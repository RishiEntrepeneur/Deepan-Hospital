import { config } from '../config.js'
import { db, nowIso } from '../db.js'
import { audit } from './audit.js'
import { removeFile } from './attachments.js'

/**
 * Retention and erasure.
 *
 * India's DPDP Act 2023 requires personal data to be kept no longer than the
 * purpose needs. It also has to survive contact with medical record-keeping
 * rules, which pull the other way — so the rule here is deliberately narrow:
 *
 *   Delete what nobody is required to hold. Keep clinical history.
 *
 * Cancelled bookings, spent OTPs, expired sessions, old alerts and old audit
 * lines go. Prescriptions, records and completed appointments stay, because a
 * hospital is obliged to keep them and a patient is usually glad it did.
 */
const cutoff = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

export function runRetention() {
  const removed = {}
  const run = (label, sql, ...params) => {
    const info = db.prepare(sql).run(...params)
    if (info.changes) removed[label] = Number(info.changes)
  }

  // Spent or expired one-time codes have no purpose the moment they are used.
  run('otp', "DELETE FROM otp_codes WHERE expires_at < ?", nowIso())
  run('sessions', 'DELETE FROM sessions WHERE expires_at < ?', nowIso())

  /*
   * Uploads that never became a booking.
   *
   * Somebody picked a photograph of a wound, thought better of it and closed
   * the tab. The file is on disk with nothing pointing at it, so it is deleted
   * outright after a day — an unattached medical image is pure liability.
   */
  const orphans = db
    .prepare("SELECT id, stored_name FROM attachments WHERE appointment_id IS NULL AND created_at < ?")
    .all(cutoff(1))
  for (const row of orphans) {
    removeFile(row.stored_name)
    db.prepare('DELETE FROM attachments WHERE id = ?').run(row.id)
  }
  if (orphans.length) removed.orphan_attachments = orphans.length

  /*
   * The files belonging to bookings about to be deleted. Their rows carry a
   * foreign key to appointments, so they have to go first — and the bytes on
   * disk have to go with them, or the folder fills with images nothing in the
   * database can account for.
   */
  const doomed = db
    .prepare(
      `SELECT a.id, a.stored_name FROM attachments a
       JOIN appointments p ON p.id = a.appointment_id
       WHERE p.status = 'cancelled' AND p.updated_at < ?`,
    )
    .all(cutoff(config.privacy.cancelledDays))
  for (const row of doomed) {
    removeFile(row.stored_name)
    db.prepare('DELETE FROM attachments WHERE id = ?').run(row.id)
  }
  if (doomed.length) removed.attachments = doomed.length

  run(
    'cancelled_appointments',
    "DELETE FROM appointments WHERE status = 'cancelled' AND updated_at < ?",
    cutoff(config.privacy.cancelledDays),
  )
  run(
    'notifications',
    'DELETE FROM notifications WHERE created_at < ?',
    cutoff(config.privacy.notificationDays),
  )
  run('audit', 'DELETE FROM audit_log WHERE at < ?', cutoff(config.privacy.auditDays))

  /*
   * A patient who asked to be erased is unlinked once nothing clinical still
   * points at them. The appointment rows themselves are kept where the law
   * requires, but they no longer identify a person.
   */
  const erasable = db
    .prepare(
      `SELECT id FROM patients WHERE erased_at IS NOT NULL
       AND id NOT IN (
         SELECT patient_id FROM appointments
         WHERE patient_id IS NOT NULL AND status IN ('pending', 'confirmed', 'requested')
       )`,
    )
    .all()
  for (const row of erasable) {
    db.prepare('UPDATE appointments SET patient_id = NULL WHERE patient_id = ?').run(row.id)
    // A review is feedback, not a record the hospital must keep — it holds the
    // patient's own words, so it goes with them, and its FK would block the
    // delete besides.
    db.prepare('DELETE FROM reviews WHERE patient_id = ?').run(row.id)
    for (const file of db
      .prepare('SELECT id, stored_name FROM attachments WHERE patient_id = ?')
      .all(row.id)) {
      removeFile(file.stored_name)
      db.prepare('DELETE FROM attachments WHERE id = ?').run(file.id)
    }
    db.prepare('DELETE FROM patients WHERE id = ?').run(row.id)
  }
  if (erasable.length) removed.erased_patients = erasable.length

  if (Object.keys(removed).length) {
    audit({ actorType: 'system', action: 'retention.ran', detail: removed })
    console.log('[retention]', JSON.stringify(removed))
  }
  return removed
}

/**
 * Everything the hospital holds about one patient, for a subject access
 * request. Built by reading rather than by hand-listing fields, so a column
 * added later cannot silently go missing from the export.
 */
export function exportPatient(patientId) {
  const one = (sql, ...p) => db.prepare(sql).all(...p)
  return {
    exportedAt: nowIso(),
    profile: db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId) ?? null,
    appointments: one('SELECT * FROM appointments WHERE patient_id = ?', patientId),
    payments: one(
      'SELECT * FROM payments WHERE appointment_id IN (SELECT id FROM appointments WHERE patient_id = ?)',
      patientId,
    ),
    prescriptions: one('SELECT * FROM prescriptions WHERE patient_id = ?', patientId),
    prescriptionItems: one(
      'SELECT * FROM prescription_items WHERE prescription_id IN (SELECT id FROM prescriptions WHERE patient_id = ?)',
      patientId,
    ),
    medicalRecords: one('SELECT * FROM medical_records WHERE patient_id = ?', patientId),
    reviews: one('SELECT * FROM reviews WHERE patient_id = ?', patientId),
    // tokens carry no patient_id — they hang off the appointment.
    tokens: one(
      'SELECT * FROM tokens WHERE appointment_id IN (SELECT id FROM appointments WHERE patient_id = ?)',
      patientId,
    ),
  }
}

/**
 * Marks a patient erased and blanks what is not required to be kept.
 *
 * Immediate rather than deferred: the identifying fields go now, and the row
 * itself is removed by the retention job once no live appointment needs it.
 * The phone is replaced rather than emptied because it carries a UNIQUE
 * constraint — two erased patients must not collide.
 */
export function erasePatient(patientId) {
  const at = nowIso()
  db.prepare(
    `UPDATE patients
     SET full_name = '', email = NULL, age = NULL, gender = NULL,
         phone = 'erased:' || id, erased_at = ?
     WHERE id = ?`,
  ).run(at, patientId)
  db.prepare('DELETE FROM sessions WHERE subject_id = ? AND subject_type = ?').run(patientId, 'patient')
  audit({ actorType: 'patient', actorId: patientId, action: 'patient.erased' })
  return at
}

/** Runs at boot and daily thereafter. Never allowed to take the server down. */
export function startRetention() {
  const tick = () => {
    try {
      runRetention()
    } catch (error) {
      console.error('[retention] failed', error)
    }
  }
  tick()
  const timer = setInterval(tick, 24 * 60 * 60 * 1000)
  timer.unref?.()
  return timer
}
