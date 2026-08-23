import express from 'express'
import { rateLimit } from '../lib/rateLimit.js'
import { db } from '../db.js'
import { config } from '../config.js'
import { asyncRoute } from '../middleware/base.js'
import { notFound } from '../lib/validate.js'
import {
  doctorSlots,
  isDateKey,
  isSlotInPast,
  parseDays,
  weekdayOf,
} from '../lib/slots.js'

export const catalogRouter = express.Router()

const allDepartments = db.prepare(
  'SELECT * FROM departments WHERE active = 1 ORDER BY sort_order, name_en',
)
const allDoctors = db.prepare(
  'SELECT * FROM doctors WHERE active = 1 ORDER BY sort_order, name_en',
)
const oneDoctor = db.prepare('SELECT * FROM doctors WHERE id = ? AND active = 1')
const takenSlotsFor = db.prepare(`
  SELECT slot FROM appointments
  WHERE doctor_id = ? AND date = ? AND kind = 'slot' AND status IN ('pending', 'confirmed', 'completed')
`)

const jsonArray = (value, fallback = []) => {
  if (!value) return fallback
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

/**
 * A translatable field, as the front end's `tl()` expects it.
 *
 * Falls back per field rather than per row: a department named in Hindi but
 * not yet described in Hindi shows the Hindi name beside the English
 * description. Mixed, but every word of it is the best available, which is the
 * point of a fallback.
 */
const say = (en, ta, hi) => ({ en, ta: ta || en, hi: hi || en })

/** Shapes a DB row for the client. Null stays null — nothing is invented. */
export function presentDoctor(row) {
  return {
    id: row.id,
    departmentId: row.department_id,
    name: say(row.name_en, row.name_ta, row.name_hi),
    grade: row.grade,
    specialization: say(row.spec_en, row.spec_ta, row.spec_hi),
    qualification: row.qualification,
    regNo: row.reg_no,
    experience: row.experience,
    fee: row.fee,
    // Null means "same as the first-visit fee" — see lib/fees.js.
    feeReview: row.fee_review,
    room: row.room,
    languages: jsonArray(row.languages, ['ta', 'en']),
    days: parseDays(row),
    sessions: {
      morning: row.morning_start && row.morning_end ? [row.morning_start, row.morning_end] : null,
      evening: row.evening_start && row.evening_end ? [row.evening_start, row.evening_end] : null,
    },
    bookingMode: row.booking_mode,
    about: row.about_en ?? '',
    away: row.away_from && row.away_to ? { from: row.away_from, to: row.away_to } : null,
    featured: Boolean(row.featured),
  }
}

export function presentDepartment(row) {
  return {
    id: row.id,
    icon: row.icon,
    name: say(row.name_en, row.name_ta, row.name_hi),
    description: say(row.description_en, row.description_ta, row.description_hi),
  }
}

/** Everything the front end needs to render the catalogue, in one call. */
catalogRouter.get(
  '/catalog',
  asyncRoute(async (_req, res) => {
    res.json({
      departments: allDepartments.all().map(presentDepartment),
      doctors: allDoctors.all().map(presentDoctor),
      booking: {
        windowDays: config.booking.windowDays,
        slotMinutes: config.booking.slotMinutes,
        /*
         * Sent so the booking form can show the patient what they will pay
         * before they commit. The server still computes the real total at
         * booking — this is for display, not arithmetic anyone relies on.
         */
        visitCharges: config.booking.visitCharges,
      },
      klinique: {
        // Staff embed the hospital's clinical system on the desk; the URL is
        // the hospital's to change, so it travels as config not a constant.
        portalUrl: config.klinique.portalUrl,
      },
      privacy: {
        version: config.privacy.version,
        // Null falls back to the hospital's general address on the front end.
        contact: config.privacy.contact,
      },
      payments: {
        provider: config.payments.provider,
        convenienceFee: config.payments.convenienceFee,
        razorpayKeyId: config.payments.razorpay.keyId ?? null,
      },
    })
  }),
)

/** Live availability for one doctor on one date. */
catalogRouter.get(
  '/doctors/:id/availability',
  // Public by design — a patient must see free slots before signing in. Capped
  // so it cannot be walked to map a doctor's whole diary, or used to keep the
  // slot query running against the database in a loop.
  rateLimit({ limit: 120, windowMs: 60 * 1000, code: 'AVAILABILITY_LIMIT' }),
  asyncRoute(async (req, res) => {
    const doctor = oneDoctor.get(req.params.id)
    if (!doctor) throw notFound('DOCTOR_NOT_FOUND')

    const date = String(req.query.date ?? '')
    if (!isDateKey(date)) {
      res.json({ doctorId: doctor.id, date: null, bookingMode: doctor.booking_mode, slots: [] })
      return
    }

    if (doctor.booking_mode !== 'live' || !parseDays(doctor).includes(weekdayOf(date))) {
      res.json({ doctorId: doctor.id, date, bookingMode: doctor.booking_mode, slots: [] })
      return
    }

    const taken = new Set(takenSlotsFor.all(doctor.id, date).map((r) => r.slot))
    const { morning, evening } = doctorSlots(doctor)

    const shape = (slot, session) => ({
      slot,
      session,
      available: !taken.has(slot) && !isSlotInPast(date, slot),
      reason: taken.has(slot) ? 'taken' : isSlotInPast(date, slot) ? 'past' : null,
    })

    res.json({
      doctorId: doctor.id,
      date,
      bookingMode: doctor.booking_mode,
      slots: [
        ...morning.map((s) => shape(s, 'morning')),
        ...evening.map((s) => shape(s, 'evening')),
      ],
    })
  }),
)
