/**
 * Audible + system alert for the reception desk.
 *
 * The live feed already updates the screen, but a screen nobody is looking at
 * is not a notification. Reception is a counter with people at it — the thing
 * that actually works there is a noise.
 *
 * Both channels are opt-in and remembered, because browsers refuse to make
 * sound or raise notifications until a human has asked for them, and because
 * a hospital may not want a chime going off in a waiting room.
 */
const SOUND_KEY = 'deepan_desk_sound'
const NOTIFY_KEY = 'deepan_desk_notify'

const read = (key) => {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
const write = (key, on) => {
  try {
    localStorage.setItem(key, on ? '1' : '0')
  } catch {
    /* private mode — the preference just does not persist */
  }
}

export const soundEnabled = () => read(SOUND_KEY)
export const notifyEnabled = () => read(NOTIFY_KEY)
export const setSoundEnabled = (on) => write(SOUND_KEY, on)

/*
 * One AudioContext for the life of the page. Creating one per chime leaks
 * hardware contexts — browsers cap them at a few dozen and then go silent,
 * which would look exactly like the feature having stopped working.
 */
let audio = null
function context() {
  if (!audio) {
    const Ctor = window.AudioContext ?? window.webkitAudioContext
    if (!Ctor) return null
    audio = new Ctor()
  }
  // Autoplay policy suspends the context until a gesture; resume is a no-op
  // when it is already running.
  if (audio.state === 'suspended') audio.resume().catch(() => {})
  return audio
}

/**
 * A short two-note chime, synthesised rather than shipped as a file.
 *
 * No binary asset to load, nothing extra in the bundle, and it cannot fail
 * because a file 404'd. Kept quiet and short: this fires at a counter with
 * patients standing at it.
 */
export function chime() {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  for (const [index, frequency] of [880, 1174.7].entries()) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = frequency
    const at = now + index * 0.13
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.14, at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22)
    osc.connect(gain).connect(ctx.destination)
    osc.start(at)
    osc.stop(at + 0.24)
  }
}

/** Asks the browser for notification permission. Must run from a click. */
export async function requestNotifyPermission() {
  if (typeof Notification === 'undefined') return false
  const result =
    Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  const granted = result === 'granted'
  write(NOTIFY_KEY, granted)
  return granted
}

export function disableNotify() {
  write(NOTIFY_KEY, false)
}

/**
 * Raises a system notification if it was switched on and still permitted.
 *
 * `tag` collapses repeats: five bookings in a minute should leave one banner
 * saying the latest, not five stacked over each other.
 */
export function notifyDesk(title, body) {
  if (!notifyEnabled() || typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  try {
    // eslint-disable-next-line no-new
    new Notification(title, { body, tag: 'deepan-desk', renotify: true })
  } catch {
    /* some browsers only allow this from a service worker; silence is fine */
  }
}

/** Both channels at once, each respecting its own switch. */
export function alertDesk(title, body) {
  if (soundEnabled()) chime()
  notifyDesk(title, body)
}
