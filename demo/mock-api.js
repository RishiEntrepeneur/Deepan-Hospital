/**
 * A fake hospital server, for the standalone demo build only.
 *
 * The real app talks to the Node API for everything — the doctor list, slot
 * availability, sign-in, bookings. That makes it impossible to hand someone a
 * link and let them click through it, which is the one thing you want when
 * showing the hospital what has been built.
 *
 * So this intercepts `fetch` before the app starts and answers `/api/*` itself,
 * from a catalogue snapshot taken from a real seeded server. Nothing here is
 * imported by the app: `npm run build` does not see this file, and the demo is
 * built by a separate config into its own file.
 *
 * What it is not: a second implementation to keep in step. It answers the
 * handful of calls a visitor can reach by clicking, and returns a clear error
 * for anything else rather than pretending. Slot availability is computed the
 * same way the server computes it — from the doctor's consulting days and
 * session times — so the picker behaves like the real one, including refusing
 * days a doctor does not sit and times that have already passed.
 *
 * Bookings made here live in memory and are gone on reload. No data leaves the
 * page; there is nothing to leave.
 */
import catalog from './catalog.json'
import { handleDesk, seedDeskDemo } from './desk-api.js'

const DEMO_PATIENT = { name: 'Demo Patient', phone: '9876500000' }

/*
 * Bookings made during this visit. Reset by a reload — deliberately.
 *
 * Three prefixes share this list and none may collide: the desk seeds
 * `DH-DEMO01`–`05` so the reception screen has something to show, the desk
 * creates `DH-DESK…` when staff book for a caller, and a patient booking on
 * the site gets `DH-WEB…`.
 *
 * They collided once, and the symptom was alarming: a patient booking was
 * numbered from 1 like the seeds, so it minted `DH-DEMO01` — a reference
 * already held by a seeded record — and the confirmation screen looked that
 * one up and showed a stranger's name, age, phone number and reason for visit
 * back to whoever had just booked. Nothing had leaked, the two records simply
 * shared an id, but on a hospital's screen there is no innocent reading of it.
 * Distinct prefixes make it impossible by construction rather than by counting
 * carefully.
 */
const appointments = []
let signedIn = false
let nextRef = 1

const pad = (n) => String(n).padStart(2, '0')
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const toHHMM = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`

/**
 * The same rule the server applies: every `slotMinutes` between the start and
 * end of each session the doctor sits that day, minus anything already taken
 * or already past.
 */
function availability(doctorId, date) {
  const doctor = catalog.doctors.find((d) => d.id === doctorId)
  if (!doctor) return null

  const { slotMinutes } = catalog.booking
  const day = new Date(`${date}T00:00:00`)
  const sits = doctor.days?.includes(day.getDay())
  const now = new Date()
  const isToday = date === isoDate(now)
  const minutesNow = now.getHours() * 60 + now.getMinutes()

  const slots = []
  if (sits) {
    for (const [session, range] of Object.entries(doctor.sessions ?? {})) {
      if (!Array.isArray(range) || range.length < 2) continue
      for (let m = toMinutes(range[0]); m < toMinutes(range[1]); m += slotMinutes) {
        const slot = toHHMM(m)
        const taken = appointments.some(
          (a) => a.doctorId === doctorId && a.date === date && a.slot === slot,
        )
        const past = isToday && m <= minutesNow
        slots.push({
          slot,
          session,
          available: !taken && !past,
          reason: taken ? 'taken' : past ? 'past' : null,
        })
      }
    }
  }
  return { doctorId, date, bookingMode: doctor.bookingMode, slots }
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const fail = (status, code, message) => json({ error: { code, message } }, status)

/** Answers one API call, or returns null to mean "not something the demo does". */
async function handle(method, path, search, body) {
  /*
   * The desk first. It shares the bookings and the slot calculator with the
   * patient side deliberately — a booking made on the public site has to turn
   * up on the desk, which is most of what there is to demonstrate.
   */
  const desk = handleDesk(method, path, search, body, {
    catalog,
    appointments,
    availability,
    json,
    fail,
  })
  if (desk) return desk

  if (path === '/health') return json({ ok: true, env: 'demo', payments: 'none' })
  if (path === '/catalog') return json(catalog)

  const avail = path.match(/^\/doctors\/([^/]+)\/availability$/)
  if (avail) {
    const result = availability(decodeURIComponent(avail[1]), search.get('date') ?? '')
    return result ? json(result) : fail(404, 'DOCTOR_NOT_FOUND', 'No such doctor.')
  }

  /* Sign-in. The demo accepts any phone and any code — there is no account. */
  if (path === '/auth/me') {
    return signedIn
      ? json({ patient: { ...DEMO_PATIENT, consentVersion: catalog.privacy.version } })
      : json({ patient: null })
  }
  if (path === '/auth/otp') return json({ sent: true, demoCode: '000000' })
  if (path === '/auth/verify' || path === '/auth/login' || path === '/auth/register') {
    signedIn = true
    return json({ patient: { ...DEMO_PATIENT, consentVersion: catalog.privacy.version } })
  }
  if (path === '/auth/signout') {
    signedIn = false
    return json({ ok: true })
  }
  if (path === '/auth/consent') return json({ ok: true })

  if (path === '/appointments' && method === 'GET') {
    return json({ appointments: [...appointments].reverse() })
  }
  /*
   * Every route the booking flow can take, not just the signed-in one.
   *
   * This mock originally answered `/appointments` alone — the path used when a
   * patient is signed in. But booking needs no account, so the ordinary journey
   * posts to `/appointments/guest`, which fell through to a 404 and surfaced as
   * "Something went wrong. Please try again." on the last step of the demo. The
   * real server has all of these; only the mock was short, so the product was
   * fine and the preview was broken — the worse way round, because the preview
   * is what people judge it by.
   */
  const bookingPaths = ['/appointments', '/appointments/guest', '/appointments/callback']
  if (bookingPaths.includes(path) && method === 'POST') {
    const isCallback = path.endsWith('/callback')
    const doctor = catalog.doctors.find((d) => d.id === body?.doctorId)

    /* A callback holds no slot, so it cannot clash with anything. */
    if (!isCallback) {
      const clash = appointments.some(
        (a) => a.doctorId === body?.doctorId && a.date === body?.date && a.slot === body?.slot,
      )
      if (clash) {
        return fail(409, 'SLOT_TAKEN', 'Someone has just taken that time. Please pick another.')
      }
    }

    const created = {
      id: `DH-WEB${pad(nextRef++)}`,
      ...body,
      /* The real server derives this from the doctor; without it the
         confirmation summary looks up an undefined department. */
      departmentId: body?.departmentId ?? doctor?.departmentId ?? null,
      doctorName: doctor?.name?.en ?? null,
      status: isCallback ? 'requested' : 'confirmed',
      kind: isCallback ? 'callback' : 'slot',
      paymentStatus: 'counter',
      fee: isCallback ? null : (doctor?.fee ?? null),
      createdAt: new Date().toISOString(),
    }
    appointments.push(created)
    /* A guest booking creates no account, so it must not appear to sign anyone
       in — that is the whole point of the guest route. */
    if (path === '/appointments') signedIn = true
    return json({ appointment: created }, 201)
  }

  /* Finding a booking again with its reference and phone number. */
  if (path === '/appointments/lookup' && method === 'POST') {
    const found = appointments.find(
      (a) =>
        a.id.toUpperCase() === String(body?.reference ?? '').trim().toUpperCase() &&
        String(a.patient?.phone ?? a.phone ?? '') === String(body?.phone ?? '').trim(),
    )
    if (!found) {
      return fail(404, 'NOT_FOUND', 'No booking matches that reference and number.')
    }
    return json({ appointment: found })
  }

  if (path === '/appointments/lookup/cancel' && method === 'POST') {
    const found = appointments.find(
      (a) => a.id.toUpperCase() === String(body?.reference ?? '').trim().toUpperCase(),
    )
    if (!found) {
      return fail(404, 'NOT_FOUND', 'No booking matches that reference and number.')
    }
    found.status = 'cancelled'
    return json({ appointment: found })
  }

  const cancel = path.match(/^\/appointments\/([^/]+)\/cancel$/)
  if (cancel) {
    const found = appointments.find((a) => a.id === decodeURIComponent(cancel[1]))
    if (found) found.status = 'cancelled'
    return found ? json({ appointment: found }) : fail(404, 'NOT_FOUND', 'No such appointment.')
  }

  /*
   * Paying at the counter — which is what every demo booking does, and the
   * step the flow ends on. Without this the last press of the booking journey
   * failed, which is the worst possible place for a demo to break.
   */
  if (path === '/payments/counter' && method === 'POST') {
    const found = appointments.find((a) => a.id === body?.appointmentId)
    if (!found) return fail(404, 'NOT_FOUND', 'No such appointment.')
    found.paymentStatus = 'counter'
    return json({ appointment: found })
  }

  /* Online payment needs a real gateway. Say so rather than half-doing it. */
  if (path === '/payments/order' || path === '/payments/verify') {
    return fail(501, 'DEMO_ONLY', 'Paying online needs the real server. Choose "Pay at the counter".')
  }

  /*
   * Anything this mock does not implement.
   *
   * Returning null here meant the request fell through to a 404 and the app
   * showed its catch-all "Something went wrong. Please try again." — which is
   * honest about a real server and misleading about this one, where nothing
   * went wrong at all: the demo simply has no server behind that feature. A
   * named message points whoever hits it at the cause in one reading instead
   * of sending them hunting for a bug that does not exist.
   */
  return fail(501, 'DEMO_ONLY', `This part needs the real server (${method} ${path}).`)
}

export function installMockApi() {
  seedDeskDemo(catalog, appointments)
  const realFetch = globalThis.fetch.bind(globalThis)

  globalThis.fetch = async (input, init = {}) => {
    const raw = typeof input === 'string' ? input : input?.url ?? ''
    const url = new URL(raw, window.location.origin)
    if (!url.pathname.startsWith('/api/')) return realFetch(input, init)

    const path = url.pathname.slice('/api'.length)
    const method = (init.method ?? 'GET').toUpperCase()
    let body = null
    try {
      body = init.body ? JSON.parse(init.body) : null
    } catch {
      /* not JSON — the demo has no endpoint that wants anything else */
    }

    /* A beat of latency, so loading states are visible rather than skipped. */
    await new Promise((r) => setTimeout(r, 120))

    const response = await handle(method, path, url.searchParams, body)
    return (
      response ??
      fail(501, 'DEMO_ONLY', 'This part needs the real hospital server — it is not in the demo.')
    )
  }

  /* The live desk feed is a server-sent stream. Nothing to stream here, and an
     EventSource pointed at a non-existent URL retries forever, so it is stubbed
     into something inert. */
  globalThis.EventSource = class {
    close() {}
    addEventListener() {}
    removeEventListener() {}
  }
}
