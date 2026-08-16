/**
 * Session mode: submitting bookings through Klinique's own web forms.
 *
 * When Klinique will not give the hospital an API, this is the automation that
 * remains: sign in the way a browser does and post each booking through the
 * appointment form. It is the "reverse-engineered form POST" approach, done
 * carefully.
 *
 * Klinique is a Rails/Devise app (confirmed from its public sign-in page), so
 * every form carries a per-session CSRF `authenticity_token` and the login is
 * an HttpOnly `_session_id` cookie. That means you cannot simply POST
 * credentials blind — you fetch the form first, read its token and cookie,
 * then post. This module does exactly that, keeps the session, and re-signs-in
 * when it lapses.
 *
 * Three things make this safe to run rather than reckless:
 *
 *   1. **A dedicated account.** Point KLINIQUE_USERNAME at an account created
 *      for this — "Website Bookings" — not a receptionist's. Klinique's audit
 *      log then says the website made the booking, which is true.
 *   2. **It never blocks a patient.** Every failure — bad login, changed form,
 *      Klinique down — leaves the booking on reception's manual worklist. The
 *      automatic path is a layer on top of the safety net, never instead of it.
 *   3. **It only sends what a receptionist would type.** Name, phone, age,
 *      gender, date, time, reason, doctor. No clinical data.
 *
 * What it cannot know by itself is the appointment form's URL and field names —
 * those are behind the login and differ per Klinique build. They come from
 * config (KLINIQUE_BOOKING_PATH, KLINIQUE_FIELD_MAP), captured once from a real
 * booking. Until they are set this module reports "not configured" and the
 * booking stays manual.
 */

import { config } from '../config.js'

/** One process-wide session. Klinique is one system; one cookie jar suffices. */
let session = { cookie: null, signedInAt: 0 }

const SESSION_TTL_MS = 20 * 60 * 1000 // re-login well inside a typical timeout

export const isSessionMode = () =>
  config.klinique.mode === 'session' &&
  Boolean(config.klinique.baseUrl && config.klinique.username && config.klinique.password)

/** True only when there is also enough to actually submit a booking. */
export const isSessionSubmitReady = () =>
  isSessionMode() && Boolean(config.klinique.bookingPath && parsedFieldMap())

const url = (path) => new URL(path, config.klinique.baseUrl).toString()

/** Merges Set-Cookie values into a single Cookie header, newest winning. */
function mergeCookies(existing, setCookieHeaders) {
  const jar = new Map()
  for (const pair of (existing ?? '').split('; ').filter(Boolean)) {
    jar.set(pair.split('=')[0], pair)
  }
  for (const line of setCookieHeaders) {
    const pair = line.split(';')[0]
    const name = pair.split('=')[0]
    if (name) jar.set(name, pair)
  }
  return [...jar.values()].join('; ')
}

/** Rails puts the CSRF token in a hidden input and usually a <meta> too. */
function extractToken(html) {
  const meta = html.match(/<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/i)
  if (meta) return decodeHtml(meta[1])
  const input = html.match(/name="authenticity_token"[^>]*value="([^"]+)"/i)
  if (input) return decodeHtml(input[1])
  const inputAlt = html.match(/value="([^"]+)"[^>]*name="authenticity_token"/i)
  return inputAlt ? decodeHtml(inputAlt[1]) : null
}

const decodeHtml = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&#x2F;/g, '/')
    .replace(/&#x2B;/g, '+')
    .replace(/&#61;/g, '=')
    .replace(/&quot;/g, '"')

const timeout = () => AbortSignal.timeout(config.klinique.sessionTimeoutMs)

/**
 * Signs in and stores the session cookie. Throws on failure so the caller can
 * record it against the booking — the booking itself is never at risk.
 */
export async function signIn() {
  const loginUrl = url(config.klinique.loginPath)

  // 1. GET the form: collect the initial cookie and the CSRF token.
  const page = await fetch(loginUrl, { headers: { Accept: 'text/html' }, signal: timeout() })
  if (!page.ok) throw new Error(`sign-in page returned ${page.status}`)
  const cookie = mergeCookies(null, page.headers.getSetCookie?.() ?? [])
  const token = extractToken(await page.text())
  if (!token) throw new Error('no CSRF token on the sign-in page — form has changed')

  // 2. POST the credentials, carrying that cookie and token, as the form does.
  // The field prefix is 'user' or 'doctor' depending which door this account
  // uses — Klinique's two logins name their fields differently.
  const scope = config.klinique.loginScope
  const body = new URLSearchParams({
    utf8: '✓',
    authenticity_token: token,
    [`${scope}[login]`]: config.klinique.username,
    [`${scope}[password]`]: config.klinique.password,
    [`${scope}[remember_me]`]: '0',
    commit: 'Sign in',
  })
  const res = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
      Accept: 'text/html',
    },
    body,
    redirect: 'manual', // Devise answers a good login with a 302 to the app
    signal: timeout(),
  })

  const after = mergeCookies(cookie, res.headers.getSetCookie?.() ?? [])

  /*
   * Devise signs you in with a 302 away from /sign_in. A 200 that lands back on
   * the sign-in form means the credentials were refused. Anything with a fresh
   * session cookie and a redirect off the login path is success.
   */
  const location = res.headers.get('location') ?? ''
  const ok = (res.status === 302 || res.status === 303) && !/sign_in/.test(location)
  if (!ok) {
    const otherDoor = scope === 'user' ? 'doctor' : 'user'
    throw new Error(
      res.status === 200
        ? `Klinique refused the credentials at ${config.klinique.loginPath}. ` +
          `Check KLINIQUE_USERNAME / KLINIQUE_PASSWORD — and if this account is a ` +
          `${otherDoor === 'doctor' ? 'physician/doctor' : 'staff'} login, set ` +
          `KLINIQUE_LOGIN_SCOPE=${otherDoor} in .env.`
        : `unexpected sign-in response ${res.status} from ${config.klinique.loginPath}`,
    )
  }

  session = { cookie: after, signedInAt: Date.now() }
  return session
}

async function ensureSession() {
  if (session.cookie && Date.now() - session.signedInAt < SESSION_TTL_MS) return session
  return signIn()
}

function parsedFieldMap() {
  if (!config.klinique.fieldMap) return null
  try {
    const map = JSON.parse(config.klinique.fieldMap)
    return map && typeof map === 'object' && Object.keys(map).length ? map : null
  } catch {
    return null
  }
}

function parsedDoctorMap() {
  if (!config.klinique.doctorMap) return {}
  try {
    return JSON.parse(config.klinique.doctorMap) ?? {}
  } catch {
    return {}
  }
}

/** The booking, flattened to the values a form field might want. */
function bookingValues(row) {
  const doctorMap = parsedDoctorMap()
  return {
    name: row.patient_name ?? '',
    phone: row.patient_phone ?? '',
    age: row.patient_age == null ? '' : String(row.patient_age),
    gender: row.patient_gender ?? '',
    date: row.date ?? '',
    time: row.slot ?? '',
    reason: row.reason ?? '',
    doctorRef: doctorMap[row.doctor_id] ?? row.doctor_id ?? '',
    ref: row.id ?? '',
  }
}

/**
 * Builds the form body from the captured field map. Any Klinique field mapped
 * to a booking value we do not have is simply left out.
 */
function buildBookingBody(row, token) {
  const map = parsedFieldMap()
  const values = bookingValues(row)
  const body = new URLSearchParams()
  body.set('utf8', '✓')
  body.set('authenticity_token', token)
  for (const [field, source] of Object.entries(map)) {
    if (source in values) body.set(field, values[source])
  }
  return body
}

/**
 * Submits one booking. Returns { ok, ref } or { ok:false, reason }. Never
 * throws — the caller is recording an outcome, not handling an exception.
 */
export async function submitBooking(row) {
  if (!isSessionSubmitReady()) {
    return { ok: false, reason: 'session mode not fully configured (booking path / field map)' }
  }

  try {
    await ensureSession()

    // Fetch the appointment form for a fresh CSRF token, exactly as a browser
    // would before typing into it. Falls back to the submit path if no separate
    // "new" page was captured.
    const formUrl = url(config.klinique.bookingNewPath || config.klinique.bookingPath)
    const form = await fetch(formUrl, {
      headers: { Cookie: session.cookie, Accept: 'text/html' },
      signal: timeout(),
    })
    if (form.status === 401 || form.status === 403 || /sign_in/.test(form.url)) {
      // Session lapsed between bookings — sign in once more and retry the fetch.
      await signIn()
    }
    const formHtml = form.ok ? await form.text() : ''
    session.cookie = mergeCookies(session.cookie, form.headers.getSetCookie?.() ?? [])
    const token = extractToken(formHtml)
    if (!token) return { ok: false, reason: 'no CSRF token on the booking form' }

    const res = await fetch(url(config.klinique.bookingPath), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: session.cookie,
        Accept: 'text/html',
      },
      body: buildBookingBody(row, token),
      redirect: 'manual',
      signal: timeout(),
    })
    session.cookie = mergeCookies(session.cookie, res.headers.getSetCookie?.() ?? [])

    /*
     * Rails answers a successful create with a 302 to the new record, often at
     * a URL that ends in its id. A 200 usually means the form came back with
     * validation errors — a real failure that belongs on the worklist.
     */
    if (res.status === 302 || res.status === 303 || res.status === 201) {
      const location = res.headers.get('location') ?? ''
      const ref = location.match(/\/(\d+)(?:[/?#]|$)/)?.[1] ?? null
      return { ok: true, ref }
    }

    const detail = (await res.text().catch(() => '')).slice(0, 200)
    return { ok: false, reason: `Klinique returned ${res.status}`, detail }
  } catch (error) {
    return { ok: false, reason: error.message }
  }
}

/** Forgets the current session — used by tests and after a credential change. */
export function resetSession() {
  session = { cookie: null, signedInAt: 0 }
}
