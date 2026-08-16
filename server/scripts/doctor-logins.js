/**
 * Creates a login for every doctor on the roster, in one pass.
 *
 *   npm run doctor-logins              # only doctors who have no login yet
 *   npm run doctor-logins -- --reset   # also give existing accounts a new password
 *
 * Onboarding 25 consultants one `create-staff` at a time is the kind of chore
 * that gets abandoned halfway, leaving most of the roster unable to sign in.
 *
 * Every password is random and shown exactly once. They are stored as salted
 * scrypt hashes, so nothing here can be recovered afterwards — if you lose the
 * output, run `npm run reset-password -- --username <name>` for that account
 * rather than trying to look it up.
 *
 * Usernames follow the convention enforced at sign-in: a doctor account starts
 * with "doctor". `deepan-g` becomes `doctordeepan-g`.
 */
import { randomBytes } from 'node:crypto'
import { db, migrate, nowIso } from '../src/db.js'
import { hashSecret, randomSalt, uuid } from '../src/lib/crypto.js'
import { audit } from '../src/lib/audit.js'
import { DOCTOR_USERNAME } from '../src/lib/validate.js'

migrate()

const args = process.argv.slice(2)
const resetExisting = args.includes('--reset')

const doctors = db.prepare('SELECT id, name_en FROM doctors WHERE active = 1 ORDER BY name_en').all()
if (doctors.length === 0) {
  console.error('\n  No active doctors. Run `npm run seed` first.\n')
  process.exit(1)
}

const findStaff = db.prepare('SELECT id, username FROM staff WHERE doctor_id = ?')
const byUsername = db.prepare('SELECT id FROM staff WHERE username = ?')
const insert = db.prepare(`
  INSERT INTO staff (id, username, full_name, password_hash, password_salt, role, doctor_id, created_at)
  VALUES (?, ?, ?, ?, ?, 'staff', ?, ?)
`)
const update = db.prepare('UPDATE staff SET password_hash = ?, password_salt = ? WHERE id = ?')
const endSessions = db.prepare("DELETE FROM sessions WHERE subject_id = ? AND subject_type = 'staff'")

const created = []
const reset = []
const skipped = []

for (const doctor of doctors) {
  const existing = findStaff.get(doctor.id)
  const username = existing?.username ?? `doctor${doctor.id}`

  if (existing && !resetExisting) {
    skipped.push({ doctor: doctor.name_en, username })
    continue
  }

  // The convention is checked here rather than assumed, so a doctor id that
  // cannot make a valid username is reported instead of failing at sign-in.
  if (!DOCTOR_USERNAME.test(username)) {
    console.error(`  ✗ ${doctor.name_en}: "${username}" is not a usable username — create this one by hand.`)
    continue
  }
  if (!existing && byUsername.get(username)) {
    console.error(`  ✗ ${doctor.name_en}: the username "${username}" is taken by another account.`)
    continue
  }

  const password = randomBytes(12).toString('base64url')
  const salt = randomSalt()

  if (existing) {
    update.run(hashSecret(password, salt), salt, existing.id)
    endSessions.run(existing.id)
    audit({ action: 'staff.password_reset', entity: 'staff', entityId: existing.id, detail: { username } })
    reset.push({ doctor: doctor.name_en, username, password })
  } else {
    const id = uuid()
    insert.run(id, username, doctor.name_en, hashSecret(password, salt), salt, doctor.id, nowIso())
    audit({ action: 'staff.created', entity: 'staff', entityId: id, detail: { username, doctorId: doctor.id } })
    created.push({ doctor: doctor.name_en, username, password })
  }
}

const show = (rows, heading) => {
  if (rows.length === 0) return
  console.info(`\n  ${heading}\n`)
  const width = Math.max(...rows.map((r) => r.username.length))
  for (const row of rows) {
    console.info(`    ${row.username.padEnd(width)}   ${row.password}   ${row.doctor}`)
  }
}

show(created, `Created ${created.length} new doctor login${created.length === 1 ? '' : 's'}:`)
show(reset, `Reset ${reset.length} existing login${reset.length === 1 ? '' : 's'}:`)

if (skipped.length) {
  console.info(`\n  ${skipped.length} already had a login and were left alone:`)
  console.info(`    ${skipped.map((s) => s.username).join(', ')}`)
  console.info('    Re-run with --reset to give these new passwords too.')
}

if (created.length || reset.length) {
  console.info(
    '\n  ⚠  These passwords are shown ONCE. Copy them somewhere safe now.\n' +
      '     Give each doctor their own line and nobody else’s.\n',
  )
}
