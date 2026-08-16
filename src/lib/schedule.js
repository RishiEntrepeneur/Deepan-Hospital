import { WEEKDAYS } from '../data/hospital'

/** How many days ahead patients can book. */
export const BOOKING_WINDOW_DAYS = 30

/** Minutes per consulting slot. */
const SLOT_MINUTES = 20

const pad = (n) => String(n).padStart(2, '0')

/* ------------------------------------------------------------------ *
 * Date keys — all persisted dates use a local 'YYYY-MM-DD' string so
 * they never shift across timezones the way ISO/UTC strings do.
 * ------------------------------------------------------------------ */
export function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function fromDateKey(key) {
  const [y, m, day] = key.split('-').map(Number)
  return new Date(y, m - 1, day)
}

export function todayKey() {
  return toDateKey(new Date())
}

/** Whole-day difference: negative = in the past. */
export function daysFromToday(key) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = fromDateKey(key)
  target.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86_400_000)
}

/** The next `BOOKING_WINDOW_DAYS` calendar days, starting today. */
export function upcomingDates(count = BOOKING_WINDOW_DAYS) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    return date
  })
}

/* ------------------------------------------------------------------ *
 * Slots
 * ------------------------------------------------------------------ */
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

const fromMinutes = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`

function buildSlots(range) {
  if (!range) return []
  const [start, end] = range.map(toMinutes)
  const slots = []
  for (let t = start; t + SLOT_MINUTES <= end; t += SLOT_MINUTES) slots.push(fromMinutes(t))
  return slots
}

/** All consulting slots a doctor offers, grouped by session. */
export function doctorSlots(doctor) {
  if (!doctor) return { morning: [], evening: [] }
  return {
    morning: buildSlots(doctor.sessions.morning),
    evening: buildSlots(doctor.sessions.evening),
  }
}

/** Which session a `HH:MM` slot belongs to for a given doctor. */
export function sessionOfSlot(doctor, slot) {
  const { morning } = doctorSlots(doctor)
  return morning.includes(slot) ? 'morning' : 'evening'
}

export function isDoctorAvailableOn(doctor, date) {
  return Boolean(doctor) && doctor.days.includes(date.getDay())
}

/** Slots already gone for today (a 30-minute lead time is required). */
export function isSlotInPast(dateKey, slot) {
  if (daysFromToday(dateKey) !== 0) return daysFromToday(dateKey) < 0
  const now = new Date()
  return toMinutes(slot) <= now.getHours() * 60 + now.getMinutes() + 30
}

/** A doctor's consulting hours as a display string, e.g. "9:00 AM – 1:00 PM". */
export function sessionRangeLabel(range, lang) {
  if (!range) return null
  return `${formatTime(range[0], lang)} – ${formatTime(range[1], lang)}`
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */
const TA_MERIDIEM = (hour) => {
  if (hour < 12) return 'காலை'
  if (hour < 16) return 'மதியம்'
  if (hour < 20) return 'மாலை'
  return 'இரவு'
}

/** `"09:30"` → `"9:30 AM"` / `"காலை 9:30"`. */
export function formatTime(hhmm, lang = 'en') {
  const [h, m] = hhmm.split(':').map(Number)
  const minutes = pad(m)
  if (lang === 'ta') return `${TA_MERIDIEM(h)} ${h % 12 === 0 ? 12 : h % 12}:${minutes}`
  const suffix = h < 12 ? 'AM' : 'PM'
  return `${h % 12 === 0 ? 12 : h % 12}:${minutes} ${suffix}`
}

const locale = (lang) => (lang === 'ta' ? 'ta-IN' : 'en-IN')

export function formatDateLong(key, lang = 'en') {
  return new Intl.DateTimeFormat(locale(lang), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fromDateKey(key))
}

export function formatDateMedium(key, lang = 'en') {
  return new Intl.DateTimeFormat(locale(lang), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(fromDateKey(key))
}

export function formatMonthYear(date, lang = 'en') {
  return new Intl.DateTimeFormat(locale(lang), { month: 'long', year: 'numeric' }).format(date)
}

export function weekdayShort(dayIndex, lang = 'en') {
  return WEEKDAYS[dayIndex].short[lang] ?? WEEKDAYS[dayIndex].short.en
}

export function weekdayLong(dayIndex, lang = 'en') {
  return WEEKDAYS[dayIndex].long[lang] ?? WEEKDAYS[dayIndex].long.en
}

/** Collapse `[1,2,3,4,5]` into "Mon – Fri"; leave gaps as a comma list. */
export function availabilityLabel(days, lang = 'en') {
  const sorted = [...days].sort((a, b) => a - b)
  const isRun =
    sorted.length > 2 && sorted.every((day, i) => i === 0 || day === sorted[i - 1] + 1)
  if (isRun) {
    return `${weekdayShort(sorted[0], lang)} – ${weekdayShort(sorted[sorted.length - 1], lang)}`
  }
  return sorted.map((day) => weekdayShort(day, lang)).join(', ')
}

/** Formats fees as ₹ amounts using Indian digit grouping. */
export function formatFee(amount, lang = 'en') {
  /*
   * A missing fee must never render as ₹0.
   *
   * Intl formats null as zero, so an unguarded call turns "the hospital has
   * not published this fee" — true of most of the roster — into "this
   * consultation is free". Every caller happens to check for null today; this
   * makes the next one safe too. Note the test is `isFinite`, not truthiness,
   * so a genuine zero still formats as ₹0.
   */
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat(locale(lang), {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

/* ------------------------------------------------------------------ *
 * Appointment IDs — short, readable, collision-resistant enough for a
 * single browser's history.
 * ------------------------------------------------------------------ */
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no look-alikes

export function generateAppointmentId(existingIds = []) {
  const taken = new Set(existingIds)
  let id
  do {
    const suffix = Array.from(
      { length: 6 },
      () => ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)],
    ).join('')
    id = `DH-${suffix}`
  } while (taken.has(id))
  return id
}

/**
 * A `tel:` href that a dialler will actually accept.
 *
 * Keeps digits and a leading `+`, drops everything else. The app previously
 * had two versions of this: a strict one, and one that removed only spaces —
 * so a number configured as "+91 (431) 245-6789" would have produced
 * `tel:+91(431)245-6789`, which some diallers refuse outright. The hospital's
 * numbers come from environment variables, so the punctuation is not
 * hypothetical.
 *
 * Returns null for anything with no digits, so callers can omit the link
 * rather than render one that dials nothing.
 */
export function telHref(number) {
  const cleaned = String(number ?? '').replace(/[^\d+]/g, '')
  const digits = cleaned.replace(/\D/g, '')
  if (digits.length < 3) return null
  return `tel:${cleaned.startsWith('+') ? '+' : ''}${digits}`
}

/**
 * A WhatsApp link, or null when the hospital has not published a number.
 *
 * wa.me wants the country code and digits only — no plus, no spaces. Indian
 * numbers are stored locally as ten digits, so a bare one gets 91 prefixed;
 * anything already carrying a country code is passed through.
 */
export function whatsappHref(number, message) {
  const digits = String(number ?? '').replace(/\D/g, '')
  if (digits.length < 10) return null
  const full = digits.length === 10 ? `91${digits}` : digits
  const text = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${full}${text}`
}
