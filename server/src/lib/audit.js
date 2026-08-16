import { db, nowIso } from '../db.js'

const stmt = db.prepare(`
  INSERT INTO audit_log (at, actor_type, actor_id, action, entity, entity_id, detail, ip)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)

/**
 * Records who did what. Patient-identifying detail is deliberately kept out —
 * store the entity id and look the record up, rather than copying names here.
 */
export function audit({ actorType = 'system', actorId = null, action, entity = null, entityId = null, detail = null, ip = null }) {
  stmt.run(
    nowIso(),
    actorType,
    actorId,
    action,
    entity,
    entityId,
    detail ? JSON.stringify(detail) : null,
    ip,
  )
}
