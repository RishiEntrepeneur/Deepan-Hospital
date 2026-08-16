/**
 * Content-Security-Policy, defined once for both halves of the app.
 *
 * It lives at the repo root rather than inside `server/` or `src/` because the
 * server and the built front end must agree, and two hand-maintained copies
 * would drift the first time somebody adds a script. The server imports it for
 * its response header; vite.config.js imports it to stamp a <meta> tag into
 * the built index.html.
 *
 * Every entry is here because something breaks without it:
 *
 *   checkout.razorpay.com   the payment sheet's script and iframe
 *   api.razorpay.com        where the sheet posts the payment
 *   fonts.googleapis.com    the stylesheet for Instrument Sans / Noto Tamil
 *   fonts.gstatic.com       the font files themselves
 *   meet.jit.si             the teleconsultation iframe
 *   deepan.klinique.net     the hospital's clinical portal, embedded for staff
 *
 * 'unsafe-inline' is permitted for styles only. Tailwind and React both set
 * inline style attributes, and a style value is not an XSS route that CSP
 * would otherwise be closing. It is NOT permitted for scripts, which is the
 * directive that actually earns its keep.
 */
const RAZORPAY = ['https://checkout.razorpay.com', 'https://api.razorpay.com']

/*
 * The hospital's clinical system, embedded on a staff-only page so reception
 * has one screen rather than two. Configurable because the host is the
 * hospital's, not ours — and because framing only works while Klinique sends
 * no X-Frame-Options, which is their decision to change.
 */
const KLINIQUE = process.env.KLINIQUE_PORTAL_URL ?? 'https://deepan.klinique.net'

/**
 * @param apiOrigin  Absolute origin of the API when it is not same-origin
 *                   (e.g. https://api.deepanhospital.in). Without this the
 *                   browser blocks every call the app makes and the site looks
 *                   completely broken — a very easy deployment to get wrong.
 * @param dev        Relaxes script rules for Vite's dev server, which needs
 *                   inline scripts and a websocket for hot reload. Never true
 *                   in a build that reaches a patient.
 */
export function buildCsp({ apiOrigin = null, dev = false } = {}) {
  const connect = ["'self'", ...RAZORPAY]
  if (apiOrigin) connect.push(apiOrigin)
  if (dev) connect.push('ws:', 'wss:')

  return [
    "default-src 'self'",
    `script-src 'self'${dev ? " 'unsafe-inline' 'unsafe-eval'" : ''} https://checkout.razorpay.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    `connect-src ${connect.join(' ')}`,
    `frame-src ${RAZORPAY.join(' ')} https://meet.jit.si ${KLINIQUE}`,
    // Nothing may embed this app. Clickjacking a "Cancel appointment" button
    // is the concrete attack this closes.
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ')
}

/**
 * The subset that works in a <meta> tag.
 *
 * `frame-ancestors` is ignored when delivered by meta — it only counts as a
 * real header. Whatever serves the built files must send it, or the app can
 * still be framed. Stripped here rather than left in, so nobody reads the meta
 * tag and concludes they are protected when they are not.
 */
export const metaCsp = (options) =>
  buildCsp(options)
    .split('; ')
    .filter((directive) => !directive.startsWith('frame-ancestors'))
    .join('; ')

/** Header the static host must send for clickjacking protection. */
export const FRAME_ANCESTORS_HEADER = "frame-ancestors 'none'"
