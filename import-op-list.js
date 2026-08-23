/**
 * Applies the hospital's OP list — consulting hours, days and fees.
 *
 *   npm run import-op-list -- --dry   show what would change
 *   npm run import-op-list            write it
 *
 * The data is transcribed from "DR'S OP LIST.xlsx" rather than read from it:
 * the spreadsheet is a working document that gets re-saved and re-ordered, and
 * a script that parses it would break silently the next time somebody inserts
 * a column. Transcribed values are reviewable in a diff; a parser's output is
 * not.
 *
 * Times are converted to 24-hour on the OPD reading of the sheet: the MOR
 * column is morning through early afternoon (so "9 TO 2" is 09:00–14:00), and
 * the EVG column is afternoon through evening (so "6 TO 7.30" is 18:00–19:30).
 *
 * Fees are stored as the CONSULTATION only. The case-sheet charge — ₹50 for a
 * first visit, ₹20 for a review — is added by the server at booking, which is
 * why the sheet's "250+50" appears here as 250.
 */
import { db, nowIso } from '../src/db.js'

/* Days: 0 = Sunday. Most of the roster consults Monday to Saturday. */
const MON_SAT = [1, 2, 3, 4, 5, 6]

const ROWS = [
  {
    id: 'nithya',
    sheet: 'DR. NITHYA A (psy)',
    days: [2, 5], // Tue, Fri
    morning: null,
    evening: null, // "4PM (Appointment only)" — no bookable window
    fee: null, // "Dr. Told" — fee not settled, so nothing is published
    feeReview: null,
    // 'pending' is this schema's callback-only state; the CHECK constraint
    // allows only live | pending | offline.
    mode: 'pending',
    note: 'appointment only, fee to be confirmed with the doctor',
  },
  {
    id: 'narmadha-s',
    sheet: 'DR. S. NARMADHA M.D., DVL.,',
    days: [3, 6], // Wed, Sat
    morning: null,
    evening: ['16:00', '18:00'],
    fee: 200,
    feeReview: null,
    mode: 'live',
  },
  {
    id: 'deepan-g',
    sheet: 'DR.G.DEEPAN, M.S.(ORTHO)',
    days: MON_SAT,
    morning: ['09:00', '14:00'],
    evening: ['18:00', '19:30'],
    fee: 250,
    feeReview: null,
    mode: 'live',
  },
  {
    id: 'kawin-g',
    sheet: 'DR.G.KAWIN, MD DM (NEPHRO)',
    days: MON_SAT,
    morning: ['10:30', '14:00'],
    evening: ['18:00', '19:00'],
    fee: 250,
    feeReview: 200,
    mode: 'live',
  },
  {
    id: 'krishnasamy-kannan',
    sheet: 'DR.KRISHNASAMY KANNAN, M.S., M.Ch.(UROLOGY)',
    days: MON_SAT,
    morning: null,
    evening: ['12:00', '14:30'],
    fee: 600,
    feeReview: null,
    mode: 'live',
  },
  {
    id: 'venkateswaran-n',
    sheet: 'DR.N.VENKATESWARAN, MD.,',
    days: MON_SAT,
    morning: ['11:00', '15:00'],
    evening: ['19:00', '20:30'],
    fee: 300,
    feeReview: 280,
    mode: 'live',
  },
  {
    id: 'rajagopal-p',
    sheet: 'DR.P.RAJAGOPAL, MS.,',
    days: [1, 3, 6], // Mon, Wed, Sat
    morning: null,
    evening: ['18:00', '19:30'],
    fee: 200,
    feeReview: null,
    mode: 'live',
  },
  {
    id: 'gunasekaran-r',
    sheet: 'DR.R.GUNASEKARAN, MD., FICP., FRCP(G).,',
    days: MON_SAT,
    morning: ['09:00', '14:00'],
    evening: ['18:00', '19:30'],
    fee: 400,
    feeReview: 280,
    mode: 'live',
  },
  {
    id: 'hari-prasad',
    sheet: 'DR.R.HARIPRASAD, M.S.(ENT)',
    days: MON_SAT,
    morning: ['09:00', '11:00'],
    evening: ['18:00', '19:30'],
    fee: 200,
    feeReview: null,
    mode: 'live',
  },
  {
    id: 'vaishnavi-rm',
    sheet: 'DR.R.M.VAISHNAVI, M.S.(GENERAL SURGERY)',
    days: MON_SAT,
    morning: ['12:00', '14:00'],
    evening: null,
    fee: 200,
    feeReview: null,
    mode: 'live',
  },
  {
    id: 'priyanka-v',
    sheet: 'DR.V.PRIYANKA DEEPAN, DGO., FMAS',
    days: MON_SAT,
    morning: ['12:30', '14:00'],
    evening: ['18:00', '19:00'],
    fee: 250,
    feeReview: 200,
    mode: 'live',
  },
]

/** On the sheet but not on the roster — reported, never invented. */
const NOT_IN_APP = [
  'DR.DEBORAH ROSELIN',
  'DR.DEVIKA SUDHAGER MBBS DGO',
  'DR.G.BHARANI DHARAN M.S., M.Ch.',
  'DR.G.K.S.SUDHAGER SUNDARARAJAN MD',
  'DR.NEETHU MBBS, DCH',
  'DR.NITHYA DURAISAMY MBBS, DCH, DNB(PAED)',
  'DR.P.NIVEDHA MD',
]

const dry = process.argv.includes('--dry')

const read = db.prepare(
  'SELECT id, name_en, days, morning_start, morning_end, evening_start, evening_end, fee, fee_review, booking_mode FROM doctors WHERE id = ?',
)
const write = db.prepare(`
  UPDATE doctors SET
    days = ?, morning_start = ?, morning_end = ?, evening_start = ?, evening_end = ?,
    fee = ?, fee_review = ?, booking_mode = ?, updated_at = ?
  WHERE id = ?
`)

const show = (row) =>
  [
    row.days ? JSON.parse(row.days).join('') : '-',
    row.morning_start ? `${row.morning_start}-${row.morning_end}` : 'no morning',
    row.evening_start ? `${row.evening_start}-${row.evening_end}` : 'no evening',
    row.fee == null ? 'no fee' : `₹${row.fee}${row.fee_review != null ? `/₹${row.fee_review}` : ''}`,
    row.booking_mode,
  ].join('  ')

let changed = 0
const missing = []

/*
 * One transaction for the whole roster. A failure halfway through — a bad
 * value, a constraint — would otherwise leave some doctors on the new hours
 * and some on the old, which is worse than not having run it at all.
 */
if (!dry) db.exec('BEGIN IMMEDIATE')
try {
for (const entry of ROWS) {
  const before = read.get(entry.id)
  if (!before) {
    missing.push(entry.id)
    continue
  }

  const after = {
    days: JSON.stringify(entry.days),
    morning_start: entry.morning?.[0] ?? null,
    morning_end: entry.morning?.[1] ?? null,
    evening_start: entry.evening?.[0] ?? null,
    evening_end: entry.evening?.[1] ?? null,
    fee: entry.fee,
    fee_review: entry.feeReview,
    booking_mode: entry.mode,
  }

  console.log(`\n  ${before.name_en}   ${entry.note ? `(${entry.note})` : ''}`)
  console.log(`    was  ${show(before)}`)
  console.log(`    now  ${show({ ...after, name_en: before.name_en })}`)

  if (!dry) {
    write.run(
      after.days,
      after.morning_start,
      after.morning_end,
      after.evening_start,
      after.evening_end,
      after.fee,
      after.fee_review,
      after.booking_mode,
      nowIso(),
      entry.id,
    )
  }
  changed += 1
}
  if (!dry) db.exec('COMMIT')
} catch (error) {
  if (!dry) db.exec('ROLLBACK')
  console.error('\n  nothing was written — rolled back:', error.message)
  process.exit(1)
}

console.log()
if (missing.length) console.warn(`  ? not found on the roster: ${missing.join(', ')}`)
console.log(`  ${dry ? 'would update' : 'updated'} ${changed} doctor(s)`)
console.log(`\n  On the sheet but NOT in the app (${NOT_IN_APP.length}) — each needs a department before it can be added:`)
for (const name of NOT_IN_APP) console.log(`    ${name}`)
if (dry) console.log('\n  (dry run — nothing changed)')
console.log()
