/**
 * Attachments, end to end.
 *
 * These are medical images, so the tests that matter are the refusals: a file
 * that is not what it claims to be, a booking trying to adopt somebody else's
 * upload, and a stranger asking to read one.
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
const PORT = 4401
const BASE = `http://127.0.0.1:${PORT}/api`

let server
let workdir
const jars = {}

function remember(who, res) {
  for (const cookie of res.headers.getSetCookie?.() ?? []) {
    const pair = cookie.split(';')[0]
    const name = pair.split('=')[0]
    const kept = new Map(
      (jars[who] ?? '').split('; ').filter(Boolean).map((c) => [c.split('=')[0], c]),
    )
    kept.set(name, pair)
    jars[who] = [...kept.values()].join('; ')
  }
}

async function call(who, endpoint, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(jars[who] ? { Cookie: jars[who] } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  remember(who, res)
  let json = null
  try {
    json = await res.json()
  } catch {
    /* empty body */
  }
  return { status: res.status, json }
}

/** Upload raw bytes the way the browser does. */
async function upload(who, mime, bytes, name = 'photo.jpg') {
  const res = await fetch(`${BASE}/attachments`, {
    method: 'POST',
    headers: {
      'Content-Type': mime,
      'X-File-Name': name,
      ...(jars[who] ? { Cookie: jars[who] } : {}),
    },
    body: bytes,
  })
  remember(who, res)
  let json = null
  try {
    json = await res.json()
  } catch {
    /* not json */
  }
  return { status: res.status, json }
}

async function fetchFile(who, id, query = '') {
  const res = await fetch(`${BASE}/attachments/${id}${query}`, {
    headers: { ...(jars[who] ? { Cookie: jars[who] } : {}) },
  })
  return res
}

/* A real, minimal JPEG: SOI + APP0 marker, enough to pass the signature test. */
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  Buffer.from('JFIF\0'),
  Buffer.alloc(32, 7),
])
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n')

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
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'deepan-attach-'))
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(PORT),
    DATABASE_FILE: path.join(workdir, 'test.db'),
    UPLOAD_DIR: path.join(workdir, 'uploads'),
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

describe('attachments', () => {
  const doctorId = 'priyanka-v'
  const phone = '+919000000030'
  let date
  let slot

  before(async () => {
    const otp = await call('patient', '/auth/otp', { method: 'POST', body: { phone } })
    await call('patient', '/auth/verify', {
      method: 'POST',
      body: { phone, code: otp.json.devCode ?? otp.json.code },
    })
    await call('desk', '/admin/signin', {
      method: 'POST',
      body: { username: 'testdesk', password: 'test-password-1234', as: 'staff' },
    })
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

  it('accepts a photograph and a PDF', async () => {
    const image = await upload('patient', 'image/jpeg', JPEG, 'rash.jpg')
    assert.equal(image.status, 201)
    assert.equal(image.json.kind, 'image')
    assert.ok(image.json.token, 'no token issued')

    const report = await upload('patient', 'application/pdf', PDF, 'bloods.pdf')
    assert.equal(report.status, 201)
    assert.equal(report.json.kind, 'pdf')
  })

  it('refuses a file whose contents do not match its type', async () => {
    // The attack: an HTML page called a PDF, which the browser would later run
    // as a page on the hospital's own origin.
    const res = await upload('patient', 'application/pdf', Buffer.from('<html><script>x</script>'))
    assert.equal(res.status, 400)
    assert.equal(res.json.error.code, 'FILE_CONTENTS')
  })

  it('refuses a type that is not a photo or a PDF', async () => {
    const res = await upload('patient', 'image/svg+xml', Buffer.from('<svg onload="x()"/>'))
    assert.ok(res.status === 400 || res.status === 415, `got ${res.status}`)
  })

  it('attaches uploads to the booking that claims them', async () => {
    const a = await upload('patient', 'image/jpeg', JPEG, 'one.jpg')
    const b = await upload('patient', 'application/pdf', PDF, 'two.pdf')

    const booked = await call('patient', '/appointments', {
      method: 'POST',
      body: {
        doctorId,
        date,
        slot,
        patient: { name: 'Ravi Kumar', age: 44, phone, gender: 'male', reason: 'rash on arm' },
        visitType: 'first',
        attachments: [
          { id: a.json.id, token: a.json.token },
          { id: b.json.id, token: b.json.token },
        ],
      },
    })
    assert.equal(booked.status, 201, JSON.stringify(booked.json))
    assert.equal(booked.json.appointment.attachments.length, 2)
    const names = booked.json.appointment.attachments.map((x) => x.name).sort()
    assert.deepEqual(names, ['one.jpg', 'two.pdf'])
  })

  it('will not attach a file without its token', async () => {
    const mine = await upload('patient', 'image/jpeg', JPEG, 'private.jpg')

    // A second patient books, quoting the id but not the token.
    const other = '+919000000031'
    const otp = await call('thief', '/auth/otp', { method: 'POST', body: { phone: other } })
    await call('thief', '/auth/verify', {
      method: 'POST',
      body: { phone: other, code: otp.json.devCode ?? otp.json.code },
    })

    let taken = null
    for (let i = 1; i <= 14 && !taken; i++) {
      const day = new Date()
      day.setDate(day.getDate() + i)
      const key = day.toISOString().slice(0, 10)
      const avail = await call('thief', `/doctors/${doctorId}/availability?date=${key}`)
      const free = avail.json?.slots?.find((s) => s.available)
      if (free) taken = { date: key, slot: free.slot }
    }
    assert.ok(taken, 'no second slot free')

    const booked = await call('thief', '/appointments', {
      method: 'POST',
      body: {
        doctorId,
        ...taken,
        patient: { name: 'Not Ravi', age: 30, phone: other, gender: 'male', reason: 'sore throat' },
        visitType: 'first',
        attachments: [{ id: mine.json.id, token: 'guessed-token' }],
      },
    })
    assert.equal(booked.status, 201, JSON.stringify(booked.json))
    assert.equal(booked.json.appointment.attachments.length, 0, 'a file was stolen')
  })

  it('serves the file to the patient it belongs to, defensively', async () => {
    const up = await upload('patient', 'image/jpeg', JPEG, 'mine.jpg')
    const res = await fetchFile('patient', up.json.id, `?token=${up.json.token}`)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'image/jpeg')
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    assert.match(res.headers.get('content-security-policy') ?? '', /default-src 'none'/)
    assert.match(res.headers.get('cache-control') ?? '', /no-store/)
    const body = Buffer.from(await res.arrayBuffer())
    assert.equal(body.length, JPEG.length, 'bytes came back changed')
  })

  it('refuses a stranger, and answers a made-up id with a 404', async () => {
    const up = await upload('patient', 'image/jpeg', JPEG, 'secret.jpg')

    const stranger = await fetchFile('nobody', up.json.id)
    assert.equal(stranger.status, 403)

    const guessed = await fetchFile('desk', 'no-such-attachment-id')
    assert.equal(guessed.status, 404)
  })

  it('lets reception read a booked patient’s file', async () => {
    const up = await upload('patient', 'application/pdf', PDF, 'desk.pdf')
    const res = await fetchFile('desk', up.json.id)
    assert.equal(res.status, 200, 'reception could not open an attachment')
  })

  it('keeps the stored file out of reach of a path in its name', async () => {
    const res = await upload('patient', 'image/jpeg', JPEG, '../../../etc/passwd.jpg')
    assert.equal(res.status, 201)
    assert.equal(res.json.name, 'passwd.jpg', 'the directory part survived')
  })
})
