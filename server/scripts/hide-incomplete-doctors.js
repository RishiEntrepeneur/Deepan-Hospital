/**
 * Takes doctors off the public site when the hospital has not supplied a fee
 * or consulting times, and takes down any department that empties as a result.
 *
 *   npm run hide-incomplete -- --dry   show what would change
 *   npm run hide-incomplete            do it
 *   npm run hide-incomplete -- --restore   put everyone back
 *
 * HIDDEN, NOT DELETED — and this is not a technicality.
 *
 * Appointments point at a doctor by id. Deleting the row would either be
 * refused by the database or leave bookings pointing at nothing, and either
 * way a past patient's record stops making sense. `active = 0` removes them
 * from every list, every search and every booking form — the same thing a
 * visitor sees as deletion — while keeping old appointments readable and
 * making the whole thing one command to undo.
 *
 * THE DEPARTMENTS ARE THE HARD PART
 *
 * Hiding the last doctor in a department leaves the department listed with
 * nobody in it: a patient picks Cardiology, waits for a list, and gets an
 * empty page. So departments that empty are hidden too.
 *
 * That has a cost worth being clear about. The hospital genuinely has these
 * specialists — they are on the roster it supplied — they simply have not
 * given consulting hours yet. A patient who needs a cardiologist will now be
 * told Deepan Hospital does not list cardiology at all, which is not true.
 * The fix is not this script: it is getting the timings and fees, and then
 * running --restore.
 *
 * Emergency care is the sharpest case. If that department empties it is hidden
 * with the rest — but the emergency number in the header and the footer is not
 * part of the department list and stays exactly where it is, on every page.
 */
import { db, migrate, nowIso } from '../src/db.js'

migrate()

const dry = process.argv.includes('--dry')
const restore = process.argv.includes('--restore')

const say = (s = '') => console.info(s)

if (restore) {
  const doctors = db.prepare('UPDATE doctors SET active = 1, updated_at = ? WHERE active = 0').run(nowIso())
  const departments = db.prepare('UPDATE departments SET active = 1 WHERE active = 0').run()
  say(`\n  Restored ${doctors.changes} doctor(s) and ${departments.changes} department(s).\n`)
  process.exit(0)
}

/*
 * "Incomplete" means a patient could not book them even if they wanted to: no
 * price, or no hours to put a slot in. A doctor missing either one cannot
 * produce a bookable appointment, which is what being listed is for.
 */
const incomplete = db.prepare(`
  SELECT id, name_en, department_id, fee, morning_start, evening_start
  FROM doctors
  WHERE active = 1
    AND (fee IS NULL OR (morning_start IS NULL AND evening_start IS NULL))
  ORDER BY department_id, name_en
`).all()

if (incomplete.length === 0) {
  say('\n  Every listed doctor has a fee and consulting times. Nothing to do.\n')
  process.exit(0)
}

say(`\n  ${dry ? 'Would hide' : 'Hiding'} ${incomplete.length} doctor(s):\n`)
for (const d of incomplete) {
  const missing = [d.fee == null ? 'no fee' : null, !d.morning_start && !d.evening_start ? 'no timings' : null]
    .filter(Boolean).join(', ')
  say(`    ${d.name_en.padEnd(34)} ${d.department_id.padEnd(20)} ${missing}`)
}

const hiddenIds = new Set(incomplete.map((d) => d.id))
const stillStaffed = new Set(
  db.prepare('SELECT id, department_id FROM doctors WHERE active = 1').all()
    .filter((d) => !hiddenIds.has(d.id))
    .map((d) => d.department_id),
)
const emptied = db.prepare('SELECT id, name_en FROM departments WHERE active = 1').all()
  .filter((dep) => !stillStaffed.has(dep.id))

if (emptied.length) {
  say(`\n  ${dry ? 'Would also hide' : 'Also hiding'} ${emptied.length} department(s), now with nobody in them:\n`)
  for (const dep of emptied) say(`    ${dep.name_en}`)
  if (emptied.some((d) => d.id === 'emergency')) {
    say('\n    Emergency & Critical Care is one of them. The emergency phone number')
    say('    in the header and footer is separate and is NOT affected — it stays on')
    say('    every page. Only the department tile goes.')
  }
}

if (dry) {
  say('\n  (dry run — nothing changed)\n')
  process.exit(0)
}

const stamp = nowIso()
try {
  db.exec('BEGIN')
  const hideDoctor = db.prepare('UPDATE doctors SET active = 0, updated_at = ? WHERE id = ?')
  for (const d of incomplete) hideDoctor.run(stamp, d.id)
  const hideDepartment = db.prepare('UPDATE departments SET active = 0 WHERE id = ?')
  for (const dep of emptied) hideDepartment.run(dep.id)
  db.exec('COMMIT')
} catch (error) {
  db.exec('ROLLBACK')
  console.error(`\n  nothing was written — rolled back: ${error.message}\n`)
  process.exit(1)
}

const left = db.prepare('SELECT COUNT(*) c FROM doctors WHERE active = 1').get().c
const deps = db.prepare('SELECT COUNT(*) c FROM departments WHERE active = 1').get().c
say(`\n  Done. The site now lists ${left} doctor(s) across ${deps} department(s).`)
say('  Nothing was deleted — every hidden row is still there, and past')
say('  appointments still read correctly.')
say('\n  When the hospital supplies the missing fees and timings, put them back with:')
say('      npm run hide-incomplete -- --restore\n')
