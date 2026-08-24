/** Request validation. Every field the client sends is re-checked here. */

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message ?? code)
    this.status = status
    this.code = code
    this.details = details
  }
}

export const badRequest = (code, message, details) => new ApiError(400, code, message, details)
export const unauthorized = (code = 'UNAUTHORIZED') => new ApiError(401, code)
export const forbidden = (code = 'FORBIDDEN') => new ApiError(403, code)
export const notFound = (code = 'NOT_FOUND') => new ApiError(404, code)
export const conflict = (code, message) => new ApiError(409, code, message)
export const tooMany = (code = 'RATE_LIMITED', message) => new ApiError(429, code, message)

const NAME_PATTERN = /^[\p{L}\p{M}\s.'-]+$/u
// International numbers are accepted, not just Indian ten-digit mobiles: the
// hospital's patients travel, and relatives abroad book for them. See
// src/lib/phone.js — the client mirror of this rule; keep the two in step.
const INDIAN_MOBILE = /^[6-9]\d{9}$/
const INTERNATIONAL = /^\+?\d{7,15}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const normalisePhone = (value) =>
  String(value ?? '')
    .replace(/[\s\-().]/g, '')
    .replace(/^00/, '+')      // 0044… → +44…
    .replace(/^\+91/, '')     // +91 is home; store it bare
    .replace(/^0(?=\d{10}$)/, '') // a leading trunk 0 on a 10-digit number

export function requireString(value, field, { min = 1, max = 500 } = {}) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length < min || text.length > max) throw badRequest('INVALID_FIELD', `Invalid ${field}`, { field })
  return text
}

export function requirePhone(value, field = 'phone') {
  const phone = normalisePhone(value)
  if (!INDIAN_MOBILE.test(phone) && !INTERNATIONAL.test(phone)) {
    throw badRequest('INVALID_PHONE', 'Invalid phone number', { field })
  }
  return phone
}

export function optionalEmail(value, field = 'email') {
  if (value === undefined || value === null || value === '') return null
  const email = String(value).trim().toLowerCase()
  if (!EMAIL_PATTERN.test(email)) throw badRequest('INVALID_EMAIL', 'Invalid email', { field })
  return email
}

/**
 * Age of the person who holds the account — must be an adult.
 *
 * Distinct from requireAge, which validates the age of the person being *seen*
 * and deliberately accepts any age: paediatrics is one of this hospital's
 * largest departments, and a parent booking for a two-year-old must keep
 * working. The restriction is on who may hold an account, not on who may be
 * treated.
 *
 * Beyond the hospital's own preference, the DPDP Act 2023 treats anyone under
 * 18 as a child and requires verifiable parental consent to process their
 * data. An adult account holder booking on a child's behalf is the arrangement
 * that satisfies that; a child holding their own account is not.
 */
export const ADULT_AGE = 18

export function requireAdultAge(value, field = 'age') {
  const age = requireAge(value, field)
  if (age < ADULT_AGE) {
    throw badRequest(
      'UNDER_AGE',
      `You must be ${ADULT_AGE} or over to hold an account. A parent or guardian can create the account and book appointments for a child.`,
      { field },
    )
  }
  return age
}

export function requireAge(value, field = 'age') {
  const age = Number(value)
  if (!Number.isInteger(age) || age < 0 || age > 120) {
    throw badRequest('INVALID_AGE', 'Invalid age', { field })
  }
  return age
}

export function requireName(value, field = 'name') {
  const name = requireString(value, field, { min: 3, max: 120 })
  if (!NAME_PATTERN.test(name)) throw badRequest('INVALID_NAME', 'Invalid name', { field })
  return name
}

export function requireGender(value, field = 'gender') {
  const gender = String(value ?? '').toLowerCase()
  if (!['male', 'female', 'other'].includes(gender)) {
    throw badRequest('INVALID_GENDER', 'Invalid gender', { field })
  }
  return gender
}

export function requireEnum(value, allowed, field) {
  if (!allowed.includes(value)) throw badRequest('INVALID_FIELD', `Invalid ${field}`, { field })
  return value
}

/** Patient details block shared by booking and callback requests. */
export function requirePatientBlock(body) {
  return {
    name: requireName(body?.name, 'name'),
    age: requireAge(body?.age, 'age'),
    phone: requirePhone(body?.phone, 'phone'),
    gender: requireGender(body?.gender, 'gender'),
    reason: requireString(body?.reason, 'reason', { min: 5, max: 1000 }),
  }
}


/**
 * Staff username convention.
 *
 * A doctor account's username must begin with "doctor", and a non-doctor
 * staff username must not. This is a NAMING CONVENTION, not a security
 * control — the actual boundary is that staff accounts can only be created by
 * an administrator with server access, and authorisation comes from the
 * `doctor_id` link, never from the spelling of the username.
 */
export const DOCTOR_USERNAME = /^doctor[a-z0-9][a-z0-9._-]*$/

export function assertUsernameMatchesRole(username, isDoctor) {
  const name = String(username ?? '').trim().toLowerCase()

  if (isDoctor && !DOCTOR_USERNAME.test(name)) {
    throw badRequest(
      'DOCTOR_USERNAME_PREFIX',
      'A doctor username must start with "doctor" — for example doctordeepan.',
    )
  }
  if (!isDoctor && name.startsWith('doctor')) {
    throw badRequest(
      'RESERVED_USERNAME_PREFIX',
      'Usernames starting with "doctor" are reserved for doctor accounts.',
    )
  }
  return name
}

/**
 * First visit or review — which decides the case-sheet charge.
 *
 * Required rather than defaulted for a slot booking, because it changes what
 * the patient pays. A silent default here would be a silent ₹30 difference on
 * somebody's bill, and the booking form always knows the answer.
 */
export function requireVisitType(value, field = 'visitType') {
  const visit = String(value ?? '').trim()
  if (visit !== 'first' && visit !== 'review') {
    throw badRequest('VISIT_TYPE_REQUIRED', 'Say whether this is a first visit or a review.', {
      field,
    })
  }
  return visit
}
