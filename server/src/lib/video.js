import crypto from 'node:crypto'
import { config } from '../config.js'

/**
 * Teleconsultation rooms.
 *
 * Jitsi Meet is the default because it needs no account, no SDK and no
 * per-minute billing — a room exists the moment someone opens its URL. The
 * trade is that a room is public to anyone who knows its name, so the name is
 * an HMAC of the appointment id rather than the id itself: the reference
 * printed on a patient's slip must not be enough to walk into a consultation.
 */
export function roomNameFor(appointmentId) {
  const secret = config.video.roomSecret
  if (!secret) {
    // Still unguessable within a process, but not stable across restarts —
    // which is why preflight warns when the secret is missing.
    return `deepan-${crypto.randomBytes(16).toString('hex')}`
  }
  const digest = crypto.createHmac('sha256', secret).update(appointmentId).digest('base64url')
  return `deepan-${digest.slice(0, 24)}`
}

/** Returns a join URL, or null when the hospital pastes links by hand. */
export function createRoom(appointmentId) {
  if (config.video.provider !== 'jitsi') return null

  const room = roomNameFor(appointmentId)
  const url = new URL(`https://${config.video.jitsiHost}/${room}`)
  // Open muted with the camera off; the patient decides when to appear.
  url.hash = 'config.startWithVideoMuted=true&config.startWithAudioMuted=true'
  return { provider: 'jitsi', joinUrl: url.toString() }
}
