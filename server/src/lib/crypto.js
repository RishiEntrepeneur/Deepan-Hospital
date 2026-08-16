import crypto from 'node:crypto'

/** URL-safe random token. */
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url')

export const randomSalt = () => crypto.randomBytes(16).toString('hex')

/** scrypt hash — used for OTP codes and staff passwords. */
export function hashSecret(secret, salt) {
  return crypto.scryptSync(String(secret), salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex')
}

/** Constant-time compare so a wrong OTP can't be timed out digit by digit. */
export function verifySecret(secret, salt, expectedHash) {
  const actual = Buffer.from(hashSecret(secret, salt), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  if (actual.length !== expected.length) return false
  return crypto.timingSafeEqual(actual, expected)
}

/** Session tokens are stored hashed, so a database leak isn't a login leak. */
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

/** Numeric OTP with no modulo bias. */
export function generateOtp(length = 6) {
  let code = ''
  while (code.length < length) code += crypto.randomInt(0, 10)
  return code
}

const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no look-alike characters

/** Public appointment reference, e.g. DH-K7P2QM. */
export function appointmentRef() {
  let suffix = ''
  for (let i = 0; i < 6; i += 1) suffix += ID_ALPHABET[crypto.randomInt(0, ID_ALPHABET.length)]
  return `DH-${suffix}`
}

export const uuid = () => crypto.randomUUID()

/** HMAC-SHA256 hex — used to verify Razorpay signatures. */
export const hmacHex = (secret, payload) =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex')

export function safeEqualHex(a, b) {
  const bufA = Buffer.from(String(a), 'utf8')
  const bufB = Buffer.from(String(b), 'utf8')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}
