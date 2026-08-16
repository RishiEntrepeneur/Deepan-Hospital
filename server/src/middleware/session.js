import { config } from '../config.js'
import { db, nowIso } from '../db.js'
import { hashToken, randomToken, uuid } from '../lib/crypto.js'
import { forbidden, unauthorized } from '../lib/validate.js'

const insertSession = db.prepare(`
  INSERT INTO sessions (token_hash, subject_id, subject_type, created_at, expires_at, user_agent, ip)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)
const findSession = db.prepare('SELECT * FROM sessions WHERE token_hash = ?')
const deleteSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?')
const deleteExpired = db.prepare("DELETE FROM sessions WHERE expires_at < ?")
const findPatient = db.prepare('SELECT * FROM patients WHERE id = ?')
const findStaff = db.prepare('SELECT * FROM staff WHERE id = ? AND active = 1')

const cookieFor = (subjectType) =>
  subjectType === 'staff' ? config.session.staffCookie : config.session.patientCookie

/** Issues a session and sets the cookie. The raw token never touches the DB. */
export function startSession(res, req, subjectId, subjectType) {
  const token = randomToken()
  const expiresAt = new Date(Date.now() + config.session.ttlMs).toISOString()

  insertSession.run(
    hashToken(token),
    subjectId,
    subjectType,
    nowIso(),
    expiresAt,
    req.get('user-agent') ?? null,
    req.clientIp ?? null,
  )

  res.cookie(cookieFor(subjectType), token, {
    httpOnly: true,
    /*
     * 'strict', not 'lax'. Lax still sends the cookie on a top-level
     * navigation from another site, which is fine for a blog and not fine for
     * something holding payment and medical records. The cost is that
     * following a link from an email lands you signed out; for a hospital app
     * that is the right trade.
     */
    sameSite: 'strict',
    secure: config.session.secure,
    maxAge: config.session.ttlMs,
    path: '/',
  })

  // Opportunistic cleanup — cheap, and keeps the table from growing forever.
  deleteExpired.run(nowIso())
  return { token, expiresAt }
}

/** Ends one side only — signing out of the desk leaves a patient signed in. */
export function endSession(req, res, subjectType = 'patient') {
  const name = cookieFor(subjectType)
  const token = req.cookies?.[name]
  if (token) deleteSession.run(hashToken(token))
  res.clearCookie(name, { path: '/' })
}

/**
 * Populates `req.patient` and `req.staff` independently.
 * Both may be set at once — the same person can be a signed-in patient and
 * signed in at the desk, without either displacing the other.
 */
export function loadSession(req, _res, next) {
  for (const [name, type] of [
    [config.session.patientCookie, 'patient'],
    [config.session.staffCookie, 'staff'],
  ]) {
    const token = req.cookies?.[name]
    if (!token) continue

    const row = findSession.get(hashToken(token))
    if (!row) continue

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      deleteSession.run(row.token_hash)
      continue
    }

    // A token from the wrong cookie is not honoured, so a patient token
    // pasted into the staff cookie cannot grant staff access.
    if (row.subject_type !== type) continue

    if (type === 'patient') req.patient = findPatient.get(row.subject_id) ?? null
    else req.staff = findStaff.get(row.subject_id) ?? null
  }

  return next()
}

export function requirePatient(req, _res, next) {
  if (!req.patient) return next(unauthorized('SIGN_IN_REQUIRED'))
  return next()
}

export function requireStaff(role) {
  return (req, _res, next) => {
    if (!req.staff) return next(unauthorized('STAFF_SIGN_IN_REQUIRED'))
    if (role === 'admin' && req.staff.role !== 'admin') return next(forbidden('ADMIN_ONLY'))
    return next()
  }
}

export const uuidv4 = uuid
