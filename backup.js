/**
 * Consistent snapshot of the database.
 *
 * VACUUM INTO takes a proper copy even while the server is running and mid
 * write — unlike `cp`, which can capture a torn WAL. This file is the entire
 * patient record; schedule it off-machine.
 *
 *   npm run backup                     -> ./backups/deepan-<timestamp>.db
 *   npm run backup -- /path/to/dir
 */
import fs from 'node:fs'
import path from 'node:path'
import { db } from '../src/db.js'
import { config } from '../src/config.js'

const target = process.argv[2] ?? path.join(path.dirname(config.databaseFile), '..', 'backups')
fs.mkdirSync(target, { recursive: true })

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const file = path.join(target, `deepan-${stamp}.db`)

db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`)

const { size } = fs.statSync(file)
console.info(`  Backup written: ${file} (${(size / 1024).toFixed(0)} KB)`)
console.info('  This is the whole patient record. Copy it somewhere off this machine.')
