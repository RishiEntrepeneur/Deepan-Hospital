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
 * Facilities — presentation content, not clinical data.
 * ------------------------------------------------------------------ */
export const FACILITIES = [
  {
    id: 'pharmacy',
    icon: Pill,
    name: { en: '24-hour Pharmacy', ta: '24 மணி நேர மருந்தகம்' },
    text: { en: 'In-house pharmacy open all night.', ta: 'இரவு முழுவதும் திறந்திருக்கும் மருந்தகம்.' },
  },
  {
    id: 'lab',
    icon: FlaskConical,
    name: { en: 'Diagnostic Lab', ta: 'நோயறிதல் ஆய்வகம்' },
    text: { en: 'Blood and pathology testing on site.', ta: 'ரத்த மற்றும் நோயியல் பரிசோதனை இங்கேயே.' },
  },
  {
    id: 'imaging',
    icon: ScanLine,
    name: { en: 'Scan & X-Ray', ta: 'ஸ்கேன் & எக்ஸ்-ரே' },
    text: { en: 'Digital imaging with same-day reports.', ta: 'அதே நாளில் அறிக்கையுடன் டிஜிட்டல் ஸ்கேன்.' },
  },
  {
    id: 'icu',
    icon: Activity,
    name: { en: 'ICU & Critical Care', ta: 'தீவிர சிகிச்சை பிரிவு' },
    text: { en: 'Intensivist-led critical care unit.', ta: 'தீவிர சிகிச்சை நிபுணர் தலைமையிலான பிரிவு.' },
  },
  {
    id: 'ambulance',
    icon: Truck,
    name: { en: 'Ambulance Service', ta: 'ஆம்புலன்ஸ் சேவை' },
    text: { en: 'Call the emergency line day or night.', ta: 'இரவு பகல் அவசர எண்ணை அழையுங்கள்.' },
  },
  {
    id: 'rooms',
    icon: Bed,
    name: { en: 'Inpatient Rooms', ta: 'உள்நோயாளி அறைகள்' },
    text: { en: 'General wards to private rooms.', ta: 'பொது வார்டு முதல் தனி அறைகள் வரை.' },
  },
  {
    id: 'insurance',
    icon: CreditCard,
    name: { en: 'Insurance Assistance', ta: 'காப்பீட்டு உதவி' },
    text: { en: 'Help with claims at the billing desk.', ta: 'கட்டண மையத்தில் காப்பீட்டு உதவி.' },
  },
  {
    id: 'canteen',
    icon: Cake,
    name: { en: 'Canteen', ta: 'உணவகம்' },
    text: { en: 'Meals for patients and visitors.', ta: 'நோயாளிகள் மற்றும் வருபவர்களுக்கு உணவு.' },
  },
  {
    id: 'wifi',
    icon: Wifi,
    name: { en: 'Free Wi-Fi', ta: 'இலவச வைஃபை' },
    text: { en: 'Complimentary internet on site.', ta: 'வளாகத்தில் இலவச இணைய வசதி.' },
  },
  {
    id: 'screening',
    icon: Microscope,
    name: { en: 'Health Check-ups', ta: 'உடல்நல பரிசோதனை' },
    text: { en: 'Preventive health check packages.', ta: 'தடுப்பு உடல்நல பரிசோதனை தொகுப்புகள்.' },
  },
]
