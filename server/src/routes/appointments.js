import express from 'express'
import { db, nowIso, transaction } from '../db.js'
import { appointmentRef } from '../lib/crypto.js'
import { audit } from '../lib/audit.js'
import { notify } from '../lib/notify.js'
import { rateLimit } from '../lib/rateLimit.js'
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  requirePatientBlock,
  requirePhone,
  requireVisitType,
} from '../lib/validate.js'
import { consultationFee, isVisitType } from '../lib/fees.js'
import { pushAppointment } from '../lib/klinique.js'
import { daysFromToday, sessionOfSlot, validateBookingRequest } from '../lib/slots.js'
import { approvalReason, statusForNewBooking } from '../lib/deskHours.js'
import { publish, subscribe } from '../lib/events.js'
import { asyncRoute } from '../middleware/base.js'
import { loadSession, requirePatient, requireStaff } from '../middleware/session.js'

export const appointmentsRouter = express.Router()

const oneDoctor = db.prepare('SELECT * FROM doctors WHERE id = ? AND active = 1')
const insertAppointment = db.prepare(`
  INSERT INTO appointments (
    id, patient_id, doctor_id, department_id, kind, date, slot, session, fee, visit_type, status,
    patient_name, patient_age, patient_phone, patient_gender, reason, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
const byPatient = db.prepare(`
  SELECT * FROM appointments WHERE patient_id = ?
  ORDER BY COALESCE(date, created_at) DESC, slot DESC
`)
const oneAppointment = db.prepare('SELECT * FROM appointments WHERE id = ?')
const rescheduleStmt = db.prepare(`
  UPDATE appointments SET date = ?, slot = ?, session = ?, rescheduled_at = ?, updated_at = ?
  WHERE id = ?
`)
const paymentsFor = db.prepare(
  'SELECT * FROM payments WHERE appointment_id = ? ORDER BY created_at DESC',
)

/**
 * A lost race for a slot arrives as a violation of ux_appointment_slot.
 *
 * Matched on the message rather than errcode 2067, because that code covers
 * *any* unique index — so a future constraint tripping inside the booking
 * transaction would otherwise be reported to the patient as "someone just
 * took that slot", which would be a lie and would send them to re-pick a
 * time that was never the problem.
 */
const isSlotTakenError = (error) =>
  /UNIQUE constraint failed: appointments\.(doctor_id|date|slot)/i.test(String(error?.message))

export function presentAppointment(row) {
  const payment = paymentsFor.all(row.id)[0]
  return {
    id: row.id,
    doctorId: row.doctor_id,
    departmentId: row.department_id,
    kind: row.kind,
    date: row.date,
    slot: row.slot,
    session: row.session,
    fee: row.fee,
    visitType: row.visit_type,
    // How far this booking has got towards Klinique — see lib/klinique.js.
    klinique: {
      status: row.klinique_status ?? 'pending',
      ref: row.klinique_ref ?? null,
      at: row.klinique_at ?? null,
    },
    status: row.status,
    patient: {
      name: row.patient_name,
      age: row.patient_age,
      phone: row.patient_phone,
      gender: row.patient_gender,
      reason: row.reason,
    },
    payment: payment
      ? {
          status: payment.status,
          method: payment.method,
          amount: payment.amount / 100,
          reference: payment.provider_ref ?? payment.provider_order_id ?? payment.id,
          instrument: payment.instrument_hint,
          paidAt: payment.paid_at,
        }
      : null,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
    rescheduledAt: row.rescheduled_at,
  }
}

/**
 * The shape pushed down the desk's live feed.
 *
 * Narrower than the patient's own view on purpose: enough to render a row and
 * a toast, and nothing more. The desk still re-reads the authoritative list
 * from /admin/appointments, so this never has to be complete.
 */
export function deskView(appointment, doctor) {
  return {
    id: appointment.id,
    doctorId: appointment.doctorId,
    doctorName: doctor?.name_en ?? null,
    departmentId: appointment.departmentId,
    kind: appointment.kind,
    date: appointment.date,
    slot: appointment.slot,
    status: appointment.status,
    patientName: appointment.patient.name,
    patientPhone: appointment.patient.phone,
    reason: appointment.patient.reason,
    createdAt: appointment.createdAt,
  }
}

const BOOKING_ERRORS = {
  DOCTOR_NOT_BOOKABLE: 'This doctor is not open for online booking yet.',
  DATE_IN_PAST: 'That date has passed.',
  DATE_TOO_FAR: 'That date is beyond the booking window.',
  DOCTOR_NOT_AVAILABLE_THAT_DAY: 'The doctor does not consult on that day.',
  SLOT_NOT_OFFERED: 'That time is not one of the doctor’s slots.',
  SLOT_IN_PAST: 'That time has already passed.',
  BAD_DATE: 'Invalid date.',
  BAD_SLOT: 'Invalid time.',
}

/* ------------------------------------------------------------------ *
 * Guest booking — no account, no code, no SIM
 *
 * The hospital decided against one-time codes, which removed the only reason
 * this app needed an SMS gateway. A patient now books the way they would at
 * the counter: they give their name, age, phone and reason, and take away a
 * reference.
 *
 * Guest appointments carry NO patient row. The details live on the
 * appointment itself, which the schema already stored for the desk. That
 * means there is no account to break into, and nothing about the patient
 * retained beyond the visit they booked — which is the right answer under the
 * DPDP Act as well as the simple one.
 *
 * Looking one up needs BOTH the reference and the phone number it was booked
 * with. The reference alone is six characters from a 32-letter alphabet; the
 * pair is what makes guessing impractical, and the rate limit does the rest.
 * ------------------------------------------------------------------ */
/*
 * Its own bucket, not the signed-in route's. Sharing the code meant sharing
 * the counter, so activity on one route silently exhausted the other — which
 * is both wrong operationally and impossible to diagnose from a 429.
 */
const guestLimiter = rateLimit({ limit: 15, windowMs: 60 * 60 * 1000, code: 'GUEST_BOOKING_LIMIT' })

/*
 * Deliberately tighter, and deliberately identical whether the reference
 * exists or not: a lookup that answered "no such reference" faster or
 * differently would be an oracle for enumerating them.
 */
const lookupLimiter = rateLimit({ limit: 20, windowMs: 15 * 60 * 1000, code: 'LOOKUP_LIMIT' })

const guestAppointment = db.prepare(
  'SELECT * FROM appointments WHERE id = ? AND patient_phone = ?',
)

appointmentsRouter.post(
  '/guest',
  guestLimiter,
  asyncRoute(async (req, res) => {
    const doctor = oneDoctor.get(String(req.body?.doctorId ?? ''))
    if (!doctor) throw notFound('DOCTOR_NOT_FOUND')

    const patient = requirePatientBlock(req.body?.patient)
    const date = String(req.body?.date ?? '')
    const slot = String(req.body?.slot ?? '')

    const problem = validateBookingRequest(doctor, date, slot)
    if (problem) throw badRequest(problem, BOOKING_ERRORS[problem] ?? 'Cannot book that slot.')

    // Same rule as a signed-in booking: the total is the server's to decide.
    const visitType = requireVisitType(req.body?.visitType)
    const fee = consultationFee(doctor, visitType)

    const id = appointmentRef()
    const status = statusForNewBooking()

    try {
      transaction(() => {
        insertAppointment.run(
          id,
          null, // no account — this is the whole point
          doctor.id,
          doctor.department_id,
          'slot',
          date,
          slot,
          sessionOfSlot(doctor, slot),
          fee,
          visitType,
          status,
          patient.name,
          patient.age,
          patient.phone,
          patient.gender,
          patient.reason,
          nowIso(),
          nowIso(),
        )
      })
    } catch (error) {
      if (isSlotTakenError(error)) throw conflict('SLOT_TAKEN', 'That time has just been taken.')
      throw error
    }

    const created = presentAppointment(oneAppointment.get(id))
    audit({
      actorType: 'guest',
      action: 'appointment.booked_as_guest',
      entity: 'appointment',
      entityId: id,
      ip: req.clientIp,
    })
    // Same notifications a signed-in booking raises — the desk must not be
    // able to tell the difference, because operationally there isn't one.
    notify({ event: 'appointment.booked', recipientType: 'doctor', recipientId: doctor.id, appointmentId: id })
    notify({ event: 'appointment.booked', recipientType: 'desk', appointmentId: id })
    publish('appointment.created', deskView(created, doctor))

    /*
     * Hand it to Klinique — after the slot is safely held, and never in a way
     * that can fail the booking. In manual mode this only flags it for
     * reception; in api mode it posts, and a failure is recorded rather than
     * thrown. The patient has their appointment either way.
     */
    await pushAppointment(oneAppointment.get(id))

    res.status(201).json({ appointment: created })
  }),
)

/** Find one booking from its reference and the phone it was booked with. */
appointmentsRouter.post(
  '/lookup',
  lookupLimiter,
  asyncRoute(async (req, res) => {
    const reference = String(req.body?.reference ?? '').trim().toUpperCase()
    const phone = requirePhone(req.body?.phone)
    const row = guestAppointment.get(reference, phone)
    /*
     * One error for both "no such reference" and "wrong phone". Telling them
     * apart would let somebody confirm which references exist.
     */
    if (!row) throw notFound('APPOINTMENT_NOT_FOUND')
    res.json({ appointment: presentAppointment(row) })
  }),
)

/** Cancel a guest booking, proved the same way. */
appointmentsRouter.post(
  '/lookup/cancel',
  lookupLimiter,
  asyncRoute(async (req, res) => {
    const reference = String(req.body?.reference ?? '').trim().toUpperCase()
    const phone = requirePhone(req.body?.phone)
    const row = guestAppointment.get(reference, phone)
    if (!row) throw notFound('APPOINTMENT_NOT_FOUND')
    if (row.status === 'cancelled') throw conflict('ALREADY_CANCELLED')
    if (row.status === 'completed') throw conflict('ALREADY_COMPLETED')

    db.prepare("UPDATE appointments SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ?")
      .run(nowIso(), nowIso(), row.id)

    const fresh = presentAppointment(oneAppointment.get(row.id))
    audit({
      actorType: 'guest',
      action: 'appointment.cancelled_by_guest',
      entity: 'appointment',
      entityId: row.id,
      ip: req.clientIp,
    })
    publish('appointment.cancelled', deskView(fresh))
    res.json({ appointment: fresh })
  }),
)

/* ------------------------------------------------------------------ *
 * POST /appointments — book a slot
 * ------------------------------------------------------------------ */
appointmentsRouter.post(
  '/',
  loadSession,
  requirePatient,
  rateLimit({ limit: 20, windowMs: 60 * 60 * 1000, code: 'BOOKING_LIMIT' }),
  asyncRoute(async (req, res) => {
    const doctor = oneDoctor.get(String(req.body?.doctorId ?? ''))
    if (!doctor) throw notFound('DOCTOR_NOT_FOUND')

    const patient = requirePatientBlock(req.body?.patient)
    const date = String(req.body?.date ?? '')
    const slot = String(req.body?.slot ?? '')

    const problem = validateBookingRequest(doctor, date, slot)
    if (problem) throw badRequest(problem, BOOKING_ERRORS[problem] ?? 'Cannot book that slot.')

    /*
     * The total is worked out here, from the doctor's own fee and the visit
     * type — never taken from the request. A client that could send its own
     * `fee` would be a client that could book a ₹500 consultation for ₹1.
     */
    const visitType = requireVisitType(req.body?.visitType)
    const fee = consultationFee(doctor, visitType)

    const id = appointmentRef()
    /*
     * Only ask for approval when somebody is there to give it. Out of hours
     * the booking is confirmed outright rather than left in a queue nobody is
     * watching — the patient is told the truth either way.
     */
    const status = statusForNewBooking()

    try {
      transaction(() => {
        insertAppointment.run(
          id,
          req.patient.id,
          doctor.id,
          doctor.department_id,
          'slot',
          date,
          slot,
          sessionOfSlot(doctor, slot),
          fee,
          visitType,
          status,
          patient.name,
          patient.age,
          patient.phone,
          patient.gender,
          patient.reason,
          nowIso(),
          nowIso(),
        )
      })
    } catch (error) {
      // The UNIQUE index is the real defence against a double booking.
      if (isSlotTakenError(error)) {
        throw conflict('SLOT_TAKEN', 'Someone just took that slot. Please pick another time.')
      }
      throw error
    }

    audit({
      actorType: 'patient',
      actorId: req.patient.id,
      action: 'appointment.created',
      entity: 'appointment',
      entityId: id,
      detail: { status, why: approvalReason() },
      ip: req.clientIp,
    })

    // Enqueued after the transaction has committed — see lib/notify.js.
    notify({ event: 'appointment.booked', recipientType: 'doctor', recipientId: doctor.id, appointmentId: id })
    notify({ event: 'appointment.booked', recipientType: 'desk', appointmentId: id })

    const created = presentAppointment(oneAppointment.get(id))
    // Wakes up any desk with the live feed open.
    publish('appointment.created', deskView(created, doctor))
    await pushAppointment(oneAppointment.get(id))

    res.status(201).json({ appointment: created })
  }),
)

/* ------------------------------------------------------------------ *
 * POST /appointments/callback — request a call back
 *
 * Used for doctors whose consulting hours are not published yet. It creates a
 * real record for the front desk rather than pretending a slot was confirmed.
 * ------------------------------------------------------------------ */
appointmentsRouter.post(
  '/callback',
  loadSession,
  requirePatient,
  rateLimit({ limit: 20, windowMs: 60 * 60 * 1000, code: 'CALLBACK_LIMIT' }),
  asyncRoute(async (req, res) => {
    const doctor = oneDoctor.get(String(req.body?.doctorId ?? ''))
    if (!doctor) throw notFound('DOCTOR_NOT_FOUND')

    const patient = requirePatientBlock(req.body?.patient)
    /*
     * Not required here. Nothing is charged for a callback request — reception
     * rings the patient and settles both the time and the fee then. Recording
     * what they said, if they said anything, saves the desk a question.
     */
    const visitType = isVisitType(req.body?.visitType) ? req.body.visitType : null
    const id = appointmentRef()

    insertAppointment.run(
      id,
      req.patient.id,
      doctor.id,
      doctor.department_id,
      'callback',
      null,
      null,
      null,
      consultationFee(doctor, visitType ?? 'first'),
      visitType,
      'requested',
      patient.name,
      patient.age,
      patient.phone,
      patient.gender,
      patient.reason,
      nowIso(),
      nowIso(),
    )

    audit({
      actorType: 'patient',
      actorId: req.patient.id,
      action: 'appointment.callback_requested',
      entity: 'appointment',
      entityId: id,
      ip: req.clientIp,
    })

    // The desk must act on these — nobody else will.
    notify({ event: 'appointment.callback', recipientType: 'desk', appointmentId: id })
    notify({ event: 'appointment.callback', recipientType: 'doctor', recipientId: doctor.id, appointmentId: id })

    const created = presentAppointment(oneAppointment.get(id))
    publish('appointment.callback', deskView(created, doctor))

    res.status(201).json({ appointment: created })
  }),
)

/* ------------------------------------------------------------------ *
 * GET /appointments — the signed-in patient's own bookings
 * ------------------------------------------------------------------ */
appointmentsRouter.get(
  '/',
  loadSession,
  requirePatient,
  asyncRoute(async (req, res) => {
    res.json({ appointments: byPatient.all(req.patient.id).map(presentAppointment) })
  }),
)

const ownedOr403 = (req, id) => {
  const row = oneAppointment.get(id)
  if (!row) throw notFound('APPOINTMENT_NOT_FOUND')
  if (row.patient_id !== req.patient.id) throw forbidden('NOT_YOUR_APPOINTMENT')
  return row
}

/* ------------------------------------------------------------------ *
 * POST /appointments/:id/cancel
 * ------------------------------------------------------------------ */
appointmentsRouter.post(
  '/:id/cancel',
  loadSession,
  requirePatient,
  asyncRoute(async (req, res) => {
    const row = ownedOr403(req, req.params.id)
    if (!['pending', 'confirmed', 'requested'].includes(row.status)) {
      throw conflict('NOT_CANCELLABLE', 'This appointment can no longer be cancelled.')
    }

    db.prepare(
      "UPDATE appointments SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ?",
    ).run(nowIso(), nowIso(), row.id)

    audit({
      actorType: 'patient',
      actorId: req.patient.id,
      action: 'appointment.cancelled',
      entity: 'appointment',
      entityId: row.id,
      ip: req.clientIp,
    })

    notify({ event: 'appointment.cancelled', recipientType: 'doctor', recipientId: row.doctor_id, appointmentId: row.id })
    notify({ event: 'appointment.cancelled', recipientType: 'desk', appointmentId: row.id })

    const updated = presentAppointment(oneAppointment.get(row.id))
    publish('appointment.cancelled', deskView(updated))

    res.json({ appointment: updated })
  }),
)

/* ------------------------------------------------------------------ *
 * POST /appointments/:id/reschedule
 * ------------------------------------------------------------------ */
appointmentsRouter.post(
  '/:id/reschedule',
  loadSession,
  requirePatient,
  asyncRoute(async (req, res) => {
    const row = ownedOr403(req, req.params.id)
    if (row.status !== 'confirmed' && row.status !== 'pending') throw conflict('NOT_RESCHEDULABLE')
    if (row.kind !== 'slot') throw conflict('NOT_RESCHEDULABLE')

    const doctor = oneDoctor.get(row.doctor_id)
    if (!doctor) throw notFound('DOCTOR_NOT_FOUND')

    const date = String(req.body?.date ?? '')
    const slot = String(req.body?.slot ?? '')
    const problem = validateBookingRequest(doctor, date, slot)
    if (problem) throw badRequest(problem, BOOKING_ERRORS[problem] ?? 'Cannot move to that slot.')

    try {
      transaction(() => {
        rescheduleStmt.run(date, slot, sessionOfSlot(doctor, slot), nowIso(), nowIso(), row.id)
      })
    } catch (error) {
      if (isSlotTakenError(error)) {
        throw conflict('SLOT_TAKEN', 'Someone just took that slot. Please pick another time.')
      }
      throw error
    }

    audit({
      actorType: 'patient',
      actorId: req.patient.id,
      action: 'appointment.rescheduled',
      entity: 'appointment',
      entityId: row.id,
      detail: { from: { date: row.date, slot: row.slot }, to: { date, slot } },
      ip: req.clientIp,
    })

    notify({ event: 'appointment.rescheduled', recipientType: 'doctor', recipientId: row.doctor_id, appointmentId: row.id })
    notify({ event: 'appointment.rescheduled', recipientType: 'desk', appointmentId: row.id })

    const updated = presentAppointment(oneAppointment.get(row.id))
    publish('appointment.rescheduled', deskView(updated, doctor))

    res.json({ appointment: updated })
  }),
)

/** Marks past confirmed appointments as completed. Called on read. */
export function settlePastAppointments() {
  const rows = db
    .prepare("SELECT id, date FROM appointments WHERE status = 'confirmed' AND kind = 'slot'")
    .all()
  const done = db.prepare("UPDATE appointments SET status = 'completed', updated_at = ? WHERE id = ?")
  for (const row of rows) {
    if (row.date && daysFromToday(row.date) < 0) done.run(nowIso(), row.id)
  }
}


/* ------------------------------------------------------------------ *
 * PATCH /appointments/:id — the desk moves a booking along
 *
 * pending → confirmed → completed, or cancelled from either. Expressed as
 * named actions rather than a free-text status so an invalid jump (say,
 * completed → pending) is impossible to express, not merely rejected.
 * ------------------------------------------------------------------ */
const ACTIONS = {
  approve: { from: ['pending'], to: 'confirmed', event: 'appointment.approved' },
  complete: { from: ['pending', 'confirmed'], to: 'completed', event: 'appointment.completed' },
  cancel: { from: ['pending', 'confirmed', 'requested'], to: 'cancelled', event: 'appointment.cancelled' },
}

appointmentsRouter.patch(
  '/:id',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    const action = ACTIONS[String(req.body?.action ?? '')]
    if (!action) throw badRequest('BAD_ACTION', 'Use approve, complete or cancel.')

    const row = oneAppointment.get(req.params.id)
    if (!row) throw notFound('APPOINTMENT_NOT_FOUND')

    // A doctor at the desk may only move their own patients along.
    const own = req.staff.doctor_id ?? null
    if (own && own !== row.doctor_id) throw forbidden('NOT_YOUR_PATIENT')

    if (!action.from.includes(row.status)) {
      throw conflict(
        'BAD_TRANSITION',
        `An appointment that is ${row.status} cannot be ${req.body.action}d.`,
      )
    }

    const cancelling = action.to === 'cancelled'
    db.prepare(
      `UPDATE appointments SET status = ?, ${cancelling ? 'cancelled_at = ?,' : ''} updated_at = ? WHERE id = ?`,
    ).run(...[action.to, ...(cancelling ? [nowIso()] : []), nowIso(), row.id])

    audit({
      actorType: 'staff',
      actorId: req.staff.id,
      action: `appointment.${req.body.action}`,
      entity: 'appointment',
      entityId: row.id,
      detail: { from: row.status, to: action.to },
      ip: req.clientIp,
    })

    // The patient is told when their booking is approved or called off —
    // those are the two changes that alter whether they should turn up.
    if (action.to === 'confirmed' || cancelling) {
      notify({
        event: action.event,
        recipientType: 'patient',
        recipientId: row.patient_id,
        appointmentId: row.id,
      })
    }

    const updated = presentAppointment(oneAppointment.get(row.id))
    publish(action.event, deskView(updated, oneDoctor.get(row.doctor_id)))

    res.json({ appointment: updated })
  }),
)

/* ------------------------------------------------------------------ *
 * GET /appointments/live — Server-Sent Events feed for the desk
 *
 * Staff only. It carries patient names and numbers, so it is gated exactly
 * like every other desk endpoint; a signed-in patient cannot open it.
 * ------------------------------------------------------------------ */
appointmentsRouter.get('/live', loadSession, requireStaff(), (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Nginx buffers proxied responses by default, which would hold every
    // event back until the buffer filled — i.e. forever, on a quiet feed.
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders?.()

  const send = (event, data) => {
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  send('ready', { at: nowIso() })

  /*
   * A doctor's feed carries only their own patients. Reception sees all of it.
   * Without this a doctor signed in at the desk would receive every other
   * doctor's patients in real time — the exact leak the REST routes prevent.
   */
  const onlyDoctor = req.staff.doctor_id ?? null
  const off = subscribe(({ event, payload }) => {
    if (onlyDoctor && payload?.doctorId !== onlyDoctor) return
    send(event, payload)
  })

  // Proxies and phone networks drop idle connections; a comment line is the
  // cheapest thing that keeps one alive and is ignored by EventSource.
  const beat = setInterval(() => res.write(': keep-alive\n\n'), 25_000)

  const close = () => {
    clearInterval(beat)
    off()
    res.end()
  }
  req.on('close', close)
  req.on('error', close)
})
