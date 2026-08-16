import { config } from '../config.js'
import { db, nowIso } from '../db.js'
import { audit } from './audit.js'
import { isSessionMode, isSessionSubmitReady, submitBooking } from './klinique-session.js'

/**
 * Sending appointments to Klinique, the hospital's clinical system.
 *
 * Deepan Hospital already runs Klinique at deepan.klinique.net — it holds the
 * physician portal and reception desk. This app is the public booking page in
 * front of it, so every appointment booked here has to end up there.
 *
 * There are two ways that happens, chosen by KLINIQUE_MODE:
 *
 *   **manual** (the default, and what runs today)
 *     The appointment is flagged as not yet in Klinique. Reception sees the
 *     outstanding ones on the desk and enters them, then ticks them off. Slow
 *     but correct, and it needs nothing from the vendor.
 *
 *   **api**
 *     The appointment is POSTed to Klinique. Switched on by setting
 *     KLINIQUE_BASE_URL and KLINIQUE_API_KEY, which the hospital has to obtain
 *     from Klinique — there is no public documentation and no way to guess it.
 *
 * What this deliberately does NOT do is write into Klinique's database
 * directly, or drive its login form with a stored password. Both were
 * suggested and both are bad ideas for the same reason: they bypass the
 * application that owns those records, so the vendor's own validation, audit
 * trail and ID sequences never run. A schema change on their side then
 * corrupts patient records on ours, silently. This adapter only ever talks to
 * an interface Klinique publishes and supports.
 *
 * Nothing here blocks a booking. If Klinique is unreachable the appointment is
 * still made and still shows at the desk — the patient's booking must never
 * depend on a third-party system being up.
 */

/** Where an appointment has got to on its way into Klinique. */
export const KLINIQUE_STATES = ['pending', 'sent', 'entered', 'failed']

const setState = db.prepare(
  'UPDATE appointments SET klinique_status = ?, klinique_ref = ?, klinique_at = ? WHERE id = ?',
)

export const isApiMode = () =>
  config.klinique.mode === 'api' && Boolean(config.klinique.baseUrl && config.klinique.apiKey)

/** What the desk and the extension should call this: the delivery mode in force. */
export function kliniqueMode() {
  if (isSessionMode()) return 'session'
  if (isApiMode()) return 'api'
  return 'manual'
}

/**
 * The payload Klinique would receive.
 *
 * Kept as its own function so the shape is reviewable, and so the field names
 * can be remapped in one place once their documentation says what they call
 * things. Nothing clinical is included — this creates an appointment, it does
 * not carry a diagnosis.
 */
export function appointmentPayload(row) {
  return {
    externalRef: row.id,
    source: 'deepan-hospital-web',
    patient: {
      name: row.patient_name,
      age: row.patient_age,
      phone: row.patient_phone,
      gender: row.patient_gender,
    },
    doctorId: row.doctor_id,
    departmentId: row.department_id,
    date: row.date,
    time: row.slot,
    visitType: row.visit_type,
    reasonForVisit: row.reason,
    feePaise: row.fee == null ? null : row.fee * 100,
    bookedAt: row.created_at,
  }
}

/**
 * Hands one appointment to Klinique, or marks it for manual entry.
 *
 * Always resolves — a failure is recorded against the appointment rather than
 * thrown, because the caller is finishing a patient's booking and that must
 * succeed regardless.
 */
export async function pushAppointment(row) {
  if (!row) return { state: 'pending' }

  /*
   * Session mode: submit through Klinique's own web form. On any failure fall
   * through to leaving it 'failed', which is what the desk worklist shows — the
   * booking is never lost, a person can still enter it.
   */
  if (isSessionMode()) {
    if (!isSessionSubmitReady()) {
      // Signed in fine, but the booking form was never captured. Nothing to
      // submit to yet, so this is an ordinary manual-worklist booking.
      setState.run('pending', null, null, row.id)
      return { state: 'pending', reason: 'session mode — booking form not captured yet' }
    }
    const result = await submitBooking(row)
    if (result.ok) {
      setState.run('sent', result.ref ?? null, nowIso(), row.id)
      audit({
        action: 'klinique.pushed',
        entity: 'appointment',
        entityId: row.id,
        detail: { via: 'session', kliniqueRef: result.ref ?? null },
      })
      return { state: 'sent', ref: result.ref ?? null }
    }
    console.warn(`[klinique] session submit failed for ${row.id}: ${result.reason}`)
    setState.run('failed', null, nowIso(), row.id)
    audit({
      action: 'klinique.push_failed',
      entity: 'appointment',
      entityId: row.id,
      detail: { via: 'session', reason: result.reason },
    })
    return { state: 'failed', reason: result.reason }
  }

  if (!isApiMode()) {
    setState.run('pending', null, null, row.id)
    return { state: 'pending', reason: 'manual mode — reception enters this one' }
  }

  try {
    const response = await fetch(
      new URL(config.klinique.appointmentPath, config.klinique.baseUrl).toString(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Header name is a guess until Klinique documents theirs; it is
          // configurable precisely so it can be corrected without a code change.
          [config.klinique.authHeader]: config.klinique.apiKey,
          Accept: 'application/json',
        },
        body: JSON.stringify(appointmentPayload(row)),
        signal: AbortSignal.timeout(config.klinique.timeoutMs),
      },
    )

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300)
      console.warn(`[klinique] ${response.status} for ${row.id}: ${detail}`)
      setState.run('failed', null, nowIso(), row.id)
      audit({
        action: 'klinique.push_failed',
        entity: 'appointment',
        entityId: row.id,
        detail: { status: response.status },
      })
      return { state: 'failed', status: response.status }
    }

    const body = await response.json().catch(() => ({}))
    const ref = body?.id ?? body?.appointmentId ?? null
    setState.run('sent', ref == null ? null : String(ref), nowIso(), row.id)
    audit({
      action: 'klinique.pushed',
      entity: 'appointment',
      entityId: row.id,
      detail: { kliniqueRef: ref },
    })
    return { state: 'sent', ref }
  } catch (error) {
    /*
     * Unreachable, timed out, DNS gone. The booking still stands and the desk
     * still shows it; reception can enter it by hand and tick it off, which is
     * exactly the manual path.
     */
    console.warn(`[klinique] could not reach Klinique for ${row.id}: ${error.message}`)
    setState.run('failed', null, nowIso(), row.id)
    return { state: 'failed', reason: error.message }
  }
}

/** Reception confirming they have typed one into Klinique themselves. */
export function markEnteredByHand(appointmentId, klinique_ref = null) {
  setState.run('entered', klinique_ref, nowIso(), appointmentId)
  audit({
    action: 'klinique.entered_by_hand',
    entity: 'appointment',
    entityId: appointmentId,
    detail: { klinique_ref },
  })
}

/** Everything still waiting to reach Klinique, for the desk's worklist. */
export const outstandingForKlinique = db.prepare(`
  SELECT * FROM appointments
  WHERE COALESCE(klinique_status, 'pending') IN ('pending', 'failed')
    AND status IN ('pending', 'confirmed')
    AND kind = 'slot'
  ORDER BY created_at DESC
  LIMIT 200
`)
