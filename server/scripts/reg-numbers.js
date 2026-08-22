/**
 * Collecting the doctors' medical registration numbers.
 *
 *   npm run reg-numbers                    # what is missing, and writes a form
 *   npm run reg-numbers -- --import <file> # loads the filled-in form back
 *
 * Every consultant's qualification is shown publicly on the site. Beside a
 * qualification, a registration number is what lets a patient check the person
 * on the TNMC or TNDC register — so a site that prints one without the other
 * is asking to be trusted without offering the means to verify.
 *
 * This cannot be filled in from here. The numbers exist only in the hospital's
 * own files, and an invented or mistyped one is worse than a blank: it points
 * a patient at somebody else's entry. So the job is to make the hospital's
 * half easy — hand somebody a list, take it back, load it in one command —
 * and to refuse anything that does not look like a real number.
 */
import fs from 'node:fs'
import path from 'node:path'
import { db, migrate, nowIso } from '../src/db.js'
import { audit } from '../src/lib/audit.js'

migrate()

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? null : (args[i + 1] ?? '')
}

/*
 * Deliberately loose on shape. Councils format these differently and change
 * formats over the years — TNMC prints plain digits, dental numbers often
 * carry a state prefix — so enforcing a pattern nobody agreed on would reject
 * real numbers.
 *
 * What it does refuse is the two things that actually turn up in a filled-in
 * spreadsheet, both found by testing this script rather than by imagining it:
 * a mobile number pasted into the wrong column, and a fragment of the doctor's
 * own qualification that arrived because the row was parsed badly. Both look
 * like plausible strings; neither is a registration number, and either one
 * published beside a name points a patient at the wrong person on the register.
 */
const PLAUSIBLE = /^[A-Za-z0-9][A-Za-z0-9 /.-]{2,29}$/
const LOOKS_LIKE_A_MOBILE = /^[6-9]\d{9}$/

/** A value that is simply a piece of the qualification already on file. */
const isQualificationFragment = (value, qualification) => {
  const tidy = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '')
  const v = tidy(value)
  if (v.length < 2) return false
  return tidy(qualification ?? '')
    .split(/(?=[a-z])/)
    .join('')
    .includes(v)
}

/**
 * One CSV line into cells, respecting quotes.
 *
 * A plain split(',') was the first version and it silently corrupted ten
 * records on the first real run: qualifications contain commas ("M.D., D.M."),
 * so the name column shattered into pieces and "D.M." was written into the
 * database as somebody's medical registration number. Nothing errored. It
 * simply published a wrong number beside a real doctor's name.
 */
function cellsOf(line) {
  const cells = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { cells.push(cell.trim()); cell = '' }
    else cell += ch
  }
  cells.push(cell.trim())
  return cells
}

const doctors = db
  .prepare('SELECT id, name_en, qualification, reg_no FROM doctors WHERE active = 1 ORDER BY name_en')
  .all()

/* ---------------------------------------------------------------- import */
const importPath = flag('import')
if (importPath !== null) {
  if (!importPath) {
    console.error('\n  Give the file to read:  npm run reg-numbers -- --import doctors.csv\n')
    process.exit(1)
  }
  const rows = fs
    .readFileSync(path.resolve(importPath), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))

  const byId = new Map(doctors.map((d) => [d.id, d]))
  const update = db.prepare('UPDATE doctors SET reg_no = ?, updated_at = ? WHERE id = ?')
  let set = 0
  const skipped = []
  const rejected = []

  for (const [n, line] of rows.entries()) {
    /* id,name,registration — the name column is there for the human filling
       it in and is ignored here; the id is what identifies the row. */
    const cells = cellsOf(line)
    const id = cells[0]
    const reg = cells[2] ?? ''
    if (n === 0 && id.toLowerCase() === 'id') continue // header
    const doctor = byId.get(id)
    if (!doctor) {
      rejected.push(`${id || '(blank)'} — no active doctor with that id`)
      continue
    }
    if (!reg) {
      skipped.push(doctor.name_en)
      continue
    }
    if (LOOKS_LIKE_A_MOBILE.test(reg)) {
      rejected.push(`${doctor.name_en} — "${reg}" is a mobile number, not a registration number`)
      continue
    }
    if (isQualificationFragment(reg, doctor.qualification)) {
      rejected.push(`${doctor.name_en} — "${reg}" is part of the qualification, not a registration number`)
      continue
    }
    if (!PLAUSIBLE.test(reg)) {
      rejected.push(`${doctor.name_en} — "${reg}" does not look like a registration number`)
      continue
    }
    update.run(reg, nowIso(), id)
    audit({ actorType: 'system', action: 'doctor.reg_no_set', entity: 'doctor', entityId: id })
    set++
  }

  console.info(`\n  Saved ${set} registration number${set === 1 ? '' : 's'}.`)
  if (skipped.length) console.info(`  Left blank: ${skipped.length} (${skipped.join(', ')})`)
  if (rejected.length) {
    console.error('\n  Not saved:')
    for (const line of rejected) console.error(`    ✖  ${line}`)
  }
  const still = db.prepare('SELECT COUNT(*) c FROM doctors WHERE active = 1 AND reg_no IS NULL').get().c
  console.info(`\n  ${still} of ${doctors.length} still have none.\n`)
  process.exit(rejected.length ? 1 : 0)
}

/* ---------------------------------------------------------------- report */
const missing = doctors.filter((d) => !d.reg_no)
console.info(`\n  ${doctors.length - missing.length} of ${doctors.length} consultants have a registration number.\n`)

if (missing.length === 0) {
  console.info('  Nothing to collect.\n')
  process.exit(0)
}

const out = path.resolve('doctors-registration.csv')
const csv = [
  '# Fill in the third column from the hospital records, then run:',
  '#   npm run reg-numbers -- --import doctors-registration.csv',
  '# Leave a row blank if you do not have it yet. Do not guess.',
  'id,name,registration',
  ...missing.map((d) => `${d.id},"${d.name_en} — ${d.qualification}",`),
].join('\n')
fs.writeFileSync(out, `${csv}\n`)

for (const d of missing) console.info(`    ·  ${d.name_en}  (${d.qualification})`)
console.info(`\n  Written ${out}`)
console.info('  Give it to whoever holds the records, then import it back.\n')
