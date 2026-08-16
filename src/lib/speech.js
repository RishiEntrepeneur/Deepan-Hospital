/**
 * Reading the page aloud, in English, Tamil or Hindi.
 *
 * Two backends, tried in order:
 *
 *   1. **The server**, which calls ElevenLabs and returns audio. Better voices,
 *      and much better Tamil and Hindi than most devices manage alone. Only
 *      available when the hospital has configured a key; the browser never
 *      sees that key.
 *   2. **The browser's own speech.** Free, offline, no account, already on
 *      nearly every phone. This is what runs out of the box.
 *
 * The second is not a consolation prize. For an accessibility feature the
 * thing that matters is that pressing the button produces speech, and browser
 * speech does that on the overwhelming majority of devices at no cost. The
 * server path is an upgrade, and the code treats it as one — any failure
 * anywhere in it falls through to the browser rather than surfacing an error.
 *
 * What this deliberately does not do is read the whole page. It reads the
 * passage attached to the button that was pressed. A control that starts
 * reciting navigation, footer and cookie notice is one people press once.
 */

const BASE = import.meta.env.VITE_API_URL ?? '/api'

/**
 * BCP-47 tags for the browser's speech engine. India-specific where it helps:
 * `en-IN` is likelier to be pronounceable to a patient in Trichy than `en-US`,
 * and Tamil/Hindi realistically only ship in their Indian variants.
 */
const VOICE_TAGS = {
  en: ['en-IN', 'en-GB', 'en-US', 'en'],
  ta: ['ta-IN', 'ta-LK', 'ta'],
  hi: ['hi-IN', 'hi'],
}

let current = null // The Audio element or utterance now playing.
let serverSpeech = null // null = untested, true/false once known.
const listeners = new Set()

const synth = () => (typeof window !== 'undefined' ? window.speechSynthesis : null)

/* --------------------------------------------------------------- voices --- */

/**
 * The browser loads voices asynchronously and reports an empty list until it
 * has. Chrome fires `voiceschanged`; Safari sometimes never does but has them
 * populated by the time anything is spoken. Both are handled by simply asking
 * again at speak time rather than caching a list that may have been empty.
 */
function voiceFor(lang) {
  const speech = synth()
  if (!speech) return null
  const voices = speech.getVoices()
  if (!voices.length) return null

  for (const tag of VOICE_TAGS[lang] ?? []) {
    const exact = voices.find((v) => v.lang?.replace('_', '-').toLowerCase() === tag.toLowerCase())
    if (exact) return exact
    const loose = voices.find((v) =>
      v.lang?.replace('_', '-').toLowerCase().startsWith(tag.split('-')[0].toLowerCase()),
    )
    if (loose) return loose
  }
  return null
}

/**
 * Can this device speak the language at all?
 *
 * Worth knowing before showing the button: a device with no Tamil voice will
 * either say nothing or read Tamil text with an English engine, which is worse
 * than silence — it produces confident gibberish. Where the server backend is
 * available this does not apply, since the server can speak all three.
 */
export function canSpeak(lang) {
  if (serverSpeech) return true
  const speech = synth()
  if (!speech) return false
  // Before voices have loaded, assume yes rather than hiding the control on
  // first paint and revealing it a moment later.
  if (!speech.getVoices().length) return true
  return Boolean(voiceFor(lang))
}

/* ---------------------------------------------------------------- state --- */

const announce = (speaking) => {
  for (const listener of listeners) listener(speaking)
}

/** Subscribe to start/stop, so buttons can show the right icon. */
export function onSpeechChange(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Stop whatever is being read. Safe to call when nothing is. */
export function stopSpeaking() {
  const speech = synth()
  if (speech) {
    speech.cancel()
  }
  if (current instanceof Audio) {
    current.pause()
    current.currentTime = 0
  }
  current = null
  announce(false)
}

export const isSpeaking = () => current !== null

/* -------------------------------------------------------------- backends --- */

async function speakViaServer(text, lang) {
  if (serverSpeech === false) return false

  let response
  try {
    response = await fetch(`${BASE}/speech`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang }),
    })
  } catch {
    // Offline, or the API is down. Remember nothing — the browser may be back
    // in a moment, and the fallback covers this attempt.
    return false
  }

  if (!response.ok) {
    // 503 means the hospital has not configured a key. That will not change
    // while the page is open, so stop asking.
    if (response.status === 503) serverSpeech = false
    return false
  }

  serverSpeech = true

  const audio = new Audio(URL.createObjectURL(await response.blob()))
  current = audio
  announce(true)

  const done = () => {
    URL.revokeObjectURL(audio.src)
    if (current === audio) {
      current = null
      announce(false)
    }
  }
  audio.addEventListener('ended', done)
  audio.addEventListener('error', done)

  try {
    await audio.play()
    return true
  } catch {
    // Autoplay refused. Only happens without a user gesture, and every caller
    // here is a button press, but fall through rather than sit silent.
    done()
    return false
  }
}

function speakViaBrowser(text, lang) {
  const speech = synth()
  if (!speech) return false

  const utterance = new SpeechSynthesisUtterance(text)
  const voice = voiceFor(lang)
  if (voice) utterance.voice = voice
  utterance.lang = VOICE_TAGS[lang]?.[0] ?? 'en-IN'
  /*
   * Slightly slower than default. This is being read to someone who may be
   * elderly, unwell, or listening in their second language — and unlike a
   * podcast there is no scrubbing back.
   */
  utterance.rate = 0.95

  const done = () => {
    if (current === utterance) {
      current = null
      announce(false)
    }
  }
  utterance.addEventListener('end', done)
  utterance.addEventListener('error', done)

  current = utterance
  announce(true)
  speech.speak(utterance)
  return true
}

/* ----------------------------------------------------------------- speak --- */

/**
 * Read a passage aloud. Stops anything already being read first — two voices
 * at once is worse than no voice at all.
 *
 * Returns true if speech started. Callers can ignore it; the button uses it to
 * tell the patient when nothing could be spoken, which is far better than a
 * control that silently does nothing.
 */
export async function speak(text, lang = 'en') {
  const passage = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!passage) return false

  stopSpeaking()

  if (await speakViaServer(passage, lang)) return true
  return speakViaBrowser(passage, lang)
}

/** Read if silent, stop if speaking. What a play/pause button needs. */
export async function toggleSpeech(text, lang = 'en') {
  if (isSpeaking()) {
    stopSpeaking()
    return false
  }
  return speak(text, lang)
}
