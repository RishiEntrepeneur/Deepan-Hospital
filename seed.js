/**
 * Seeds departments and the consulting roster.
 *
 * IMPORTANT — what this file does and does not contain.
 *
 * Doctor names, qualifications and designations are the hospital's own supplied
 * list and are reproduced as given. Registration numbers, consultation fees,
 * consulting days, timings and room numbers are NOT included, because they were
 * not supplied: inventing any of them for a real, named doctor would put a
 * false credential or a wrong clinic time in front of a patient.
 *
 * Every doctor is therefore seeded with booking_mode = 'pending', which lists
 * them and lets patients request a callback. Fill in the real schedule and fee
 * through the admin API and the doctor becomes bookable automatically.
 *
 * Run:  npm run seed          (adds missing rows, leaves edits alone)
 *       npm run seed -- --reset   (wipes doctors and departments first)
 */
import { db, migrate, nowIso, transaction } from '../src/db.js'

migrate()

const reset = process.argv.includes('--reset')

/* ------------------------------------------------------------------ *
 * Departments — derived from the specialities present in the roster.
 * ------------------------------------------------------------------ */
const DEPARTMENTS = [
  ['emergency', 'Emergency & Critical Care', 'அவசர மற்றும் தீவிர சிகிச்சை', 'Ambulance', 10,
    'Casualty, intensive care and anaesthesia cover, round the clock.',
    'அவசர பிரிவு, தீவிர சிகிச்சை மற்றும் மயக்க மருந்து சேவை — இரவு பகல்.'],
  ['general-medicine', 'General Medicine', 'பொது மருத்துவம்', 'Stethoscope', 20,
    'Fever, infections, diabetes, blood pressure and general physician care.',
    'காய்ச்சல், தொற்று, சர்க்கரை நோய், ரத்த அழுத்தம் மற்றும் பொது மருத்துவ சிகிச்சை.'],
  ['general-surgery', 'General Surgery', 'பொது அறுவை சிகிச்சை', 'Scissors', 30,
    'Hernia, appendix, gallbladder, NSV and other general surgical procedures.',
    'குடலிறக்கம், குடல்வால், பித்தப்பை, NSV மற்றும் பிற பொது அறுவை சிகிச்சைகள்.'],
  ['orthopedics', 'Orthopaedics', 'எலும்பியல்', 'Bone', 40,
    'Fractures, joint problems, arthroscopy and sports injuries.',
    'எலும்பு முறிவு, மூட்டு பிரச்சினைகள், ஆர்த்ரோஸ்கோபி மற்றும் விளையாட்டு காயங்கள்.'],
  ['gynecology', 'Obstetrics & Gynaecology', 'மகப்பேறு மற்றும் மகளிர் நலம்', 'Venus', 50,
    'Antenatal care, deliveries, laparoscopic gynaecology and women’s health.',
    'கர்ப்ப கால பராமரிப்பு, பிரசவம், லேபராஸ்கோபி மற்றும் மகளிர் நலம்.'],
  ['pediatrics', 'Paediatrics & Neonatology', 'குழந்தை நலம் மற்றும் பச்சிளம் குழந்தை', 'Baby', 60,
    'Newborn care, childhood illness, growth and immunisation.',
    'பச்சிளம் குழந்தை பராமரிப்பு, குழந்தை நோய்கள், வளர்ச்சி மற்றும் தடுப்பூசி.'],
  ['pediatric-surgery', 'Paediatric Surgery', 'குழந்தை அறுவை சிகிச்சை', 'Baby', 65,
    'Laparoscopic and open surgery for infants and children.',
    'குழந்தைகளுக்கான லேபராஸ்கோபி மற்றும் திறந்த அறுவை சிகிச்சை.'],
  ['cardiology', 'Cardiology', 'இருதயவியல்', 'HeartPulse', 70,
    'ECG, echo, angiogram, angioplasty and ongoing heart care.',
    'ஈ.சி.ஜி., எக்கோ, ஆஞ்சியோகிராம், ஆஞ்சியோபிளாஸ்டி மற்றும் தொடர் இதய பராமரிப்பு.'],
  ['neurology', 'Neurology', 'நரம்பியல்', 'Brain', 80,
    'Stroke, fits, headache, Parkinson’s disease and nerve disorders.',
    'பக்கவாதம், வலிப்பு, தலைவலி, பார்கின்சன் மற்றும் நரம்பு கோளாறுகள்.'],
  ['neurosurgery', 'Neurosurgery', 'நரம்பியல் அறுவை சிகிச்சை', 'Brain', 85,
    'Brain and spine surgery, head injury and tumour care.',
    'மூளை மற்றும் முதுகுத்தண்டு அறுவை சிகிச்சை, தலைக் காயம் மற்றும் கட்டி சிகிச்சை.'],
  ['nephrology', 'Nephrology', 'சிறுநீரகவியல்', 'Droplet', 90,
    'Kidney disease, dialysis and transplant follow-up.',
    'சிறுநீரக நோய், டயாலிசிஸ் மற்றும் மாற்று அறுவை பின் பராமரிப்பு.'],
  ['urology', 'Urology', 'சிறுநீர் பாதை அறுவை சிகிச்சை', 'Droplet', 95,
    'Kidney stones, prostate problems and urinary tract surgery.',
    'சிறுநீரக கல், புராஸ்டேட் பிரச்சினைகள் மற்றும் சிறுநீர் பாதை அறுவை சிகிச்சை.'],
  ['gastroenterology', 'Gastroenterology', 'இரைப்பை குடலியல்', 'Utensils', 100,
    'Acidity, ulcer, liver disease, endoscopy and GI surgery.',
    'அமிலத்தன்மை, புண், கல்லீரல் நோய், எண்டோஸ்கோபி மற்றும் அறுவை சிகிச்சை.'],
  ['pulmonology', 'Pulmonology', 'நுரையீரல் மருத்துவம்', 'Wind', 110,
    'Asthma, COPD, tuberculosis and chest infections.',
    'ஆஸ்துமா, சி.ஓ.பி.டி., காசநோய் மற்றும் நுரையீரல் தொற்று.'],
  ['dermatology', 'Dermatology', 'தோல் மருத்துவம்', 'Sparkles', 120,
    'Skin, hair and nail conditions, allergies and cosmetic care.',
    'தோல், முடி, நக நோய்கள், ஒவ்வாமை மற்றும் அழகு சிகிச்சை.'],
  ['ent', 'ENT', 'காது, மூக்கு, தொண்டை', 'Ear', 130,
    'Ear, nose and throat conditions, sinus and hearing problems.',
    'காது, மூக்கு, தொண்டை நோய்கள், சைனஸ் மற்றும் கேட்கும் திறன் பிரச்சினைகள்.'],
  ['ophthalmology', 'Ophthalmology', 'கண் மருத்துவம்', 'Eye', 140,
    'Cataract, glaucoma, retina care and vision correction.',
    'கண்புரை, கிளௌகோமா, விழித்திரை சிகிச்சை மற்றும் பார்வைத் திருத்தம்.'],
  ['maxillofacial', 'Faciomaxillary Surgery', 'முகம் மற்றும் தாடை அறுவை சிகிச்சை', 'Smile', 150,
    'Jaw, face and dental surgery, including trauma and corrective procedures.',
    'தாடை, முகம் மற்றும் பல் அறுவை சிகிச்சை — காயம் மற்றும் சீரமைப்பு உட்பட.'],
  ['plastic-surgery', 'Plastic & Reconstructive Surgery', 'பிளாஸ்டிக் அறுவை சிகிச்சை', 'Bandage', 160,
    'Reconstruction after injury or burns, and corrective procedures.',
    'காயம் அல்லது தீக்காயத்திற்குப் பின் மறுசீரமைப்பு மற்றும் திருத்த அறுவை சிகிச்சை.'],
  ['oncology', 'Oncology', 'புற்றுநோயியல்', 'Ribbon', 170,
    'Cancer screening, medical and surgical oncology and supportive care.',
    'புற்றுநோய் பரிசோதனை, மருத்துவ மற்றும் அறுவை சிகிச்சை, ஆறுதல் பராமரிப்பு.'],
  ['psychiatry', 'Psychiatry', 'மனநல மருத்துவம்', 'HeartHandshake', 180,
    'Depression, anxiety, sleep problems, addiction and counselling.',
    'மனச்சோர்வு, பதற்றம், தூக்கமின்மை, போதைப் பழக்கம் மற்றும் ஆலோசனை.'],
]

/* ------------------------------------------------------------------ *
 * Doctors — supplied by the hospital.
 *
 * [id, departmentId, nameEn, nameTa, qualification, designationEn, designationTa, grade]
 * ------------------------------------------------------------------ */
const DOCTORS = [
  ['gunasekaran-r', 'general-medicine', 'Dr. R. Gunasekaran', 'டாக்டர் ரா. குணசேகரன்',
    'M.D., FRCP (Glasgow), FICP', 'Chief Physician', 'தலைமை மருத்துவர்', 'chief'],

  /* Dr. Joseph C. Mathuram — retired. Kept out of the seed; the existing row is
     deactivated rather than deleted so any past appointments stay resolvable. */
  ['deepan-g', 'orthopedics', 'Dr. G. Deepan', 'டாக்டர் கோ. தீபன்',
    'M.S. (Ortho)', 'Orthopaedic & Arthroscopy Surgeon', 'எலும்பியல் மற்றும் ஆர்த்ரோஸ்கோபி அறுவை சிகிச்சை நிபுணர்', 'senior'],

  ['priyanka-v', 'gynecology', 'Dr. V. Priyanka', 'டாக்டர் வ. பிரியங்கா',
    'M.B.B.S., D.G.O., F.MAS', 'Obstetrician & Gynaecologist', 'மகப்பேறு மற்றும் மகளிர் நல மருத்துவர்', 'consultant'],

  ['kawin-g', 'nephrology', 'Dr. G. Kawin', 'டாக்டர் கோ. கவின்',
    'M.D., D.M.', 'Nephrologist', 'சிறுநீரகவியல் நிபுணர்', 'consultant'],

  ['vaishnavi-rm', 'general-surgery', 'Dr. RM. Vaishnavi', 'டாக்டர் ரம. வைஷ்ணவி',
    'M.S. (General Surgery)', 'General Surgeon', 'பொது அறுவை சிகிச்சை நிபுணர்', 'consultant'],
  ['rajagopal-p', 'general-surgery', 'Dr. P. Rajagopal', 'டாக்டர் ப. ராஜகோபால்',
    'M.S. (General & NSV Surgery)', 'Senior General Surgeon', 'மூத்த பொது அறுவை சிகிச்சை நிபுணர்', 'senior'],

  ['venkateswaran-n', 'pediatrics', 'Dr. N. Venkateswaran', 'டாக்டர் ந. வெங்கடேஸ்வரன்',
    'M.D. (Paediatrics)', 'Paediatrician & Neonatologist', 'குழந்தை நல மற்றும் பச்சிளம் குழந்தை மருத்துவர்', 'senior'],
  ['sridharan-s', 'pediatric-surgery', 'Dr. S. Sridharan', 'டாக்டர் ச. சீதரன்',
    'M.S. (General), M.Ch (Paediatric Surgery)', 'Paediatric Laparoscopic Surgeon', 'குழந்தை லேபராஸ்கோபி அறுவை சிகிச்சை நிபுணர்', 'consultant'],

  ['krishnasamy-kannan', 'urology', 'Dr. Krishnasamy Kannan', 'டாக்டர் கிருஷ்ணசாமி கண்ணன்',
    'M.S., M.Ch (Urology)', 'Urologist', 'சிறுநீர் பாதை அறுவை சிகிச்சை நிபுணர்', 'consultant'],

  ['murali-r', 'gastroenterology', 'Dr. R. Murali', 'டாக்டர் ரா. முரளி',
    'M.D., D.M. (Gastroenterology)', 'Gastroenterologist', 'இரைப்பை குடலியல் நிபுணர்', 'consultant'],
  ['senthilkumar-r', 'gastroenterology', 'Dr. R. Senthilkumar', 'டாக்டர் ரா. செந்தில்குமார்',
    'M.S., M.Ch (Surgical Gastroenterology)', 'Surgical Gastroenterologist', 'இரைப்பை குடல் அறுவை சிகிச்சை நிபுணர்', 'consultant'],

  ['narmadha-s', 'dermatology', 'Dr. S. Narmadha', 'டாக்டர் ச. நர்மதா',
    'M.D., D.V.L.', 'Dermatologist', 'தோல் மருத்துவ நிபுணர்', 'consultant'],

  ['vijayakumar-b', 'emergency', 'Dr. B. Vijayakumar', 'டாக்டர் ப. விஜயகுமார்',
    'M.D., D.A.', 'Intensivist & Anaesthesiologist', 'தீவிர சிகிச்சை மற்றும் மயக்க மருந்து நிபுணர்', 'senior'],
  ['vignesh-g', 'emergency', 'Dr. G. Vignesh', 'டாக்டர் கோ. விக்னேஷ்',
    'M.B.B.S., D.N.B.', 'Intensivist & Anaesthesiologist', 'தீவிர சிகிச்சை மற்றும் மயக்க மருந்து நிபுணர்', 'consultant'],

  ['hari-prasad', 'ent', 'Dr. Hari Prasad', 'டாக்டர் ஹரி பிரசாத்',
    'M.S. (ENT)', 'ENT Surgeon', 'காது மூக்கு தொண்டை அறுவை சிகிச்சை நிபுணர்', 'consultant'],

  ['subramanian-p', 'maxillofacial', 'Dr. P. Subramanian', 'டாக்டர் ப. சுப்பிரமணியன்',
    'M.D.S.', 'Faciomaxillary Surgeon', 'முகம் மற்றும் தாடை அறுவை சிகிச்சை நிபுணர்', 'consultant'],

  ['thirupathi-sp', 'neurosurgery', 'Dr. SP. Thirupathi', 'டாக்டர் எஸ்பி. திருபதி',
    'M.Ch (Neurosurgery)', 'Neurosurgeon', 'நரம்பியல் அறுவை சிகிச்சை நிபுணர்', 'consultant'],
  ['priya-r', 'neurology', 'Dr. R. Priya', 'டாக்டர் ரா. பிரியா',
    'M.D., D.M. (Neurology)', 'Neuro Physician', 'நரம்பியல் மருத்துவர்', 'consultant'],

  ['sujatha-s', 'ophthalmology', 'Dr. S. Sujatha', 'டாக்டர் ச. சுஜாதா',
    'M.B.B.S., D.O.', 'Ophthalmic Surgeon', 'கண் அறுவை சிகிச்சை நிபுணர்', 'consultant'],

  ['ashwin-raja', 'plastic-surgery', 'Dr. Ashwin Raja', 'டாக்டர் அஸ்வின் ராஜா',
    'M.S., M.Ch', 'Plastic Surgeon', 'பிளாஸ்டிக் அறுவை சிகிச்சை நிபுணர்', 'consultant'],

  ['ramanan-r', 'pulmonology', 'Dr. R. Ramanan', 'டாக்டர் ரா. ராமனன்',
    'M.D.', 'Pulmonologist', 'நுரையீரல் நிபுணர்', 'consultant'],

  ['kader-sahib-a', 'cardiology', 'Dr. A. Kader Sahib', 'டாக்டர் அ. காதர் சாஹிப்',
    'M.D., MRCP (UK), D.N.B. (Cardiology)', 'Cardiologist', 'இருதயவியல் நிபுணர்', 'senior'],

  ['srinivas-sp', 'oncology', 'Dr. SP. Srinivas', 'டாக்டர் எஸ்பி. சீனிவாஸ்',
    'M.D. (R.T.)', 'Medical Oncologist', 'புற்றுநோய் மருத்துவ நிபுணர்', 'consultant'],
  ['jayakumar', 'oncology', 'Dr. Jayakumar', 'டாக்டர் ஜெயக்குமார்',
    'M.S., M.Ch', 'Surgical Oncologist', 'புற்றுநோய் அறுவை சிகிச்சை நிபுணர்', 'consultant'],

  ['nithya', 'psychiatry', 'Dr. Nithya', 'டாக்டர் நித்யா',
    'M.D., D.M.', 'Psychiatrist', 'மனநல மருத்துவர்', 'consultant'],
]

/**
 * Languages beyond Tamil and English, as confirmed by the hospital.
 * Patients filter on this, so only add a language when someone has said so.
 */
const EXTRA_LANGUAGES = {
  'gunasekaran-r': ['te'],
  'priyanka-v': ['hi'],
  'vaishnavi-rm': ['hi'],
  'venkateswaran-n': ['hi'],
  'hari-prasad': ['te'],
}

/* ------------------------------------------------------------------ */
const upsertDepartment = db.prepare(`
  INSERT INTO departments (id, name_en, name_ta, description_en, description_ta, icon, sort_order, active)
  VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  ON CONFLICT(id) DO UPDATE SET
    name_en = excluded.name_en, name_ta = excluded.name_ta,
    description_en = excluded.description_en, description_ta = excluded.description_ta,
    icon = excluded.icon, sort_order = excluded.sort_order
`)

const insertDoctor = db.prepare(`
  INSERT INTO doctors (
    id, department_id, name_en, name_ta, grade, spec_en, spec_ta, qualification,
    reg_no, experience, fee, room, languages, days,
    morning_start, morning_end, evening_start, evening_end,
    booking_mode, featured, active, sort_order, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, NULL, NULL, NULL, NULL, NULL, 'pending', 0, 1, ?, ?, ?)
  ON CONFLICT(id) DO NOTHING
`)

transaction(() => {
  if (reset) {
    db.exec('DELETE FROM doctors')
    db.exec('DELETE FROM departments')
  }

  for (const [id, nameEn, nameTa, icon, order, descEn, descTa] of DEPARTMENTS) {
    upsertDepartment.run(id, nameEn, nameTa, descEn, descTa, icon, order)
  }

  DOCTORS.forEach(([id, dept, nameEn, nameTa, qualification, specEn, specTa, grade], index) => {
    insertDoctor.run(
      id, dept, nameEn, nameTa, grade, specEn, specTa, qualification,
      JSON.stringify(['ta', 'en', ...(EXTRA_LANGUAGES[id] ?? [])]),
      (index + 1) * 10, nowIso(), nowIso(),
    )
  })
})

const counts = {
  departments: db.prepare('SELECT COUNT(*) AS n FROM departments').get().n,
  doctors: db.prepare('SELECT COUNT(*) AS n FROM doctors').get().n,
  pending: db.prepare("SELECT COUNT(*) AS n FROM doctors WHERE booking_mode = 'pending'").get().n,
}

console.info(`\n  Seeded ${counts.departments} departments and ${counts.doctors} doctors.`)
console.info(`  ${counts.pending} doctors have no published schedule yet, so they accept`)
console.info('  callback requests rather than online slots.\n')
console.info('  Add real consulting days, timings and fees via PATCH /api/admin/doctors/:id')
console.info('  (or the admin UI) — a doctor becomes bookable when those are set.\n')
