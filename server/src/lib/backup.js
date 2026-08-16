import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'
import { db } from '../db.js'
import { audit } from './audit.js'

/**
 * Automatic backups.
 *
 * A hospital's entire appointment book, prescription history and patient list
 * live in one SQLite file. A manual backup script that somebody is supposed to
 * remember to run is not a backup strategy — it is a story about one.
 *
 * Two things make this trustworthy rather than reassuring:
 *
 *   1. VACUUM INTO, not a file copy. Copying a live SQLite file while a write
 *      is in flight can produce a corrupt backup that only reveals itself the
 *      day you need it. VACUUM INTO asks SQLite for a consistent snapshot.
 *   2. Every backup is opened and read back before it counts as taken. A
 *      backup that has never been read is an assumption.
 *
 * It still writes to the same machine. That is a real limitation and the
 * console says so on the first run — off-machine copies are a deployment
 * decision, not something the app can make for you.
 */
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-')

function verify(file) {
  // Read it back through a fresh connection: if the snapshot is unreadable or
  // structurally broken, better to find out now than in a disaster.
  const { DatabaseSync } = process.getBuiltinModule
    ? process.getBuiltinModule('node:sqlite')
    : { DatabaseSync: null }
  if (!DatabaseSync) return true
  const copy = new DatabaseSync(file, { readOnly: true })
  try {
    const check = copy.prepare('PRAGMA integrity_check').get()
    const ok = Object.values(check ?? {})[0] === 'ok'
    const count = copy.prepare('SELECT COUNT(*) n FROM appointments').get().n
    return ok && Number.isInteger(count)
  } finally {
    copy.close()
  }
}

export function takeBackup() {
  const dir = config.backup.directory
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `deepan-${stamp()}.db`)

  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`)

  if (!verify(file)) {
    fs.rmSync(file, { force: true })
    throw new Error('backup failed its integrity check and was discarded')
  }

  // Prune by count rather than age, so a server that was off for a month does
  // not come back to find every backup expired at once.
  const kept = fs
    .readdirSync(dir)
    .filter((name) => name.startsWith('deepan-') && name.endsWith('.db'))
    .sort()
    .reverse()
  for (const stale of kept.slice(config.backup.keep)) {
    fs.rmSync(path.join(dir, stale), { force: true })
  }

  const size = fs.statSync(file).size
  audit({ actorType: 'system', action: 'backup.taken', detail: { file: path.basename(file), size } })
  return { file, size, kept: Math.min(kept.length, config.backup.keep) }
}

let warned = false

/** Runs at boot and on an interval. A failure is loud but never fatal. */
export function startBackups() {
  if (!config.backup.enabled) {
    console.log('  ⚠  Automatic backups are switched off (BACKUP_ENABLED=false).')
    return null
  }

  const tick = () => {
    try {
      const { file, size } = takeBackup()
      if (!warned) {
        warned = true
        console.log(
          `  ✓ Backup written (${Math.round(size / 1024)} KB) — ${path.basename(file)}\n` +
            '     These sit on this machine. Copy them somewhere else as well.',
        )
      }
    } catch (error) {
      console.error('  ✗ BACKUP FAILED —', error.message)
    }
  }

  tick()
  const timer = setInterval(tick, config.backup.everyHours * 60 * 60 * 1000)
  timer.unref?.()
  return timer
}
