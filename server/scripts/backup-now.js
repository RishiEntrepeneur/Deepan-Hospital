/**
 * Take a backup right now, without waiting for the six-hourly one.
 *
 *   npm run backup:now
 *
 * Worth running before anything you would rather be able to undo — a bulk
 * import, a schedule change across every doctor, an upgrade. It writes the same
 * snapshot the automatic job does, verifies it can be read back, and copies any
 * new patient uploads alongside it.
 */
import { takeBackup } from '../src/lib/backup.js'

try {
  const { file, size, files } = takeBackup()
  console.info('\n  Backup taken\n')
  console.info(`    snapshot   ${file}`)
  console.info(`    size       ${Math.round(size / 1024)} KB`)
  console.info(`    files      ${files.total} uploaded (${files.copied} new this run)`)
  console.info('\n  This is on the same machine as the database it protects.')
  console.info('  Copy it somewhere else too:  npm run backup:offsite\n')
} catch (error) {
  console.error(`\n  ✖  Backup failed: ${error.message}\n`)
  process.exit(1)
}
