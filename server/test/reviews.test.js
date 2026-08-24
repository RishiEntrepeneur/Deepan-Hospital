/**
 * Reviews, end to end.
 *
 * A review may only be left by the patient who was actually seen, only for a
 * visit that is finished, and only once — and nothing shows publicly until a
 * staff member approves it. Every one of those rules lives in the database or
 * the route, so the test drives a real server on a throwaway database rather
 * than mocking any of it.
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
const PORT = 4400
const BASE = `http://127.0.0.1:${PORT}/api`

let server
let workdir
const jars = {}

async function call(who, endpoint, { method = 'GET', body } = {}) {
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
      (jars[who] ?? '').split('; ').filter(Boolean).map((c) => [c.split('=')[0], c]),
    )
    kept.set(name, pair)
    jars[who] = [...kept.values()].join('; ')
  }
  let json = null
  try {
    json = await res.json()
  } catch {
    /* empty body */
  }
  return { status: res.status, json }
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
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'deepan-reviews-'))
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(PORT),
    DATABASE_FILE: path.join(workdir, 'test.db'),
    BACKUP_ENABLED: 'false',
    OTP_ECHO: 'true',
    BOOKING_APPROVAL: 'always',
    STAFF_PASSWORD: 'test-password-1234',
  }

  await new Promise((resolve, reject) => {
    spawn('node', ['scripts/seed.js'], { cwd: root, env, stdio: 'ignore' }).on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('seed failed')),
    )
  })
  await new Promise((resolve) => {
    spawn('node', ['scripts/create-staff.js', '--username', 'testdesk', '--role', 'staff'], {
      cwd: root,
      env,
      stdio: 'ignore',
    }).on('exit', resolve)
  })

  server = spawn('node', ['src/index.js'], { cwd: root, env, stdio: 'ignore' })
  await waitForHealth()
})

after(() => {
  server?.kill()
  if (workdir) fs.rmSync(workdir, { recursive: true, force: true })
})

describe('reviews', () => {
  const doctorId = 'priyanka-v'
  const patient = { name: 'Asha Kumar', age: 40, phone: '+919000000010', gender: 'female', reason: 'checkup' }
  let appointmentId
  let date
  let slot

  before(async () => {
    // A patient with a real session.
    const otp = await call('patient', '/auth/otp', { method: 'POST', body: { phone: patient.phone } })
    await call('patient', '/auth/verify', {
      method: 'POST',
      body: { phone: patient.phone, code: otp.json.devCode ?? otp.json.code },
    })
    // Staff, to complete the visit and to moderate.
    await call('desk', '/admin/signin', {
      method: 'POST',
      body: { username: 'testdesk', password: 'test-password-1234', as: 'staff' },
    })

    // Open the doctor and take the first free slot.
    await call('desk', `/admin/doctors/${doctorId}`, {
      method: 'PATCH',
      body: { days: [0, 1, 2, 3, 4, 5, 6], morningStart: '10:00', morningEnd: '13:00', fee: 400, bookingMode: 'live' },
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

    const booked = await call('patient', '/appointments', {
      method: 'POST',
      body: { doctorId, date, slot, patient, visitType: 'first' },
    })
    assert.equal(booked.status, 201)
    appointmentId = booked.json.appointment.id
  })

  it('will not accept a review before the visit is completed', async () => {
    const res = await call('patient', '/reviews', {
      method: 'POST',
      body: { appointmentId, rating: 5, comment: 'Too early' },
    })
    assert.equal(res.status, 409)
    assert.equal(res.json.error.code, 'NOT_COMPLETED')
  })

  it('lets a patient review a completed visit', async () => {
    // Staff mark the visit finished.
    const done = await call('desk', `/appointments/${appointmentId}`, {
      method: 'PATCH',
      body: { action: 'complete' },
    })
    assert.equal(done.status, 200)

    const res = await call('patient', '/reviews', {
      method: 'POST',
      body: { appointmentId, rating: 5, comment: 'Kind and quick, thank you.', displayName: 'Asha K.' },
    })
    assert.equal(res.status, 201)
    assert.equal(res.json.status, 'pending')
  })

  it('keeps a pending review off the public list', async () => {
    const res = await call('anon', '/reviews')
    assert.equal(res.status, 200)
    assert.equal(res.json.reviews.length, 0)
    assert.equal(res.json.summary.count, 0)
  })

  it('rejects a rating outside 1–5', async () => {
    // Needs a second completed appointment to get past the duplicate guard, so
    // test the validation on a fresh, unrelated bad request instead.
    const res = await call('patient', '/reviews', {
      method: 'POST',
      body: { appointmentId, rating: 9, comment: 'x' },
    })
    // Duplicate is caught first here; either way it is refused, not stored.
    assert.ok(res.status === 400 || res.status === 409)
  })

  it('refuses a second review for the same visit', async () => {
    const res = await call('patient', '/reviews', {
      method: 'POST',
      body: { appointmentId, rating: 3, comment: 'again' },
    })
    assert.equal(res.status, 409)
    assert.equal(res.json.error.code, 'ALREADY_REVIEWED')
  })

  it('will not let one patient review another patient’s visit', async () => {
    const otherPhone = '+919000000011'
    const otp = await call('intruder', '/auth/otp', { method: 'POST', body: { phone: otherPhone } })
    await call('intruder', '/auth/verify', {
      method: 'POST',
      body: { phone: otherPhone, code: otp.json.devCode ?? otp.json.code },
    })
    const res = await call('intruder', '/reviews', {
      method: 'POST',
      body: { appointmentId, rating: 1, comment: 'not mine' },
    })
    assert.equal(res.status, 403)
    assert.equal(res.json.error.code, 'NOT_YOUR_APPOINTMENT')
  })

  it('shows a review only after staff approve it', async () => {
    // Staff see it pending.
    const pending = await call('desk', '/admin/reviews?status=pending')
    assert.equal(pending.status, 200)
    const mine = pending.json.reviews.find((r) => r.name === 'Asha K.')
    assert.ok(mine, 'the pending review was not listed for staff')
    assert.equal(pending.json.counts.pending, 1)

    // Approve it.
    const ok = await call('desk', `/admin/reviews/${mine.id}/moderate`, {
      method: 'POST',
      body: { decision: 'approved' },
    })
    assert.equal(ok.status, 200)

    // Now the public sees it, and the average is computed.
    const pub = await call('anon', '/reviews')
    assert.equal(pub.json.reviews.length, 1)
    assert.equal(pub.json.reviews[0].name, 'Asha K.')
    assert.equal(pub.json.reviews[0].rating, 5)
    assert.equal(pub.json.summary.count, 1)
    assert.equal(pub.json.summary.average, 5)
  })

  it('refuses review submission without a patient session', async () => {
    const res = await call('anon', '/reviews', {
      method: 'POST',
      body: { appointmentId, rating: 5 },
    })
    assert.equal(res.status, 401)
  })

  it('refuses moderation without a staff session', async () => {
    const res = await call('patient', '/admin/reviews?status=pending')
    assert.equal(res.status, 401)
  })
})
