/**
 * Phone rules, in one place so the booking form, the account form, the desk
 * and the "remember me" store cannot drift apart.
 *
 * The hospital is in Tiruchirappalli, so most numbers are Indian ten-digit
 * mobiles — but patients travel, and relatives abroad book on their behalf, so
 * an international number has to be accepted too. The old rule was
 * `^[6-9]\d{9}$`: it rejected every foreign number outright, and reception was
 * left typing a fake Indian number in to get past the form.
 *
 * Accepted now:
 *   - a plain Indian mobile:            9843074989
 *   - the same with +91 / 0 / 0091:     +91 98430 74989, 09843074989
 *   - any international number in E.164: +44 7911 123456, +1 415 555 2671
 */

/**
 * Strip formatting and fold the common Indian prefixes to a bare ten digits,
 * so the same number typed three different ways compares equal on lookup.
 * A genuine international number keeps its leading '+' and country code.
 */
export function normalisePhone(value) {
  const compact = String(value ?? '').replace(/[\s\-().]/g, '')
  return compact
    .replace(/^00/, '+') // 0044… → +44…
    .replace(/^\+91/, '') // +91 is home; store it bare
    .replace(/^0(?=\d{10}$)/, '') // a leading trunk 0 on a 10-digit number
}

/**
 * True for a number the hospital can actually dial: a home ten-digit mobile,
 * or an international number of a plausible length. E.164 caps the digits at
 * 15; seven is the shortest real subscriber number anywhere.
 */
export function isValidPhone(value) {
  const phone = normalisePhone(value)
  if (/^[6-9]\d{9}$/.test(phone)) return true // Indian mobile
  return /^\+?\d{7,15}$/.test(phone) // international
}

/** Group for legibility: Indian numbers as 5+5, others left as dialled. */
export function prettyPhone(value) {
  const phone = normalisePhone(value)
  if (/^[6-9]\d{9}$/.test(phone)) return `${phone.slice(0, 5)} ${phone.slice(5)}`
  return phone
}
