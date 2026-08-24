import {
  Activity,
  Ambulance,
  Baby,
  Bandage,
  Bed,
  Bone,
  Brain,
  Cake,
  CreditCard,
  Droplet,
  Ear,
  Eye,
  FlaskConical,
  HeartHandshake,
  HeartPulse,
  Microscope,
  Pill,
  Ribbon,
  ScanLine,
  Scissors,
  Smile,
  Sparkles,
  Stethoscope,
  Truck,
  Utensils,
  Venus,
  Wifi,
  Wind,
} from 'lucide-react'

/**
 * The catalogue is served by the API and cached here as live module bindings,
 * so plain helpers (`getDoctor`, the assistant, the appointment slip) can stay
 * synchronous. `setCatalog` is called once by the catalog provider on load.
 *
 * Everything else in this file is static presentation detail — icons, colours
 * and label maps — which belongs with the front end rather than the database.
 */
export let DEPARTMENTS = []
export let DOCTORS = []

export function setCatalog({ departments, doctors }) {
  DEPARTMENTS = departments
  DOCTORS = doctors
}

export const getDepartment = (id) => DEPARTMENTS.find((d) => d.id === id)
export const getDoctor = (id) => DOCTORS.find((doc) => doc.id === id)
export const getDoctorsByDepartment = (departmentId) =>
  DOCTORS.filter((doc) => doc.departmentId === departmentId)

/** Icon names come from the database as strings; resolve them here. */
const ICONS = {
  Activity, Ambulance, Baby, Bandage, Bed, Bone, Brain, Cake, CreditCard, Droplet, Ear, Eye,
  FlaskConical, HeartHandshake, HeartPulse, Microscope, Pill, Ribbon, ScanLine, Scissors, Smile,
  Sparkles, Stethoscope, Truck, Utensils, Venus, Wifi, Wind,
}

export const iconFor = (name) => ICONS[name] ?? Stethoscope

/** Shown on the home page when present, in this order. */
export const HOME_DEPARTMENT_IDS = [
  'emergency',
  'general-medicine',
  'pediatrics',
  'cardiology',
]

/* ------------------------------------------------------------------ *
 * Hospital contact details
 * ------------------------------------------------------------------ */
/*
 * The hospital's real numbers, supplied by Deepan Hospital.
 *
 *   landline  0431 279 4989   — reception and appointments
 *   mobile    +91 98430 74989 — reachable out of hours
 *
 * The mobile is used for emergency and ambulance because it is the number that
 * is actually answered around the clock. If the hospital has a SEPARATE
 * ambulance line, set VITE_AMBULANCE_PHONE — a wrong ambulance number is the
 * most dangerous string in this file, so it is never invented here.
 */
export const HOSPITAL = {
  emergencyPhone: import.meta.env.VITE_EMERGENCY_PHONE ?? '+91 98430 74989',
  ambulancePhone: import.meta.env.VITE_AMBULANCE_PHONE ?? '+91 98430 74989',
  receptionPhone: import.meta.env.VITE_RECEPTION_PHONE ?? '+91 431 279 4989',
  email: import.meta.env.VITE_HOSPITAL_EMAIL ?? 'dnhtrichy@gmail.com',
  /*
   * WhatsApp, if the hospital uses it.
   *
   * A `tel:` link cannot place a call from a laptop — the browser hands off to
   * the operating system, and unless something is registered for tel: the
   * click does nothing. WhatsApp works from a desktop and a phone alike, which
   * makes it the one contact route that behaves the same everywhere.
   *
   * Empty by default: inventing a WhatsApp number would send patients messages
   * into the void. Set VITE_WHATSAPP_PHONE and the link appears.
   */
  whatsappPhone: import.meta.env.VITE_WHATSAPP_PHONE ?? '',
  established: 1986,

  /*
   * Parking, in the hospital's own words. Empty by default and deliberately
   * so: nobody involved in building this knew the real arrangement, and
   * inventing one would send somebody driving to a hospital expecting a car
   * park that may not exist. Set VITE_PARKING_NOTE and the assistant answers
   * with it; until then it says it does not know and offers reception.
   */
  parkingNote: import.meta.env.VITE_PARKING_NOTE ?? '',
}

/* Weekday indices follow `Date.getDay()` — 0 = Sunday. */
export const WEEKDAYS = [
  { index: 0, short: { en: 'Sun', ta: 'ஞாயி', hi: 'रवि' }, long: { en: 'Sunday', ta: 'ஞாயிறு', hi: 'रविवार' } },
  { index: 1, short: { en: 'Mon', ta: 'திங்', hi: 'सोम' }, long: { en: 'Monday', ta: 'திங்கள்', hi: 'सोमवार' } },
  { index: 2, short: { en: 'Tue', ta: 'செவ்', hi: 'मंगल' }, long: { en: 'Tuesday', ta: 'செவ்வாய்', hi: 'मंगलवार' } },
  { index: 3, short: { en: 'Wed', ta: 'புத', hi: 'बुध' }, long: { en: 'Wednesday', ta: 'புதன்', hi: 'बुधवार' } },
  { index: 4, short: { en: 'Thu', ta: 'வியா', hi: 'गुरु' }, long: { en: 'Thursday', ta: 'வியாழன்', hi: 'गुरुवार' } },
  { index: 5, short: { en: 'Fri', ta: 'வெள்', hi: 'शुक्र' }, long: { en: 'Friday', ta: 'வெள்ளி', hi: 'शुक्रवार' } },
  { index: 6, short: { en: 'Sat', ta: 'சனி', hi: 'शनि' }, long: { en: 'Saturday', ta: 'சனி', hi: 'शनिवार' } },
]

export const SPOKEN_LANGUAGES = {
  ta: { en: 'Tamil', ta: 'தமிழ்', hi: 'तमिल' },
  en: { en: 'English', ta: 'ஆங்கிலம்', hi: 'अंग्रेज़ी' },
  hi: { en: 'Hindi', ta: 'இந்தி', hi: 'हिंदी' },
  ml: { en: 'Malayalam', ta: 'மலையாளம்', hi: 'मलयालम' },
  te: { en: 'Telugu', ta: 'தெலுங்கு', hi: 'तेलुगु' },
  kn: { en: 'Kannada', ta: 'கன்னடம்', hi: 'कन्नड़' },
  ur: { en: 'Urdu', ta: 'உருது', hi: 'उर्दू' },
}

export const GENDERS = [
  { value: 'male', labelKey: 'field.male' },
  { value: 'female', labelKey: 'field.female' },
  { value: 'other', labelKey: 'field.other' },
]

/** Post held at the hospital. */
export const GRADES = {
  chief: { en: 'Chief Consultant', ta: 'தலைமை ஆலோசகர்', hi: 'मुख्य सलाहकार' },
  senior: { en: 'Senior Consultant', ta: 'மூத்த ஆலோசகர்', hi: 'वरिष्ठ सलाहकार' },
  consultant: { en: 'Consultant', ta: 'ஆலோசகர்', hi: 'सलाहकार' },
  associate: { en: 'Associate Consultant', ta: 'இணை ஆலோசகர்', hi: 'सह सलाहकार' },
  junior: { en: 'Junior Consultant', ta: 'இளநிலை ஆலோசகர்', hi: 'कनिष्ठ सलाहकार' },
  visiting: { en: 'Visiting Consultant', ta: 'வருகை ஆலோசகர்', hi: 'आगंतुक सलाहकार' },
  dmo: { en: 'Duty Medical Officer', ta: 'பணி மருத்துவ அலுவலர்', hi: 'ड्यूटी चिकित्सा अधिकारी' },
}

/* ------------------------------------------------------------------ *
 * Facilities.
 * ------------------------------------------------------------------ *
 * `confirmed` is the important field, and it defaults to nothing being shown.
 *
 * This list began as the sort of thing a hospital website says, and several
 * entries turned out not to describe this hospital: it is a specialist
 * orthopaedic and general nursing facility, not a multi-speciality hospital
 * with an intensivist-led ICU, and the all-night pharmacy, the canteen and the
 * visitor Wi-Fi were never verified on site. A patient reading "ICU & Critical
 * Care" could choose this hospital in an emergency on the strength of it.
 *
 * So an entry appears on the site only when somebody at the hospital has
 * confirmed it is true. Turning one on is a one-word edit here, and should
 * follow an actual conversation, not an assumption.
 * ------------------------------------------------------------------ */
export const FACILITIES = [
  {
    id: 'pharmacy',
    icon: Pill,
    // Unconfirmed: a pharmacy may well exist, but "open all night" is the part
    // somebody would rely on at 2am, and nobody has verified it.
    confirmed: false,
    name: { en: 'Pharmacy', ta: 'மருந்தகம்', hi: 'फ़ार्मेसी' },
    text: { en: 'Medicines dispensed on site.', ta: 'இங்கேயே மருந்துகள் வழங்கப்படுகின்றன.', hi: 'दवाइयाँ यहीं मिलती हैं।' },
  },
  {
    id: 'lab',
    icon: FlaskConical,
    // Unconfirmed in scope: basic tests are done, but which ones, and which are
    // sent out, has never been established. Reception knows; this file does not.
    confirmed: false,
    name: { en: 'Basic Lab Tests', ta: 'அடிப்படை ஆய்வக பரிசோதனைகள்', hi: 'बुनियादी लैब जाँच' },
    text: { en: 'Common tests on site; some sent out. Ask reception.', ta: 'பொதுவான பரிசோதனைகள் இங்கே; சில வெளியே அனுப்பப்படும். வரவேற்பில் கேளுங்கள்.', hi: 'आम जाँचें यहीं; कुछ बाहर भेजी जाती हैं। रिसेप्शन से पूछिए।' },
  },
  {
    id: 'imaging',
    icon: ScanLine,
    // Unconfirmed: "digital imaging with same-day reports" promised a turnaround
    // nobody had checked. Which scans are done here at all is still open.
    confirmed: false,
    name: { en: 'X-Ray', ta: 'எக்ஸ்-ரே', hi: 'एक्स-रे' },
    text: { en: 'Ask reception which scans are done here.', ta: 'எந்த ஸ்கேன்கள் இங்கே செய்யப்படுகின்றன என்று வரவேற்பில் கேளுங்கள்.', hi: 'कौन-से स्कैन यहाँ होते हैं, रिसेप्शन से पूछिए।' },
  },
  {
    id: 'icu',
    icon: Activity,
    /*
     * Not true of this hospital, and the most dangerous of the lot.
     *
     * This is a specialist orthopaedic and general nursing facility. Somebody
     * with chest pain choosing it over a multi-speciality hospital because the
     * website said "intensivist-led critical care" is a real harm. It stays off
     * unless the hospital says otherwise in writing.
     */
    confirmed: false,
    name: { en: 'Inpatient Nursing Care', ta: 'உள்நோயாளி நர்சிங் பராமரிப்பு', hi: 'भर्ती मरीज़ों की नर्सिंग देखभाल' },
    text: { en: 'Monitored beds with nursing cover.', ta: 'நர்சிங் கண்காணிப்புடன் கூடிய படுக்கைகள்.', hi: 'नर्सिंग निगरानी वाले बेड।' },
  },
  {
    id: 'ambulance',
    icon: Truck,
    // The number is the hospital's own and answers; that much is known.
    confirmed: true,
    name: { en: 'Ambulance Service', ta: 'ஆம்புலன்ஸ் சேவை', hi: 'एम्बुलेंस सेवा' },
    text: { en: 'Call the emergency line day or night.', ta: 'இரவு பகல் அவசர எண்ணை அழையுங்கள்.', hi: 'दिन हो या रात, आपातकालीन नंबर पर कॉल कीजिए।' },
  },
  {
    id: 'rooms',
    icon: Bed,
    confirmed: true,
    name: { en: 'Inpatient Rooms', ta: 'உள்நோயாளி அறைகள்', hi: 'भर्ती मरीज़ों के कमरे' },
    text: { en: 'General wards to private rooms.', ta: 'பொது வார்டு முதல் தனி அறைகள் வரை.', hi: 'जनरल वार्ड से लेकर निजी कमरों तक।' },
  },
  {
    id: 'insurance',
    icon: CreditCard,
    confirmed: true,
    name: { en: 'Insurance Assistance', ta: 'காப்பீட்டு உதவி', hi: 'बीमा सहायता' },
    text: { en: 'Help with claims at the billing desk.', ta: 'கட்டண மையத்தில் காப்பீட்டு உதவி.', hi: 'बिलिंग डेस्क पर क्लेम में मदद।' },
  },
  {
    id: 'canteen',
    icon: Cake,
    // Unconfirmed: not a standard feature at a facility this size.
    confirmed: false,
    name: { en: 'Canteen', ta: 'உணவகம்', hi: 'कैंटीन' },
    text: { en: 'Meals for patients and visitors.', ta: 'நோயாளிகள் மற்றும் வருபவர்களுக்கு உணவு.', hi: 'मरीज़ों और मिलने आने वालों के लिए भोजन।' },
  },
  {
    id: 'wifi',
    icon: Wifi,
    // Unconfirmed: no public visitor network was ever verified.
    confirmed: false,
    name: { en: 'Free Wi-Fi', ta: 'இலவச வைஃபை', hi: 'मुफ़्त वाई-फ़ाई' },
    text: { en: 'Complimentary internet on site.', ta: 'வளாகத்தில் இலவச இணைய வசதி.', hi: 'परिसर में मुफ़्त इंटरनेट।' },
  },
  {
    id: 'screening',
    icon: Microscope,
    // Unconfirmed: no package list has ever been supplied.
    confirmed: false,
    name: { en: 'Health Check-ups', ta: 'உடல்நல பரிசோதனை', hi: 'स्वास्थ्य जाँच' },
    text: { en: 'Preventive health check packages.', ta: 'தடுப்பு உடல்நல பரிசோதனை தொகுப்புகள்.', hi: 'बचाव के लिए स्वास्थ्य जाँच पैकेज।' },
  },
]

/**
 * What the site is allowed to say it has.
 *
 * Everything else stays in FACILITIES with `confirmed: false` — written down,
 * visible to whoever works on this next, and not shown to a patient.
 */
export const CONFIRMED_FACILITIES = FACILITIES.filter((item) => item.confirmed === true)
