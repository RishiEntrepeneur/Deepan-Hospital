import { translations } from '../i18n/translations'
import { HOSPITAL } from '../data/hospital'

/**
 * The message reception sends a patient about their appointment.
 *
 * Why this exists rather than an SMS gateway: texting patients in India from
 * the hospital's own systems means DLT registration as a principal entity, a
 * registered sender header, and every template approved before a single
 * message leaves. That is weeks of paperwork with the hospital's name on it,
 * not a line of code — and until it is done, operators reject the messages.
 *
 * So this app does not try to be a bulk sender. It hands reception a finished
 * message and one tap to send it from the phone already in their hand, as one
 * person writing to another. No registration, no template approval, no
 * per-message cost, and the patient has the details in writing instead of
 * being read them down a telephone line.
 *
 * (The hospital's other route is Klinique, whose booking form carries
 * `send_sms[op_app_confirmation]` — see KLINIQUE_SEND_SMS. If the hospital
 * turns that on, Klinique becomes the one that texts and reception should stop
 * using this. One sender, one message.)
 */

/** Renders a key in a specific language, whatever the staff member reads. */
function inLang(lang, key, vars) {
  const raw = translations[lang]?.[key] ?? translations.en[key] ?? key
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : match,
  )
}

/** '14:20' → '2:20 PM'. Fixed form: the message is read, not laid out. */
export function clockTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = String(hhmm).split(':').map(Number)
  if (Number.isNaN(h)) return String(hhmm)
  const suffix = h < 12 ? 'AM' : 'PM'
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m ?? 0).padStart(2, '0')} ${suffix}`
}

/** 'YYYY-MM-DD' → a date a patient can read, in their own script. */
export function longDate(date, lang) {
  if (!date) return ''
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  const locale = { en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN' }[lang] ?? 'en-IN'
  try {
    return parsed.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  } catch {
    return date
  }
}

/**
 * Builds the message for one appointment.
 *
 * A cancelled appointment gets its own wording — sending somebody a cheerful
 * confirmation for a visit that is not happening is worse than sending
 * nothing.
 */
export function patientMessage(appointment, doctorName, lang = 'ta') {
  const cancelled = appointment.status === 'cancelled'
  const when = appointment.date
    ? `${longDate(appointment.date, lang)}${appointment.slot ? `, ${clockTime(appointment.slot)}` : ''}`
    : ''

  return inLang(lang, cancelled ? 'sms.cancelled' : 'sms.confirmed', {
    hospital: inLang(lang, 'brand.name'),
    ref: appointment.id,
    doctor: doctorName,
    when,
    address: inLang(lang, 'contact.addressLine'),
    phone: HOSPITAL.receptionPhone,
  })
}

/**
 * Where to send it.
 *
 * WhatsApp needs the country code and nothing else — no plus, no spaces. The
 * numbers this app stores are ten digits, so 91 is prefixed; anything already
 * carrying a country code is left alone.
 */
export function whatsappLink(phone, text) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  const withCode = digits.length === 10 ? `91${digits}` : digits
  return `https://wa.me/${withCode}?text=${encodeURIComponent(text)}`
}

/**
 * The plain SMS fallback, for a patient with no WhatsApp.
 *
 * `?body=` with a `?` rather than `&`: there is no other parameter, and iOS
 * only accepts the first separator as `?`. Android accepts both.
 */
export function smsLink(phone, text) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  return `sms:${digits}?body=${encodeURIComponent(text)}`
}
