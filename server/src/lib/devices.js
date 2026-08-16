/**
 * Bearer tokens for reception computers.
 *
 * Why these exist at all: the staff session cookie is SameSite=strict, so a
 * request made from a chrome-extension:// page never carries it. The choice
 * was to loosen that cookie for the whole application or to give the
 * extension its own credential. This is the second option.
 *
 * A device token is deliberately worth very little if it leaks. It opens the
 * Klinique worklist and the "entered" tick, and nothing else — no patient
 * records, no payments, no staff administration. Each reception computer has
 * its own, so one can be revoked without disturbing the others, and every
 * token carries a label so the list means something to whoever reads it.
 */

import { db, nowIso } from '../db.js'
import { hashToken, randomToken, uuid } from './crypto.js'
import { unauthorized } from './validate.js'

const insertDevice = db.prepare(`
  INSERT INTO desk_devices (id, label, token_hash, created_at, created_by)
  VALUES (?, ?, ?, ?, ?)
`)
const findByHash = db.prepare('SELECT * FROM desk_devices WHERE token_hash = ?')
const touch = db.prepare('UPDATE desk_devices SET last_used_at = ? WHERE id = ?')
const listAll = db.prepare(`
  SELECT id, label, created_at, last_used_at, revoked_at
  FROM desk_devices ORDER BY created_at DESC
`)
const revoke = db.prepare('UPDATE desk_devices SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')

/** Recognisable on sight, so one pasted into the wrong box is obvious. */
const PREFIX = 'dhk_'

/**
 * Issues a token. The raw value is returned once and never stored — if it is
 * lost, the answer is to revoke that device and issue another.
 */
export function issueDevice(label, staffId = null) {
  const token = PREFIX + randomToken()
  const id = uuid()
  insertDevice.run(id, label, hashToken(token), nowIso(), staffId)
  return { id, label, token }
}

export const listDevices = () => listAll.all()
export const revokeDevice = (id) => revoke.run(nowIso(), id).changes > 0

/**
 * Reads `Authorization: Bearer …` and, if it names a live device, sets
 * `req.device`. Never rejects — an absent or unknown token simply leaves the
 * request unauthenticated, and the route decides what that means.
 */
export function loadDevice(req, _res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return next()

  const token = header.slice(7).trim()
  if (!token) return next()

  const row = findByHash.get(hashToken(token))
  if (!row || row.revoked_at) return next()

  touch.run(nowIso(), row.id)
  req.device = row
  return next()
}

/**
 * Either a signed-in member of staff or a registered device.
 *
 * Used only on the two Klinique worklist routes. Everything else on the
 * admin router still requires a real person to be signed in.
 */
export function requireDesk(req, _res, next) {
  if (req.staff || req.device) return next()
  return next(unauthorized('STAFF_SIGN_IN_REQUIRED'))
}

/**
 * For the audit log: who did this. A device is recorded as a device, not as
 * whoever set it up — the log should say a reception computer ticked this
 * off, because that is what happened.
 */
export const actorOf = (req) =>
  req.staff
    ? { actorType: 'staff', actorId: req.staff.id }
    : req.device
      ? { actorType: 'device', actorId: req.device.id }
      : { actorType: 'system', actorId: null }
