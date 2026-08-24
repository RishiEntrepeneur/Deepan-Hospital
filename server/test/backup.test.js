/**
 * Backups.
 *
 * The question these answer is not "did a file appear" but "could the hospital
 * actually come back from this" — so the tests check that the snapshot holds
 * the appointments, that the patients' uploaded files came with it, and that a
 * file deleted by retention does not linger in the backup afterwards.
 */
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

let workdir

before(() => {
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'deepan-backup-'))
  process.env.DATABASE_FILE = path.join(workdir, 'test.db')
  process.env.UPLOAD_DIR = path.join(workdir, 'uploads')
  process.env.BACKUP_DIR = path.join(workdir, 'backups')
  process.env.BACKUP_ENABLED = 'false'
})

after(() => {
  if (workdir) fs.rmSync(workdir, { recursive: true, force: true })
})

describe('backups', () => {
  it('captures the database and the files patients uploaded', async () => {
    const { migrate } = await import('../src/db.js')
    const { takeBackup } = await import('../src/lib/backup.js')
    migrate()

    // Two uploaded files, as the attachment routes would have written them.
    fs.mkdirSync(process.env.UPLOAD_DIR, { recursive: true })
    fs.writeFileSync(path.join(process.env.UPLOAD_DIR, 'a.jpg'), 'first photograph')
    fs.writeFileSync(path.join(process.env.UPLOAD_DIR, 'b.pdf'), 'a lab report')

    const first = takeBackup()
    assert.equal(first.files.total, 2, 'the uploads were not counted')
    assert.equal(first.files.copied, 2, 'the uploads were not copied')

    // The snapshot must be a readable database, not just bytes on disk.
    const restored = new DatabaseSync(first.file, { readOnly: true })
    try {
      const check = restored.prepare('PRAGMA integrity_check').get()
      assert.equal(Object.values(check)[0], 'ok')
      // A table that only exists if the schema really came across.
      const columns = restored.prepare('SELECT name FROM pragma_table_info(?)').all('attachments')
      assert.ok(columns.length > 0, 'the attachments table did not survive')
    } finally {
      restored.close()
    }

    // And the bytes themselves are there, unchanged.
    const mirrored = path.join(process.env.BACKUP_DIR, 'files')
    assert.equal(fs.readFileSync(path.join(mirrored, 'a.jpg'), 'utf8'), 'first photograph')
    assert.equal(fs.readFileSync(path.join(mirrored, 'b.pdf'), 'utf8'), 'a lab report')
  })

  it('copies only what is new on the next run', async () => {
    const { takeBackup } = await import('../src/lib/backup.js')
    fs.writeFileSync(path.join(process.env.UPLOAD_DIR, 'c.jpg'), 'third')

    const second = takeBackup()
    assert.equal(second.files.copied, 1, 'it re-copied files it already had')
    assert.equal(second.files.total, 3)
  })

  it('drops a file from the backup once retention has deleted it', async () => {
    const { takeBackup } = await import('../src/lib/backup.js')
    // What erasure or the orphan sweep does: the file leaves the live folder.
    fs.rmSync(path.join(process.env.UPLOAD_DIR, 'a.jpg'))

    const third = takeBackup()
    assert.equal(third.files.removed, 1, 'the deleted file stayed in the backup')

    const mirrored = path.join(process.env.BACKUP_DIR, 'files')
    assert.equal(
      fs.existsSync(path.join(mirrored, 'a.jpg')),
      false,
      'a patient’s erased photograph survived in the backup',
    )
    assert.ok(fs.existsSync(path.join(mirrored, 'b.pdf')), 'it removed the wrong file')
  })
})
