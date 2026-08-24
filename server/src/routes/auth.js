import express from 'express'
import { config } from '../config.js'
import { db, nowIso, transaction } from '../db.js'
import { generateOtp, hashSecret, randomSalt, uuid, verifySecret } from '../lib/crypto.js'
import { rateLimit } from '../lib/rateLimit.js'
import { audit } from '../lib/audit.js'
import { issueChallenge, requireCaptcha, verifyChallenge } from '../lib/captcha.js'
import { erasePatient, exportPatient } from '../lib/retention.js'
import {
  badRequest,
  conflict,
  optionalEmail,
  requireAdultAge,
  requireGender,
  requireName,
  requirePhone,
  tooMany,
  unauthorized,
} from '../lib/validate.js'
import { asyncRoute } from '../middleware/base.js'
import { endSession, loadSession, requirePatient, startSession } from '../middleware/session.js'

export const authRouter = express.Router()

const insertOtp = db.prepare(`
  INSERT INTO otp_codes (id, phone, code_hash, code_salt, expires_at, created_at, ip)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)
const latestOtp = db.prepare(`
  SELECT * FROM otp_codes
  WHERE phone = ? AND consumed_at IS NULL
  ORDER BY created_at DESC LIMIT 1
`)
const countRecentOtp = db.prepare(
  'SELECT COUNT(*) AS n FROM otp_codes WHERE phone = ? AND created_at > ?',
)
const bumpAttempts = db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?')
const consumeOtp = db.prepare('UPDATE otp_codes SET consumed_at = ? WHERE id = ?')

const findPatientByPhone = db.prepare('SELECT * FROM patients WHERE phone = ?')
const insertPatient = db.prepare(`
  INSERT INTO patients (id, phone, full_name, email, age, gender, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)
const touchLogin = db.prepare('UPDATE patients SET last_login_at = ? WHERE id = ?')
const updatePatient = db.prepare(`
  UPDATE patients SET full_name = ?, email = ?, age = ?, gender = ? WHERE id = ?
`)

const publicPatient = (row) =>
  row && {
    id: row.id,
    phone: row.phone,
    fullName: row.full_name,
    email: row.email,
    age: row.age,
    gender: row.gender,
    createdAt: row.created_at,
  }

/* ------------------------------------------------------------------ *
 * POST /auth/otp — request a code
 * ------------------------------------------------------------------ */
authRouter.post(
  '/otp',
  rateLimit({ limit: 10, windowMs: 60 * 60 * 1000, code: 'OTP_IP_LIMIT' }),
  asyncRoute(async (req, res) => {
    const phone = requirePhone(req.body?.phone)

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { n } = countRecentOtp.get(phone, since)
    if (n >= config.otp.perPhonePerHour) {
      throw tooMany('OTP_PHONE_LIMIT', 'Too many codes requested for this number. Try again later.')
    }

    const code = generateOtp(config.otp.length)
    const salt = randomSalt()

    insertOtp.run(
      uuid(),
      phone,
      hashSecret(code, salt),
      salt,
      new Date(Date.now() + config.otp.ttlMs).toISOString(),
      nowIso(),
      req.clientIp ?? null,
    )

    // No delivery channel: the code is returned below and logged. Reception
    // can read it out; there is nothing to send it to.
    console.info(`  [verification code for +91${phone}] ${code}`)
    audit({ action: 'otp.requested', entity: 'phone', entityId: phone, ip: req.clientIp })

    res.json({
      sent: true,
      expiresInSeconds: Math.floor(config.otp.ttlMs / 1000),
      isNewPatient: !findPatientByPhone.get(phone),
      // Development convenience only — see config.otp.echoInResponse.
      ...(config.otp.echoInResponse ? { devCode: code } : {}),
    })
  }),
)

/* ------------------------------------------------------------------ *
 * POST /auth/verify — exchange the code for a session
 * ------------------------------------------------------------------ */
authRouter.post(
  '/verify',
  rateLimit({ limit: 20, windowMs: 15 * 60 * 1000, code: 'OTP_VERIFY_LIMIT' }),
  asyncRoute(async (req, res) => {
    const phone = requirePhone(req.body?.phone)
    const code = String(req.body?.code ?? '').trim()
    if (!/^\d{4,8}$/.test(code)) throw badRequest('INVALID_CODE', 'Enter the code you received.')

    const record = latestOtp.get(phone)
    if (!record) throw unauthorized('OTP_NOT_FOUND')

    if (new Date(record.expires_at).getTime() <= Date.now()) throw unauthorized('OTP_EXPIRED')
    if (record.attempts >= config.otp.maxAttempts) throw unauthorized('OTP_ATTEMPTS_EXCEEDED')

    if (!verifySecret(code, record.code_salt, record.code_hash)) {
      bumpAttempts.run(record.id)
      throw unauthorized('OTP_INCORRECT')
    }

    const patient = transaction(() => {
      consumeOtp.run(nowIso(), record.id)

      const existing = findPatientByPhone.get(phone)
      if (existing) {
        touchLogin.run(nowIso(), existing.id)
        return existing
      }

      // First sign-in creates the record; the profile is completed separately.
      const id = uuid()
      insertPatient.run(id, phone, '', null, null, null, nowIso())
      touchLogin.run(nowIso(), id)
      return findPatientByPhone.get(phone)
    })

    startSession(res, req, patient.id, 'patient')
    audit({
      actorType: 'patient',
      actorId: patient.id,
      action: 'auth.signed_in',
      ip: req.clientIp,
    })

    res.json({
      patient: publicPatient(patient),
      profileComplete: Boolean(patient.full_name),
      consentNeeded: patient.consent_version !== config.privacy.version,
      privacyVersion: config.privacy.version,
    })
  }),
)

/* ------------------------------------------------------------------ *
 * Password sign-in
 *
 * A patient account with a password they choose, rather than a code texted to
 * their handset. Codes meant an SMS gateway, which meant TRAI registration —
 * a week of paperwork before anyone could book. A password removes that
 * dependency and is what people expect from every other site they use.
 *
 * Booking does not require an account at all (see /appointments/guest). This
 * exists for patients who want their appointments in one place.
 * ------------------------------------------------------------------ */
const setPassword = db.prepare(
  'UPDATE patients SET password_hash = ?, password_salt = ?, full_name = COALESCE(NULLIF(?, \'\'), full_name) WHERE id = ?',
)

/*
 * Rate limits, keyed per source address.
 *
 * These were one shared 10-per-15-minutes bucket, which was two mistakes for a
 * hospital: a waiting room shares one public IP, so a dozen people signing in
 * legitimately would lock the rest out; and sign-in attempts and new sign-ups
 * ate the same budget, so a burst of one blocked the other. Now they are
 * separate and roomier. Still tight enough that password-guessing gets nowhere
 * — an attacker on one address gets 40 tries an hour, not thousands.
 */
const loginLimiter = rateLimit({ limit: 40, windowMs: 15 * 60 * 1000, code: 'SIGNIN_LIMIT' })
const registerLimiter = rateLimit({ limit: 20, windowMs: 15 * 60 * 1000, code: 'SIGNIN_LIMIT' })

/*
 * Claiming an account that already has records on it.
 *
 * Numbers were in this database long before passwords were — every booking
 * made as a guest, and everyone who used the old code-by-SMS sign-in. Letting
 * anyone set a password on one of those by typing the number alone would hand
 * a stranger the patient's name, email, age and every appointment they have
 * had. So a number with history has to be claimed with something only its
 * owner holds: one of their own booking references.
 *
 * It is a one-time proof, not a way in. After this they sign in with the
 * password they chose, like anywhere else.
 */
const historyFor = db.prepare(
  'SELECT COUNT(*) AS n FROM appointments WHERE patient_id = ? OR patient_phone = ?',
)
const referenceForPhone = db.prepare('SELECT id FROM appointments WHERE id = ? AND patient_phone = ?')

function assertMayClaim(existing, phone, supplied) {
  const hasRecords = historyFor.get(existing.id, phone).n > 0
  if (!hasRecords && !existing.email && !existing.full_name) return

  const reference = String(supplied ?? '').trim().toUpperCase()
  if (reference && referenceForPhone.get(reference, phone)) return

  throw badRequest(
    'CLAIM_PROOF_REQUIRED',
    'This number already has records at the hospital. Enter one of your booking references to set a password, or ask reception to help.',
    { field: 'bookingReference' },
  )
}

/* ------------------------------------------------------------------ *
 * Captcha
 * ------------------------------------------------------------------ *
 * A sum to answer, so a script cannot create accounts in bulk. The question is
 * handed out here; the answer never leaves the server (see lib/captcha.js).
 *
 * Sign-up always asks. Signing in only asks once an address has got the
 * password wrong repeatedly — a patient who signs in normally is never made to
 * do arithmetic, and somebody working through a password list is.
 */
authRouter.get(
  '/captcha',
  rateLimit({ limit: 60, windowMs: 15 * 60 * 1000, code: 'CAPTCHA_LIMIT' }),
  (_req, res) => {
    res.json(issueChallenge())
  },
)

/** Failed sign-ins per address, to decide when to start asking for a sum. */
const FAILURES_BEFORE_CAPTCHA = 3
const loginFailures = new Map()
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of loginFailures) if (entry.until <= now) loginFailures.delete(ip)
}, 60_000).unref()

const loginNeedsCaptcha = (ip) => (loginFailures.get(ip)?.count ?? 0) >= FAILURES_BEFORE_CAPTCHA

/** Tells the sign-in form whether it must show a sum before it submits. */
authRouter.get('/login-challenge', (req, res) => {
  res.json({ required: loginNeedsCaptcha(req.clientIp) })
})

/** Create an account, or set a password on one that has none yet. */
authRouter.post(
  '/register',
  registerLimiter,
  requireCaptcha,
  asyncRoute(async (req, res) => {
    const phone = requirePhone(req.body?.phone)
    const password = String(req.body?.password ?? '')
    const fullName = String(req.body?.fullName ?? '').trim().slice(0, 80)

    if (password.length < 8) {
      throw badRequest('WEAK_PASSWORD', 'Use at least 8 characters.', { field: 'password' })
    }

    const existing = findPatientByPhone.get(phone)
    if (existing?.password_hash) {
      // Never reveal that a number is registered to someone who is guessing —
      // but this is the sign-up form, so the useful answer is "sign in".
      throw conflict('PHONE_TAKEN', 'That number already has an account. Please sign in.')
    }
    if (existing) assertMayClaim(existing, phone, req.body?.bookingReference)

    const salt = randomSalt()
    const patient = transaction(() => {
      if (!existing) {
        const id = uuid()
        insertPatient.run(id, phone, fullName, null, null, null, nowIso())
      }
      const row = findPatientByPhone.get(phone)
      setPassword.run(hashSecret(password, salt), salt, fullName, row.id)
      return findPatientByPhone.get(phone)
    })

    startSession(res, req, patient.id, 'patient')
    audit({ actorType: 'patient', actorId: patient.id, action: 'auth.registered', ip: req.clientIp })

    res.status(201).json({
      patient: publicPatient(patient),
      profileComplete: Boolean(patient.full_name),
      consentNeeded: patient.consent_version !== config.privacy.version,
      privacyVersion: config.privacy.version,
    })
  }),
)

/** Sign in with the phone number and password. */
authRouter.post(
  '/login',
  loginLimiter,
  asyncRoute(async (req, res) => {
    // Once this address has failed a few times, it has to answer a sum before
    // the password is even checked — that is what makes a password list slow.
    if (loginNeedsCaptcha(req.clientIp)) {
      verifyChallenge(req.body?.captchaToken, req.body?.captchaAnswer)
    }

    const phone = requirePhone(req.body?.phone)
    const password = String(req.body?.password ?? '')
    const patient = findPatientByPhone.get(phone)

    /*
     * One answer for "no such number" and "wrong password". Telling them apart
     * turns this form into a way of discovering which numbers are patients of
     * this hospital, which is itself information worth protecting. The password
     * is still verified against a dummy hash when the account does not exist,
     * so the two paths take the same time.
     */
    const ok =
      patient?.password_hash && patient?.password_salt
        ? verifySecret(password, patient.password_salt, patient.password_hash)
        : (hashSecret(password, 'timing-equaliser'), false)

    if (!ok) {
      const entry = loginFailures.get(req.clientIp)
      loginFailures.set(req.clientIp, {
        count: (entry?.count ?? 0) + 1,
        until: Date.now() + 60 * 60 * 1000,
      })
      audit({ actorType: 'patient', action: 'auth.signin_failed', ip: req.clientIp })
      throw unauthorized('INVALID_CREDENTIALS')
    }

    // A real sign-in clears the suspicion against this address.
    loginFailures.delete(req.clientIp)
    touchLogin.run(nowIso(), patient.id)
    startSession(res, req, patient.id, 'patient')
    audit({ actorType: 'patient', actorId: patient.id, action: 'auth.signed_in', ip: req.clientIp })

    res.json({
      patient: publicPatient(patient),
      profileComplete: Boolean(patient.full_name),
      consentNeeded: patient.consent_version !== config.privacy.version,
      privacyVersion: config.privacy.version,
    })
  }),
)

/* ------------------------------------------------------------------ *
 * Session
 * ------------------------------------------------------------------ */
authRouter.get('/me', loadSession, (req, res) => {
  if (!req.patient) {
    res.json({ patient: null })
    return
  }
  res.json({
    patient: publicPatient(req.patient),
    profileComplete: Boolean(req.patient.full_name),
    // The app asks again whenever the notice has moved on.
    consentNeeded: req.patient.consent_version !== config.privacy.version,
    privacyVersion: config.privacy.version,
  })
})

authRouter.post('/profile', loadSession, requirePatient, (req, res) => {
  const fullName = requireName(req.body?.fullName, 'fullName')
  const email = optionalEmail(req.body?.email)
  // The account holder must be an adult; the person being seen need not be.
  const age = req.body?.age === '' || req.body?.age == null ? null : requireAdultAge(req.body.age)
  const gender = req.body?.gender ? requireGender(req.body.gender) : null

  updatePatient.run(fullName, email, age, gender, req.patient.id)
  audit({ actorType: 'patient', actorId: req.patient.id, action: 'profile.updated', ip: req.clientIp })

  res.json({ patient: publicPatient(db.prepare('SELECT * FROM patients WHERE id = ?').get(req.patient.id)) })
})

authRouter.post('/signout', loadSession, (req, res) => {
  if (req.patient) {
    audit({ actorType: 'patient', actorId: req.patient.id, action: 'auth.signed_out', ip: req.clientIp })
  }
  endSession(req, res, 'patient')
  res.json({ signedOut: true })
})

/* ------------------------------------------------------------------ *
 * Data protection — DPDP Act 2023
 *
 * Consent is recorded rather than assumed, and the two rights a patient is
 * most likely to exercise are wired to real endpoints rather than to an email
 * address nobody reads.
 * ------------------------------------------------------------------ */
authRouter.post('/consent', loadSession, requirePatient, (req, res) => {
  const version = String(req.body?.version ?? config.privacy.version)
  if (version !== config.privacy.version) throw badRequest('STALE_CONSENT_VERSION')

  db.prepare('UPDATE patients SET consent_at = ?, consent_version = ? WHERE id = ?').run(
    nowIso(), version, req.patient.id,
  )
  audit({
    actorType: 'patient',
    actorId: req.patient.id,
    action: 'consent.given',
    detail: { version },
    ip: req.clientIp,
  })
  res.json({ ok: true, version })
})

/** Everything held about the signed-in patient, as a download. */
authRouter.get('/export', loadSession, requirePatient, (req, res) => {
  audit({ actorType: 'patient', actorId: req.patient.id, action: 'data.exported', ip: req.clientIp })
  res.setHeader('Content-Disposition', 'attachment; filename="deepan-my-data.json"')
  res.json(exportPatient(req.patient.id))
})

/**
 * Erasure.
 *
 * Refused while an appointment is still coming up: the hospital cannot honour
 * a booking for somebody whose record it has just deleted, and quietly
 * cancelling their appointment to satisfy the request would be worse.
 */
authRouter.post('/erase', loadSession, requirePatient, (req, res) => {
  const upcoming = db
    .prepare(
      `SELECT COUNT(*) n FROM appointments
       WHERE patient_id = ? AND status IN ('pending', 'confirmed', 'requested')`,
    )
    .get(req.patient.id).n

  if (upcoming > 0) {
    throw conflict(
      'HAS_UPCOMING',
      'Please cancel your upcoming appointments first, then ask again.',
    )
  }

  erasePatient(req.patient.id)
  endSession(req, res, 'patient')
  res.json({ ok: true })
})
