/**
 * The session-mode driver, proven end to end against a Rails-faithful mock.
 *
 * These never touch the real Klinique and use no real credential. They prove
 * the protocol: fetch a form, carry its CSRF token and cookie, sign in, submit,
 * and — the part that actually matters for a hospital — fail safely when
 * anything is wrong, so a booking is never silently lost.
 *
 *   node --test test/klinique-session.test.js
 *
 * Run on its own because it sets KLINIQUE_* in the environment and imports the
 * driver fresh; the main api.test.js runs the server in a separate process.
 */
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startKliniqueMock } from './klinique-mock.js'

let mock
let session
let workdir

const booking = {
  id: 'DH-TEST01',
  patient_name: 'Test Patient',
  patient_phone: '9876500000',
  patient_age: 40,
  patient_gender: 'male',
  date: '2026-09-01',
  slot: '10:20',
  reason: 'follow up',
  doctor_id: 'deepan-g',
}

before(async () => {
  mock = await startKliniqueMock({ username: 'website', password: 'correct-horse' })

  // A throwaway database, so the pushAppointment integration test below can
  // write appointment state without touching the real file.
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'deepan-klin-'))
  process.env.DATABASE_FILE = path.join(workdir, 'test.db')
  process.env.BACKUP_ENABLED = 'false'

  // Configure session mode to point at the mock, then import the driver so it
  // reads this environment. config.js is read at import time.
  process.env.KLINIQUE_MODE = 'session'
  process.env.KLINIQUE_BASE_URL = mock.baseUrl
  process.env.KLINIQUE_USERNAME = 'website'
  process.env.KLINIQUE_PASSWORD = 'correct-horse'
  process.env.KLINIQUE_LOGIN_PATH = '/users/sign_in'
  process.env.KLINIQUE_BOOKING_NEW_PATH = '/appointments/new'
  process.env.KLINIQUE_BOOKING_PATH = '/appointments'
  process.env.KLINIQUE_FIELD_MAP = JSON.stringify({
    'appointment[patient_name]': 'name',
    'appointment[phone]': 'phone',
    'appointment[age]': 'age',
    'appointment[gender]': 'gender',
    'appointment[date]': 'date',
    'appointment[time]': 'time',
    'appointment[reason]': 'reason',
    'appointment[doctor_id]': 'doctorRef',
  })
  process.env.KLINIQUE_DOCTOR_MAP = JSON.stringify({ 'deepan-g': '42' })

  session = await import('../src/lib/klinique-session.js')
})

after(async () => {
  await mock?.close()
  if (workdir) fs.rmSync(workdir, { recursive: true, force: true })
})

describe('Klinique session mode', () => {
  it('reports itself ready once configured', () => {
    assert.equal(session.isSessionMode(), true)
    assert.equal(session.isSessionSubmitReady(), true)
  })

  it('signs in through the CSRF-protected form', async () => {
    const result = await session.signIn()
    assert.ok(result.cookie.includes('_session_id'), 'no session cookie kept')
  })

  it('submits a booking and reads back the new record id', async () => {
    const result = await session.submitBooking(booking)
    assert.equal(result.ok, true, result.reason)
    assert.equal(result.ref, '1', 'did not read the created record id from the redirect')

    const [saved] = mock.bookings
    assert.equal(saved['appointment[patient_name]'], 'Test Patient')
    assert.equal(saved['appointment[phone]'], '9876500000')
    // The doctor id was translated to Klinique's own, not sent as ours.
    assert.equal(saved['appointment[doctor_id]'], '42')
  })

  it('translates every mapped field and nothing else', async () => {
    mock.bookings.length = 0
    await session.submitBooking(booking)
    const saved = mock.bookings[0]
    assert.equal(saved['appointment[gender]'], 'male')
    assert.equal(saved['appointment[date]'], '2026-09-01')
    assert.equal(saved['appointment[time]'], '10:20')
    assert.ok(!('appointment[fee]' in saved), 'sent a field that was never mapped')
  })

  it('re-signs-in by itself when the session is dropped', async () => {
    session.resetSession()
    const result = await session.submitBooking(booking)
    assert.equal(result.ok, true, 'did not recover from a dropped session')
  })

  it('reports a failure (never throws) when a required field is missing', async () => {
    const result = await session.submitBooking({ ...booking, patient_name: '' })
    assert.equal(result.ok, false)
    assert.match(result.reason, /200/)
  })

  it('a booking flows through pushAppointment into Klinique', async () => {
    // The real integration: the same call the booking route makes must submit
    // to Klinique and mark the appointment 'sent'.
    mock.setPassword('correct-horse')
    mock.bookings.length = 0
    session.resetSession()

    const { db, migrate } = await import('../src/db.js')
    migrate()
    const { pushAppointment } = await import('../src/lib/klinique.js')

    // This test exercises the Klinique wiring, not referential integrity, and
    // the throwaway database has no doctor or department rows to point at.
    db.exec('PRAGMA foreign_keys = OFF')

    db.prepare(
      `INSERT INTO appointments
        (id, doctor_id, department_id, patient_name, patient_age, patient_phone,
         patient_gender, date, slot, reason, status, kind, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'slot', ?, ?)`,
    ).run(
      'DH-FLOW01', 'deepan-g', 'general-medicine', 'Flow Patient', 51, '9876511111',
      'female', '2026-09-02', '11:00', 'cough', new Date(0).toISOString(), new Date(0).toISOString(),
    )
    const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get('DH-FLOW01')

    const result = await pushAppointment(row)
    assert.equal(result.state, 'sent', result.reason)
    assert.equal(mock.bookings.length, 1, 'Klinique never received the booking')

    const after = db.prepare('SELECT klinique_status FROM appointments WHERE id = ?').get('DH-FLOW01')
    assert.equal(after.klinique_status, 'sent')
  })

  it('a failed submit leaves the booking on the manual worklist', async () => {
    const { db } = await import('../src/db.js')
    const { pushAppointment } = await import('../src/lib/klinique.js')

    // Rotate the password so the submit fails, then push a fresh booking.
    mock.setPassword('now-wrong')
    session.resetSession()
    db.prepare(
      `INSERT INTO appointments
        (id, doctor_id, department_id, patient_name, patient_age, patient_phone,
         patient_gender, date, slot, reason, status, kind, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'slot', ?, ?)`,
    ).run(
      'DH-FLOW02', 'deepan-g', 'general-medicine', 'Fail Patient', 33, '9876522222',
      'male', '2026-09-03', '12:00', 'fever', new Date(0).toISOString(), new Date(0).toISOString(),
    )
    const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get('DH-FLOW02')

    const result = await pushAppointment(row)
    assert.equal(result.state, 'failed')
    const after = db.prepare('SELECT klinique_status FROM appointments WHERE id = ?').get('DH-FLOW02')
    assert.equal(after.klinique_status, 'failed', 'a failure must land on the worklist, not vanish')

    mock.setPassword('correct-horse')
    session.resetSession()
  })

  it('fails safely, not fatally, when the credentials are refused', async () => {
    // Rotate the account's password on Klinique's side; the driver still sends
    // the old one, so the login is refused — exactly what a changed or wrong
    // KLINIQUE_PASSWORD looks like.
    mock.setPassword('rotated-on-their-side')
    session.resetSession()
    await assert.rejects(() => session.signIn(), /refused the credentials/)

    // And a booking in that state fails to the worklist rather than throwing.
    const result = await session.submitBooking(booking)
    assert.equal(result.ok, false)

    mock.setPassword('correct-horse')
    session.resetSession()
  })
})
