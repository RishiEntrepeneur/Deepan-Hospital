/**
 * A one-glance count of what is in the hospital's database.
 *
 *   npm run stats
 *
 * Answers the everyday questions — how many people have signed up, how many
 * appointments there are, how busy today is — without opening the database or
 * writing a query. Read-only: it counts, it never changes anything.
 */
import { db, migrate } from '../src/db.js'
import { todayKey } from '../src/lib/slots.js'

migrate()

const count = (sql, ...params) => Number(db.prepare(sql).get(...params)?.n ?? 0)
const today = todayKey()

// A "registered" patient set a password; the rest booked as guests. Both are
// real people the hospital can reach — worth seeing apart.
const patientsTotal = count('SELECT COUNT(*) n FROM patients WHERE erased_at IS NULL')
const patientsWithAccount = count(
  "SELECT COUNT(*) n FROM patients WHERE erased_at IS NULL AND password_hash IS NOT NULL AND password_hash != ''",
)
const patientsGuest = patientsTotal - patientsWithAccount

const apptTotal = count('SELECT COUNT(*) n FROM appointments')
const apptUpcoming = count(
  "SELECT COUNT(*) n FROM appointments WHERE date >= ? AND status IN ('pending','confirmed')",
  today,
)
const apptToday = count(
  "SELECT COUNT(*) n FROM appointments WHERE date = ? AND status != 'cancelled'",
  today,
)
const apptPending = count("SELECT COUNT(*) n FROM appointments WHERE status = 'pending'")
const apptCallbacks = count("SELECT COUNT(*) n FROM appointments WHERE status = 'requested'")

const doctorsActive = count('SELECT COUNT(*) n FROM doctors WHERE active = 1')
const departments = count('SELECT COUNT(*) n FROM departments')
const staffAccounts = count('SELECT COUNT(*) n FROM staff WHERE doctor_id IS NULL')
const doctorLogins = count('SELECT COUNT(*) n FROM staff WHERE doctor_id IS NOT NULL')

const reviewsApproved = count("SELECT COUNT(*) n FROM reviews WHERE status = 'approved'")
const reviewsPending = count("SELECT COUNT(*) n FROM reviews WHERE status = 'pending'")
const avgRating = db.prepare("SELECT AVG(rating) a FROM reviews WHERE status = 'approved'").get()?.a

const line = (label, value) => console.info(`    ${String(label).padEnd(26)} ${value}`)
const rule = () => console.info('')

console.info('\n  Deepan Hospital — by the numbers\n')

console.info('  People')
line('Patients (total)', patientsTotal)
line('  with an account', patientsWithAccount)
line('  booked as guest', patientsGuest)
rule()

console.info('  Appointments')
line('All time', apptTotal)
line('Upcoming', apptUpcoming)
line('Today', apptToday)
line('Waiting for approval', apptPending)
line('Call-back requests', apptCallbacks)
rule()

console.info('  Hospital')
line('Active doctors', doctorsActive)
line('Departments', departments)
line('Desk / manager logins', staffAccounts)
line('Doctor logins', doctorLogins)
rule()

console.info('  Reviews')
line('Published', reviewsApproved)
line('Waiting to approve', reviewsPending)
line('Average rating', avgRating != null ? `${(Math.round(avgRating * 10) / 10).toFixed(1)} / 5` : '—')

console.info(`\n  There is no cap on sign-ups. As of ${today}.\n`)
