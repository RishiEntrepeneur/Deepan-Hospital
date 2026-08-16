import { config } from '../config.js'

/**
 * Slot maths lives on the server and is the only authority.
 * The client mirrors it for display, but every booking is re-checked here.
 */

const pad = (n) => String(n).padStart(2, '0')

export const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

const fromMinutes = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`

export function buildSlots(start, end) {
  if (!start || !end) return []
  const step = config.booking.slotMinutes
  const slots = []
  for (let t = toMinutes(start); t + step <= toMinutes(end); t += step) slots.push(fromMinutes(t))
  return slots
}

export function doctorSlots(doctor) {
  return {
    morning: buildSlots(doctor.morning_start, doctor.morning_end),
    evening: buildSlots(doctor.evening_start, doctor.evening_end),
  }
}

export function sessionOfSlot(doctor, slot) {
  return doctorSlots(doctor).morning.includes(slot) ? 'morning' : 'evening'
}

export const parseDays = (doctor) => {
  if (!doctor.days) return []
  try {
    const parsed = JSON.parse(doctor.days)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Local (hospital timezone) 'YYYY-MM-DD' for a Date. */
export function toDateKey(date, timeZone = config.hospital.timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type) => parts.find((p) => p.type === type).value
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** Weekday index (0 = Sunday) for a date key, in the hospital's timezone. */
export function weekdayOf(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function daysFromToday(dateKey) {
  const today = todayKey()
  const [ty, tm, td] = today.split('-').map(Number)
  const [y, m, d] = dateKey.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000)
}

export const todayKey = () => toDateKey(new Date())

/** Current wall-clock minutes in the hospital's timezone. */
function nowMinutes() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: config.hospital.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const get = (type) => Number(parts.find((p) => p.type === type).value)
  return get('hour') * 60 + get('minute')
}

export function isSlotInPast(dateKey, slot) {
  const diff = daysFromToday(dateKey)
  if (diff < 0) return true
  if (diff > 0) return false
  return toMinutes(slot) <= nowMinutes() + config.booking.leadMinutes
}

export const isDateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value)
export const isSlotValue = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

/**
 * Validates a requested booking against the doctor's published schedule.
 * Returns `null` when acceptable, or an error code.
 */
export function validateBookingRequest(doctor, dateKey, slot) {
  if (doctor.booking_mode !== 'live') return 'DOCTOR_NOT_BOOKABLE'
  if (!isDateKey(dateKey)) return 'BAD_DATE'
  if (!isSlotValue(slot)) return 'BAD_SLOT'

  const offset = daysFromToday(dateKey)
  if (offset < 0) return 'DATE_IN_PAST'
  if (offset > config.booking.windowDays) return 'DATE_TOO_FAR'

  if (!parseDays(doctor).includes(weekdayOf(dateKey))) return 'DOCTOR_NOT_AVAILABLE_THAT_DAY'

  // A doctor who has marked themselves away is unbookable for those dates,
  // whatever their weekly pattern says.
  if (doctor.away_from && doctor.away_to && dateKey >= doctor.away_from && dateKey <= doctor.away_to) {
    return 'DOCTOR_AWAY'
  }

  const { morning, evening } = doctorSlots(doctor)
  if (!morning.includes(slot) && !evening.includes(slot)) return 'SLOT_NOT_OFFERED'

  if (isSlotInPast(dateKey, slot)) return 'SLOT_IN_PAST'

  return null
}
