/**
 * Sets a new password for an existing staff or doctor account.
 *
 *   npm run reset-password -- --username doctordeepan
 *   STAFF_PASSWORD='choose-your-own' npm run reset-password -- --username admin
 *
 * Passwords are stored as salted scrypt hashes, so a forgotten one cannot be
 * looked up, recovered or emailed — by anyone, including whoever runs the
 * server. Setting a new one is the only way back in, which is why this script
 * exists: without it, a doctor who forgets their password is locked out of the
 * app permanently and the only fix is deleting and recreating their account.
 *
 * Every existing session for that account is ended too. A password reset that
 * leaves an old browser signed in has not actually secured anything.
 */
import { randomBytes } from 'node:crypto'
import { db, migrate } from '../src/db.js'
import { hashSecret, randomSalt } from '../src/lib/crypto.js'
import { audit } from '../src/lib/audit.js'

migrate()

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? fallback : args[index + 1]
}

const username = String(flag('username', '')).trim().toLowerCase()

if (!username) {
  console.error('\n  Usage: npm run reset-password -- --username <name>\n')
  const all = db.prepare('SELECT username, role, doctor_id FROM staff ORDER BY username').all()
  if (all.length) {
    console.error('  Accounts on this server:')
    for (const row of all) {
      console.error(`    ${row.username}  (${row.role}${row.doctor_id ? `, ${row.doctor_id}` : ''})`)
    }
    console.error('')
  }
  process.exit(1)
}

const staff = db.prepare('SELECT id, username, role, doctor_id FROM staff WHERE username = ?').get(username)
if (!staff) {
  console.error(`\n  No account named "${username}".\n`)
  process.exit(1)
}

const password = process.env.STAFF_PASSWORD || randomBytes(12).toString('base64url')
if (password.length < 12) {
  console.error('\n  STAFF_PASSWORD must be at least 12 characters.\n')
  process.exit(1)
}

const salt = randomSalt()
db.prepare('UPDATE staff SET password_hash = ?, password_salt = ? WHERE id = ?').run(
  hashSecret(password, salt),
  salt,
  staff.id,
)

// Anything signed in with the old password is signed out.
const ended = db
  .prepare("DELETE FROM sessions WHERE subject_id = ? AND subject_type = 'staff'")
  .run(staff.id)

audit({
  action: 'staff.password_reset',
  entity: 'staff',
  entityId: staff.id,
  detail: { username, sessionsEnded: Number(ended.changes) },
})

console.info(`\n  Password reset for "${staff.username}"${staff.doctor_id ? ` (${staff.doctor_id})` : ''}.`)
if (Number(ended.changes) > 0) {
  console.info(`  ${ended.changes} existing session${ended.changes === 1 ? '' : 's'} signed out.`)
}
if (!process.env.STAFF_PASSWORD) {
  console.info(`  Password: ${password}`)
  console.info('  This is shown once. Store it in a password manager now.\n')
} else {
  console.info('  Using the password from STAFF_PASSWORD.\n')
}
