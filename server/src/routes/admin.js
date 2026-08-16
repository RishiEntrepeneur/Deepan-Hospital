import express from 'express'
import { db, nowIso } from '../db.js'
import { config } from '../config.js'
import { kliniqueMode, markEnteredByHand, outstandingForKlinique } from '../lib/klinique.js'
import { actorOf, issueDevice, listDevices, requireDesk, revokeDevice } from '../lib/devices.js'
import { hashSecret, randomSalt, uuid, verifySecret } from '../lib/crypto.js'
import { audit } from '../lib/audit.js'
import { publish } from '../lib/events.js'
import { rateLimit } from '../lib/rateLimit.js'
import {
  badRequest,
  forbidden,
  notFound,
  requireEnum,
  requireString,
  unauthorized,
  assertUsernameMatchesRole,
} from '../lib/validate.js'
import { asyncRoute } from '../middleware/base.js'
import { endSession, loadSession, requireStaff, startSession } from '../middleware/session.js'
import { presentDoctor } from './catalog.js'
import { deskView, presentAppointment } from './appointments.js'
import { drainOutbox, maskPhone, notify } from '../lib/notify.js'
import { requirePhone, requirePatientBlock, conflict } from '../lib/validate.js'
import { appointmentRef, uuid as newId } from '../lib/crypto.js'
import { sessionOfSlot, todayKey, validateBookingRequest } from '../lib/slots.js'
import { transaction } from '../db.js'

export const adminRouter = express.Router()

const findStaffByUsername = db.prepare('SELECT * FROM staff WHERE username = ? AND active = 1')
const oneDoctorRow = db.prepare('SELECT * FROM doctors WHERE id = ?')

const GRADES = ['chief', 'senior', 'consultant', 'associate', 'junior', 'visiting', 'dmo']
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/* ------------------------------------------------------------------ *
 * Staff sign-in
 * ------------------------------------------------------------------ */
adminRouter.post(
  '/signin',
  // Per source address: stops one machine grinding through many accounts.
  rateLimit({ limit: 10, windowMs: 15 * 60 * 1000, code: 'STAFF_SIGNIN_LIMIT' }),
  /*
   * Per account as well, and this is the one that matters.
   *
   * Throttling by IP alone is close to useless against anyone determined: an
   * attacker with a handful of addresses gets unlimited attempts at a single
   * doctor's password. Keyed on the username, a targeted attack gets 8 tries
   * an hour no matter how many machines it comes from.
   *
   * Keyed on what was *typed*, not on a looked-up account, so this cannot be
   * used to discover which usernames exist.
   */
  rateLimit({
    limit: 8,
    windowMs: 60 * 60 * 1000,
    code: 'ACCOUNT_SIGNIN_LIMIT',
    keyOf: (req) => String(req.body?.username ?? '').toLowerCase().slice(0, 60),
  }),
  asyncRoute(async (req, res) => {
    const username = requireString(req.body?.username, 'username', { max: 60 }).toLowerCase()
    const password = String(req.body?.password ?? '')

    // The caller declares which door they are using; the username must match it.
    // Checked before any lookup, so this cannot be used to probe for accounts.
    if (req.body?.as !== undefined) {
      const asDoctor = requireEnum(String(req.body.as), ['patient', 'doctor', 'staff'], 'as') === 'doctor'
      assertUsernameMatchesRole(username, asDoctor)
    }

    const staff = findStaffByUsername.get(username)
    // Same error either way, so the endpoint can't be used to enumerate users.
    if (!staff || !verifySecret(password, staff.password_salt, staff.password_hash)) {
      throw unauthorized('INVALID_CREDENTIALS')
    }

    /*
     * The account itself must match the door it came through — a username
     * prefix is only a convention, but `doctor_id` is the real distinction.
     * Checked after the password so a wrong answer here reveals nothing about
     * which accounts exist.
     */
    if (req.body?.as !== undefined) {
      const wantsDoctor = String(req.body.as) === 'doctor'
      if (wantsDoctor !== Boolean(staff.doctor_id)) throw unauthorized('INVALID_CREDENTIALS')
    }

    startSession(res, req, staff.id, 'staff')
    audit({ actorType: 'staff', actorId: staff.id, action: 'staff.signed_in', ip: req.clientIp })

    res.json({
      staff: {
        id: staff.id, username: staff.username, role: staff.role,
        fullName: staff.full_name, doctorId: staff.doctor_id ?? null,
      },
    })
  }),
)

adminRouter.get('/me', loadSession, (req, res) => {
  res.json({
    staff: req.staff
      ? {
          id: req.staff.id, username: req.staff.username, role: req.staff.role,
          fullName: req.staff.full_name, doctorId: req.staff.doctor_id ?? null,
        }
      : null,
  })
})

adminRouter.post('/signout', loadSession, (req, res) => {
  endSession(req, res, 'staff')
  res.json({ signedOut: true })
})

/* ------------------------------------------------------------------ *
 * Doctors
 * ------------------------------------------------------------------ */
adminRouter.get(
  '/doctors',
  loadSession,
  requireStaff(),
  asyncRoute(async (_req, res) => {
    res.json({
      doctors: db.prepare('SELECT * FROM doctors ORDER BY sort_order, name_en').all().map(presentDoctor),
    })
  }),
)

/**
 * Updates a doctor's published details.
 *
 * Deliberately permits null for reg_no, fee, experience and the schedule: an
 * unknown value must stay unknown rather than be filled with a placeholder.
 * `booking_mode` flips to 'live' only when a real schedule exists.
 */
adminRouter.patch(
  '/doctors/:id',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    const existing = oneDoctorRow.get(req.params.id)
    if (!existing) throw notFound('DOCTOR_NOT_FOUND')

    const body = req.body ?? {}
    const next = { ...existing }

    if (body.nameEn !== undefined) next.name_en = requireString(body.nameEn, 'nameEn', { max: 160 })
    if (body.nameTa !== undefined) next.name_ta = String(body.nameTa ?? '').trim()
    if (body.specEn !== undefined) next.spec_en = requireString(body.specEn, 'specEn', { max: 160 })
    if (body.specTa !== undefined) next.spec_ta = String(body.specTa ?? '').trim()
    if (body.qualification !== undefined) next.qualification = String(body.qualification ?? '').trim()
    if (body.departmentId !== undefined) {
      const dept = db.prepare('SELECT id FROM departments WHERE id = ?').get(String(body.departmentId))
      if (!dept) throw badRequest('UNKNOWN_DEPARTMENT')
      next.department_id = dept.id
    }
    if (body.grade !== undefined) next.grade = requireEnum(String(body.grade), GRADES, 'grade')

    if (body.regNo !== undefined) next.reg_no = body.regNo ? String(body.regNo).trim() : null
    if (body.experience !== undefined) {
      next.experience = body.experience === null || body.experience === '' ? null : Number(body.experience)
      if (next.experience !== null && (!Number.isInteger(next.experience) || next.experience < 0 || next.experience > 70)) {
        throw badRequest('INVALID_EXPERIENCE')
      }
    }
    if (body.fee !== undefined) {
      next.fee = body.fee === null || body.fee === '' ? null : Number(body.fee)
      if (next.fee !== null && (!Number.isInteger(next.fee) || next.fee < 0 || next.fee > 100000)) {
        throw badRequest('INVALID_FEE')
      }
    }
    /*
     * The review fee, where it differs from the first-visit one. Null means
     * "same as the first visit", which is true of most of the roster — so the
     * desk only fills this in for the doctors who actually charge less to see
     * a returning patient.
     */
    if (body.feeReview !== undefined) {
      next.fee_review = body.feeReview === null || body.feeReview === '' ? null : Number(body.feeReview)
      if (
        next.fee_review !== null &&
        (!Number.isInteger(next.fee_review) || next.fee_review < 0 || next.fee_review > 100000)
      ) {
        throw badRequest('INVALID_FEE')
      }
    }
    if (body.room !== undefined) next.room = body.room ? String(body.room).trim() : null
    if (body.languages !== undefined) {
      if (!Array.isArray(body.languages)) throw badRequest('INVALID_LANGUAGES')
      next.languages = JSON.stringify(body.languages.map(String))
    }

    if (body.days !== undefined) {
      if (body.days === null) next.days = null
      else {
        if (!Array.isArray(body.days) || body.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
          throw badRequest('INVALID_DAYS')
        }
        next.days = JSON.stringify([...new Set(body.days)].sort())
      }
    }

    for (const [key, column] of [
      ['morningStart', 'morning_start'],
      ['morningEnd', 'morning_end'],
      ['eveningStart', 'evening_start'],
      ['eveningEnd', 'evening_end'],
    ]) {
      if (body[key] === undefined) continue
      const value = body[key] ? String(body[key]) : null
      if (value && !TIME.test(value)) throw badRequest('INVALID_TIME', `Invalid ${key}`)
      next[column] = value
    }

    if (body.bookingMode !== undefined) {
      next.booking_mode = requireEnum(String(body.bookingMode), ['live', 'pending', 'offline'], 'bookingMode')
    }

    // Going live requires everything a patient needs to actually turn up.
    if (next.booking_mode === 'live') {
      const days = next.days ? JSON.parse(next.days) : []
      const hasSession =
        (next.morning_start && next.morning_end) || (next.evening_start && next.evening_end)
      if (days.length === 0 || !hasSession || next.fee == null) {
        throw badRequest(
          'INCOMPLETE_SCHEDULE',
          'To open online booking, set the consulting days, at least one session and the fee.',
        )
      }
    }

    if (body.featured !== undefined) next.featured = body.featured ? 1 : 0
    if (body.active !== undefined) next.active = body.active ? 1 : 0
    if (body.sortOrder !== undefined) next.sort_order = Number(body.sortOrder) || 100

    db.prepare(`
      UPDATE doctors SET
        department_id = ?, name_en = ?, name_ta = ?, grade = ?, spec_en = ?, spec_ta = ?,
        qualification = ?, reg_no = ?, experience = ?, fee = ?, fee_review = ?, room = ?, languages = ?,
        days = ?, morning_start = ?, morning_end = ?, evening_start = ?, evening_end = ?,
        booking_mode = ?, featured = ?, active = ?, sort_order = ?, updated_at = ?
      WHERE id = ?
    `).run(
      next.department_id, next.name_en, next.name_ta, next.grade, next.spec_en, next.spec_ta,
      next.qualification, next.reg_no, next.experience, next.fee, next.fee_review, next.room, next.languages,
      next.days, next.morning_start, next.morning_end, next.evening_start, next.evening_end,
      next.booking_mode, next.featured, next.active, next.sort_order, nowIso(), next.id,
    )

    audit({
      actorType: 'staff',
      actorId: req.staff.id,
      action: 'doctor.updated',
      entity: 'doctor',
      entityId: next.id,
      ip: req.clientIp,
    })

    res.json({ doctor: presentDoctor(oneDoctorRow.get(next.id)) })
  }),
)

/* ------------------------------------------------------------------ *
 * POST /admin/doctors/bulk-schedule
 *
 * Sets the same consulting pattern on many doctors at once.
 *
 * This exists because of the single biggest thing standing between this app
 * and being useful: a doctor is only bookable once their days, session times
 * and fee are all filled in, and doing that one doctor at a time for a full
 * roster is the kind of chore that never gets finished. Most consultants at
 * one hospital keep near-identical OPD hours, so the realistic workflow is
 * "these fourteen are mornings, Mon–Sat, ₹400" — one action, not fourteen.
 * ------------------------------------------------------------------ */
adminRouter.post(
  '/doctors/bulk-schedule',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    const ids = Array.isArray(req.body?.doctorIds) ? req.body.doctorIds.map(String) : []
    if (ids.length === 0) throw badRequest('NO_DOCTORS', 'Pick at least one doctor.')
    if (ids.length > 100) throw badRequest('TOO_MANY', 'Up to 100 doctors at a time.')

    const days = req.body?.days
    if (!Array.isArray(days) || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      throw badRequest('INVALID_DAYS')
    }
    if (days.length === 0) throw badRequest('INVALID_DAYS', 'Pick at least one consulting day.')

    const time = (value, label) => {
      const v = value ? String(value) : null
      if (v && !TIME.test(v)) throw badRequest('INVALID_TIME', `Invalid ${label}`)
      return v
    }
    const morningStart = time(req.body?.morningStart, 'morningStart')
    const morningEnd = time(req.body?.morningEnd, 'morningEnd')
    const eveningStart = time(req.body?.eveningStart, 'eveningStart')
    const eveningEnd = time(req.body?.eveningEnd, 'eveningEnd')

    const hasSession = (morningStart && morningEnd) || (eveningStart && eveningEnd)
    if (!hasSession) throw badRequest('NO_SESSION', 'Set a morning or an evening session.')

    const fee = req.body?.fee === null || req.body?.fee === '' ? null : Number(req.body?.fee)
    if (fee !== null && (!Number.isInteger(fee) || fee < 0 || fee > 100000)) {
      throw badRequest('INVALID_FEE')
    }

    // Opening booking is the point of this, but it is still opt-in: a run can
    // fill the timings in and leave the doctors closed for a final check.
    const goLive = req.body?.goLive !== false
    if (goLive && fee === null) {
      throw badRequest('INCOMPLETE_SCHEDULE', 'A fee is needed before booking can open.')
    }

    const update = db.prepare(`
      UPDATE doctors SET
        days = ?, morning_start = ?, morning_end = ?, evening_start = ?, evening_end = ?,
        fee = COALESCE(?, fee), booking_mode = ?, updated_at = ?
      WHERE id = ? AND active = 1
    `)

    const applied = []
    const skipped = []
    transaction(() => {
      for (const id of ids) {
        const doctor = oneDoctorRow.get(id)
        if (!doctor) {
          skipped.push({ id, reason: 'NOT_FOUND' })
          continue
        }
        // COALESCE above keeps an existing fee when none was given, so a run
        // that leaves fee blank must not open booking for a doctor who has
        // never had one set.
        const effectiveFee = fee ?? doctor.fee
        if (goLive && effectiveFee == null) {
          skipped.push({ id, reason: 'NO_FEE' })
          continue
        }
        update.run(
          JSON.stringify([...new Set(days)].sort()),
          morningStart, morningEnd, eveningStart, eveningEnd,
          fee, goLive ? 'live' : doctor.booking_mode, nowIso(), id,
        )
        applied.push(id)
      }
    })

    audit({
      actorType: 'staff',
      actorId: req.staff.id,
      action: 'doctor.bulk_schedule',
      entity: 'doctor',
      entityId: applied.join(','),
      detail: { count: applied.length, days, goLive, skipped },
      ip: req.clientIp,
    })

    res.json({ applied, skipped })
  }),
)

/* ------------------------------------------------------------------ *
 * Appointment desk
 * ------------------------------------------------------------------ */
adminRouter.get(
  '/appointments',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : null
    const date = req.query.date ? String(req.query.date) : null

    const clauses = []
    const params = []
    if (status) {
      clauses.push('status = ?')
      params.push(status)
    }
    if (date) {
      clauses.push('date = ?')
      params.push(date)
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

    const rows = db
      .prepare(`SELECT * FROM appointments ${where} ORDER BY COALESCE(date, created_at) DESC LIMIT 500`)
      .all(...params)

    res.json({ appointments: rows.map(presentAppointment) })
  }),
)

/* ------------------------------------------------------------------ *
 * Klinique worklist — what reception still has to enter
 * ------------------------------------------------------------------ */
/*
 * These two accept a reception device token as well as a staff session, so
 * the Chrome extension can read the list and tick items off. Nothing else on
 * this router does — a device cannot reach patient records or payments.
 */
const deviceLimiter = rateLimit({ limit: 240, windowMs: 60 * 1000, code: 'DESK_LIMIT' })

adminRouter.get(
  '/klinique',
  deviceLimiter,
  loadSession,
  requireDesk,
  asyncRoute(async (_req, res) => {
    // The doctor's name, so whoever is typing does not have to translate an
    // id in their head at the counter.
    const names = new Map(
      db.prepare('SELECT id, name_en FROM doctors').all().map((d) => [d.id, d.name_en]),
    )
    res.json({
      mode: kliniqueMode(),
      portalUrl: config.klinique.portalUrl,
      outstanding: outstandingForKlinique.all().map((row) => ({
        ...presentAppointment(row),
        doctorName: names.get(row.doctor_id) ?? row.doctor_id,
      })),
    })
  }),
)

/** Reception ticking off one they have typed into Klinique themselves. */
adminRouter.post(
  '/klinique/:id/entered',
  deviceLimiter,
  loadSession,
  requireDesk,
  asyncRoute(async (req, res) => {
    const row = db.prepare('SELECT id FROM appointments WHERE id = ?').get(req.params.id)
    if (!row) throw notFound('APPOINTMENT_NOT_FOUND')
    const ref = req.body?.kliniqueRef ? String(req.body.kliniqueRef).slice(0, 60) : null
    markEnteredByHand(row.id, ref)
    audit({ ...actorOf(req), action: 'klinique.entered', entity: 'appointment', entityId: row.id })
    res.json({ ok: true })
  }),
)

/* ------------------------------------------------------------------ *
 * Reception devices — issuing and revoking extension tokens
 * ------------------------------------------------------------------ */

adminRouter.get(
  '/devices',
  loadSession,
  requireStaff('admin'),
  asyncRoute(async (_req, res) => {
    res.json({ devices: listDevices() })
  }),
)

/** The raw token is in this response and nowhere else, ever again. */
adminRouter.post(
  '/devices',
  loadSession,
  requireStaff('admin'),
  asyncRoute(async (req, res) => {
    const label = requireString(req.body?.label, 'label', { min: 2, max: 60 })
    const device = issueDevice(label, req.staff.id)
    audit({
      actorType: 'staff',
      actorId: req.staff.id,
      action: 'device.issued',
      entity: 'device',
      entityId: device.id,
      detail: { label },
    })
    res.status(201).json({ device })
  }),
)

adminRouter.delete(
  '/devices/:id',
  loadSession,
  requireStaff('admin'),
  asyncRoute(async (req, res) => {
    if (!revokeDevice(req.params.id)) throw notFound('DEVICE_NOT_FOUND')
    audit({
      actorType: 'staff',
      actorId: req.staff.id,
      action: 'device.revoked',
      entity: 'device',
      entityId: req.params.id,
    })
    res.json({ ok: true })
  }),
)

/** Staff can create additional staff accounts; only admins may create admins. */
adminRouter.post(
  '/staff',
  loadSession,
  requireStaff('admin'),
  asyncRoute(async (req, res) => {
    const username = requireString(req.body?.username, 'username', { min: 3, max: 60 }).toLowerCase()
    const password = String(req.body?.password ?? '')
    if (password.length < 12) throw badRequest('WEAK_PASSWORD', 'Use at least 12 characters.')
    const role = requireEnum(String(req.body?.role ?? 'staff'), ['staff', 'admin'], 'role')

    if (findStaffByUsername.get(username)) throw badRequest('USERNAME_TAKEN')

    const salt = randomSalt()
    const id = uuid()
    db.prepare(`
      INSERT INTO staff (id, username, full_name, password_hash, password_salt, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, username, String(req.body?.fullName ?? ''), hashSecret(password, salt), salt, role, nowIso())

    audit({ actorType: 'staff', actorId: req.staff.id, action: 'staff.created', entity: 'staff', entityId: id })
    res.status(201).json({ staff: { id, username, role } })
  }),
)

/* ------------------------------------------------------------------ *
 * Notification hub
 * ------------------------------------------------------------------ */
const contactRows = db.prepare(`
  SELECT d.id, d.name_en, d.name_ta, d.department_id, d.booking_mode, d.active,
         c.phone_hint, c.verified_at, c.notify_sms, c.lang, c.consent_at, c.consent_note
  FROM doctors d LEFT JOIN doctor_contacts c ON c.doctor_id = d.id
  WHERE d.active = 1
  ORDER BY d.sort_order, d.name_en
`)

/** Contact list. Returns only the masked hint — never the number itself. */
adminRouter.get(
  '/contacts',
  loadSession,
  requireStaff(),
  asyncRoute(async (_req, res) => {
    res.json({
      contacts: contactRows.all().map((r) => ({
        doctorId: r.id,
        name: { en: r.name_en, ta: r.name_ta || r.name_en },
        departmentId: r.department_id,
        bookingMode: r.booking_mode,
        phoneHint: r.phone_hint,
        verified: Boolean(r.verified_at),
        notifySms: Boolean(r.notify_sms),
        lang: r.lang ?? 'en',
        consented: Boolean(r.consent_at),
        consentNote: r.consent_note ?? '',
        contactable: Boolean(r.phone_hint && r.verified_at && r.notify_sms && r.consent_at),
      })),
    })
  }),
)

/**
 * Records or updates a doctor's contact details.
 *
 * Consent is explicit and staff-attested: a number is not usable until someone
 * records that the doctor agreed, and verification is confirmed by a human
 * rather than an OTP — reusing the patient OTP table here would let a
 * doctor-verification code sign somebody in as a patient.
 */
adminRouter.patch(
  '/contacts/:doctorId',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    const doctor = oneDoctorRow.get(req.params.doctorId)
    if (!doctor) throw notFound('DOCTOR_NOT_FOUND')

    const body = req.body ?? {}
    const existing = db.prepare('SELECT * FROM doctor_contacts WHERE doctor_id = ?').get(doctor.id)

    let phone = existing?.phone ?? null
    let verifiedAt = existing?.verified_at ?? null

    if (body.phone !== undefined) {
      phone = body.phone ? requirePhone(body.phone, 'phone') : null
      // A changed number is never carried over as verified.
      if (phone !== existing?.phone) verifiedAt = null
    }
    if (body.verified !== undefined) {
      if (body.verified && !phone) throw badRequest('NO_PHONE', 'Add a number before verifying it.')
      verifiedAt = body.verified ? nowIso() : null
    }

    const notifySms = body.notifySms === undefined ? (existing?.notify_sms ?? 1) : body.notifySms ? 1 : 0
    const lang = body.lang ? requireEnum(String(body.lang), ['en', 'ta'], 'lang') : (existing?.lang ?? 'en')

    let consentAt = existing?.consent_at ?? null
    let consentBy = existing?.consent_by ?? null
    let consentNote = existing?.consent_note ?? ''
    if (body.consented !== undefined) {
      consentAt = body.consented ? nowIso() : null
      consentBy = body.consented ? req.staff.id : null
      consentNote = body.consented ? String(body.consentNote ?? '').slice(0, 300) : ''
      if (body.consented && !consentNote) {
        throw badRequest('CONSENT_NOTE_REQUIRED', 'Record how consent was obtained.')
      }
    }

    db.prepare(`
      INSERT INTO doctor_contacts
        (doctor_id, phone, phone_hint, verified_at, notify_sms, lang,
         consent_at, consent_by, consent_note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(doctor_id) DO UPDATE SET
        phone = excluded.phone, phone_hint = excluded.phone_hint,
        verified_at = excluded.verified_at, notify_sms = excluded.notify_sms,
        lang = excluded.lang, consent_at = excluded.consent_at,
        consent_by = excluded.consent_by, consent_note = excluded.consent_note,
        updated_at = excluded.updated_at
    `).run(
      doctor.id, phone, maskPhone(phone), verifiedAt, notifySms, lang,
      consentAt, consentBy, consentNote, existing?.created_at ?? nowIso(), nowIso(),
    )

    audit({
      actorType: 'staff',
      actorId: req.staff.id,
      action: 'doctor.contact_updated',
      entity: 'doctor',
      entityId: doctor.id,
      // Deliberately does not record the number itself.
      detail: { verified: Boolean(verifiedAt), consented: Boolean(consentAt), notifySms: Boolean(notifySms) },
      ip: req.clientIp,
    })

    res.json({ contact: contactRows.all().find((r) => r.id === doctor.id) ?? null })
  }),
)

/** The outbox, newest first — what was sent, what is queued, what was skipped and why. */
adminRouter.get(
  '/notifications',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : null
    const rows = db
      .prepare(`
        SELECT n.*, d.name_en AS doctor_name
        FROM notifications n
        LEFT JOIN doctors d ON d.id = n.recipient_id AND n.recipient_type = 'doctor'
        ${status ? 'WHERE n.status = ?' : ''}
        ORDER BY n.created_at DESC LIMIT 200
      `)
      .all(...(status ? [status] : []))

    res.json({
      notifications: rows.map((r) => ({
        id: r.id,
        event: r.event,
        recipientType: r.recipient_type,
        recipientName: r.doctor_name ?? null,
        appointmentId: r.appointment_id,
        status: r.status,
        attempts: r.attempts,
        addressHint: r.address_hint,
        lastError: r.last_error,
        createdAt: r.created_at,
        sentAt: r.sent_at,
      })),
      counts: db
        .prepare('SELECT status, COUNT(*) AS n FROM notifications GROUP BY status')
        .all()
        .reduce((acc, row) => ({ ...acc, [row.status]: row.n }), {}),
    })
  }),
)

/** Force a delivery pass now, rather than waiting for the poll interval. */
adminRouter.post(
  '/notifications/drain',
  loadSession,
  requireStaff(),
  asyncRoute(async (_req, res) => {
    res.json({ processed: await drainOutbox() })
  }),
)


/* ================================================================== *
 * Assisted booking
 *
 * Reception takes the call and books on the patient's behalf. This is the
 * path that needs no SMS gateway and no patient app — the hospital can run
 * its whole OPD through it from day one, and patient self-service switches
 * on later without changing anything here.
 * ================================================================== */
const patientByPhone = db.prepare('SELECT * FROM patients WHERE phone = ?')

/** Finds or creates the patient record behind a phone number. */
function resolvePatient(phone, name, age, gender) {
  const existing = patientByPhone.get(phone)
  if (existing) {
    // Fill in blanks we learn at the desk, but never overwrite what the
    // patient set themselves.
    if (!existing.full_name && name) {
      db.prepare('UPDATE patients SET full_name = ? WHERE id = ?').run(name, existing.id)
    }
    return patientByPhone.get(phone)
  }
  const id = newId()
  db.prepare(`
    INSERT INTO patients (id, phone, full_name, email, age, gender, created_at)
    VALUES (?, ?, ?, NULL, ?, ?, ?)
  `).run(id, phone, name, age, gender, nowIso())
  return patientByPhone.get(phone)
}

const BOOKING_ERRORS = {
  DOCTOR_NOT_BOOKABLE: 'This doctor is not open for booking yet — publish their schedule first.',
  DOCTOR_NOT_AVAILABLE_THAT_DAY: 'The doctor does not consult on that day.',
  SLOT_NOT_OFFERED: 'That time is not one of the doctor’s slots.',
  SLOT_IN_PAST: 'That time has already passed.',
  DATE_IN_PAST: 'That date has passed.',
  DATE_TOO_FAR: 'That date is beyond the booking window.',
  BAD_DATE: 'Invalid date.',
  BAD_SLOT: 'Invalid time.',
}

adminRouter.post(
  '/appointments',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    const doctor = oneDoctorRow.get(String(req.body?.doctorId ?? ''))
    if (!doctor) throw notFound('DOCTOR_NOT_FOUND')

    const patientBlock = requirePatientBlock(req.body?.patient)
    const date = String(req.body?.date ?? '')
    const slot = String(req.body?.slot ?? '')

    const problem = validateBookingRequest(doctor, date, slot)
    if (problem) throw badRequest(problem, BOOKING_ERRORS[problem] ?? 'Cannot book that slot.')

    const patient = resolvePatient(
      patientBlock.phone, patientBlock.name, patientBlock.age, patientBlock.gender,
    )
    const id = appointmentRef()

    try {
      transaction(() => {
        db.prepare(`
          INSERT INTO appointments (
            id, patient_id, doctor_id, department_id, kind, date, slot, session, fee, status,
            patient_name, patient_age, patient_phone, patient_gender, reason, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'slot', ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, patient.id, doctor.id, doctor.department_id, date, slot,
          sessionOfSlot(doctor, slot), doctor.fee,
          patientBlock.name, patientBlock.age, patientBlock.phone, patientBlock.gender,
          patientBlock.reason, nowIso(), nowIso(),
        )
      })
    } catch (error) {
      if (/UNIQUE constraint failed: appointments\./i.test(String(error?.message))) {
        throw conflict('SLOT_TAKEN', 'Someone just took that slot. Pick another time.')
      }
      throw error
    }

    audit({
      actorType: 'staff', actorId: req.staff.id, action: 'appointment.created_by_staff',
      entity: 'appointment', entityId: id, ip: req.clientIp,
    })
    notify({ event: 'appointment.booked', recipientType: 'doctor', recipientId: doctor.id, appointmentId: id })

    const created = presentAppointment(db.prepare('SELECT * FROM appointments WHERE id = ?').get(id))
    // A booking taken at one counter shows up on the others without a refresh.
    publish('appointment.created', deskView(created, doctor))

    res.status(201).json({ appointment: created })
  }),
)

/**
 * Turns a callback request into a real booking.
 *
 * Without this the callback queue is a dead end: reception can see who is
 * waiting but has no way to finish the job in the app.
 */
adminRouter.post(
  '/appointments/:id/convert',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id)
    if (!row) throw notFound('APPOINTMENT_NOT_FOUND')
    if (row.kind !== 'callback') throw conflict('NOT_A_CALLBACK')
    if (row.status !== 'requested') throw conflict('ALREADY_ACTIONED')

    const doctor = oneDoctorRow.get(row.doctor_id)
    const date = String(req.body?.date ?? '')
    const slot = String(req.body?.slot ?? '')

    const problem = validateBookingRequest(doctor, date, slot)
    if (problem) throw badRequest(problem, BOOKING_ERRORS[problem] ?? 'Cannot book that slot.')

    try {
      transaction(() => {
        db.prepare(`
          UPDATE appointments
          SET kind = 'slot', date = ?, slot = ?, session = ?, status = 'confirmed',
              fee = COALESCE(fee, ?), updated_at = ?
          WHERE id = ?
        `).run(date, slot, sessionOfSlot(doctor, slot), doctor.fee, nowIso(), row.id)
      })
    } catch (error) {
      if (/UNIQUE constraint failed: appointments\./i.test(String(error?.message))) {
        throw conflict('SLOT_TAKEN', 'Someone just took that slot. Pick another time.')
      }
      throw error
    }

    audit({
      actorType: 'staff', actorId: req.staff.id, action: 'appointment.converted',
      entity: 'appointment', entityId: row.id, detail: { date, slot }, ip: req.clientIp,
    })
    notify({ event: 'appointment.booked', recipientType: 'doctor', recipientId: row.doctor_id, appointmentId: row.id })

    const updated = presentAppointment(db.prepare('SELECT * FROM appointments WHERE id = ?').get(row.id))
    publish('appointment.approved', deskView(updated, doctor))

    res.json({ appointment: updated })
  }),
)

/** Free slots for a doctor on a date — what reception reads out on the phone. */
adminRouter.get(
  '/availability/:doctorId',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    const doctor = oneDoctorRow.get(req.params.doctorId)
    if (!doctor) throw notFound('DOCTOR_NOT_FOUND')
    const date = String(req.query.date ?? todayKey())

    const { doctorSlots, parseDays, weekdayOf, isSlotInPast } = await import('../lib/slots.js')
    if (doctor.booking_mode !== 'live' || !parseDays(doctor).includes(weekdayOf(date))) {
      res.json({ date, slots: [] })
      return
    }

    const taken = new Set(
      db.prepare(`
        SELECT slot FROM appointments
        WHERE doctor_id = ? AND date = ? AND kind = 'slot' AND status IN ('pending','confirmed','completed')
      `).all(doctor.id, date).map((r) => r.slot),
    )
    const { morning, evening } = doctorSlots(doctor)
    res.json({
      date,
      slots: [...morning, ...evening]
        .filter((s) => !taken.has(s) && !isSlotInPast(date, s))
        .map((slot) => ({ slot })),
    })
  }),
)


/* ================================================================== *
 * Doctor self-service
 *
 * A doctor edits what is theirs to decide — when they sit, where, which
 * languages they consult in, their fee, and whether they are away.
 *
 * Deliberately NOT editable here: name, qualification, registration number,
 * department and active status. Those are hospital records; a registration
 * number in particular is a credential shown to patients and must be verified
 * by an administrator, not typed in by its owner.
 * ================================================================== */
const SELF_EDITABLE = new Set([
  'days', 'morningStart', 'morningEnd', 'eveningStart', 'eveningEnd',
  'fee', 'room', 'languages', 'about', 'awayFrom', 'awayTo', 'bookingMode',
])
const LOCKED = ['nameEn', 'nameTa', 'qualification', 'regNo', 'departmentId', 'grade', 'active', 'specEn']
const DATE = /^\d{4}-\d{2}-\d{2}$/

adminRouter.get(
  '/me/doctor',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    if (!req.staff.doctor_id) throw forbidden('NOT_A_DOCTOR_ACCOUNT')
    const row = oneDoctorRow.get(req.staff.doctor_id)
    if (!row) throw notFound('DOCTOR_NOT_FOUND')
    const contact = db.prepare('SELECT * FROM doctor_contacts WHERE doctor_id = ?').get(row.id)
    res.json({
      doctor: presentDoctor(row),
      alerts: { enabled: Boolean(contact?.notify_sms), lang: contact?.lang ?? 'en' },
    })
  }),
)

/* ------------------------------------------------------------------ *
 * POST /admin/me/password — change your own password
 *
 * Until this existed, changing a password meant asking whoever has shell
 * access to the server to run a script. That is not a workable arrangement for
 * 25 doctors: in practice it means nobody ever changes theirs, and the
 * password handed to them on a slip of paper on day one is still in use a year
 * later.
 *
 * The current password is required. Without that check, anyone who walked past
 * an unlocked desk terminal could lock the real owner out of their own account.
 * ------------------------------------------------------------------ */
adminRouter.post(
  '/me/password',
  loadSession,
  requireStaff(),
  // Throttled on the account, not the IP: a whole hospital shares one network,
  // so limiting by IP would let one person's mistakes lock out everybody else.
  rateLimit({
    limit: 10,
    windowMs: 15 * 60 * 1000,
    code: 'PASSWORD_CHANGE_LIMIT',
    keyOf: (req) => req.staff?.id ?? req.clientIp,
  }),
  asyncRoute(async (req, res) => {
    const current = String(req.body?.currentPassword ?? '')
    const next = String(req.body?.newPassword ?? '')

    const staff = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.staff.id)
    if (!staff) throw notFound('STAFF_NOT_FOUND')

    if (!verifySecret(current, staff.password_salt, staff.password_hash)) {
      throw unauthorized('WRONG_PASSWORD', 'That is not your current password.')
    }

    // Matches the minimum the account-creation script enforces, so a password
    // set here cannot be weaker than one issued by an administrator.
    if (next.length < 12) {
      throw badRequest('WEAK_PASSWORD', 'Use at least 12 characters.')
    }
    if (next === current) {
      throw badRequest('SAME_PASSWORD', 'That is the password you already have.')
    }

    const salt = randomSalt()
    db.prepare('UPDATE staff SET password_hash = ?, password_salt = ? WHERE id = ?').run(
      hashSecret(next, salt),
      salt,
      staff.id,
    )

    /*
     * Every session for this account is destroyed, including this one — then a
     * fresh token is issued to the browser that asked.
     *
     * Rotating rather than keeping the current token matters: if the reason
     * someone is changing their password is that their session was stolen,
     * leaving the old token valid would defeat the entire exercise. The caller
     * stays signed in because they are handed a new token, not because the old
     * one survived.
     */
    const previous = db
      .prepare("SELECT COUNT(*) n FROM sessions WHERE subject_id = ? AND subject_type = 'staff'")
      .get(staff.id).n
    db.prepare("DELETE FROM sessions WHERE subject_id = ? AND subject_type = 'staff'").run(staff.id)
    startSession(res, req, staff.id, 'staff')

    // Report only the *other* devices — the caller's own does not count as
    // having been signed out from their point of view.
    const ended = { changes: Math.max(0, previous - 1) }

    audit({
      actorType: 'staff',
      actorId: staff.id,
      action: 'staff.password_changed',
      entity: 'staff',
      entityId: staff.id,
      detail: { otherSessionsEnded: Number(ended.changes) },
      ip: req.clientIp,
    })

    res.json({ ok: true, otherSessionsEnded: Number(ended.changes) })
  }),
)

adminRouter.patch(
  '/me/doctor',
  loadSession,
  requireStaff(),
  asyncRoute(async (req, res) => {
    if (!req.staff.doctor_id) throw forbidden('NOT_A_DOCTOR_ACCOUNT')
    const body = req.body ?? {}

    const attempted = LOCKED.filter((key) => body[key] !== undefined)
    if (attempted.length > 0) {
      throw forbidden(
        'FIELD_LOCKED',
        `Only an administrator can change: ${attempted.join(', ')}. Ask the front office.`,
      )
    }

    // Away dates are handled here; everything else reuses the shared doctor
    // update so validation cannot drift between the two paths.
    if (body.awayFrom !== undefined || body.awayTo !== undefined) {
      const from = body.awayFrom || null
      const to = body.awayTo || null
      if ((from && !DATE.test(from)) || (to && !DATE.test(to))) throw badRequest('INVALID_DATE')
      if (from && to && to < from) throw badRequest('INVALID_RANGE', 'End date is before the start date.')
      db.prepare('UPDATE doctors SET away_from = ?, away_to = ?, updated_at = ? WHERE id = ?')
        .run(from, to, nowIso(), req.staff.doctor_id)
    }
    if (body.about !== undefined) {
      db.prepare('UPDATE doctors SET about_en = ?, updated_at = ? WHERE id = ?')
        .run(String(body.about).slice(0, 600), nowIso(), req.staff.doctor_id)
    }
    if (body.alertsEnabled !== undefined || body.alertsLang !== undefined) {
      const existing = db.prepare('SELECT * FROM doctor_contacts WHERE doctor_id = ?').get(req.staff.doctor_id)
      if (existing) {
        db.prepare('UPDATE doctor_contacts SET notify_sms = ?, lang = ?, updated_at = ? WHERE doctor_id = ?')
          .run(
            body.alertsEnabled === undefined ? existing.notify_sms : (body.alertsEnabled ? 1 : 0),
            body.alertsLang ? requireEnum(String(body.alertsLang), ['en', 'ta'], 'alertsLang') : existing.lang,
            nowIso(), req.staff.doctor_id,
          )
      }
    }

    const passthrough = Object.fromEntries(
      Object.entries(body).filter(([k]) => SELF_EDITABLE.has(k) && !['awayFrom', 'awayTo', 'about'].includes(k)),
    )
    if (Object.keys(passthrough).length > 0) {
      req.params.id = req.staff.doctor_id
      req.body = passthrough
      // Reuses PATCH /doctors/:id, so the "cannot go live without a schedule"
      // rule applies identically to a doctor editing their own record.
      return adminRouter.handle(
        Object.assign(req, { url: `/doctors/${req.staff.doctor_id}`, method: 'PATCH' }),
        res,
        () => res.json({ doctor: presentDoctor(oneDoctorRow.get(req.staff.doctor_id)) }),
      )
    }

    audit({
      actorType: 'staff', actorId: req.staff.id, action: 'doctor.self_updated',
      entity: 'doctor', entityId: req.staff.doctor_id, ip: req.clientIp,
    })
    res.json({ doctor: presentDoctor(oneDoctorRow.get(req.staff.doctor_id)) })
  }),
)
