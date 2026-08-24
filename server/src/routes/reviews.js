import express from 'express'
import { db, nowIso } from '../db.js'
import { uuid } from '../lib/crypto.js'
import { audit } from '../lib/audit.js'
import { rateLimit } from '../lib/rateLimit.js'
import { badRequest, conflict, forbidden, notFound, requireEnum } from '../lib/validate.js'
import { asyncRoute } from '../middleware/base.js'
import { loadSession, requirePatient } from '../middleware/session.js'

/**
 * Patient reviews.
 *
 * Two publics meet here. A patient who has actually been seen may leave one
 * review per visit; anyone at all may read the reviews that a staff member has
 * approved. Nothing a patient writes is visible until then — the moderation
 * endpoints live in admin.js, behind a staff session.
 */
export const reviewsRouter = express.Router()

const MAX_COMMENT = 600
const MAX_NAME = 60

/* One review per appointment; the row also proves the visit really happened. */
const reviewForAppointment = db.prepare('SELECT * FROM reviews WHERE appointment_id = ?')
const ownedAppointment = db.prepare('SELECT * FROM appointments WHERE id = ?')

const insertReview = db.prepare(`
  INSERT INTO reviews
    (id, appointment_id, patient_id, doctor_id, rating, comment, display_name, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
`)

/*
 * The public list joins the doctor's name for display but never the patient's
 * identity beyond the name they chose to show. Approved only, newest first.
 */
const approvedReviews = db.prepare(`
  SELECT r.id, r.rating, r.comment, r.display_name, r.created_at,
         d.name_en AS doctor_name, d.id AS doctor_id
  FROM reviews r
  LEFT JOIN doctors d ON d.id = r.doctor_id
  WHERE r.status = 'approved'
  ORDER BY r.created_at DESC
  LIMIT ?
`)
const approvedSummary = db.prepare(
  "SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews WHERE status = 'approved'",
)

function presentPublicReview(row) {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    name: row.display_name || 'A patient',
    doctorName: row.doctor_name || null,
    date: row.created_at,
  }
}

/* ------------------------------------------------------------------ *
 * GET /reviews — the public wall. Approved reviews and their average.
 * ------------------------------------------------------------------ */
reviewsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50)
    const rows = approvedReviews.all(limit)
    const summary = approvedSummary.get()
    res.json({
      summary: {
        count: Number(summary.n) || 0,
        average: summary.avg != null ? Math.round(Number(summary.avg) * 10) / 10 : null,
      },
      reviews: rows.map(presentPublicReview),
    })
  }),
)

/* ------------------------------------------------------------------ *
 * GET /reviews/eligible — which of my completed visits I can still review.
 * Lets the app show a "leave a review" prompt only where it would work.
 * ------------------------------------------------------------------ */
const myCompletedUnreviewed = db.prepare(`
  SELECT a.id, a.doctor_id, a.date, a.patient_name
  FROM appointments a
  WHERE a.patient_id = ? AND a.status = 'completed'
    AND a.id NOT IN (SELECT appointment_id FROM reviews)
  ORDER BY a.date DESC
  LIMIT 20
`)

reviewsRouter.get(
  '/eligible',
  loadSession,
  requirePatient,
  asyncRoute(async (req, res) => {
    const rows = myCompletedUnreviewed.all(req.patient.id)
    res.json({
      appointments: rows.map((r) => ({
        id: r.id,
        doctorId: r.doctor_id,
        date: r.date,
        patientName: r.patient_name,
      })),
    })
  }),
)

/* ------------------------------------------------------------------ *
 * POST /reviews — leave a review for one of my completed visits.
 * ------------------------------------------------------------------ */
const submitLimiter = rateLimit({ limit: 10, windowMs: 60 * 60 * 1000, code: 'REVIEW_LIMIT' })

reviewsRouter.post(
  '/',
  loadSession,
  requirePatient,
  submitLimiter,
  asyncRoute(async (req, res) => {
    const body = req.body ?? {}

    const appointmentId = String(body.appointmentId ?? '').trim()
    if (!appointmentId) throw badRequest('APPOINTMENT_REQUIRED', 'Which visit is this review for?')

    const rating = Number(body.rating)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw badRequest('RATING_REQUIRED', 'Please give a rating from 1 to 5 stars.')
    }

    const comment = String(body.comment ?? '').trim().slice(0, MAX_COMMENT)
    // A name is optional; default to the booking name, then a neutral label.
    const displayName = String(body.displayName ?? '').trim().slice(0, MAX_NAME)

    const appointment = ownedAppointment.get(appointmentId)
    if (!appointment) throw notFound('APPOINTMENT_NOT_FOUND')
    if (appointment.patient_id !== req.patient.id) throw forbidden('NOT_YOUR_APPOINTMENT')
    if (appointment.status !== 'completed') {
      throw conflict('NOT_COMPLETED', 'You can review a visit once it is completed.')
    }
    if (reviewForAppointment.get(appointmentId)) {
      throw conflict('ALREADY_REVIEWED', 'You have already reviewed this visit. Thank you!')
    }

    const id = uuid()
    insertReview.run(
      id,
      appointmentId,
      req.patient.id,
      appointment.doctor_id,
      rating,
      comment,
      displayName || appointment.patient_name || '',
      nowIso(),
    )

    audit({
      actorType: 'patient',
      actorId: req.patient.id,
      action: 'review.submitted',
      entity: 'review',
      entityId: id,
      ip: req.clientIp,
    })

    // Deliberately no review body echoed back — it is not public yet.
    res.status(201).json({ ok: true, status: 'pending' })
  }),
)

// Exported so admin.js moderation and the retention job share one definition of
// the columns and constraints without re-querying the table shape.
export { MAX_COMMENT, MAX_NAME }
