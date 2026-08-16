import { config } from '../config.js'
import { db, nowIso } from '../db.js'
import { uuid } from './crypto.js'
import { audit } from './audit.js'

/**
 * Notification outbox.
 *
 * Routes enqueue; a worker delivers. Two rules shape the whole design:
 *
 *   1. Nothing is enqueued inside a transaction. A UNIQUE violation on the
 *      dedupe index would otherwise surface as a booking failure and be
 *      reported to the patient as "someone took that slot".
 *   2. No message body and no recipient address is stored. Both are resolved
 *      at send time, so this table never becomes a second, unaudited copy of
 *      patient data. Only a masked hint is written back.
 */

const insert = db.prepare(`
  INSERT INTO notifications
    (id, event, recipient_type, recipient_id, appointment_id, channel, status,
     next_attempt_at, dedupe_key, created_at)
  VALUES (?, ?, ?, ?, ?, 'sms', 'pending', ?, ?, ?)
  -- The dedupe index is partial, so the conflict target must repeat its WHERE.
  ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
`)

const dueRows = db.prepare(`
  SELECT * FROM notifications
  WHERE status = 'pending' AND next_attempt_at <= ?
  ORDER BY created_at LIMIT 20
`)

const markSent = db.prepare(
  "UPDATE notifications SET status = 'sent', sent_at = ?, address_hint = ?, attempts = attempts + 1 WHERE id = ?",
)
const markSkipped = db.prepare(
  "UPDATE notifications SET status = 'skipped', last_error = ? WHERE id = ?",
)

const contactFor = db.prepare('SELECT * FROM doctor_contacts WHERE doctor_id = ?')
const appointmentFor = db.prepare('SELECT * FROM appointments WHERE id = ?')
const doctorFor = db.prepare('SELECT * FROM doctors WHERE id = ?')
const departmentFor = db.prepare('SELECT * FROM departments WHERE id = ?')

/** '14:20' → '2:20 PM'. Kept local: the client formatter is language-aware,
 *  but an SMS goes out in one fixed form. */
function clockTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h < 12 ? 'AM' : 'PM'
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${suffix}`
}

/** Contact numbers are shown to staff masked, never in full. */
export const maskPhone = (phone) =>
  phone ? `${'•'.repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}` : null

/**
 * Queues a notification. Never throws — a failure to notify must not fail
 * the booking that triggered it.
 */
export function notify({ event, recipientType, recipientId = null, appointmentId = null }) {
  try {
    const dedupe = `${event}:${recipientType}:${recipientId ?? '-'}:${appointmentId ?? '-'}`
    insert.run(uuid(), event, recipientType, recipientId, appointmentId, nowIso(), dedupe, nowIso())
  } catch (error) {
    console.error('[notify] could not enqueue', error)
  }
}

/* ------------------------------------------------------------------ *
 * Message rendering
 * ------------------------------------------------------------------ */
const EVENT_LABEL = {
  'appointment.booked': { en: 'New booking', ta: 'புதிய பதிவு' },
  'appointment.cancelled': { en: 'Cancelled', ta: 'ரத்து' },
  'appointment.rescheduled': { en: 'Moved', ta: 'நேரம் மாற்றம்' },
  'appointment.callback': { en: 'Callback request', ta: 'அழைப்புக் கோரிக்கை' },
}

/**
 * Builds the SMS text.
 *
 * The default carries NO patient name and NO reason for visit — a consultant's
 * personal handset is not a place to put someone's health information, and an
 * SMS is neither encrypted nor access-controlled. The reference is enough to
 * open the record. Set NOTIFY_INCLUDE_PATIENT_NAME=true only with a documented
 * decision behind it.
 */
export function renderMessage(row, { appointment, doctor, department, lang = 'en' }) {
  const label = EVENT_LABEL[row.event]?.[lang] ?? row.event
  const when = appointment.date
    ? `${appointment.date}${appointment.slot ? ` ${clockTime(appointment.slot)}` : ''}`
    : lang === 'ta'
      ? 'நேரம் நிர்ணயிக்கப்படவில்லை'
      : 'time to be fixed'

  const parts = [
    `${config.hospital.name}: ${label}`,
    appointment.id,
    when,
    lang === 'ta' ? (department?.name_ta ?? '') : (department?.name_en ?? ''),
  ]

  if (config.notify.includePatientName) parts.push(appointment.patient_name)
  if (row.recipient_type === 'desk') parts.push(doctor?.name_en ?? '')

  return parts.filter(Boolean).join(' · ')
}

/**
 * Delivery.
 *
 * Every notification lands in the reception desk feed, which staff read in the
 * Alerts tab. A doctor with a recorded, consented contact is additionally
 * marked for their own portal. There is no outbound gateway, so nothing can
 * fail in transit — a notification is either recorded or it is not.
 */
async function deliver(row) {
  const appointment = row.appointment_id ? appointmentFor.get(row.appointment_id) : null
  if (!appointment) {
    markSkipped.run('APPOINTMENT_GONE', row.id)
    return
  }

  if (row.recipient_type === 'doctor') {
    const contact = contactFor.get(row.recipient_id)
    // Recorded either way; the reason is shown to staff so they can fix it.
    if (!contact?.verified_at) {
      markSkipped.run('DOCTOR_NOT_SET_UP', row.id)
      return
    }
    if (!contact.notify_sms) {
      markSkipped.run('NOTIFICATIONS_OFF', row.id)
      return
    }
  }

  const doctor = doctorFor.get(appointment.doctor_id)
  const department = departmentFor.get(appointment.department_id)
  const lang = row.recipient_type === 'doctor' ? (contactFor.get(row.recipient_id)?.lang ?? 'en') : 'en'

  // Storing the rendered line is safe here: it never leaves the hospital's
  // own database, and the desk needs something to display.
  const message = renderMessage(row, { appointment, doctor, department, lang })
  markSent.run(nowIso(), message.slice(0, 300), row.id)

  audit({
    action: 'notification.recorded',
    entity: 'appointment',
    entityId: appointment.id,
    detail: { event: row.event, to: row.recipient_type },
  })
}

let running = false

/** Drains everything currently due. Safe to call concurrently. */
export async function drainOutbox() {
  if (running) return 0
  running = true
  try {
    const rows = dueRows.all(nowIso())
    for (const row of rows) await deliver(row)
    return rows.length
  } finally {
    running = false
  }
}

/** Starts the background worker. Returns a stop function. */
export function startNotificationWorker() {
  const timer = setInterval(() => {
    drainOutbox().catch((error) => console.error('[notify] worker', error))
  }, config.notify.pollMs)
  timer.unref()
  return () => clearInterval(timer)
}
