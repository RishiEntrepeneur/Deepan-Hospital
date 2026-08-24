import { isValidPhone, normalisePhone, prettyPhone as pretty } from './phone'
/**
 * The last mobile number that signed in successfully on this device.
 *
 * Kept so a returning patient does not retype ten digits every visit, and so
 * the app can tell "you already have an account" from "you are new" *before*
 * asking for anything — which is what lets the screen say "Log in" instead of
 * the sign-up-sounding "Sign in".
 *
 * Two deliberate limits:
 *
 *   1. Only the number. No name, no session, nothing that could act on the
 *      patient's behalf. A remembered number is a convenience, never a
 *      credential — the one-time code is still required every time.
 *   2. Forgettable in one tap from the sign-in screen. Phones get shared and
 *      handed round in a family, so leaving somebody else's number sitting in
 *      the box with no way to clear it would be worse than not remembering.
 */
const KEY = 'deepan_last_phone'

export function rememberedPhone() {
  try {
    const value = localStorage.getItem(KEY) ?? ''
    return isValidPhone(value) ? value : ''
  } catch {
    // Private browsing, or storage disabled — behave as a new device.
    return ''
  }
}

export function rememberPhone(phone) {
  const clean = normalisePhone(phone)
  if (!isValidPhone(clean)) return
  try {
    localStorage.setItem(KEY, clean)
  } catch {
    /* nothing to do — the next visit simply asks again */
  }
}

export function forgetPhone() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* already effectively forgotten */
  }
}

/** Has anyone signed in on this device before? Decides log-in vs sign-in copy. */
export const hasAccountOnThisDevice = () => rememberedPhone() !== ''

/** '9943969691' → '99439 69691', easier to check at a glance. */
export const prettyPhone = (phone) => pretty(phone)
