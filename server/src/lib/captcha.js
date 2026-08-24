import crypto from 'node:crypto'
import { badRequest } from './validate.js'

/**
 * A small captcha, built in rather than bought in.
 *
 * The hospital should not have to open an account with Google or Cloudflare to
 * keep bots off its sign-up form, and a clinic's patients should not be
 * profiled by a third party on the way to booking a doctor. So this is a plain
 * arithmetic challenge — "what is 7 + 4?" — of the kind a person answers in a
 * second and a scripted sign-up flood does not.
 *
 * The important part is where the answer lives: never in the browser. The
 * server sends only the question and an HMAC-signed token that commits to the
 * answer, the issue time and a nonce. Verifying re-computes the signature over
 * the answer the user gave, so a wrong answer cannot be made to match, and the
 * token cannot be read to learn the answer or forged without the server key.
 *
 * A solved token is burned, so one answer cannot be replayed to register a
 * thousand accounts. Tokens expire, so a stockpile collected in advance goes
 * stale.
 *
 * This is a speed bump for scripts, deliberately, not a wall against a
 * determined human attacker — the rate limits and the OTP are what stop those.
 */

const TTL_MS = 10 * 60 * 1000 // long enough to fill a form slowly
const MAX_ATTEMPTS_PER_TOKEN = 3

/*
 * Signing key, random per process and never written down.
 *
 * Nothing to configure, and nothing to leak from a file. A restart invalidates
 * outstanding challenges, which costs a patient mid-form one new sum — the
 * right trade for a token that lives ten minutes. It does mean a second server
 * instance would reject the first one's tokens; if this is ever run behind more
 * than one process, derive this from a shared secret in the environment.
 */
const KEY = crypto.randomBytes(32)

/** Tokens already spent, so a correct answer cannot be replayed. */
const burned = new Map()
setInterval(() => {
  const now = Date.now()
  for (const [nonce, at] of burned) if (at + TTL_MS <= now) burned.delete(nonce)
}, 60_000).unref()

/** Wrong-answer counts, so a token cannot be brute-forced through ten options. */
const attempts = new Map()
setInterval(() => {
  const now = Date.now()
  for (const [nonce, entry] of attempts) if (entry.at + TTL_MS <= now) attempts.delete(nonce)
}, 60_000).unref()

const sign = (payload) => crypto.createHmac('sha256', KEY).update(payload).digest('base64url')

const randomInt = (min, max) => min + crypto.randomInt(max - min + 1)

/**
 * A question a person can answer in their head, in digits so it needs no
 * translating. Addition and multiplication only — subtraction invites negative
 * answers, and division invites fractions.
 */
function makeQuestion() {
  if (crypto.randomInt(2) === 0) {
    const a = randomInt(2, 9)
    const b = randomInt(2, 9)
    return { text: `${a} + ${b}`, answer: a + b }
  }
  const a = randomInt(2, 6)
  const b = randomInt(2, 6)
  return { text: `${a} × ${b}`, answer: a * b }
}

/**
 * Issue a challenge. Returns the question to show and an opaque token to send
 * back with the answer. The answer itself is not returned.
 */
export function issueChallenge() {
  const { text, answer } = makeQuestion()
  const nonce = crypto.randomBytes(12).toString('base64url')
  const issuedAt = Date.now()
  const body = `${nonce}.${issuedAt}.${answer}`
  const token = `${nonce}.${issuedAt}.${sign(body)}`
  return { question: text, token }
}

/**
 * Check an answer against its token. Throws a 400 the caller can surface, so a
 * route only has to call this and carry on.
 */
export function verifyChallenge(token, answer) {
  const raw = String(token ?? '')
  const parts = raw.split('.')
  if (parts.length !== 3) throw badRequest('CAPTCHA_REQUIRED', 'Please answer the sum to continue.')

  const [nonce, issuedAtRaw, signature] = parts
  const issuedAt = Number(issuedAtRaw)
  if (!Number.isFinite(issuedAt)) throw badRequest('CAPTCHA_INVALID', 'That answer was not right. Please try the new sum.')
  if (Date.now() - issuedAt > TTL_MS) {
    throw badRequest('CAPTCHA_EXPIRED', 'That sum expired. Please answer the new one.')
  }
  if (burned.has(nonce)) {
    throw badRequest('CAPTCHA_USED', 'Please answer the new sum.')
  }

  const tries = attempts.get(nonce)
  if (tries && tries.count >= MAX_ATTEMPTS_PER_TOKEN) {
    throw badRequest('CAPTCHA_INVALID', 'That answer was not right. Please try the new sum.')
  }

  // Blank is "you have not answered yet", not "you answered wrongly" — and
  // Number('') is 0, which would otherwise sail past the integer check and
  // tell a patient who submitted an empty box that they got the sum wrong.
  const raw2 = String(answer ?? '').trim()
  const given = Number(raw2)
  if (raw2 === '' || !Number.isInteger(given)) {
    throw badRequest('CAPTCHA_REQUIRED', 'Please answer the sum to continue.')
  }

  // Recompute the signature over the answer we were given: it matches only if
  // that is the answer the server committed to when it issued the token.
  const expected = sign(`${nonce}.${issuedAt}.${given}`)
  const a = Buffer.from(expected)
  const b = Buffer.from(String(signature))
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b)

  if (!ok) {
    attempts.set(nonce, { count: (tries?.count ?? 0) + 1, at: Date.now() })
    throw badRequest('CAPTCHA_INVALID', 'That answer was not right. Please try the new sum.')
  }

  // Correct: spend it, so it cannot be used again.
  burned.set(nonce, Date.now())
  attempts.delete(nonce)
  return true
}

/** Express middleware: verify `captchaToken` + `captchaAnswer` on the body. */
export function requireCaptcha(req, _res, next) {
  try {
    verifyChallenge(req.body?.captchaToken, req.body?.captchaAnswer)
    next()
  } catch (error) {
    next(error)
  }
}
