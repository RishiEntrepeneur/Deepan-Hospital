/**
 * Adds the seven doctors who are on the hospital's OP list but were never in
 * the app, with the departments the hospital supplied.
 *
 *   npm run add-op-doctors -- --dry   show what would be created
 *   npm run add-op-doctors            create them
 *
 * Idempotent: a doctor whose id already exists is left alone, so re-running
 * after a partial failure is safe.
 *
 * What is deliberately left EMPTY rather than guessed:
 *
 *   - **Room numbers.** Not on the sheet. A wrong room sends a patient to the
 *     wrong door, which is worse than no room at all.
 *   - **Registration numbers.** Shown publicly and checkable against the Tamil
 *     Nadu Medical Council register — never invent one.
 *   - **Experience, and the "about" text.** Not on the sheet.
 *
 * Languages default to Tamil and English, matching the rest of the roster; the
 * desk can correct any of this in Schedules afterwards.
 */
import { db, nowIso } from '../src/db.js'

const MON_SAT = [1, 2, 3, 4, 5, 6]

const DOCTORS = [
  {
    id: 'deborah-roselin',
    department: 'dermatology',
    name: { en: 'Dr. Deborah Roselin', ta: 'டாக்டர் தெபோரா ரோஸ்லின்', hi: 'डॉ. देबोरा रोज़लिन' },
    spec: { en: 'Dermatologist', ta: 'தோல் நோய் நிபுணர்', hi: 'त्वचा रोग विशेषज्ञ' },
    qualification: '',
    days: MON_SAT,
    morning: ['10:00', '12:00'],
    evening: null,
    fee: 200,
    feeReview: null,
    mode: 'live',
  },
  {
    id: 'devika-sudhager',
    department: 'gynecology',
    name: { en: 'Dr. Devika Sudhager', ta: 'டாக்டர் தேவிகா சுதாகர்', hi: 'डॉ. देविका सुधाकर' },
    spec: { en: 'Obstetrician & Gynaecologist', ta: 'மகப்பேறு மற்றும் மகளிர் நோய் நிபுணர்', hi: 'प्रसूति एवं स्त्री रोग विशेषज्ञ' },
    qualification: 'MBBS, DGO',
    days: MON_SAT,
    morning: ['10:00', '12:00'],
    evening: null,
    fee: 300,
    feeReview: null,
    mode: 'live',
  },
  {
    id: 'bharani-dharan-g',
    department: 'pediatric-surgery',
    name: { en: 'Dr. G. Bharani Dharan', ta: 'டாக்டர் கோ. பரணி தரன்', hi: 'डॉ. गो. भरणी धरन' },
    spec: { en: 'Paediatric Surgeon', ta: 'குழந்தைகள் அறுவை சிகிச்சை நிபுணர்', hi: 'बाल शल्य चिकित्सक' },
    qualification: 'M.S., M.Ch.',
    days: MON_SAT,
    morning: null,
    evening: null, // "Appointment only" — no window to publish
    fee: 300,
    feeReview: null,
    mode: 'pending',
    note: 'appointment only — reception arranges the time',
  },
  {
    id: 'sudhager-sundararajan-gks',
    department: 'general-medicine',
    name: { en: 'Dr. G.K.S. Sudhager Sundararajan', ta: 'டாக்டர் கோ.கே.எஸ். சுதாகர் சுந்தரராஜன்', hi: 'डॉ. जी.के.एस. सुधाकर सुंदरराजन' },
    spec: { en: 'General Physician', ta: 'பொது மருத்துவர்', hi: 'सामान्य चिकित्सक' },
    qualification: 'M.D.',
    days: MON_SAT,
    morning: ['10:00', '12:00'],
    evening: null,
    fee: 400,
    feeReview: null,
    mode: 'live',
  },
  {
    id: 'neethu',
    department: 'pediatrics',
    name: { en: 'Dr. Neethu', ta: 'டாக்டர் நீது', hi: 'डॉ. नीतू' },
    spec: { en: 'Paediatrician', ta: 'குழந்தைகள் நல மருத்துவர்', hi: 'बाल रोग विशेषज्ञ' },
    qualification: 'MBBS, DCH',
    days: MON_SAT,
    morning: ['11:00', '15:00'],
    evening: ['19:00', '20:30'],
    fee: 300,
    feeReview: 280,
    mode: 'live',
  },
  {
    id: 'nithya-duraisamy',
    department: 'pediatrics',
    name: { en: 'Dr. Nithya Duraisamy', ta: 'டாக்டர் நித்யா துரைசாமி', hi: 'डॉ. नित्या दुरैसामी' },
    spec: { en: 'Paediatrician', ta: 'குழந்தைகள் நல மருத்துவர்', hi: 'बाल रोग विशेषज्ञ' },
    qualification: 'MBBS, DCH, DNB (Paed)',
    days: [2, 4], // Tue, Thu
    morning: ['11:00', '13:30'],
    evening: null,
    fee: null, // "Dr. Told" — fee not settled
    feeReview: null,
    mode: 'pending',
    note: 'fee to be confirmed with the doctor',
  },
  {
    id: 'nivedha-p',
    department: 'general-medicine',
    name: { en: 'Dr. P. Nivedha', ta: 'டாக்டர் ப. நிவேதா', hi: 'डॉ. प. निवेदा' },
    spec: { en: 'General Physician', ta: 'பொது மருத்துவர்', hi: 'सामान्य चिकित्सक' },
    qualification: 'M.D.',
    days: MON_SAT,
    morning: null,
    evening: ['17:00', '19:30'],
    fee: 250,
    feeReview: 230,
    mode: 'live',
  },
]

const dry = process.argv.includes('--dry')

const exists = db.prepare('SELECT id FROM doctors WHERE id = ?')
const departmentExists = db.prepare('SELECT id FROM departments WHERE id = ?')
const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), 100) AS n FROM doctors').get().n

const insert = db.prepare(`
  INSERT INTO doctors (
    id, department_id, name_en, name_ta, name_hi, grade, spec_en, spec_ta, spec_hi,
    qualification, reg_no, experience, fee, fee_review, room, languages, days,
    morning_start, morning_end, evening_start, evening_end,
    booking_mode, featured, active, sort_order, about_en, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

let created = 0
let skipped = 0
const problems = []

if (!dry) db.exec('BEGIN IMMEDIATE')
try {
  let sort = maxSort
  for (const d of DOCTORS) {
    if (!departmentExists.get(d.department)) {
      problems.push(`${d.id}: no such department "${d.department}"`)
      continue
    }
    if (exists.get(d.id)) {
      console.log(`  already present, left alone: ${d.name.en}`)
      skipped += 1
      continue
    }

    sort += 10
    const hours = [
      d.morning ? `${d.morning[0]}-${d.morning[1]}` : null,
      d.evening ? `${d.evening[0]}-${d.evening[1]}` : null,
    ]
      .filter(Boolean)
      .join(', ') || 'no published window'
    const fee = d.fee == null ? 'no fee' : `₹${d.fee}${d.feeReview != null ? ` / ₹${d.feeReview}` : ''}`

    console.log(`\n  ${d.name.en}`)
    console.log(`    ${d.department}  ·  ${hours}  ·  ${fee}  ·  ${d.mode}${d.note ? `  (${d.note})` : ''}`)

    if (!dry) {
      insert.run(
        d.id, d.department, d.name.en, d.name.ta, d.name.hi, 'consultant',
        d.spec.en, d.spec.ta, d.spec.hi, d.qualification,
        null, null, d.fee, d.feeReview, null, JSON.stringify(['ta', 'en']),
        JSON.stringify(d.days),
        d.morning?.[0] ?? null, d.morning?.[1] ?? null,
        d.evening?.[0] ?? null, d.evening?.[1] ?? null,
        d.mode, 0, 1, sort, '', nowIso(), nowIso(),
      )
    }
    created += 1
  }
  if (!dry) db.exec('COMMIT')
} catch (error) {
  if (!dry) db.exec('ROLLBACK')
  console.error(`\n  nothing was written — rolled back: ${error.message}`)
  process.exit(1)
}

console.log()
for (const p of problems) console.warn(`  ? ${p}`)
console.log(`  ${dry ? 'would create' : 'created'} ${created}; ${skipped} already present`)
console.log('  Room numbers and registration numbers are left blank — set them in Desk → Schedules.')
if (dry) console.log('\n  (dry run — nothing changed)')
console.log()
