import { config, isProduction } from '../config.js'
import { db } from '../db.js'
import { isSessionMode, isSessionSubmitReady } from './klinique-session.js'

/**
 * Refuses to start a production server that would leak or lose patient data.
 *
 * Every check here corresponds to a way this app could go live looking fine
 * and be quietly unsafe. Failing loudly at boot is the only reliable moment
 * to catch them — nobody re-reads a README before deploying.
 */
export function preflight() {
  const fatal = []
  const warn = []

  if (isProduction) {
    if (!config.session.secure) {
      fatal.push('COOKIE_SECURE must be true in production, or session cookies travel unencrypted.')
    }
    if (config.corsOrigins.some((o) => o.startsWith('http://'))) {
      fatal.push(`CORS_ORIGINS contains a plaintext origin: ${config.corsOrigins.join(', ')}`)
    }
    if (config.payments.provider === 'razorpay' && !config.payments.razorpay.webhookSecret) {
      fatal.push('RAZORPAY_WEBHOOK_SECRET is required — without it payment confirmations cannot be trusted.')
    }

    // Accounts created during development, with passwords that were printed
    // to a terminal, must not survive into production.
    const staff = db.prepare("SELECT username FROM staff WHERE active = 1").all()
    const suspicious = staff.filter((s) => ['admin', 'test', 'demo'].includes(s.username))
    if (suspicious.length > 0) {
      warn.push(`Default-looking staff accounts still active: ${suspicious.map((s) => s.username).join(', ')}`)
    }
    if (staff.length === 0) warn.push('No staff accounts exist — nobody can reach the desk.')
  }

  if (config.video.provider === 'jitsi' && !config.video.roomSecret) {
    warn.push('VIDEO_ROOM_SECRET is not set — consultation room names change on every restart.')
  }
  /*
   * The SMS warnings are gone with the codes they were about. Patients book as
   * guests now — no account, no code, no gateway — so there is nothing to
   * deliver and nothing to warn about. Reception sees arrivals on the desk.
   */
  if (config.speech.provider !== 'elevenlabs') {
    warn.push(
      "ELEVENLABS_API_KEY is not set — read-aloud uses the device's own voice, which sounds robotic. See SPEECH-SETUP.md.",
    )
  }
  /*
   * Klinique session mode. Say plainly which of three states it is in, because
   * "half configured" looks exactly like "working" until a booking is made.
   */
  if (config.klinique.mode === 'session') {
    if (!isSessionMode()) {
      warn.push('KLINIQUE_MODE=session but username/password/base URL missing — bookings stay on the manual worklist.')
    } else if (!isSessionSubmitReady()) {
      warn.push('Klinique session sign-in is set, but the booking form is not captured yet (KLINIQUE_BOOKING_PATH / KLINIQUE_FIELD_MAP). Bookings stay on the manual worklist until it is.')
    } else {
      console.info('  ✓  Klinique session mode is active — bookings submit automatically, failures fall to the desk worklist.')
    }
  }

  const bookable = db.prepare("SELECT COUNT(*) AS n FROM doctors WHERE active = 1 AND booking_mode = 'live'").get().n
  const total = db.prepare('SELECT COUNT(*) AS n FROM doctors WHERE active = 1').get().n
  if (bookable === 0) {
    warn.push(`No doctor has a published schedule — ${total} listed, 0 bookable. Patients can only request callbacks.`)
  } else if (bookable < total) {
    warn.push(`${bookable} of ${total} doctors are bookable; the rest accept callback requests only.`)
  }

  for (const message of warn) console.warn(`  ⚠  ${message}`)

  if (fatal.length > 0) {
    console.error('\n  ✖  Refusing to start:\n')
    for (const message of fatal) console.error(`     • ${message}`)
    console.error('')
    process.exit(1)
  }
}
