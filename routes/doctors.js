/**
 * Doctor listing and profile endpoints.
 *
 *   GET /api/doctors        the consulting list, filterable
 *   GET /api/doctors/:id    one consultant, with their department attached
 *
 * The doctors also travel inside GET /api/catalog, which is what the front end
 * actually boots from — one call for departments, doctors, fees and booking
 * rules together, because a patient on a 3G phone in Trichy should wait for one
 * round trip, not five. These two endpoints exist for everything that is not
 * that first paint: a deep link to a profile that should not have to download
 * all 21 departments, and anything outside the browser reading the list.
 *
 * Rows are shaped by presentDoctor() from catalog.js rather than a second copy
 * here. That function is the boundary that decides which columns are safe to
 * put in front of a browser, and a hospital gets exactly one of those.
 */
import express from 'express'
import { db } from '../db.js'
import { rateLimit } from '../lib/rateLimit.js'
import { asyncRoute } from '../middleware/base.js'
import { notFound } from '../lib/validate.js'
import { presentDepartment, presentDoctor } from './catalog.js'

const router = express.Router()

const allDoctors = db.prepare(
  'SELECT * FROM doctors WHERE active = 1 ORDER BY sort_order, name_en',
)
const oneDoctor = db.prepare('SELECT * FROM doctors WHERE id = ? AND active = 1')
const oneDepartment = db.prepare('SELECT * FROM departments WHERE id = ? AND active = 1')

/*
 * Public, because a patient has to be able to read the list before deciding
 * whether to register — but capped, because it is the cheapest thing on the
 * server to ask for in a loop.
 */
const listLimiter = rateLimit({ limit: 120, windowMs: 60 * 1000, code: 'DOCTORS_LIMIT' })

/** Fields a patient might reasonably type into the search box. */
const searchable = (doctor) =>
  [
    doctor.name.en,
    doctor.name.ta,
    doctor.name.hi,
    doctor.specialization.en,
    doctor.specialization.ta,
    doctor.specialization.hi,
    doctor.qualification,
  ]
    .join(' ')
    .toLowerCase()

/**
 * GET /api/doctors
 *
 * Query parameters, all optional:
 *   department  department id, e.g. 'cardiology'
 *   bookable    'true' → only doctors whose online slots are actually open
 *   q           free text matched against name, specialisation, qualification
 *
 * An unknown department is not an error. It returns an empty list, because the
 * caller is a dropdown that may be one deploy behind the database, and a 404
 * there would blank the page instead of showing "no doctors found".
 */
router.get(
  '/',
  listLimiter,
  asyncRoute(async (req, res) => {
    const department = String(req.query.department ?? '').trim()
    const needle = String(req.query.q ?? '').trim().toLowerCase()
    const bookableOnly = String(req.query.bookable ?? '') === 'true'

    let doctors = allDoctors.all().map(presentDoctor)

    if (department) doctors = doctors.filter((d) => d.departmentId === department)
    if (bookableOnly) doctors = doctors.filter((d) => d.bookingMode === 'live')
    if (needle) doctors = doctors.filter((d) => searchable(d).includes(needle))

    res.json({ doctors, count: doctors.length })
  }),
)

/**
 * GET /api/doctors/:id
 *
 * The department is included so a profile page can name it without a second
 * call. A doctor whose department has since been deactivated still resolves —
 * department comes back null rather than 404, because the consultant is real
 * either way and hiding them would lose a bookable clinic over a stale row.
 */
router.get(
  '/:id',
  listLimiter,
  asyncRoute(async (req, res) => {
    const row = oneDoctor.get(String(req.params.id))
    if (!row) throw notFound('DOCTOR_NOT_FOUND')

    const departmentRow = oneDepartment.get(row.department_id)

    res.json({
      doctor: presentDoctor(row),
      department: departmentRow ? presentDepartment(departmentRow) : null,
    })
  }),
)

export const doctorRouter = router
