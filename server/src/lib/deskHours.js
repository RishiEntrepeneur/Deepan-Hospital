import { config } from '../config.js'

/**
 * Is the reception desk staffed right now?
 *
 * This exists because of a specific failure: bookings arrive as 'pending' and
 * wait for someone to approve them, but nothing pages a human. A booking made
 * at 9pm on a Saturday would sit unapproved until Monday morning while the
 * patient had been told "reception will confirm shortly".
 *
 * So approval is only *asked for* when there is somebody there to give it.
 * Outside those hours a booking still holds its slot and is confirmed
 * outright, because an unattended queue is worse than an unreviewed booking.
 */
function minutesOfDay(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null
}

/** Local wall-clock minutes in the hospital's timezone, not the server's. */
function nowMinutesLocal(at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: config.hospital.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at)
  const h = Number(parts.find((p) => p.type === 'hour')?.value)
  const m = Number(parts.find((p) => p.type === 'minute')?.value)
  return h * 60 + m
}

export function deskIsStaffed(at = new Date()) {
  const from = minutesOfDay(config.desk.opensAt)
  const to = minutesOfDay(config.desk.closesAt)
  if (from === null || to === null) return false

  const now = nowMinutesLocal(at)
  // A window that wraps past midnight (e.g. 22:00–06:00) is still one window.
  return from <= to ? now >= from && now < to : now >= from || now < to
}

/**
 * The status a new online booking should be created with.
 *
 * 'pending'   — a human will look at it shortly
 * 'confirmed' — nobody is there to look, so do not leave the patient waiting
 */
export function statusForNewBooking(at = new Date()) {
  switch (config.booking.approval) {
    case 'always':
      return 'pending'
    case 'never':
      return 'confirmed'
    default:
      return deskIsStaffed(at) ? 'pending' : 'confirmed'
  }
}

/** Explains the choice, for the audit log and for the desk. */
export function approvalReason(at = new Date()) {
  if (config.booking.approval === 'always') return 'ALWAYS_REVIEW'
  if (config.booking.approval === 'never') return 'NEVER_REVIEW'
  return deskIsStaffed(at) ? 'DESK_OPEN' : 'DESK_CLOSED'
}
