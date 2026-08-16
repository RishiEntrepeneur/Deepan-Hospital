/**
 * Creates a staff or admin login.
 *
 *   npm run create-staff -- --username reception --role staff
 *
 * The password is read from the STAFF_PASSWORD environment variable, or
 * generated and printed once if that is not set. It is never stored in plain
 * text and cannot be recovered afterwards.
 */
import { randomBytes } from 'node:crypto'
import { db, migrate, nowIso } from '../src/db.js'
import { hashSecret, randomSalt, uuid } from '../src/lib/crypto.js'
import { assertUsernameMatchesRole } from '../src/lib/validate.js'

migrate()

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? fallback : args[index + 1]
}

const username = String(flag('username', '')).trim().toLowerCase()
const role = String(flag('role', 'admin'))
const fullName = String(flag('name', ''))
const doctorId = flag('doctor', null)

if (!username) {
  console.error('  Usage: npm run create-staff -- --username <name> [--role staff|admin]')
  process.exit(1)
}
if (!['staff', 'admin'].includes(role)) {
  console.error('  --role must be "staff" or "admin"')
  process.exit(1)
}

const existing = db.prepare('SELECT id FROM staff WHERE username = ?').get(username)
if (existing) {
  console.error(`  A staff account named "${username}" already exists.`)
  process.exit(1)
}

const password = process.env.STAFF_PASSWORD || randomBytes(12).toString('base64url')
if (password.length < 12) {
  console.error('  STAFF_PASSWORD must be at least 12 characters.')
  process.exit(1)
}

try {
  assertUsernameMatchesRole(username, Boolean(doctorId))
} catch (error) {
  console.error(`  ${error.message}`)
  process.exit(1)
}

if (doctorId) {
  const doctor = db.prepare('SELECT id, name_en FROM doctors WHERE id = ?').get(doctorId)
  if (!doctor) {
    console.error(`  No doctor with id "${doctorId}".`)
    process.exit(1)
  }
}

const salt = randomSalt()
db.prepare(`
  INSERT INTO staff (id, username, full_name, password_hash, password_salt, role, doctor_id, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(uuid(), username, fullName, hashSecret(password, salt), salt, role, doctorId, nowIso())

console.info(`\n  Created ${role} account "${username}"${doctorId ? ` for doctor ${doctorId}` : ''}.`)
if (!process.env.STAFF_PASSWORD) {
  console.info(`  Password: ${password}`)
  console.info('  This is shown once. Store it in a password manager now.\n')
}
