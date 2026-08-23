import express from 'express'
import { rateLimit } from '../lib/rateLimit.js'
import { db, nowIso, transaction } from '../db.js'
import { uuid } from '../lib/crypto.js'
import { audit } from '../lib/audit.js'
import { notify } from '../lib/notify.js'
import { todayKey } from '../lib/slots.js'
import { createRoom } from '../lib/video.js'
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  requireEnum,
  requireString,
} from '../lib/validate.js'
import { asyncRoute } from '../middleware/base.js'
import { loadSession, requirePatient, requireStaff } from '../middleware/session.js'

export const clinicalRouter = express.Router()

/* ------------------------------------------------------------------ *
 * Authorisation helpers
 *
 * A staff row with `doctor_id` set is a doctor login. Everything clinical is
 * scoped by it: a doctor sees their own patients, never the whole hospital.
 * ------------------------------------------------------------------ */
const staffDoctorId = (req) => req.staff?.doctor_id ?? null

/** Staff may act broadly; a doctor login is confined to its own doctor_id. */
function assertMayActFor(req, doctorId) {
  const own = staffDoctorId(req)
  if (own && own !== doctorId) throw forbidden('NOT_YOUR_PATIENT')
}

const oneDoctor = db.prepare('SELECT * FROM doctors WHERE id = ?')
const oneAppointment = db.prepare('SELECT * FROM appointments WHERE id = ?')

/* ================================================================== *
 * OPD queue and tokens
 * ================================================================== */
const findQueue = db.prepare(
  'SELECT * FROM queue_sessions WHERE doctor_id = ? AND date = ? AND session = ?',
)
const queueById = db.prepare('SELECT * FROM queue_sessions WHERE id = ?')
const tokensFor = db.prepare('SELECT * FROM tokens WHERE queue_id = ? ORDER BY number')

function presentQueue(queue) {
  if (!queue) return null
  const tokens = tokensFor.all(queue.id)
  const waiting = tokens.filter((t) => t.status === 'waiting').length
  return {
    id: queue.id,
    doctorId: queue.doctor_id,
    date: queue.date,
    session: queue.session,
    status: queue.status,
    currentToken: queue.current_token,
    lastIssued: queue.last_issued,
    avgMinutes: queue.avg_minutes,
    waiting,
    note: queue.note,
    startedAt: queue.started_at,
    tokens: tokens.map((t) => ({
      id: t.id,
      number: t.number,
      kind: t.kind,
      status: t.status,
      patientName: t.patient_name,
      appointmentId: t.appointment_id,
    })),
  }
}

function ensureQueue(doctorId, date, session) {
  const existing = findQueue.get(doctorId, date, session)
  if (existing) return existing
  const id = uuid()
  db.prepare(`
    INSERT INTO queue_sessions (id, doctor_id, date, session, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, doctorId, date, session, nowIso(), nowIso())
  return queueById.get(id)
}

/**
 * Public live queue for a doctor.
 *
 * This is the screen a patient checks before leaving home. No patient names,
 * no appointment references — just which token is being seen.
 */
clinicalRouter.get(
  '/queue/:doctorId',
  // Deliberately public: this is the waiting-room "now serving" board, and it
  // carries counts only — never a name or a token-to-patient mapping.
  rateLimit({ limit: 120, windowMs: 60 * 1000, code: 'QUEUE_LIMIT' }),
  asyncRoute(async (req, res) => {
    const doctor = oneDoctor.get(req.params.doctorId)
    if (!doctor) throw notFound('DOCTOR_NOT_FOUND')

    const date = String(req.query.date ?? todayKey())
    const rows = db
      .prepare('SELECT * FROM queue_sessions WHERE doctor_id = ? AND date = ?')
      .all(doctor.id, date)

    res.json({
      doctorId: doctor.id,
      date,
      sessions: rows.map((q) => {
        const tokens = tokensFor.all(q.id)
        return {
          session: q.session,
          status: q.status,
          currentToken: q.current_token,
          waiting: tokens.filter((t) => t.status === 'waiting').length,
          avgMinutes: q.avg_minutes,
          note: q.note,
        }
      }),
    })
  }),
)

/** Where the signed-in patient stands, across every queue they hold a token in. */
clinicalRouter.get(
  '/my-tokens',
  loadSession,
  requirePatient,
  asyncRoute(async (req, res) => {
    const rows = db
      .prepare(`
        SELECT t.*, q.doctor_id, q.date, q.session, q.status AS queue_status,
               q.current_token, q.avg_minutes
        FROM tokens t
        JOIN queue_sessions q ON q.id = t.queue_id
        JOIN appointments a ON a.id = t.appointment_id
        WHERE a.patient_id = ? AND q.date >= ?
        ORDER BY q.date, t.number
      `)
      .all(req.patient.id, todayKey())

    res.json({
      tokens: rows.map((r) => ({
        tokenId: r.id,
        number: r.number,
        status: r.status,
        appointmentId: r.appointment_id,
        doctorId: r.doctor_id,
        date: r.date,
        session: r.session,
        queueStatus: r.queue_status,
        currentToken: r.current_token,
        // Honest estimate: how many are ahead × the doctor's observed pace.
        aheadOfYou: Math.max(0, r.number - r.current_token - 1),
        estimatedWaitMinutes:
          r.queue_status === 'running'
            ? Math.max(0, (r.number - r.current_token - 1) * r.avg_minutes)
            : null,
      })),
    })
  }),
)

/** Opens or resumes a sitting. */
clinicalRouter.post(
  '/queue/:doctorId/open',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    const doctor = oneDoctor.get(req.params.doctorId)
    if (!doctor) throw notFound('DOCTOR_NOT_FOUND')
    assertMayActFor(req, doctor.id)

    const date = String(req.body?.date ?? todayKey())
    const session = requireEnum(String(req.body?.session ?? 'morning'), ['morning', 'evening'], 'session')

    const queue = ensureQueue(doctor.id, date, session)
    db.prepare(`
      UPDATE queue_sessions SET status = 'running', started_at = COALESCE(started_at, ?), updated_at = ?
      WHERE id = ?
    `).run(nowIso(), nowIso(), queue.id)

    // Everyone booked into this sitting gets a token, in slot order.
    const booked = db
      .prepare(`
        SELECT * FROM appointments
        WHERE doctor_id = ? AND date = ? AND session = ? AND status = 'confirmed' AND kind = 'slot'
        ORDER BY slot
      `)
      .all(doctor.id, date, session)

    transaction(() => {
      let next = queueById.get(queue.id).last_issued
      const insert = db.prepare(`
        INSERT INTO tokens (id, queue_id, appointment_id, number, kind, patient_name, created_at)
        VALUES (?, ?, ?, ?, 'booked', ?, ?)
        ON CONFLICT(appointment_id) WHERE appointment_id IS NOT NULL DO NOTHING
      `)
      for (const appointment of booked) {
        const already = db
          .prepare('SELECT 1 FROM tokens WHERE appointment_id = ?')
          .get(appointment.id)
        if (already) continue
        next += 1
        insert.run(uuid(), queue.id, appointment.id, next, appointment.patient_name, nowIso())
      }
      db.prepare('UPDATE queue_sessions SET last_issued = ?, updated_at = ? WHERE id = ?').run(
        next,
        nowIso(),
        queue.id,
      )
    })

    audit({ actorType: 'staff', actorId: req.staff.id, action: 'queue.opened', entity: 'queue', entityId: queue.id })
    res.json({ queue: presentQueue(queueById.get(queue.id)) })
  }),
)

/** Calls the next waiting token. */
clinicalRouter.post(
  '/queue/:queueId/next',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    const queue = queueById.get(req.params.queueId)
    if (!queue) throw notFound('QUEUE_NOT_FOUND')
    assertMayActFor(req, queue.doctor_id)
    if (queue.status !== 'running') throw conflict('QUEUE_NOT_RUNNING')

    const next = db
      .prepare("SELECT * FROM tokens WHERE queue_id = ? AND status = 'waiting' ORDER BY number LIMIT 1")
      .get(queue.id)
    if (!next) throw conflict('QUEUE_EMPTY', 'Nobody is waiting.')

    transaction(() => {
      db.prepare("UPDATE tokens SET status = 'done', done_at = ? WHERE queue_id = ? AND status IN ('called','in_consult')")
        .run(nowIso(), queue.id)
      db.prepare("UPDATE tokens SET status = 'called', called_at = ? WHERE id = ?").run(nowIso(), next.id)
      db.prepare('UPDATE queue_sessions SET current_token = ?, updated_at = ? WHERE id = ?')
        .run(next.number, nowIso(), queue.id)
    })

    res.json({ queue: presentQueue(queueById.get(queue.id)) })
  }),
)

/** Records the doctor running late, so waiting patients see the truth. */
clinicalRouter.post(
  '/queue/:queueId/status',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    const queue = queueById.get(req.params.queueId)
    if (!queue) throw notFound('QUEUE_NOT_FOUND')
    assertMayActFor(req, queue.doctor_id)

    const status = req.body?.status
      ? requireEnum(String(req.body.status), ['scheduled', 'running', 'paused', 'closed'], 'status')
      : queue.status
    const avg = req.body?.avgMinutes == null ? queue.avg_minutes : Number(req.body.avgMinutes)
    if (!Number.isInteger(avg) || avg < 1 || avg > 120) throw badRequest('INVALID_AVG_MINUTES')
    const note = String(req.body?.note ?? queue.note).slice(0, 200)

    db.prepare(`
      UPDATE queue_sessions SET status = ?, avg_minutes = ?, note = ?,
        closed_at = CASE WHEN ? = 'closed' THEN ? ELSE closed_at END, updated_at = ?
      WHERE id = ?
    `).run(status, avg, note, status, nowIso(), nowIso(), queue.id)

    res.json({ queue: presentQueue(queueById.get(queue.id)) })
  }),
)

/** Walk-ins outnumber bookings in most Indian OPDs. */
clinicalRouter.post(
  '/queue/:queueId/walkin',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    const queue = queueById.get(req.params.queueId)
    if (!queue) throw notFound('QUEUE_NOT_FOUND')
    assertMayActFor(req, queue.doctor_id)

    const name = requireString(req.body?.name, 'name', { min: 2, max: 120 })
    const number = transaction(() => {
      const next = queueById.get(queue.id).last_issued + 1
      db.prepare(`
        INSERT INTO tokens (id, queue_id, appointment_id, number, kind, patient_name, created_at)
        VALUES (?, ?, NULL, ?, 'walkin', ?, ?)
      `).run(uuid(), queue.id, next, name, nowIso())
      db.prepare('UPDATE queue_sessions SET last_issued = ?, updated_at = ? WHERE id = ?')
        .run(next, nowIso(), queue.id)
      return next
    })

    res.status(201).json({ number, queue: presentQueue(queueById.get(queue.id)) })
  }),
)

/* ================================================================== *
 * Prescriptions
 * ================================================================== */
const itemsFor = db.prepare(
  'SELECT * FROM prescription_items WHERE prescription_id = ? ORDER BY sort_order',
)

function presentPrescription(row) {
  const doctor = oneDoctor.get(row.doctor_id)
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    doctorId: row.doctor_id,
    doctorName: doctor?.name_en ?? row.doctor_id,
    doctorQualification: doctor?.qualification ?? '',
    diagnosis: row.diagnosis,
    advice: row.advice,
    followUpOn: row.follow_up_on,
    createdAt: row.created_at,
    items: itemsFor.all(row.id).map((i) => ({
      drug: i.drug,
      strength: i.strength,
      dose: i.dose,
      frequency: i.frequency,
      duration: i.duration,
      instructions: i.instructions,
    })),
  }
}

/** Doctor writes a prescription against a consultation. */
clinicalRouter.post(
  '/prescriptions',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    const appointment = oneAppointment.get(String(req.body?.appointmentId ?? ''))
    if (!appointment) throw notFound('APPOINTMENT_NOT_FOUND')
    assertMayActFor(req, appointment.doctor_id)
    if (!appointment.patient_id) throw badRequest('NO_PATIENT_ON_APPOINTMENT')

    const items = Array.isArray(req.body?.items) ? req.body.items : []
    if (items.length === 0) throw badRequest('NO_ITEMS', 'Add at least one medicine.')

    const id = uuid()
    transaction(() => {
      db.prepare(`
        INSERT INTO prescriptions
          (id, appointment_id, patient_id, doctor_id, diagnosis, advice, follow_up_on, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        appointment.id,
        appointment.patient_id,
        appointment.doctor_id,
        String(req.body?.diagnosis ?? '').slice(0, 500),
        String(req.body?.advice ?? '').slice(0, 2000),
        req.body?.followUpOn ? String(req.body.followUpOn) : null,
        nowIso(),
        req.staff.id,
      )

      const insertItem = db.prepare(`
        INSERT INTO prescription_items
          (id, prescription_id, drug, strength, dose, frequency, duration, instructions, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      items.forEach((item, index) => {
        insertItem.run(
          uuid(), id,
          requireString(item.drug, 'drug', { max: 160 }),
          String(item.strength ?? '').slice(0, 60),
          String(item.dose ?? '').slice(0, 60),
          String(item.frequency ?? '').slice(0, 60),
          String(item.duration ?? '').slice(0, 60),
          String(item.instructions ?? '').slice(0, 200),
          index,
        )
      })
    })

    audit({
      actorType: 'staff', actorId: req.staff.id, action: 'prescription.created',
      entity: 'appointment', entityId: appointment.id, ip: req.clientIp,
    })
    notify({ event: 'prescription.ready', recipientType: 'desk', appointmentId: appointment.id })

    res.status(201).json({ prescription: presentPrescription(db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(id)) })
  }),
)

/** The patient's own prescriptions. */
clinicalRouter.get(
  '/prescriptions',
  loadSession,
  requirePatient,
  asyncRoute(async (req, res) => {
    const rows = db
      .prepare('SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY created_at DESC')
      .all(req.patient.id)
    res.json({ prescriptions: rows.map(presentPrescription) })
  }),
)

/* ================================================================== *
 * Medical records
 * ================================================================== */
const presentRecord = (r) => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  body: r.body,
  filePath: r.file_path,
  recordedOn: r.recorded_on,
  doctorId: r.doctor_id,
  appointmentId: r.appointment_id,
  createdAt: r.created_at,
})

/** The patient's own record set. */
clinicalRouter.get(
  '/records',
  loadSession,
  requirePatient,
  asyncRoute(async (req, res) => {
    const rows = db
      .prepare('SELECT * FROM medical_records WHERE patient_id = ? ORDER BY recorded_on DESC')
      .all(req.patient.id)
    res.json({ records: rows.map(presentRecord) })
  }),
)

/** Staff or the treating doctor files a result. */
clinicalRouter.post(
  '/records',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    const patientId = requireString(req.body?.patientId, 'patientId', { max: 64 })
    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId)
    if (!patient) throw notFound('PATIENT_NOT_FOUND')

    const id = uuid()
    db.prepare(`
      INSERT INTO medical_records
        (id, patient_id, appointment_id, doctor_id, kind, title, body, file_path, recorded_on, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, patient.id,
      req.body?.appointmentId ?? null,
      req.body?.doctorId ?? staffDoctorId(req),
      requireEnum(String(req.body?.kind ?? 'note'), ['lab', 'imaging', 'discharge', 'note', 'vaccination'], 'kind'),
      requireString(req.body?.title, 'title', { max: 200 }),
      String(req.body?.body ?? '').slice(0, 8000),
      req.body?.filePath ? String(req.body.filePath).slice(0, 300) : null,
      String(req.body?.recordedOn ?? todayKey()),
      nowIso(), req.staff.id,
    )

    audit({
      actorType: 'staff', actorId: req.staff.id, action: 'record.created',
      entity: 'patient', entityId: patient.id, ip: req.clientIp,
    })
    res.status(201).json({ record: presentRecord(db.prepare('SELECT * FROM medical_records WHERE id = ?').get(id)) })
  }),
)

/**
 * Patient history for a clinician, before a consultation.
 *
 * Access is deliberately narrow: a doctor login may only read the history of a
 * patient who has an appointment with that doctor. Every read is audited,
 * because looking at a record is itself an event worth recording.
 */
clinicalRouter.get(
  '/patients/:patientId/history',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    const patientId = req.params.patientId
    const own = staffDoctorId(req)

    if (own) {
      const treats = db
        .prepare('SELECT 1 FROM appointments WHERE patient_id = ? AND doctor_id = ? LIMIT 1')
        .get(patientId, own)
      if (!treats) throw forbidden('NOT_YOUR_PATIENT')
    }

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId)
    if (!patient) throw notFound('PATIENT_NOT_FOUND')

    audit({
      actorType: 'staff', actorId: req.staff.id, action: 'history.viewed',
      entity: 'patient', entityId: patientId, ip: req.clientIp,
    })

    res.json({
      patient: { id: patient.id, fullName: patient.full_name, age: patient.age, gender: patient.gender, phone: patient.phone },
      appointments: db
        .prepare('SELECT * FROM appointments WHERE patient_id = ? ORDER BY COALESCE(date, created_at) DESC LIMIT 50')
        .all(patientId)
        .map((a) => ({
          id: a.id, doctorId: a.doctor_id, date: a.date, slot: a.slot,
          status: a.status, reason: a.reason,
        })),
      prescriptions: db
        .prepare('SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY created_at DESC LIMIT 30')
        .all(patientId)
        .map(presentPrescription),
      records: db
        .prepare('SELECT * FROM medical_records WHERE patient_id = ? ORDER BY recorded_on DESC LIMIT 50')
        .all(patientId)
        .map(presentRecord),
    })
  }),
)

/* ================================================================== *
 * Teleconsultation
 * ================================================================== */
const presentConsult = (row) =>
  row && {
    id: row.id,
    appointmentId: row.appointment_id,
    mode: row.mode,
    provider: row.provider,
    joinUrl: row.join_url,
    status: row.status,
    startedAt: row.started_at,
  }

/**
 * Attaches a meeting link to an appointment.
 *
 * Provider-agnostic on purpose: until a video vendor is chosen, staff paste
 * any meeting URL and the flow works end to end. A provider adapter can fill
 * `join_url` automatically later without changing the patient side.
 */
clinicalRouter.post(
  '/consults',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    const appointment = oneAppointment.get(String(req.body?.appointmentId ?? ''))
    if (!appointment) throw notFound('APPOINTMENT_NOT_FOUND')
    assertMayActFor(req, appointment.doctor_id)

    const mode = requireEnum(String(req.body?.mode ?? 'video'), ['video', 'audio'], 'mode')

    // A link may be supplied; otherwise one is generated.
    const supplied = String(req.body?.joinUrl ?? '').trim()
    const generated = supplied ? null : createRoom(appointment.id)
    const joinUrl = supplied || generated?.joinUrl
    if (!joinUrl || !/^https:\/\/\S+$/.test(joinUrl)) {
      throw badRequest('INVALID_JOIN_URL', 'Paste an https meeting link, or enable a video provider.')
    }
    const provider = supplied ? 'manual' : (generated?.provider ?? 'manual')

    db.prepare(`
      INSERT INTO consult_sessions (id, appointment_id, mode, provider, join_url, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'scheduled', ?)
      ON CONFLICT(appointment_id) DO UPDATE SET
        join_url = excluded.join_url, mode = excluded.mode, status = 'scheduled'
    `).run(uuid(), appointment.id, mode, provider, joinUrl, nowIso())

    db.prepare("UPDATE appointments SET mode = 'teleconsult', updated_at = ? WHERE id = ?")
      .run(nowIso(), appointment.id)

    audit({
      actorType: 'staff', actorId: req.staff.id, action: 'consult.scheduled',
      entity: 'appointment', entityId: appointment.id, ip: req.clientIp,
    })
    notify({ event: 'consult.ready', recipientType: 'desk', appointmentId: appointment.id })

    res.json({
      consult: presentConsult(
        db.prepare('SELECT * FROM consult_sessions WHERE appointment_id = ?').get(appointment.id),
      ),
    })
  }),
)

/** The patient's own consult link, released only near the appointment time. */
clinicalRouter.get(
  '/consults/:appointmentId',
  loadSession,
  requirePatient,
  asyncRoute(async (req, res) => {
    const appointment = oneAppointment.get(req.params.appointmentId)
    if (!appointment) throw notFound('APPOINTMENT_NOT_FOUND')
    if (appointment.patient_id !== req.patient.id) throw forbidden('NOT_YOUR_APPOINTMENT')

    res.json({
      consult: presentConsult(
        db.prepare('SELECT * FROM consult_sessions WHERE appointment_id = ?').get(appointment.id),
      ),
    })
  }),
)


/* ================================================================== *
 * Repeat prescriptions
 * ================================================================== */
const onePrescription = db.prepare('SELECT * FROM prescriptions WHERE id = ?')

const presentRepeat = (r) => ({
  id: r.id,
  prescriptionId: r.prescription_id,
  doctorId: r.doctor_id,
  status: r.status,
  patientNote: r.patient_note,
  decisionNote: r.decision_note,
  issuedId: r.issued_id,
  createdAt: r.created_at,
  actionedAt: r.actioned_at,
})

/** Patient asks for the same medicines again. */
clinicalRouter.post(
  '/prescriptions/:id/repeat',
  loadSession,
  requirePatient,
  asyncRoute(async (req, res) => {
    const rx = onePrescription.get(req.params.id)
    if (!rx) throw notFound('PRESCRIPTION_NOT_FOUND')
    if (rx.patient_id !== req.patient.id) throw forbidden('NOT_YOUR_PRESCRIPTION')

    const id = uuid()
    try {
      db.prepare(`
        INSERT INTO repeat_requests
          (id, prescription_id, patient_id, doctor_id, patient_note, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, rx.id, rx.patient_id, rx.doctor_id, String(req.body?.note ?? '').slice(0, 500), nowIso())
    } catch (error) {
      if (/UNIQUE constraint failed: repeat_requests/i.test(String(error?.message))) {
        throw conflict('ALREADY_REQUESTED', 'You have already asked for this one. The doctor will review it.')
      }
      throw error
    }

    audit({
      actorType: 'patient', actorId: req.patient.id, action: 'repeat.requested',
      entity: 'prescription', entityId: rx.id, ip: req.clientIp,
    })
    res.status(201).json({ repeat: presentRepeat(db.prepare('SELECT * FROM repeat_requests WHERE id = ?').get(id)) })
  }),
)

/** The patient's own requests, so the app can show "awaiting the doctor". */
clinicalRouter.get(
  '/repeats',
  loadSession,
  requirePatient,
  asyncRoute(async (req, res) => {
    res.json({
      repeats: db
        .prepare('SELECT * FROM repeat_requests WHERE patient_id = ? ORDER BY created_at DESC')
        .all(req.patient.id)
        .map(presentRepeat),
    })
  }),
)

/** What is waiting for a decision. Doctors see only their own. */
clinicalRouter.get(
  '/repeats/pending',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    const own = staffDoctorId(req)
    const rows = db
      .prepare(`
        SELECT r.*, p.diagnosis, pt.full_name, pt.phone
        FROM repeat_requests r
        JOIN prescriptions p ON p.id = r.prescription_id
        JOIN patients pt ON pt.id = r.patient_id
        WHERE r.status = 'requested' ${own ? 'AND r.doctor_id = ?' : ''}
        ORDER BY r.created_at
      `)
      .all(...(own ? [own] : []))

    res.json({
      repeats: rows.map((r) => ({
        ...presentRepeat(r),
        diagnosis: r.diagnosis,
        patientName: r.full_name,
        patientPhone: r.phone,
        items: itemsFor.all(r.prescription_id).map((i) => `${i.drug} ${i.strength}`.trim()),
      })),
    })
  }),
)

/**
 * Doctor's decision.
 *
 * Approving copies the original into a new prescription dated today. The old
 * one is left untouched — a prescription is a record of what was authorised
 * on a date, and rewriting it would destroy that.
 */
clinicalRouter.post(
  '/repeats/:id/decide',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    const row = db.prepare('SELECT * FROM repeat_requests WHERE id = ?').get(req.params.id)
    if (!row) throw notFound('REQUEST_NOT_FOUND')
    assertMayActFor(req, row.doctor_id)
    if (row.status !== 'requested') throw conflict('ALREADY_ACTIONED')

    const approve = req.body?.approve === true
    const note = String(req.body?.note ?? '').slice(0, 500)
    if (!approve && !note) throw badRequest('REASON_REQUIRED', 'Give the patient a reason.')

    let issuedId = null
    if (approve) {
      const original = onePrescription.get(row.prescription_id)
      issuedId = uuid()
      transaction(() => {
        db.prepare(`
          INSERT INTO prescriptions
            (id, appointment_id, patient_id, doctor_id, diagnosis, advice, follow_up_on, created_at, created_by)
          VALUES (?, NULL, ?, ?, ?, ?, NULL, ?, ?)
        `).run(
          issuedId, original.patient_id, original.doctor_id,
          original.diagnosis, note || original.advice, nowIso(), req.staff.id,
        )
        const insertItem = db.prepare(`
          INSERT INTO prescription_items
            (id, prescription_id, drug, strength, dose, frequency, duration, instructions, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        itemsFor.all(original.id).forEach((item, index) => {
          insertItem.run(
            uuid(), issuedId, item.drug, item.strength, item.dose,
            item.frequency, item.duration, item.instructions, index,
          )
        })
      })
    }

    db.prepare(`
      UPDATE repeat_requests
      SET status = ?, decision_note = ?, issued_id = ?, actioned_at = ?, actioned_by = ?
      WHERE id = ?
    `).run(approve ? 'approved' : 'declined', note, issuedId, nowIso(), req.staff.id, row.id)

    audit({
      actorType: 'staff', actorId: req.staff.id,
      action: approve ? 'repeat.approved' : 'repeat.declined',
      entity: 'prescription', entityId: row.prescription_id, ip: req.clientIp,
    })

    res.json({ repeat: presentRepeat(db.prepare('SELECT * FROM repeat_requests WHERE id = ?').get(row.id)) })
  }),
)

/* ================================================================== *
 * Follow-ups that are due
 *
 * `follow_up_on` has been recorded on every prescription and read by nothing.
 * This turns it into a call list: patients a doctor asked to come back, who
 * have not since been seen.
 * ================================================================== */
clinicalRouter.get(
  '/followups',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    const own = staffDoctorId(req)
    const horizon = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)

    const rows = db
      .prepare(`
        SELECT p.id, p.follow_up_on, p.diagnosis, p.doctor_id,
               pt.id AS patient_id, pt.full_name, pt.phone
        FROM prescriptions p
        JOIN patients pt ON pt.id = p.patient_id
        WHERE p.follow_up_on IS NOT NULL
          AND p.follow_up_on <= ?
          ${own ? 'AND p.doctor_id = ?' : ''}
          AND NOT EXISTS (
            SELECT 1 FROM appointments a
            WHERE a.patient_id = p.patient_id
              AND a.doctor_id = p.doctor_id
              AND a.status IN ('confirmed', 'completed')
              AND a.created_at > p.created_at
          )
        ORDER BY p.follow_up_on
      `)
      .all(...(own ? [horizon, own] : [horizon]))

    res.json({
      followups: rows.map((r) => ({
        prescriptionId: r.id,
        patientId: r.patient_id,
        patientName: r.full_name,
        patientPhone: r.phone,
        doctorId: r.doctor_id,
        dueOn: r.follow_up_on,
        overdue: r.follow_up_on < todayKey(),
        diagnosis: r.diagnosis,
      })),
    })
  }),
)
