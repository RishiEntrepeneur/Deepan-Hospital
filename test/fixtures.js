import { setCatalog } from '../src/data/hospital'

/**
 * A small, fixed catalogue for the tests to reason about.
 *
 * `DEPARTMENTS` and `DOCTORS` are empty until the app calls `setCatalog()`
 * with what the API returned, so tests have to seed them. That is a feature
 * here: these fixtures are stable, so a test never breaks because somebody
 * changed a fee or opened a new clinic in the real database, and the suite
 * runs with no server and no database file.
 *
 * Kept deliberately small — enough departments to make routing decisions
 * meaningful, enough doctors to cover bookable, callback-only, and
 * fee-not-published.
 */

export const DEPARTMENTS = [
  {
    id: 'general-medicine',
    icon: 'Stethoscope',
    name: { en: 'General Medicine', ta: 'பொது மருத்துவம்', hi: 'सामान्य चिकित्सा' },
    description: { en: 'Fever, infections, diabetes.', ta: 'காய்ச்சல்.', hi: 'बुखार, संक्रमण।' },
  },
  {
    id: 'cardiology',
    icon: 'HeartPulse',
    name: { en: 'Cardiology', ta: 'இருதயவியல்', hi: 'हृदय रोग' },
    description: { en: 'ECG, echo, angiogram.', ta: 'இசிஜி.', hi: 'ईसीजी, इको।' },
  },
  {
    id: 'dermatology',
    icon: 'Sparkles',
    name: { en: 'Dermatology', ta: 'தோல் மருத்துவம்', hi: 'त्वचा रोग' },
    description: { en: 'Skin, hair and nail conditions.', ta: 'தோல்.', hi: 'त्वचा।' },
  },
  {
    id: 'ophthalmology',
    icon: 'Eye',
    name: { en: 'Ophthalmology', ta: 'கண் மருத்துவம்', hi: 'नेत्र रोग' },
    description: { en: 'Cataract, glaucoma, retina.', ta: 'கண்புரை.', hi: 'मोतियाबिंद।' },
  },
  {
    id: 'ent',
    icon: 'Ear',
    name: { en: 'ENT', ta: 'காது மூக்கு தொண்டை', hi: 'कान, नाक और गला' },
    description: { en: 'Ear, nose and throat.', ta: 'காது.', hi: 'कान।' },
  },
  {
    id: 'oncology',
    icon: 'Ribbon',
    name: { en: 'Oncology', ta: 'புற்றுநோயியல்', hi: 'कैंसर रोग' },
    description: { en: 'Cancer screening and care.', ta: 'புற்றுநோய்.', hi: 'कैंसर।' },
  },
  {
    id: 'orthopedics',
    icon: 'Bone',
    name: { en: 'Orthopaedics', ta: 'எலும்பியல்', hi: 'हड्डी रोग' },
    description: { en: 'Fractures and joints.', ta: 'எலும்பு.', hi: 'हड्डी।' },
  },
  {
    id: 'nephrology',
    icon: 'Droplet',
    name: { en: 'Nephrology', ta: 'சிறுநீரகவியல்', hi: 'गुर्दा रोग' },
    description: { en: 'Kidney disease and dialysis.', ta: 'சிறுநீரகம்.', hi: 'गुर्दा।' },
  },
  {
    id: 'pediatrics',
    icon: 'Baby',
    name: { en: 'Paediatrics', ta: 'குழந்தை மருத்துவம்', hi: 'बाल रोग' },
    description: { en: 'Newborn and child care.', ta: 'குழந்தை.', hi: 'बच्चे।' },
  },
]

const MON_TO_SAT = [1, 2, 3, 4, 5, 6]

export const DOCTORS = [
  {
    id: 'bookable-gm',
    departmentId: 'general-medicine',
    name: { en: 'Dr. A. Bookable', ta: 'டாக்டர் அ. புக்கபிள்', hi: 'डॉ. अ. बुकेबल' },
    grade: 'senior',
    specialization: { en: 'Chief Physician', ta: 'தலைமை மருத்துவர்', hi: 'मुख्य चिकित्सक' },
    qualification: 'M.D.',
    regNo: 'TN-11111',
    experience: null,
    fee: 200,
    room: 'OPD 1',
    languages: ['ta', 'en'],
    days: MON_TO_SAT,
    sessions: { morning: ['10:00', '13:00'], evening: null },
    bookingMode: 'live',
    about: '',
    away: null,
    featured: true,
  },
  {
    id: 'bookable-cardio',
    departmentId: 'cardiology',
    name: { en: 'Dr. B. Heart', ta: 'டாக்டர் ப. இதயம்', hi: 'डॉ. ब. हृदय' },
    grade: 'chief',
    specialization: { en: 'Cardiologist', ta: 'இருதய நிபுணர்', hi: 'हृदय रोग विशेषज्ञ' },
    qualification: 'D.M. (Cardiology)',
    regNo: null,
    experience: null,
    fee: 500,
    room: 'OPD 2',
    languages: ['ta', 'en', 'hi'],
    days: MON_TO_SAT,
    sessions: { morning: ['11:00', '13:00'], evening: ['18:00', '20:00'] },
    bookingMode: 'live',
    about: '',
    away: null,
    featured: false,
  },
  {
    // Callback-only, and no published fee — the state 21 of the real roster
    // are actually in.
    id: 'callback-derm',
    departmentId: 'dermatology',
    name: { en: 'Dr. C. Skin', ta: 'டாக்டர் ச. தோல்', hi: 'डॉ. स. त्वचा' },
    grade: 'consultant',
    specialization: { en: 'Dermatologist', ta: 'தோல் நிபுணர்', hi: 'त्वचा रोग विशेषज्ञ' },
    qualification: 'M.D. (DVL)',
    regNo: null,
    experience: null,
    fee: null,
    room: 'OPD 3',
    languages: ['ta'],
    days: [],
    sessions: { morning: null, evening: null },
    bookingMode: 'callback',
    about: '',
    away: null,
    featured: false,
  },
  {
    id: 'second-cardio',
    departmentId: 'cardiology',
    name: { en: 'Dr. D. Pulse', ta: 'டாக்டர் ட. துடிப்பு', hi: 'डॉ. ड. नाड़ी' },
    grade: 'consultant',
    specialization: { en: 'Cardiologist', ta: 'இருதய நிபுணர்', hi: 'हृदय रोग विशेषज्ञ' },
    qualification: 'D.M.',
    regNo: null,
    experience: null,
    fee: 400,
    room: 'OPD 4',
    languages: ['en'],
    days: MON_TO_SAT,
    sessions: { morning: ['09:00', '12:00'], evening: null },
    bookingMode: 'live',
    about: '',
    away: null,
    featured: false,
  },
  {
    // The only doctor in Ophthalmology, so "no alternatives to offer" is
    // reachable when triage is asked about a mismatch pointing here.
    id: 'only-eye',
    departmentId: 'ophthalmology',
    name: { en: 'Dr. E. Vision', ta: 'டாக்டர் இ. பார்வை', hi: 'डॉ. ई. दृष्टि' },
    grade: 'consultant',
    specialization: { en: 'Ophthalmic Surgeon', ta: 'கண் அறுவை நிபுணர்', hi: 'नेत्र शल्य विशेषज्ञ' },
    qualification: 'M.S. (Ophth)',
    regNo: null,
    experience: null,
    fee: 300,
    room: 'OPD 5',
    languages: ['ta', 'en'],
    days: MON_TO_SAT,
    sessions: { morning: ['10:00', '12:00'], evening: null },
    bookingMode: 'live',
    about: '',
    away: null,
    featured: false,
  },
]

/** Seeds the module-level catalogue the way the app does after fetching it. */
export function seedCatalog() {
  setCatalog({ departments: DEPARTMENTS, doctors: DOCTORS })
}

/**
 * A translation context shaped like the one components pass to `answer()`.
 *
 * Real dictionaries, so a test that asks a question in Hindi gets the Hindi
 * string back and a missing key shows up as the key name rather than silently
 * passing.
 */
export function makeCtx(lang = 'en', translations) {
  const dict = translations[lang] ?? translations.en
  return {
    lang,
    t: (key, vars = {}) =>
      String(dict[key] ?? translations.en[key] ?? key).replace(/\{(\w+)\}/g, (m, name) =>
        name in vars ? String(vars[name]) : m,
      ),
    tl: (pair) => (typeof pair === 'string' ? pair : (pair?.[lang] ?? pair?.en ?? '')),
  }
}
