/**
 * Clears development and test data before the app is handed to the hospital.
 *
 *   npm run prepare-handover            # shows what would go, changes nothing
 *   npm run prepare-handover -- --yes   # actually does it, after a backup
 *
 * Every booking, patient, payment and prescription made while building this
 * was test data — much of it carrying real names and real phone numbers of
 * real people. Handing that over would mean the hospital's live system opening
 * on a list of the developer's relatives, and under the DPDP Act it is
 * personal data being kept for no reason at all.
 *
 * WHAT IT KEEPS
 *   doctors, departments   the roster from the OP list — the real work
 *   staff                  the logins reception and doctors use
 *   doctor_contacts        the hospital's own contact numbers
 *
 * WHAT IT CLEARS
 *   everything patient-side: bookings, patients, payments, prescriptions,
 *   medical records, queue tokens, notifications, sessions and the audit log
 *
 * A backup is taken first, so a mistake here is recoverable.
 */
import { db, migrate } from '../src/db.js'
import { takeBackup } from '../src/lib/backup.js'

migrate()

const args = process.argv.slice(2)
const confirmed = args.includes('--yes')

/*
 * Children before parents: foreign keys are on, so a patient cannot go while
 * an appointment still points at them.
 */
const CLEAR = [
  'prescription_items',
  'repeat_requests',
  'prescriptions',
  'medical_records',
  'consult_sessions',
  'tokens',
  'queue_sessions',
  'payments',
  'notifications',
  'appointments',
  'otp_codes',
  'sessions',
  'patients',
  'audit_log',
  'desk_devices',
]

const KEEP = ['doctors', 'departments', 'staff', 'doctor_contacts']

const count = (table) => {
  try {
    return db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get().n
  } catch {
    return null // table does not exist in this build
  }
}

console.info('\n  Preparing for handover\n')

console.info('  WILL BE CLEARED')
let total = 0
for (const table of CLEAR) {
  const n = count(table)
  if (n === null) continue
  total += n
  console.info(`    ${table.padEnd(22)} ${String(n).padStart(5)}`)
}

console.info('\n  WILL BE KEPT')
for (const table of KEEP) {
  const n = count(table)
  if (n === null) continue
  console.info(`    ${table.padEnd(22)} ${String(n).padStart(5)}`)
}

if (total === 0) {
  console.info('\n  Nothing to clear — this database is already clean.\n')
  process.exit(0)
}

if (!confirmed) {
  console.info(`\n  ${total} rows would be deleted. Nothing has been changed.`)
  console.info('  Run it for real with:\n')
  console.info('    npm run prepare-handover -- --yes\n')
  process.exit(0)
}

console.info('\n  Backing up first…')
try {
  const { file, size } = takeBackup()
  console.info(`  Backup written: ${file} (${Math.round(size / 1024)} KB)`)
} catch (error) {
  console.error(`\n  ✖  Backup failed: ${error.message}`)
  console.error('     Refusing to delete anything without one.\n')
  process.exit(1)
}

/*
 * One transaction: either the whole clear-out happens or none of it does.
 * A half-cleared database — patients gone, their appointments still pointing
 * at them — would be worse than either end state.
 */
function clearAll() {
  db.exec('BEGIN')
  try {
    for (const table of CLEAR) {
      if (count(table) === null) continue
      db.prepare(`DELETE FROM "${table}"`).run()
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

try {
  clearAll()
} catch (error) {
  console.error(`\n  ✖  Nothing was deleted — ${error.message}\n`)
  process.exit(1)
}

// Reclaim the space so the handed-over file does not still contain the
// deleted rows in free pages.
db.exec('VACUUM')

console.info(`\n  ✓  Cleared ${total} rows. The roster and staff logins are untouched.\n`)
console.info('  Before going live, also:')
console.info('    1. Reset every staff password   npm run reset-password -- --username <name>')
console.info('       (the ones printed during development are in a terminal somewhere)')
console.info('    2. Check the roster            npm start   — it reports how many are bookable')
console.info('    3. Take a backup you keep off this machine\n')
