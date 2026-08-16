import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { config } from '../config.js'
import { asyncRoute } from '../middleware/base.js'
import { rateLimit } from '../lib/rateLimit.js'
import { speechSettings } from '../lib/elevenlabs.js'
import { badRequest } from '../lib/validate.js'

/**
 * Text to speech, for patients who would rather listen than read.
 *
 * This is an accessibility feature first and a convenience second. A patient
 * who cannot read comfortably — in any of the three languages, or at all — can
 * still find a department, check a fee and hear their appointment read back.
 *
 * The route exists only to keep the ElevenLabs key on the server. A key shipped
 * to the browser is a key printed in the page source, and anyone who views it
 * can spend the hospital's balance. The front end posts text and gets audio; it
 * never learns the key, the voice ids or the model.
 *
 * If no key is configured this returns 503 and the front end reads the text
 * with the browser's own speech instead — which costs nothing and is what runs
 * out of the box. The 503 is an expected state, not an error to page anyone
 * about.
 */
export const speechRouter = express.Router()

const LANGUAGES = new Set(['en', 'ta', 'hi'])
const ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-speech'

/*
 * Generous per-minute allowance — a patient reading a long page may legitimately
 * press play a dozen times — but bounded, because every miss on the cache is a
 * charge. The cache means repeat plays of the same text are free and do not
 * consume this budget in any meaningful way.
 */
const limiter = rateLimit({ limit: 40, windowMs: 60_000, code: 'SPEECH_RATE_LIMITED' })

/* ---------------------------------------------------------------- cache --- */

const cacheDir = config.speech.cacheDir
let cacheReady = false

function ensureCache() {
  if (cacheReady) return
  fs.mkdirSync(cacheDir, { recursive: true })
  cacheReady = true
}

/**
 * Cache key. Includes everything that changes the audio, so switching voice or
 * model in `.env` produces new files rather than serving the old voice forever.
 */
const cacheKey = (text, lang, settings) =>
  crypto
    .createHash('sha256')
    .update(`${settings.model} ${settings.voices[lang]} ${lang} ${text}`)
    .digest('hex')

/**
 * Drop the oldest clips once the directory grows past the limit.
 *
 * Runs after a write, and only when over the cap, so the usual request does no
 * directory listing at all. This is a disk-space guard, not an eviction policy
 * worth tuning — the working set is the app's own UI strings, which is small
 * and stable.
 */
function trimCache() {
  try {
    const files = fs.readdirSync(cacheDir).filter((f) => f.endsWith('.mp3'))
    if (files.length <= config.speech.cacheMax) return
    const byAge = files
      .map((f) => {
        const full = path.join(cacheDir, f)
        return { full, at: fs.statSync(full).mtimeMs }
      })
      .sort((a, b) => a.at - b.at)
    for (const { full } of byAge.slice(0, files.length - config.speech.cacheMax)) {
      fs.rmSync(full, { force: true })
    }
  } catch {
    /* A cache that cannot be trimmed is a disk-space problem, not a reason to
       fail a patient's request for audio. */
  }
}

/* ------------------------------------------------------------ the route --- */

speechRouter.post(
  '/speech',
  limiter,
  asyncRoute(async (req, res) => {
    if (config.speech.provider !== 'elevenlabs') {
      res.status(503).json({
        error: {
          code: 'SPEECH_NOT_CONFIGURED',
          message: 'Server speech is not configured. The browser will read this instead.',
        },
      })
      return
    }

    const lang = LANGUAGES.has(req.body?.lang) ? req.body.lang : 'en'
    const text = String(req.body?.text ?? '')
      .replace(/\s+/g, ' ')
      .trim()

    if (!text) throw badRequest('TEXT_REQUIRED', 'Nothing to read.')
    if (text.length > config.speech.maxChars) {
      throw badRequest(
        'TEXT_TOO_LONG',
        `Passages are read up to ${config.speech.maxChars} characters at a time.`,
      )
    }

    /*
     * Which model and voice to use is resolved from the account itself on
     * first use, not hardcoded — see lib/elevenlabs.js. If that could not be
     * reached, say unavailable and let the browser read it.
     */
    const settings = await speechSettings()
    if (!settings?.voices?.[lang]) {
      res.status(503).json({
        error: { code: 'SPEECH_UNAVAILABLE', message: 'Speech service unavailable.' },
      })
      return
    }

    ensureCache()
    const file = path.join(cacheDir, `${cacheKey(text, lang, settings)}.mp3`)

    // Served from cache: no API call, no charge.
    if (fs.existsSync(file)) {
      res.setHeader('X-Speech-Cache', 'hit')
      sendAudio(res, fs.readFileSync(file))
      return
    }

    let upstream
    try {
      upstream = await fetch(`${ENDPOINT}/${settings.voices[lang]}`, {
        method: 'POST',
        headers: {
          'xi-api-key': config.speech.apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: settings.model,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
        signal: AbortSignal.timeout(20_000),
      })
    } catch {
      // Network trouble reaching ElevenLabs. Same answer as "not configured":
      // the browser can read it, and a patient waiting to hear a fee does not
      // care whose network was at fault.
      res.status(503).json({
        error: { code: 'SPEECH_UNAVAILABLE', message: 'Speech service unreachable.' },
      })
      return
    }

    if (!upstream.ok) {
      /*
       * Quota exhausted, bad key, unknown voice. Logged for whoever runs the
       * server, and reported to the patient as "unavailable" — the front end
       * then falls back to browser speech, so the feature degrades rather than
       * disappears.
       */
      console.warn(`[speech] ElevenLabs returned ${upstream.status} for ${lang}`)
      res.status(503).json({
        error: { code: 'SPEECH_UNAVAILABLE', message: 'Speech service unavailable.' },
      })
      return
    }

    const audio = Buffer.from(await upstream.arrayBuffer())

    try {
      fs.writeFileSync(file, audio)
      trimCache()
    } catch {
      /* Serve it anyway; a failed cache write only costs a re-generation. */
    }

    res.setHeader('X-Speech-Cache', 'miss')
    sendAudio(res, audio)
  }),
)

function sendAudio(res, audio) {
  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('Content-Length', String(audio.length))
  // Immutable: the URL is a POST body hash in all but name — same text, same
  // voice, same audio, forever.
  res.setHeader('Cache-Control', 'private, max-age=86400')
  res.end(audio)
}

/** Told to the front end at startup so it knows which backend to use. */
export const speechStatus = () => ({
  provider: config.speech.provider,
  languages: [...LANGUAGES],
  maxChars: config.speech.maxChars,
})
