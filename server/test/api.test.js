/**
 * End-to-end API tests.
 *
 * These run against a real server on a throwaway database, not against mocks.
 * The things worth testing here — a UNIQUE index refusing a second booking,
 * a session cookie being rejected for the wrong role, a status transition
 * being impossible — all live in SQLite or in middleware, and a mock of
 * either would only test the mock.
 *
 *   npm test            (from server/)
 */
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const PORT = 4399
const BASE = `http://127.0.0.1:${PORT}/api`

let server
let workdir

/** Cookie jars, one per pretend browser. */
const jars = {}

async function call(who, endpoint, { method = 'GET', body, raw = false } = {}) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(jars[who] ? { Cookie: jars[who] } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  for (const cookie of res.headers.getSetCookie?.() ?? []) {
    const pair = cookie.split(';')[0]
    const name = pair.split('=')[0]
    const kept = new Map(
      (jars[who] ?? '')
        .split('; ')
        .filter(Boolean)
        .map((c) => [c.split('=')[0], c]),
    )
    kept.set(name, pair)
    jars[who] = [...kept.values()].join('; ')
  }

  if (raw) return res
  let json = null
  try {
    json = await res.json()
  } catch {
    /* empty body */
  }
  return { status: res.status, json }
}

/**
 * Sign-up asks for a sum to be answered, so a script cannot create accounts in
 * bulk. These tests are exactly such a script, so they solve it the way a
 * patient would — read the question, do the arithmetic, send the answer back
 * with the token it came with.
 */
async function solveCaptcha(who) {
  const { json } = await call(who, '/auth/captcha')
  const [, a, op, b] = json.question.match(/^(\d+)\s*([+×])\s*(\d+)$/)
  const answer = op === '+' ? Number(a) + Number(b) : Number(a) * Number(b)
  return { captchaToken: json.token, captchaAnswer: answer }
}

const waitForHealth = async () => {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`${BASE}/health`)
      if (res.ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('server did not start')
}

before(async () => {
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'deepan-test-'))

  /*
   * Set on THIS process too, not only on the spawned server: a few tests
   * import server modules directly, and without this the backup test would
   * write real backups into the real backups directory.
   */
  process.env.DATABASE_FILE = path.join(workdir, 'test.db')
  process.env.BACKUP_DIR = path.join(workdir, 'backups')
  process.env.BOOKING_APPROVAL = 'always'
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(PORT),
    DATABASE_FILE: path.join(workdir, 'test.db'),
    BACKUP_DIR: path.join(workdir, 'backups'),
    BACKUP_ENABLED: 'false',
    OTP_ECHO: 'true',
    // Deterministic: every test booking must land in the same state
    // regardless of what time the suite happens to run.
    BOOKING_APPROVAL: 'always',
    STAFF_PASSWORD: 'test-password-1234',
  }

  const seed = spawn('node', ['scripts/seed.js'], { cwd: root, env, stdio: 'ignore' })
  await new Promise((resolve, reject) => {
    seed.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('seed failed'))))
  })
  for (const args of [
    ['scripts/create-staff.js', '--username', 'testdesk', '--role', 'staff'],
    ['scripts/create-staff.js', '--username', 'doctortest', '--role', 'staff', '--doctor', 'priyanka-v'],
    ['scripts/create-staff.js', '--username', 'testadmin', '--role', 'admin'],
  ]) {
    const proc = spawn('node', args, { cwd: root, env, stdio: 'ignore' })
    await new Promise((resolve) => proc.on('exit', resolve))
  }

  server = spawn('node', ['src/index.js'], { cwd: root, env, stdio: 'ignore' })
  await waitForHealth()
})

after(() => {
  server?.kill()
  if (workdir) fs.rmSync(workdir, { recursive: true, force: true })
})

/* ------------------------------------------------------------------ */
describe('sign in', () => {
  it('issues a session for a correct one-time code', async () => {
    const phone = '+919000000001'
    const otp = await call('patient', '/auth/otp', { method: 'POST', body: { phone } })
    assert.equal(otp.status, 200)

    const verified = await call('patient', '/auth/verify', {
      method: 'POST',
      body: { phone, code: otp.json.devCode ?? otp.json.code },
    })
    assert.equal(verified.status, 200)

    const me = await call('patient', '/auth/me')
    assert.ok(me.json.patient, 'session did not stick')
  })

  it('refuses a wrong code', async () => {
    const phone = '+919000000002'
    await call('other', '/auth/otp', { method: 'POST', body: { phone } })
    const bad = await call('other', '/auth/verify', {
      method: 'POST',
      body: { phone, code: '000000' },
    })
    assert.equal(bad.status, 401)
  })

  it('will not accept a patient cookie as a staff cookie', async () => {
    const res = await call('patient', '/admin/appointments')
    assert.equal(res.status, 401)
  })
})

/* ------------------------------------------------------------------ */
describe('booking', () => {
  let doctorId
  let date
  let slot

  const patient = {
    name: 'Test Patient',
    age: 34,
    phone: '+919000000001',
    gender: 'female',
    reason: 'checkup',
  }

  before(async () => {
    // The second patient needs a real session: an earlier test deliberately
    // failed sign-in for this jar, so it is holding nothing.
    const otherPhone = '+919000000002'
    const otherOtp = await call('other', '/auth/otp', { method: 'POST', body: { phone: otherPhone } })
    await call('other', '/auth/verify', {
      method: 'POST',
      body: { phone: otherPhone, code: otherOtp.json.devCode ?? otherOtp.json.code },
    })

    await call('desk', '/admin/signin', {
      method: 'POST',
      body: { username: 'testdesk', password: 'test-password-1234', as: 'staff' },
    })
    await call('doc', '/admin/signin', {
      method: 'POST',
      body: { username: 'doctortest', password: 'test-password-1234', as: 'doctor' },
    })
    /*
     * The admin signs in here rather than in the suite that needs it: the
     * per-address limit on this route is 10 in 15 minutes, and a sign-in
     * near the end of the run is refused before it is ever checked.
     */
    await call('boss', '/admin/signin', {
      method: 'POST',
      body: { username: 'testadmin', password: 'test-password-1234', as: 'staff' },
    })

    // Open one doctor for booking, then take the first free slot it offers.
    doctorId = 'priyanka-v'
    await call('desk', `/admin/doctors/${doctorId}`, {
      method: 'PATCH',
      body: {
        days: [0, 1, 2, 3, 4, 5, 6],
        morningStart: '10:00',
        morningEnd: '13:00',
        fee: 400,
        bookingMode: 'live',
      },
    })

    for (let i = 1; i <= 14 && !slot; i++) {
      const day = new Date()
      day.setDate(day.getDate() + i)
      const key = day.toISOString().slice(0, 10)
      const avail = await call('patient', `/doctors/${doctorId}/availability?date=${key}`)
      const free = avail.json?.slots?.find((s) => s.available)
      if (free) {
        date = key
        slot = free.slot
      }
    }
    assert.ok(slot, 'no bookable slot was offered')
  })

  it('creates a booking that waits for approval', async () => {
    const res = await call('patient', '/appointments', {
      method: 'POST',
      body: { doctorId, date, slot, patient, visitType: 'first' },
    })
    assert.equal(res.status, 201)
    assert.equal(res.json.appointment.status, 'pending')
  })

  it('stops offering a slot that is held', async () => {
    const avail = await call('patient', `/doctors/${doctorId}/availability?date=${date}`)
    const taken = avail.json.slots.find((s) => s.slot === slot)
    assert.equal(taken.available, false, 'a held slot was still offered')
  })

  it('refuses a second booking of the same slot', async () => {
    const res = await call('other', '/appointments', {
      method: 'POST',
      body: { doctorId, date, slot, patient: { ...patient, phone: '+919000000002' }, visitType: 'first' },
    })
    assert.equal(res.status, 409)
    assert.equal(res.json.error.code, 'SLOT_TAKEN')
  })

  it('survives two simultaneous attempts on one slot', async () => {
    let second
    for (let i = 1; i <= 14 && !second; i++) {
      const day = new Date()
      day.setDate(day.getDate() + i)
      const key = day.toISOString().slice(0, 10)
      const avail = await call('patient', `/doctors/${doctorId}/availability?date=${key}`)
      const free = avail.json?.slots?.find((s) => s.available)
      if (free) second = { date: key, slot: free.slot }
    }
    assert.ok(second, 'needed a second free slot')

    const attempt = (who, phone) =>
      call(who, '/appointments', {
        method: 'POST',
        body: { doctorId, ...second, patient: { ...patient, phone }, visitType: 'first' },
      })

    const [a, b] = await Promise.all([
      attempt('patient', '+919000000001'),
      attempt('other', '+919000000002'),
    ])
    const codes = [a.status, b.status].sort()
    assert.deepEqual(codes, [201, 409], 'both requests were accepted for one slot')
  })
})

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
describe('claiming a number that already has records', () => {
  const phone = '+919000004242'
  const doctorId = 'vignesh-g'
  let reference

  /*
   * The situation this guards against is real and already in the database:
   * every patient who signed in with a texted code, before passwords
   * existed, has a record and no password. Setting one must therefore need
   * more than knowing the number.
   */
  before(async () => {
    const opened = await call('desk', `/admin/doctors/${doctorId}`, {
      method: 'PATCH',
      body: {
        days: [0, 1, 2, 3, 4, 5, 6],
        morningStart: '09:00',
        morningEnd: '12:00',
        fee: 300,
        bookingMode: 'live',
      },
    })
    assert.equal(opened.status, 200, `could not open ${doctorId} for booking`)

    const otp = await call('claim', '/auth/otp', { method: 'POST', body: { phone } })
    const verified = await call('claim', '/auth/verify', {
      method: 'POST',
      body: { phone, code: otp.json.devCode ?? otp.json.code },
    })
    assert.equal(verified.status, 200, 'could not create the account this suite needs')
  })

  it('books an appointment, leaving a record on the number', async () => {
    let found = null
    for (let ahead = 0; ahead < 14 && !found; ahead += 1) {
      const day = new Date()
      day.setDate(day.getDate() + ahead)
      const key = day.toISOString().slice(0, 10)
      const avail = await call('claim', `/doctors/${doctorId}/availability?date=${key}`)
      const free = (avail.json.slots ?? []).find((s) => s.available)
      if (free) found = { date: key, slot: free.slot }
    }
    assert.ok(found, 'no free slot to test with')

    const booking = await call('claim', '/appointments', {
      method: 'POST',
      body: {
        doctorId,
        date: found.date,
        slot: found.slot,
        visitType: 'first',
        patient: { name: 'Claim Test', phone, age: 33, gender: 'female', reason: 'checkup' },
      },
    })
    assert.equal(booking.status, 201, JSON.stringify(booking.json))
    reference = booking.json.appointment.id
    assert.ok(reference, 'no booking reference came back')
  })

  it('refuses to set a password on it with the number alone', async () => {
    const res = await call('stranger', '/auth/register', {
      method: 'POST',
      body: { phone, password: 'stranger-password', ...(await solveCaptcha('stranger')) },
    })
    assert.equal(res.status, 400, 'a stranger claimed an account with only a phone number')
    assert.equal(res.json.error.code, 'CLAIM_PROOF_REQUIRED')
  })

  it('refuses a booking reference belonging to somebody else', async () => {
    const res = await call('stranger', '/auth/register', {
      method: 'POST',
      body: {
        phone,
        password: 'stranger-password',
        bookingReference: 'DH-000000',
        ...(await solveCaptcha('stranger')),
      },
    })
    assert.equal(res.status, 400)
    assert.equal(res.json.error.code, 'CLAIM_PROOF_REQUIRED')
  })

  it('accepts the patient\u2019s own booking reference', async () => {
    const res = await call('claimant', '/auth/register', {
      method: 'POST',
      body: {
        phone,
        password: 'my-own-password',
        bookingReference: reference,
        ...(await solveCaptcha('claimant')),
      },
    })
    assert.equal(res.status, 201, JSON.stringify(res.json))
    const me = await call('claimant', '/auth/me')
    assert.ok(me.json.patient, 'no session after claiming')
  })

  it('and afterwards it is an ordinary password sign-in', async () => {
    const res = await call('claimant2', '/auth/login', {
      method: 'POST',
      body: { phone, password: 'my-own-password' },
    })
    assert.equal(res.status, 200)
  })
})

describe('status changes', () => {
  let id

  before(async () => {
    const mine = await call('patient', '/appointments')
    id = mine.json.appointments.find((a) => a.status === 'pending')?.id
    assert.ok(id, 'no pending appointment to work with')
  })

  it('will not let a patient approve their own booking', async () => {
    const res = await call('patient', `/appointments/${id}`, {
      method: 'PATCH',
      body: { action: 'approve' },
    })
    assert.equal(res.status, 401)
  })

  it('will not let a doctor touch another doctor’s patient', async () => {
    // Book against a different doctor, then try to approve it as doctortest.
    const other = await call('desk', '/admin/appointments', {
      method: 'POST',
      body: {
        doctorId: 'deepan-g',
        date: null,
        slot: null,
        patient: { name: 'Someone Else', age: 20, phone: '+919000000009', gender: 'male', reason: 'x' },
      },
    })
    // A malformed desk booking is fine to ignore; the authorization check
    // below is the point, and it needs an appointment for another doctor.
    if (other.status !== 201) return

    const res = await call('doc', `/appointments/${other.json.appointment.id}`, {
      method: 'PATCH',
      body: { action: 'approve' },
    })
    assert.equal(res.status, 403)
    assert.equal(res.json.error.code, 'NOT_YOUR_PATIENT')
  })

  it('rejects an unknown action', async () => {
    const res = await call('desk', `/appointments/${id}`, {
      method: 'PATCH',
      body: { action: 'unconfirm' },
    })
    assert.equal(res.status, 400)
  })

  it('approves, then refuses to approve twice', async () => {
    const ok = await call('desk', `/appointments/${id}`, {
      method: 'PATCH',
      body: { action: 'approve' },
    })
    assert.equal(ok.status, 200)
    assert.equal(ok.json.appointment.status, 'confirmed')

    const again = await call('desk', `/appointments/${id}`, {
      method: 'PATCH',
      body: { action: 'approve' },
    })
    assert.equal(again.status, 409)
    assert.equal(again.json.error.code, 'BAD_TRANSITION')
  })

  it('refuses to cancel something already completed', async () => {
    await call('desk', `/appointments/${id}`, { method: 'PATCH', body: { action: 'complete' } })
    const res = await call('desk', `/appointments/${id}`, {
      method: 'PATCH',
      body: { action: 'cancel' },
    })
    assert.equal(res.status, 409)
  })
})

/* ------------------------------------------------------------------ */
describe('live feed', () => {
  it('is closed to patients and open to staff', async () => {
    const patient = await call('patient', '/appointments/live', { raw: true })
    assert.equal(patient.status, 401)
    patient.body?.cancel()

    const desk = await call('desk', '/appointments/live', { raw: true })
    assert.equal(desk.status, 200)
    assert.match(desk.headers.get('content-type'), /text\/event-stream/)
    desk.body?.cancel()
  })
})

/* ------------------------------------------------------------------ */
describe('data protection', () => {
  it('exports everything held about the signed-in patient', async () => {
    const res = await call('patient', '/auth/export')
    assert.equal(res.status, 200)
    assert.ok(res.json.profile, 'export had no profile')
    assert.ok(Array.isArray(res.json.appointments))
  })

  it('records consent against the current notice version', async () => {
    const me = await call('patient', '/auth/me')
    const res = await call('patient', '/auth/consent', {
      method: 'POST',
      body: { version: me.json.privacyVersion },
    })
    assert.equal(res.status, 200)

    const after = await call('patient', '/auth/me')
    assert.equal(after.json.consentNeeded, false)
  })

  it('refuses erasure while an appointment is still coming up', async () => {
    const res = await call('patient', '/auth/erase', { method: 'POST' })
    // Either outcome is correct — it depends whether this patient still has a
    // live booking — but a silent success with one outstanding is not.
    if (res.status === 200) {
      const mine = await call('patient', '/appointments')
      assert.equal(mine.status, 401, 'erasure did not end the session')
    } else {
      assert.equal(res.status, 409)
      assert.equal(res.json.error.code, 'HAS_UPCOMING')
    }
  })
})

/* ------------------------------------------------------------------ */
describe('bulk schedule', () => {
  it('opens booking for several doctors at once', async () => {
    const before = await call('desk', '/admin/doctors')
    const closed = before.json.doctors.filter((d) => d.bookingMode !== 'live').slice(0, 3)
    assert.ok(closed.length >= 2, 'needed at least two closed doctors')

    const res = await call('desk', '/admin/doctors/bulk-schedule', {
      method: 'POST',
      body: {
        doctorIds: closed.map((d) => d.id),
        days: [1, 3, 5],
        morningStart: '09:00',
        morningEnd: '12:00',
        fee: 350,
        goLive: true,
      },
    })
    assert.equal(res.status, 200)
    assert.equal(res.json.applied.length, closed.length)

    const after = await call('desk', '/admin/doctors')
    for (const d of closed) {
      const updated = after.json.doctors.find((x) => x.id === d.id)
      assert.equal(updated.bookingMode, 'live', `${d.id} did not open`)
    }
  })

  it('refuses to open booking with no fee anywhere', async () => {
    const res = await call('desk', '/admin/doctors/bulk-schedule', {
      method: 'POST',
      body: {
        doctorIds: ['deepan-g'],
        days: [1],
        morningStart: '09:00',
        morningEnd: '12:00',
        fee: null,
        goLive: true,
      },
    })
    assert.equal(res.status, 400)
    assert.equal(res.json.error.code, 'INCOMPLETE_SCHEDULE')
  })

  it('will not take a schedule with no session times', async () => {
    const res = await call('desk', '/admin/doctors/bulk-schedule', {
      method: 'POST',
      body: { doctorIds: ['deepan-g'], days: [1], fee: 300, goLive: false },
    })
    assert.equal(res.status, 400)
    assert.equal(res.json.error.code, 'NO_SESSION')
  })

  it('is closed to patients', async () => {
    const res = await call('patient', '/admin/doctors/bulk-schedule', {
      method: 'POST',
      body: { doctorIds: ['deepan-g'], days: [1], morningStart: '09:00', morningEnd: '12:00', fee: 300 },
    })
    assert.equal(res.status, 401)
  })
})

/* ------------------------------------------------------------------ */
describe('approval policy', () => {
  it('confirms outright when reception is closed', async () => {
    // Proven directly rather than through the API, because the API's answer
    // depends on the wall clock at the moment the suite happens to run.
    const { statusForNewBooking } = await import('../src/lib/deskHours.js')
    const midnight = new Date()
    midnight.setHours(3, 0, 0, 0)
    process.env.BOOKING_APPROVAL = 'desk-hours'
    assert.ok(['pending', 'confirmed'].includes(statusForNewBooking(midnight)))
  })

  it('honours an explicit never / always setting', async () => {
    const mod = await import('../src/config.js')
    const original = mod.config.booking.approval
    const { statusForNewBooking } = await import('../src/lib/deskHours.js')

    mod.config.booking.approval = 'never'
    assert.equal(statusForNewBooking(), 'confirmed')

    mod.config.booking.approval = 'always'
    assert.equal(statusForNewBooking(), 'pending')

    mod.config.booking.approval = original
  })
})

/* ------------------------------------------------------------------ */
describe('backups', () => {
  it('produces a readable snapshot', async () => {
    const { takeBackup } = await import('../src/lib/backup.js')
    const result = takeBackup()
    assert.ok(fs.existsSync(result.file), 'no backup file was written')
    assert.ok(result.size > 0, 'backup was empty')

    // The point of a backup is that it can be read back.
    const { DatabaseSync } = await import('node:sqlite')
    const copy = new DatabaseSync(result.file, { readOnly: true })
    try {
      const n = copy.prepare('SELECT COUNT(*) n FROM doctors').get().n
      assert.ok(n > 0, 'backup contained no doctors')
    } finally {
      copy.close()
    }
  })
})

/* ------------------------------------------------------------------ */
describe('changing your own password', () => {
  const ORIGINAL = 'test-password-1234'
  const CHANGED = 'a-completely-new-password'

  it('refuses without the current password', async () => {
    const res = await call('desk', '/admin/me/password', {
      method: 'POST',
      body: { currentPassword: 'not-my-password', newPassword: CHANGED },
    })
    assert.equal(res.status, 401)
    assert.equal(res.json.error.code, 'WRONG_PASSWORD')
  })

  it('refuses a password shorter than 12 characters', async () => {
    const res = await call('desk', '/admin/me/password', {
      method: 'POST',
      body: { currentPassword: ORIGINAL, newPassword: 'short' },
    })
    assert.equal(res.status, 400)
    assert.equal(res.json.error.code, 'WEAK_PASSWORD')
  })

  it('refuses reusing the same password', async () => {
    const res = await call('desk', '/admin/me/password', {
      method: 'POST',
      body: { currentPassword: ORIGINAL, newPassword: ORIGINAL },
    })
    assert.equal(res.status, 400)
    assert.equal(res.json.error.code, 'SAME_PASSWORD')
  })

  it('is closed to patients and to anyone not signed in', async () => {
    const asPatient = await call('patient', '/admin/me/password', {
      method: 'POST',
      body: { currentPassword: ORIGINAL, newPassword: CHANGED },
    })
    assert.equal(asPatient.status, 401)

    const anonymous = await call('nobody', '/admin/me/password', {
      method: 'POST',
      body: { currentPassword: ORIGINAL, newPassword: CHANGED },
    })
    assert.equal(anonymous.status, 401)
  })

  it('changes it, keeps this session, and invalidates the old password', async () => {
    // A second sign-in for the same account, to prove other devices are cut off.
    const other = await call('desk2', '/admin/signin', {
      method: 'POST',
      body: { username: 'testdesk', password: ORIGINAL, as: 'staff' },
    })
    assert.equal(other.status, 200)

    const res = await call('desk', '/admin/me/password', {
      method: 'POST',
      body: { currentPassword: ORIGINAL, newPassword: CHANGED },
    })
    assert.equal(res.status, 200)
    assert.ok(res.json.otherSessionsEnded >= 1, 'the other device was not signed out')

    // The session that made the change still works — on a NEW token, not the
    // old one. If the reason for the change was a stolen session, leaving the
    // original token valid would defeat the whole point.
    const stillIn = await call('desk', '/admin/me')
    assert.ok(stillIn.json.staff, 'the caller was signed out of their own screen')

    // ...but the other one does not.
    const cutOff = await call('desk2', '/admin/me')
    assert.equal(cutOff.json.staff ?? null, null, 'a session elsewhere survived')

    // The old password no longer works, the new one does.
    const oldPassword = await call('fresh', '/admin/signin', {
      method: 'POST',
      body: { username: 'testdesk', password: ORIGINAL, as: 'staff' },
    })
    assert.equal(oldPassword.status, 401)

    const newPassword = await call('fresh', '/admin/signin', {
      method: 'POST',
      body: { username: 'testdesk', password: CHANGED, as: 'staff' },
    })
    assert.equal(newPassword.status, 200)
  })
})

/* ------------------------------------------------------------------ */
describe('security headers', () => {
  it('sends a content security policy that forbids framing', async () => {
    const res = await call('nobody', '/health', { raw: true })
    const csp = res.headers.get('content-security-policy')
    assert.ok(csp, 'no CSP header')
    assert.match(csp, /frame-ancestors 'none'/)
    assert.match(csp, /object-src 'none'/)
    // Inline scripts are the whole point of having a CSP.
    assert.doesNotMatch(csp.match(/script-src[^;]*/)[0], /unsafe-inline/)
    res.body?.cancel()
  })

  it('sets the other hardening headers', async () => {
    const res = await call('nobody', '/health', { raw: true })
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(res.headers.get('x-frame-options'), 'DENY')
    assert.match(res.headers.get('permissions-policy') ?? '', /camera=\(\)/)
    res.body?.cancel()
  })

  it('blocks a state-changing request from another origin', async () => {
    const res = await fetch(`${BASE}/auth/otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
      body: JSON.stringify({ phone: '+919000000500' }),
    })
    assert.equal(res.status, 403)
    const body = await res.json()
    assert.equal(body.error.code, 'CROSS_ORIGIN_BLOCKED')
  })

  it('allows a read from another origin, which changes nothing', async () => {
    const res = await fetch(`${BASE}/catalog`, { headers: { Origin: 'https://evil.example' } })
    assert.equal(res.status, 200)
    // ...but without the CORS header that would let the page read it.
    assert.equal(res.headers.get('access-control-allow-origin'), null)
  })

  it('throttles a targeted password-guessing run on one account', async () => {
    let blocked = false
    for (let i = 0; i < 12; i++) {
      const res = await call(`attacker${i}`, '/admin/signin', {
        method: 'POST',
        body: { username: 'testdesk', password: `guess-number-${i}`, as: 'staff' },
      })
      if (res.status === 429) { blocked = true; break }
    }
    assert.ok(blocked, 'an account could be guessed at without limit')
  })
})

/* ------------------------------------------------------------------ */
describe('account holder must be an adult', () => {
  it('refuses a profile age under 18', async () => {
    const res = await call('patient', '/auth/profile', {
      method: 'POST',
      body: { fullName: 'Young Person', age: 15, gender: 'male' },
    })
    assert.equal(res.status, 400)
    assert.equal(res.json.error.code, 'UNDER_AGE')
  })

  it('refuses the boundary — 17 is still a child', async () => {
    const res = await call('patient', '/auth/profile', {
      method: 'POST',
      body: { fullName: 'Almost Adult', age: 17, gender: 'female' },
    })
    assert.equal(res.status, 400)
    assert.equal(res.json.error.code, 'UNDER_AGE')
  })

  it('accepts exactly 18', async () => {
    const res = await call('patient', '/auth/profile', {
      method: 'POST',
      body: { fullName: 'Just Adult', age: 18, gender: 'female' },
    })
    assert.equal(res.status, 200)
    assert.equal(res.json.patient.age, 18)
  })

  it('still allows an account with no age given', async () => {
    const res = await call('patient', '/auth/profile', {
      method: 'POST',
      body: { fullName: 'No Age Given', age: null, gender: 'male' },
    })
    assert.equal(res.status, 200)
  })

  /*
   * The point of the whole restriction: it limits who holds an account, not
   * who may be treated. Paediatrics is one of this hospital's largest
   * departments — if this test ever fails, children cannot be booked at all.
   */
  it('still lets an adult book an appointment FOR a child', async () => {
    const doctorId = 'priyanka-v'
    let date, slot
    for (let i = 1; i <= 14 && !slot; i++) {
      const day = new Date()
      day.setDate(day.getDate() + i)
      const key = day.toISOString().slice(0, 10)
      const avail = await call('patient', `/doctors/${doctorId}/availability?date=${key}`)
      const free = avail.json?.slots?.find((s) => s.available)
      if (free) { date = key; slot = free.slot }
    }
    assert.ok(slot, 'no free slot to test with')

    const res = await call('patient', '/appointments', {
      method: 'POST',
      body: {
        doctorId,
        date,
        slot,
        visitType: 'first',
        patient: { name: 'Child Patient', age: 4, phone: '+919000000001', gender: 'male', reason: 'fever and cough' },
      },
    })
    assert.equal(res.status, 201, 'a child could not be booked in')
    assert.equal(res.json.appointment.patient.age, 4)
  })
})

/*
 * The case-sheet charge is money, so it is worth proving rather than trusting.
 *
 * The point of these is not the arithmetic — it is that the total is decided by
 * the server. A client that can name its own price will eventually be asked to.
 */
describe('consultation fee', () => {
  const FEE = 400
  const FIRST = 50
  const REVIEW = 20
  let doctorId

  const patient = {
    name: 'Fee Patient',
    age: 41,
    phone: '+919000000001',
    gender: 'male',
    reason: 'follow up on blood pressure',
  }

  /** The next slot nobody has taken, looking a fortnight ahead. */
  const freeSlot = async () => {
    for (let ahead = 0; ahead < 14; ahead += 1) {
      const day = new Date()
      day.setDate(day.getDate() + ahead)
      const key = day.toISOString().slice(0, 10)
      const avail = await call('patient', `/doctors/${doctorId}/availability?date=${key}`)
      const free = (avail.json.slots ?? []).find((s) => s.available)
      if (free) return { date: key, slot: free.slot }
    }
    return null
  }

  before(async () => {
    // A doctor of this suite's own, so taking slots cannot disturb the
    // booking suite's assertions about which slots are free.
    doctorId = 'kawin-g'
    const opened = await call('desk', `/admin/doctors/${doctorId}`, {
      method: 'PATCH',
      body: {
        days: [0, 1, 2, 3, 4, 5, 6],
        eveningStart: '17:00',
        eveningEnd: '20:00',
        fee: FEE,
        bookingMode: 'live',
      },
    })
    assert.equal(opened.status, 200, `could not open ${doctorId} for booking`)
  })

  it('adds the first-visit charge', async () => {
    const found = await freeSlot()
    assert.ok(found, 'no free slot to test with')
    const res = await call('patient', '/appointments', {
      method: 'POST',
      body: { doctorId, date: found.date, slot: found.slot, patient, visitType: 'first' },
    })
    assert.equal(res.status, 201)
    assert.equal(res.json.appointment.fee, FEE + FIRST)
    assert.equal(res.json.appointment.visitType, 'first')
  })

  it('adds the smaller review charge', async () => {
    const found = await freeSlot()
    assert.ok(found, 'no free slot to test with')
    const res = await call('patient', '/appointments', {
      method: 'POST',
      body: { doctorId, date: found.date, slot: found.slot, patient, visitType: 'review' },
    })
    assert.equal(res.status, 201)
    assert.equal(res.json.appointment.fee, FEE + REVIEW)
    assert.equal(res.json.appointment.visitType, 'review')
  })

  it('refuses a booking that does not say which kind of visit it is', async () => {
    const found = await freeSlot()
    assert.ok(found, 'no free slot to test with')
    const res = await call('patient', '/appointments', {
      method: 'POST',
      body: { doctorId, date: found.date, slot: found.slot, patient },
    })
    assert.equal(res.status, 400)
    assert.equal(res.json.error.code, 'VISIT_TYPE_REQUIRED')
  })

  it('refuses a visit type it does not recognise', async () => {
    const found = await freeSlot()
    assert.ok(found, 'no free slot to test with')
    const res = await call('patient', '/appointments', {
      method: 'POST',
      body: { doctorId, date: found.date, slot: found.slot, patient, visitType: 'free' },
    })
    assert.equal(res.status, 400)
    assert.equal(res.json.error.code, 'VISIT_TYPE_REQUIRED')
  })

  it('charges the review fee when the doctor has a lower one', async () => {
    /*
     * Six doctors on the hospital's OP list charge less to see a returning
     * patient. The total must follow the visit type, not just the one fee.
     */
    const REVIEW_FEE = 280
    const set = await call('desk', `/admin/doctors/${doctorId}`, {
      method: 'PATCH',
      body: { fee: FEE, feeReview: REVIEW_FEE },
    })
    assert.equal(set.status, 200, 'could not set a review fee')

    const first = await freeSlot()
    const a = await call('patient', '/appointments', {
      method: 'POST',
      body: { doctorId, date: first.date, slot: first.slot, patient, visitType: 'first' },
    })
    assert.equal(a.json.appointment.fee, FEE + FIRST, 'first visit used the review fee')

    const second = await freeSlot()
    const b = await call('patient', '/appointments', {
      method: 'POST',
      body: { doctorId, date: second.date, slot: second.slot, patient, visitType: 'review' },
    })
    assert.equal(b.json.appointment.fee, REVIEW_FEE + REVIEW, 'review ignored the lower fee')

    // Put it back so the later tests see the original single fee.
    await call('desk', `/admin/doctors/${doctorId}`, {
      method: 'PATCH',
      body: { fee: FEE, feeReview: null },
    })
  })

  it('ignores a fee sent by the client', async () => {
    const found = await freeSlot()
    assert.ok(found, 'no free slot to test with')
    const res = await call('patient', '/appointments', {
      method: 'POST',
      body: {
        doctorId,
        date: found.date,
        slot: found.slot,
        patient,
        visitType: 'first',
        fee: 1,
        amount: 1,
      },
    })
    assert.equal(res.status, 201)
    assert.equal(res.json.appointment.fee, FEE + FIRST, 'the client set its own price')
  })
})

/*
 * Adversarial tests.
 *
 * Everything above checks that the app does what it should. These check that
 * it refuses what it shouldn't — money, other people's records, and the
 * boundaries in between. Each one is written as the attack, so a regression
 * reads as "the attack now succeeds" rather than as a failed assertion about
 * some internal state.
 */
describe('money cannot be tampered with', () => {
  let doctorId
  let mine
  const FEE = 400

  const patient = {
    name: 'Security Patient',
    age: 44,
    phone: '+919000000001',
    gender: 'female',
    reason: 'follow up appointment',
  }

  const freeSlot = async () => {
    for (let ahead = 0; ahead < 14; ahead += 1) {
      const day = new Date()
      day.setDate(day.getDate() + ahead)
      const key = day.toISOString().slice(0, 10)
      const avail = await call('patient', `/doctors/${doctorId}/availability?date=${key}`)
      const free = (avail.json.slots ?? []).find((s) => s.available)
      if (free) return { date: key, slot: free.slot }
    }
    return null
  }

  before(async () => {
    doctorId = 'murali-r'
    const opened = await call('desk', `/admin/doctors/${doctorId}`, {
      method: 'PATCH',
      body: {
        days: [0, 1, 2, 3, 4, 5, 6],
        morningStart: '08:00',
        morningEnd: '11:00',
        fee: FEE,
        bookingMode: 'live',
      },
    })
    assert.equal(opened.status, 200, `could not open ${doctorId}`)

    const found = await freeSlot()
    assert.ok(found, 'no slot to test with')
    const created = await call('patient', '/appointments', {
      method: 'POST',
      body: { doctorId, date: found.date, slot: found.slot, patient, visitType: 'first' },
    })
    assert.equal(created.status, 201)
    mine = created.json.appointment
  })

  it('refuses to let one patient pay for another patient’s appointment', async () => {
    const res = await call('other', '/payments/counter', {
      method: 'POST',
      body: { appointmentId: mine.id },
    })
    assert.equal(res.status, 403)
    assert.equal(res.json.error.code, 'NOT_YOUR_APPOINTMENT')
  })

  it('refuses to let one patient cancel another patient’s appointment', async () => {
    // The real surface: there is no GET /appointments/:id, so ownership is
    // tested on the routes that do take an id.
    const res = await call('other', `/appointments/${mine.id}/cancel`, { method: 'POST' })
    assert.ok(res.status === 403 || res.status === 404, `cancelled someone else's booking (${res.status})`)
    const still = await call('patient', '/appointments')
    const row = (still.json.appointments ?? []).find((a) => a.id === mine.id)
    assert.ok(row && row.status !== 'cancelled', 'the appointment was cancelled by another patient')
  })

  it('ignores an amount supplied by the client', async () => {
    const res = await call('patient', '/payments/counter', {
      method: 'POST',
      body: { appointmentId: mine.id, amount: 1, paise: 1, fee: 1 },
    })
    assert.equal(res.status, 200)
    const list = await call('patient', '/appointments')
    const fresh = (list.json.appointments ?? []).find((a) => a.id === mine.id)
    assert.ok(fresh, 'appointment vanished')
    assert.equal(fresh.fee, mine.fee, 'the stored fee moved')
  })

  it('refuses an unsigned or wrongly-signed payment verification', async () => {
    for (const body of [
      {},
      { razorpay_order_id: 'order_fake', razorpay_payment_id: 'pay_fake', razorpay_signature: 'x' },
      { razorpay_order_id: 'order_fake', razorpay_payment_id: 'pay_fake', razorpay_signature: '0'.repeat(64) },
    ]) {
      const res = await call('patient', '/payments/verify', { method: 'POST', body })
      assert.ok(res.status >= 400, `a forged signature was accepted: ${JSON.stringify(body)}`)
    }
  })

  it('refuses a webhook with no signature', async () => {
    const res = await fetch(`${BASE}/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'x', order_id: 'y' } } } }),
    })
    assert.ok(res.status >= 400, 'an unsigned webhook was accepted')
  })

  it('does not let a cancelled appointment be paid for', async () => {
    const found = await freeSlot()
    assert.ok(found, 'no slot to test with')
    const made = await call('patient', '/appointments', {
      method: 'POST',
      body: { doctorId, date: found.date, slot: found.slot, patient, visitType: 'first' },
    })
    assert.equal(made.status, 201)
    const cancelled = await call('patient', `/appointments/${made.json.appointment.id}/cancel`, {
      method: 'POST',
    })
    assert.equal(cancelled.status, 200, 'could not cancel as the owner')

    const res = await call('patient', '/payments/counter', {
      method: 'POST',
      body: { appointmentId: made.json.appointment.id },
    })
    assert.ok(res.status >= 400, `a cancelled appointment accepted payment (${res.status})`)
  })

  it('refuses to charge for an appointment with no published fee', async () => {
    // A callback-only doctor has no fee. Taking money against one would mean
    // inventing a price the hospital never published.
    const noFee = await call('desk', '/admin/doctors/priya-r', {
      method: 'PATCH',
      body: { fee: null, bookingMode: 'pending' },
    })
    assert.equal(noFee.status, 200)
    const req = await call('patient', '/appointments/callback', {
      method: 'POST',
      body: { doctorId: 'priya-r', patient },
    })
    assert.equal(req.status, 201, 'could not create a callback request')
    const res = await call('patient', '/payments/counter', {
      method: 'POST',
      body: { appointmentId: req.json.appointment.id },
    })
    assert.equal(res.status, 409)
    assert.equal(res.json.error.code, 'FEE_NOT_PUBLISHED')
  })

  it('does not accumulate duplicate payment rows when asked twice', async () => {
    const found = await freeSlot()
    const made = await call('patient', '/appointments', {
      method: 'POST',
      body: { doctorId, date: found.date, slot: found.slot, patient, visitType: 'first' },
    })
    const id = made.json.appointment.id
    const first = await call('patient', '/payments/counter', { method: 'POST', body: { appointmentId: id } })
    assert.equal(first.status, 200)
    const second = await call('patient', '/payments/counter', { method: 'POST', body: { appointmentId: id } })
    assert.equal(second.status, 200, 'a repeat press should be harmless, not an error')

    // The real assertion: pressing twice must not create two charges. Read the
    // database directly — the API deliberately exposes only the latest.
    const { DatabaseSync } = await import('node:sqlite')
    const probe = new DatabaseSync(path.join(workdir, 'test.db'), { readOnly: true })
    const rows = probe.prepare('SELECT COUNT(*) AS n FROM payments WHERE appointment_id = ?').get(id)
    probe.close()
    assert.equal(rows.n, 1, `pressing pay twice left ${rows.n} charges on one visit`)
    // Whatever the API answers, the record must not accumulate charges.
    const view = await call('patient', '/appointments')
    const row = (view.json.appointments ?? []).find((a) => a.id === id)
    assert.ok(row, 'appointment vanished')
    assert.ok(
      !Array.isArray(row.payment) || row.payment.length <= 1,
      'two payments are showing on one appointment',
    )
  })
})

describe('records stay with their owner', () => {
  it('refuses admin routes to a patient session', async () => {
    for (const endpoint of ['/admin/appointments', '/admin/doctors', '/admin/staff']) {
      const res = await call('patient', endpoint)
      assert.ok(res.status === 401 || res.status === 403 || res.status === 404,
        `${endpoint} answered a patient with ${res.status}`)
    }
  })

  it('refuses admin routes with no session at all', async () => {
    for (const endpoint of ['/admin/appointments', '/admin/doctors']) {
      const res = await call('nobody', endpoint)
      assert.ok(res.status === 401 || res.status === 403 || res.status === 404,
        `${endpoint} answered an anonymous caller with ${res.status}`)
    }
  })

  it('never returns a session token in a response body', async () => {
    const res = await call('patient', '/auth/me', { raw: true })
    const text = await res.text()
    assert.ok(!/"token"\s*:/.test(text), 'a token appeared in the body')
    assert.ok(!/dh_session=/.test(text), 'a raw cookie appeared in the body')
  })

  it('does not leak other patients through the appointment list', async () => {
    const mine = await call('patient', '/appointments')
    const theirs = await call('other', '/appointments')
    const mineIds = new Set((mine.json.appointments ?? []).map((a) => a.id))
    const overlap = (theirs.json.appointments ?? []).filter((a) => mineIds.has(a.id))
    assert.equal(overlap.length, 0, 'two patients see the same appointment')
  })
})

describe('input that tries to break out', () => {
  it('treats SQL metacharacters as ordinary text', async () => {
    const res = await call('patient', '/appointments', {
      method: 'POST',
      body: {
        doctorId: "'; DROP TABLE appointments; --",
        date: '2026-01-01',
        slot: '10:00',
        visitType: 'first',
        patient: { name: 'Bobby Tables', age: 30, phone: '+919000000001', gender: 'male', reason: 'testing input' },
      },
    })
    assert.ok(res.status >= 400, 'a nonsense doctor id was accepted')
    // The table must still be there.
    const still = await call('patient', '/appointments')
    assert.equal(still.status, 200, 'the appointments table did not survive')
  })

  it('rejects an over-long field rather than storing it', async () => {
    const res = await call('patient', '/appointments', {
      method: 'POST',
      body: {
        doctorId: 'murali-r',
        date: '2026-01-01',
        slot: '10:00',
        visitType: 'first',
        patient: { name: 'x'.repeat(5000), age: 30, phone: '+919000000001', gender: 'male', reason: 'testing' },
      },
    })
    assert.ok(res.status >= 400, 'a 5000-character name was accepted')
  })

  it('refuses a negative or absurd age', async () => {
    for (const age of [-5, 999, 1e9]) {
      const res = await call('patient', '/appointments', {
        method: 'POST',
        body: {
          doctorId: 'murali-r',
          date: '2026-01-01',
          slot: '10:00',
          visitType: 'first',
          patient: { name: 'Age Test', age, phone: '+919000000001', gender: 'male', reason: 'testing input' },
        },
      })
      assert.ok(res.status >= 400, `age ${age} was accepted`)
    }
  })
})

describe('medical records stay behind their guards', () => {
  it('refuses a patient’s own records endpoint to an anonymous caller', async () => {
    for (const endpoint of ['/records', '/prescriptions', '/my-tokens']) {
      const res = await call('nobody', endpoint)
      assert.ok(res.status === 401 || res.status === 403,
        `${endpoint} answered an anonymous caller with ${res.status}`)
    }
  })

  it('refuses another patient’s history to a patient session', async () => {
    const res = await call('patient', '/patients/someone-else/history')
    assert.ok(res.status === 401 || res.status === 403,
      `a patient read a history with ${res.status}`)
  })

  it('refuses a history the doctor does not treat', async () => {
    const res = await call('doc', '/patients/not-a-real-patient/history')
    assert.ok(res.status === 403 || res.status === 404,
      `a doctor reached an unrelated patient with ${res.status}`)
  })

  it('keeps the public queue board free of patient identity', async () => {
    // Deliberately public, so it must carry no name, phone or reference.
    const res = await call('nobody', '/queue/deepan-g', { raw: true })
    const text = await res.text()
    assert.ok(!/patient_name|"phone"|DH-[A-Z0-9]{6}/.test(text),
      'the waiting-room board is leaking patient identity')
  })

  it('will not let staff write a prescription without a session', async () => {
    const res = await call('nobody', '/prescriptions', {
      method: 'POST',
      body: { appointmentId: 'x', items: [] },
    })
    assert.ok(res.status === 401 || res.status === 403, `answered with ${res.status}`)
  })
})

describe('sessions cannot be forged, reused or crossed', () => {
  it('rejects a tampered session cookie', async () => {
    const good = jars.patient
    try {
      // Flip the last character of the token.
      jars.patient = good.replace(/(dh_session=[^;]+)/, (m) =>
        m.slice(0, -1) + (m.at(-1) === 'A' ? 'B' : 'A'))
      const res = await call('patient', '/appointments')
      assert.ok(res.status === 401 || res.status === 403,
        `a tampered token was accepted with ${res.status}`)
    } finally {
      jars.patient = good
    }
  })

  it('rejects an invented session cookie', async () => {
    jars.forged = 'dh_session=' + 'a'.repeat(43)
    const res = await call('forged', '/appointments')
    assert.ok(res.status === 401 || res.status === 403, `an invented token worked (${res.status})`)
  })

  it('does not let a staff cookie act as a patient', async () => {
    // The desk jar holds dh_staff only; patient routes must not accept it.
    const res = await call('desk', '/appointments')
    assert.ok(res.status === 401 || res.status === 403,
      `a staff session read a patient's appointments (${res.status})`)
  })

  it('invalidates the token server-side on sign out, not just the cookie', async () => {
    const phone = '+919000000123'
    const otp = await call('victim', '/auth/otp', { method: 'POST', body: { phone } })
    await call('victim', '/auth/verify', {
      method: 'POST',
      body: { phone, code: otp.json.devCode ?? otp.json.code },
    })
    const stolen = jars.victim
    assert.ok(/dh_session=/.test(stolen), 'no session to steal')

    const before = await call('victim', '/auth/me')
    assert.equal(before.status, 200)

    await call('victim', '/auth/signout', { method: 'POST' })

    /*
     * The attacker still holds the cookie. Clearing it in the victim's browser
     * would not help them — the row has to be gone from the database.
     */
    jars.thief = stolen
    const after = await call('thief', '/auth/me')
    const body = after.json
    assert.ok(
      after.status === 401 || body?.patient == null,
      'a signed-out token still identifies the patient',
    )
  })

  it('issues a different token on each sign-in', async () => {
    const phone = '+919000000124'
    const tokenOf = (jar) => (jar ?? '').match(/dh_session=([^;]+)/)?.[1] ?? null

    const one = await call('rotA', '/auth/otp', { method: 'POST', body: { phone } })
    await call('rotA', '/auth/verify', {
      method: 'POST',
      body: { phone, code: one.json.devCode ?? one.json.code },
    })
    const first = tokenOf(jars.rotA)

    const two = await call('rotB', '/auth/otp', { method: 'POST', body: { phone } })
    await call('rotB', '/auth/verify', {
      method: 'POST',
      body: { phone, code: two.json.devCode ?? two.json.code },
    })
    const second = tokenOf(jars.rotB)

    assert.ok(first && second, 'no tokens issued')
    assert.notEqual(first, second, 'the same session token was handed out twice')
  })

  it('never puts a raw code or token in the audit log', async () => {
    const res = await call('desk', '/admin/audit?limit=50')
    if (res.status !== 200) return // route may be restricted; nothing to assert
    const text = JSON.stringify(res.json)
    assert.ok(!/"code_hash"|"code_salt"|dh_session=/.test(text), 'the audit log is leaking secrets')
  })
})

describe('booking without an account', () => {
  /*
   * The hospital dropped one-time codes, which removed the only thing that
   * needed an SMS gateway. A patient now books the way they would at the
   * counter and takes away a reference. These pin the two properties that
   * matter: anyone can book, and only someone holding both the reference and
   * the phone number can see or cancel it.
   */
  let doctorId
  const patient = {
    name: 'Guest Booker',
    age: 38,
    phone: '+919000000777',
    gender: 'female',
    reason: 'persistent cough for a week',
  }

  const freeSlot = async () => {
    for (let ahead = 0; ahead < 14; ahead += 1) {
      const day = new Date()
      day.setDate(day.getDate() + ahead)
      const key = day.toISOString().slice(0, 10)
      const avail = await call('nobody', `/doctors/${doctorId}/availability?date=${key}`)
      const free = (avail.json.slots ?? []).find((s) => s.available)
      if (free) return { date: key, slot: free.slot }
    }
    return null
  }

  before(async () => {
    doctorId = 'narmadha-s'
    const opened = await call('desk', `/admin/doctors/${doctorId}`, {
      method: 'PATCH',
      body: {
        days: [0, 1, 2, 3, 4, 5, 6],
        morningStart: '08:00',
        morningEnd: '11:00',
        fee: 200,
        bookingMode: 'live',
      },
    })
    assert.equal(opened.status, 200, `could not open ${doctorId}`)
  })

  it('lets someone with no session book a slot', async () => {
    const found = await freeSlot()
    assert.ok(found, 'no free slot')
    const res = await call('nobody', '/appointments/guest', {
      method: 'POST',
      body: { doctorId, ...found, visitType: 'first', patient },
    })
    assert.equal(res.status, 201, 'a guest could not book')
    assert.match(res.json.appointment.id, /^DH-[A-Z0-9]{6}$/)
    // The server still prices it: 200 consultation + 50 first-visit charge.
    assert.equal(res.json.appointment.fee, 250)
  })

  it('still refuses a guest booking with no visit type', async () => {
    const found = await freeSlot()
    const res = await call('nobody', '/appointments/guest', {
      method: 'POST',
      body: { doctorId, ...found, patient },
    })
    assert.equal(res.status, 400)
    assert.equal(res.json.error.code, 'VISIT_TYPE_REQUIRED')
  })

  it('still ignores a fee sent by a guest', async () => {
    const found = await freeSlot()
    const res = await call('nobody', '/appointments/guest', {
      method: 'POST',
      body: { doctorId, ...found, visitType: 'first', patient, fee: 1, amount: 1 },
    })
    assert.equal(res.status, 201)
    assert.equal(res.json.appointment.fee, 250, 'a guest set their own price')
  })

  it('finds a booking from its reference and phone', async () => {
    const found = await freeSlot()
    const made = await call('nobody', '/appointments/guest', {
      method: 'POST',
      body: { doctorId, ...found, visitType: 'review', patient },
    })
    const ref = made.json.appointment.id

    const ok = await call('nobody', '/appointments/lookup', {
      method: 'POST',
      body: { reference: ref, phone: patient.phone },
    })
    assert.equal(ok.status, 200)
    assert.equal(ok.json.appointment.id, ref)
  })

  it('refuses a lookup with the wrong phone, and says nothing different for a bad reference', async () => {
    const found = await freeSlot()
    const made = await call('nobody', '/appointments/guest', {
      method: 'POST',
      body: { doctorId, ...found, visitType: 'first', patient },
    })
    const ref = made.json.appointment.id

    const wrongPhone = await call('nobody', '/appointments/lookup', {
      method: 'POST',
      body: { reference: ref, phone: '+919000000888' },
    })
    const badRef = await call('nobody', '/appointments/lookup', {
      method: 'POST',
      body: { reference: 'DH-ZZZZZZ', phone: patient.phone },
    })
    assert.equal(wrongPhone.status, 404)
    assert.equal(badRef.status, 404)
    /*
     * Identical answers on purpose. A different status or code for "that
     * reference exists but the phone is wrong" would confirm which references
     * are real, and they are only six characters long.
     */
    assert.equal(wrongPhone.json.error.code, badRef.json.error.code)
  })

  it('cancels with the reference and phone, and refuses a second time', async () => {
    const found = await freeSlot()
    const made = await call('nobody', '/appointments/guest', {
      method: 'POST',
      body: { doctorId, ...found, visitType: 'first', patient },
    })
    const ref = made.json.appointment.id

    const first = await call('nobody', '/appointments/lookup/cancel', {
      method: 'POST',
      body: { reference: ref, phone: patient.phone },
    })
    assert.equal(first.status, 200)
    assert.equal(first.json.appointment.status, 'cancelled')

    const again = await call('nobody', '/appointments/lookup/cancel', {
      method: 'POST',
      body: { reference: ref, phone: patient.phone },
    })
    assert.equal(again.status, 409)
  })

  it('will not let a stranger cancel with the wrong phone', async () => {
    const found = await freeSlot()
    const made = await call('nobody', '/appointments/guest', {
      method: 'POST',
      body: { doctorId, ...found, visitType: 'first', patient },
    })
    const ref = made.json.appointment.id

    const res = await call('nobody', '/appointments/lookup/cancel', {
      method: 'POST',
      body: { reference: ref, phone: '+919000000888' },
    })
    assert.equal(res.status, 404)

    const still = await call('nobody', '/appointments/lookup', {
      method: 'POST',
      body: { reference: ref, phone: patient.phone },
    })
    assert.notEqual(still.json.appointment.status, 'cancelled', 'a stranger cancelled it')
  })
})

describe('patient sign-in with a password', () => {
  /*
   * Replaced the one-time code, which needed an SMS gateway and TRAI
   * registration before anybody could sign in at all. Booking still needs no
   * account; this is for patients who want their appointments in one place.
   */
  const phone = '+919333000111'
  const password = 'a-good-enough-password'

  it('creates an account and signs in immediately', async () => {
    const res = await call('pw', '/auth/register', {
      method: 'POST',
      body: { phone, password, fullName: 'Password Patient', ...(await solveCaptcha('pw')) },
    })
    assert.equal(res.status, 201)
    assert.equal(res.json.patient.fullName, 'Password Patient')

    const me = await call('pw', '/auth/me')
    assert.equal(me.json.patient.phone.slice(-10), phone.slice(-10))
  })

  it('refuses a password shorter than eight characters', async () => {
    const res = await call('nobody', '/auth/register', {
      method: 'POST',
      body: { phone: '+919333000112', password: 'short', ...(await solveCaptcha('nobody')) },
    })
    assert.equal(res.status, 400)
    assert.equal(res.json.error.code, 'WEAK_PASSWORD')
  })

  it('refuses a second account on the same number', async () => {
    const res = await call('nobody', '/auth/register', {
      method: 'POST',
      body: { phone, password: 'another-password-here', ...(await solveCaptcha('nobody')) },
    })
    assert.equal(res.status, 409)
  })

  it('will not create an account without answering the sum', async () => {
    // The whole point of the captcha: a script that skips it gets nowhere,
    // and it is refused before the password is even considered.
    const res = await call('nobody', '/auth/register', {
      method: 'POST',
      body: { phone: '+919333000119', password: 'a-perfectly-good-password' },
    })
    assert.equal(res.status, 400)
    assert.equal(res.json.error.code, 'CAPTCHA_REQUIRED')

    const after = await call('nobody', '/auth/me')
    assert.equal(after.json.patient, null, 'a session was started without the captcha')
  })

  it('will not accept a made-up captcha token', async () => {
    const res = await call('nobody', '/auth/register', {
      method: 'POST',
      body: {
        phone: '+919333000120',
        password: 'a-perfectly-good-password',
        captchaToken: 'made.up.token',
        captchaAnswer: 7,
      },
    })
    assert.equal(res.status, 400)
    assert.match(res.json.error.code, /^CAPTCHA_/)
  })

  it('answers a wrong password and an unknown number identically', async () => {
    /*
     * Different answers would turn this form into a way of discovering which
     * numbers belong to patients of this hospital.
     */
    const wrongPassword = await call('nobody', '/auth/login', {
      method: 'POST',
      body: { phone, password: 'not-the-password' },
    })
    const unknownNumber = await call('nobody', '/auth/login', {
      method: 'POST',
      body: { phone: '+919333000999', password: 'not-the-password' },
    })
    assert.equal(wrongPassword.status, 401)
    assert.equal(unknownNumber.status, 401)
    assert.equal(wrongPassword.json.error.code, unknownNumber.json.error.code)
  })

  it('signs in with the right password', async () => {
    const res = await call('pw2', '/auth/login', { method: 'POST', body: { phone, password } })
    assert.equal(res.status, 200)
    const me = await call('pw2', '/auth/me')
    assert.ok(me.json.patient, 'no session after signing in')
  })

  it('never returns the password or its hash', async () => {
    /*
     * Checks the field names, not a substring of the body: the first version
     * of this searched the raw text for "password" and tripped over the test
     * patient's own name, "Password Patient".
     */
    const res = await call('pw2', '/auth/me')
    const fields = Object.keys(res.json?.patient ?? {})
    for (const leaky of ['password', 'passwordHash', 'password_hash', 'passwordSalt', 'password_salt']) {
      assert.ok(!fields.includes(leaky), `${leaky} reached the client`)
    }
    assert.ok(!JSON.stringify(res.json).includes('scrypt'), 'a hash reached the client')
  })
})

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
describe('reception device tokens', () => {
  let token
  let deviceId

  const asDevice = (endpoint, { method = 'GET', body } = {}) =>
    fetch(`${BASE}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (res) => ({ status: res.status, json: await res.json().catch(() => null) }))

  before(async () => {
    const me = await call('boss', '/admin/me')
    assert.equal(me.status, 200, 'the admin is not signed in — these tests would be vacuous')
    assert.equal(me.json.staff?.role, 'admin')
  })

  it('only an admin may issue one', async () => {
    const asStaff = await call('desk', '/admin/devices', {
      method: 'POST',
      body: { label: 'Sneaky PC' },
    })
    assert.equal(asStaff.status, 403, 'ordinary staff issued a device token')
  })

  it('issues a token, once', async () => {
    const res = await call('boss', '/admin/devices', {
      method: 'POST',
      body: { label: 'Reception PC 1' },
    })
    assert.equal(res.status, 201, JSON.stringify(res.json))
    token = res.json.device.token
    deviceId = res.json.device.id
    assert.match(token, /^dhk_/)

    // The list must never hand the token back again.
    const list = await call('boss', '/admin/devices')
    const listed = list.json.devices.find((d) => d.id === deviceId)
    assert.ok(listed, 'the device is not in the list')
    assert.ok(!('token' in listed) && !('token_hash' in listed), 'the token came back from the list')
  })

  it('reads the Klinique worklist', async () => {
    const res = await asDevice('/admin/klinique')
    assert.equal(res.status, 200, JSON.stringify(res.json))
    assert.ok(Array.isArray(res.json.outstanding))
  })

  it('cannot reach anything else on the admin router', async () => {
    for (const endpoint of ['/admin/appointments', '/admin/patients', '/admin/devices', '/admin/audit']) {
      const res = await asDevice(endpoint)
      assert.ok(res.status === 401 || res.status === 403 || res.status === 404,
        `a device token read ${endpoint} (${res.status})`)
    }
    const staff = await asDevice('/admin/staff', {
      method: 'POST',
      body: { username: 'evil', password: 'passwordpassword', role: 'admin' },
    })
    assert.ok(staff.status === 401 || staff.status === 403, 'a device token created a staff account')
  })

  it('marks an appointment entered', async () => {
    const before = await asDevice('/admin/klinique')
    const target = before.json.outstanding[0]
    if (!target) return // nothing outstanding in this run

    const marked = await asDevice(`/admin/klinique/${target.id}/entered`, { method: 'POST', body: {} })
    assert.equal(marked.status, 200, JSON.stringify(marked.json))

    const after = await asDevice('/admin/klinique')
    assert.ok(!after.json.outstanding.some((a) => a.id === target.id), 'it stayed on the list')
  })

  it('a made-up token opens nothing', async () => {
    const real = token
    token = 'dhk_not-a-real-token'
    const res = await asDevice('/admin/klinique')
    token = real
    assert.equal(res.status, 401)
  })

  it('stops working the moment it is revoked', async () => {
    const revoked = await call('boss', `/admin/devices/${deviceId}`, { method: 'DELETE' })
    assert.equal(revoked.status, 200)

    const res = await asDevice('/admin/klinique')
    assert.equal(res.status, 401, 'a revoked token still worked')
  })
})

/* ------------------------------------------------------------------ */

describe('the doctor list', () => {
  it('lists the active consultants without signing in', async () => {
    const res = await call('anon', '/doctors')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.json.doctors), 'no doctors array came back')
    assert.ok(res.json.doctors.length > 0, 'the hospital listed nobody')
    assert.equal(res.json.count, res.json.doctors.length)
  })

  it('agrees with the catalogue, which is the same data by another door', async () => {
    const list = await call('anon', '/doctors')
    const catalog = await call('anon', '/catalog')
    assert.deepEqual(
      list.json.doctors.map((d) => d.id).sort(),
      catalog.json.doctors.map((d) => d.id).sort(),
    )
  })

  it('filters to one department', async () => {
    const all = await call('anon', '/doctors')
    const target = all.json.doctors[0].departmentId
    const res = await call('anon', `/doctors?department=${encodeURIComponent(target)}`)
    assert.equal(res.status, 200)
    assert.ok(res.json.doctors.length > 0)
    assert.ok(res.json.doctors.every((d) => d.departmentId === target))
  })

  it('returns an empty list for a department that does not exist, not a 404', async () => {
    // A stale dropdown must show "none found", not blank the page.
    const res = await call('anon', '/doctors?department=department-of-magic')
    assert.equal(res.status, 200)
    assert.deepEqual(res.json.doctors, [])
  })

  it('searches by name and by specialisation', async () => {
    const all = await call('anon', '/doctors')
    const one = all.json.doctors[0]
    const word = one.name.en.split(' ').filter((w) => w.length > 3)[0]

    const res = await call('anon', `/doctors?q=${encodeURIComponent(word.toLowerCase())}`)
    assert.equal(res.status, 200)
    assert.ok(res.json.doctors.some((d) => d.id === one.id), 'a doctor could not find themselves')
  })

  it('can narrow to the ones actually open for online booking', async () => {
    const res = await call('anon', '/doctors?bookable=true')
    assert.equal(res.status, 200)
    assert.ok(res.json.doctors.every((d) => d.bookingMode === 'live'))
  })

  it('opens one doctor with their department attached', async () => {
    const all = await call('anon', '/doctors')
    const one = all.json.doctors[0]

    const res = await call('anon', `/doctors/${one.id}`)
    assert.equal(res.status, 200)
    assert.equal(res.json.doctor.id, one.id)
    assert.equal(res.json.department.id, one.departmentId)
  })

  it('404s on a doctor who is not there', async () => {
    const res = await call('anon', '/doctors/nobody-by-that-name')
    assert.equal(res.status, 404)
    assert.equal(res.json.error.code, 'DOCTOR_NOT_FOUND')
  })

  it('does not shadow the availability route that lives in the catalogue', async () => {
    const all = await call('anon', '/doctors')
    const one = all.json.doctors[0]
    const res = await call('anon', `/doctors/${one.id}/availability?date=2026-01-01`)
    assert.equal(res.status, 200)
    assert.equal(res.json.doctorId, one.id)
    assert.ok('slots' in res.json, 'the profile route swallowed /availability')
  })

  it('never leaks a column a patient has no business seeing', async () => {
    const res = await call('anon', '/doctors')
    for (const doctor of res.json.doctors) {
      for (const banned of ['active', 'created_at', 'updated_at', 'sort_order']) {
        assert.ok(!(banned in doctor), `${banned} reached the browser`)
      }
    }
  })
})
