import fs from 'node:fs'
import express from 'express'
import { db, nowIso } from '../db.js'
import { hashToken, safeEqualHex } from '../lib/crypto.js'
import { audit } from '../lib/audit.js'
import { rateLimit } from '../lib/rateLimit.js'
import { badRequest, forbidden, notFound } from '../lib/validate.js'
import { asyncRoute } from '../middleware/base.js'
import { loadSession } from '../middleware/session.js'
import { ACCEPTED, MAX_BYTES, pathFor, safeName, sniff, store } from '../lib/attachments.js'

/**
 * Uploading and reading the photographs a patient sends with a booking.
 *
 * The order of events is the awkward part: a patient picks the photo while
 * filling in the form, long before an appointment exists to hang it on. So an
 * upload creates a free-standing row and hands back a token; the booking then
 * presents that token to claim the file. A patient who changes their mind
 * leaves an orphan, which the retention job clears out after a day.
 *
 * Reading is the part that matters for privacy. These are medical images, so
 * the rule is narrow: reception and the treating doctor, the patient whose
 * appointment it is, and nobody else. Not "anyone with the link" — the id is
 * in the desk's HTML, and a hospital's files should not be one leaked URL away
 * from the internet.
 */
export const attachmentsRouter = express.Router()

const insertAttachment = db.prepare(`
  INSERT INTO attachments
    (id, appointment_id, patient_id, token_hash, kind, mime, byte_size, original_name, stored_name, created_at, ip)
  VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
const oneAttachment = db.prepare('SELECT * FROM attachments WHERE id = ?')
const appointmentOf = db.prepare('SELECT * FROM appointments WHERE id = ?')

/* An upload is cheap for us and expensive to abuse, so the limit is per hour. */
const uploadLimiter = rateLimit({ limit: 20, windowMs: 60 * 60 * 1000, code: 'UPLOAD_LIMIT' })

/* ------------------------------------------------------------------ *
 * POST /attachments — send one file
 * ------------------------------------------------------------------ *
 * The body is the raw bytes, not a form: multipart would mean a parser
 * dependency for a single field. The type comes from Content-Type and is
 * checked against the bytes themselves before anything is written.
 */
attachmentsRouter.post(
  '/',
  uploadLimiter,
  loadSession,
  express.raw({ type: ACCEPTED, limit: MAX_BYTES }),
  asyncRoute(async (req, res) => {
    const mime = String(req.headers['content-type'] ?? '').split(';')[0].trim()
    if (!Buffer.isBuffer(req.body)) {
      throw badRequest('FILE_TYPE', 'Send a photo (JPG, PNG, WebP) or a PDF.')
    }

    const kind = sniff(mime, req.body)
    const { id, storedName, token } = store(mime, req.body)

    insertAttachment.run(
      id,
      req.patient?.id ?? null,
      hashToken(token),
      kind,
      mime,
      req.body.length,
      safeName(req.headers['x-file-name']),
      storedName,
      nowIso(),
      req.clientIp,
    )

    audit({
      actorType: req.patient ? 'patient' : 'guest',
      actorId: req.patient?.id ?? null,
      action: 'attachment.uploaded',
      entity: 'attachment',
      entityId: id,
      detail: { kind, bytes: req.body.length },
      ip: req.clientIp,
    })

    res.status(201).json({ id, token, kind, name: safeName(req.headers['x-file-name']) })
  }),
)

/**
 * Claim uploaded files for a booking that has just been created.
 *
 * Exported rather than exposed as a route: only the booking handlers call it,
 * inside the same request that created the appointment. Each file must be
 * presented with the token issued at upload, so one patient cannot attach
 * another patient's photograph to their own booking by guessing an id.
 */
export function attachToAppointment(list, appointmentId, patientId) {
  if (!Array.isArray(list) || list.length === 0) return 0
  const bind = db.prepare(
    'UPDATE attachments SET appointment_id = ?, patient_id = COALESCE(patient_id, ?) WHERE id = ?',
  )
  let bound = 0
  for (const entry of list.slice(0, 4)) {
    const row = oneAttachment.get(String(entry?.id ?? ''))
    if (!row || row.appointment_id) continue
    if (!safeEqualHex(row.token_hash, hashToken(String(entry?.token ?? '')))) continue
    bind.run(appointmentId, patientId ?? null, row.id)
    bound += 1
  }
  return bound
}

/** What the desk and the doctor are told about an appointment's files. */
const forAppointment = db.prepare(
  'SELECT id, kind, mime, byte_size, original_name FROM attachments WHERE appointment_id = ? ORDER BY created_at',
)

export function attachmentsFor(appointmentId) {
  return forAppointment.all(appointmentId).map((row) => ({
    id: row.id,
    kind: row.kind,
    mime: row.mime,
    bytes: row.byte_size,
    name: row.original_name,
  }))
}

/**
 * Who may read one file.
 *
 * A doctor account is deliberately narrower than reception: it sees only the
 * files belonging to its own patients, matching every other doctor-scoped
 * endpoint. An unattached file belongs to nobody yet, so only the uploader —
 * holding the token — can read it back.
 */
function mayRead(req, row) {
  const token = String(req.query.token ?? '')
  if (token && safeEqualHex(row.token_hash, hashToken(token))) return true

  if (req.staff) {
    if (!req.staff.doctor_id) return true // reception and the manager
    const appointment = row.appointment_id ? appointmentOf.get(row.appointment_id) : null
    return Boolean(appointment && appointment.doctor_id === req.staff.doctor_id)
  }

  if (req.patient && row.patient_id && row.patient_id === req.patient.id) return true
  return false
}

/* ------------------------------------------------------------------ *
 * GET /attachments/:id — read one file
 * ------------------------------------------------------------------ */
attachmentsRouter.get(
  '/:id',
  loadSession,
  asyncRoute(async (req, res) => {
    const row = oneAttachment.get(String(req.params.id))
    if (!row) throw notFound('ATTACHMENT_NOT_FOUND')
    if (!mayRead(req, row)) throw forbidden('NOT_YOURS')

    let bytes
    try {
      bytes = fs.readFileSync(pathFor(row.stored_name))
    } catch {
      throw notFound('ATTACHMENT_NOT_FOUND')
    }

    /*
     * Served defensively, because the one thing worse than not showing a
     * patient's report is running it. nosniff stops the browser second-guessing
     * the type; the sandbox CSP means that even a file that somehow got past
     * the signature check executes nothing and reaches nothing; no-store keeps
     * a medical image out of the disk cache on a shared reception computer.
     */
    res.setHeader('Content-Type', row.mime)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox; base-uri 'none'")
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('Content-Length', String(bytes.length))
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${(row.original_name || 'attachment').replace(/"/g, '')}"`,
    )
    res.end(bytes)
  }),
)
