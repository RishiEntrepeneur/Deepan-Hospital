import { config } from '../config.js'

/**
 * Picks the model and voices to speak with.
 *
 * Hardcoding voice IDs was the obvious approach and the wrong one. A voice ID
 * is meaningless unless that voice is in *this* account's library, and the
 * default library changes; a stale ID gets a 404 and the patient hears the
 * robotic browser voice with no clue why. The same goes for models — which
 * languages a model covers is a fact ElevenLabs publishes and I should not be
 * guessing at, particularly for Tamil, which the older multilingual model does
 * not speak.
 *
 * So both are resolved from the API on first use: ask which models exist and
 * which languages they cover, ask which voices the account has, and choose.
 * Anything set explicitly in `.env` wins — this is a sensible default, not a
 * policy.
 *
 * Resolved once per process and cached. If resolution fails the caller falls
 * back to browser speech, same as any other failure.
 */

const API = 'https://api.elevenlabs.io/v1'

/** ISO codes ElevenLabs uses for the three languages the app speaks. */
const NEEDED = ['en', 'hi', 'ta']

let resolved = null
let inFlight = null

const authHeaders = () => ({ 'xi-api-key': config.speech.apiKey })

async function get(path) {
  const response = await fetch(`${API}${path}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`${path} returned ${response.status}`)
  return response.json()
}

/**
 * The best model that can speak all three languages.
 *
 * Preference order is quality first: the multilingual models are meant for
 * this, the turbo and flash ones trade a little fidelity for latency. Reading
 * a paragraph to a patient is not latency-sensitive — nobody minds waiting
 * 400ms for a voice that does not grate.
 */
function chooseModel(models) {
  const canSpeakAll = models.filter((model) => {
    if (model.can_do_text_to_speech === false) return false
    const codes = new Set((model.languages ?? []).map((l) => l.language_id?.toLowerCase()))
    return NEEDED.every((code) => codes.has(code))
  })
  if (!canSpeakAll.length) return null

  const rank = (id) => {
    if (/multilingual_v2/.test(id)) return 0
    if (/v3/.test(id)) return 1
    if (/turbo/.test(id)) return 2
    if (/flash/.test(id)) return 3
    return 4
  }
  canSpeakAll.sort((a, b) => rank(a.model_id) - rank(b.model_id))
  return canSpeakAll[0].model_id
}

/**
 * A voice per language.
 *
 * Where the account has a voice actually labelled for the language, use it —
 * a voice built for Hindi sounds far better reading Hindi than an English one
 * doing it phonetically. Most accounts have no such voice, so the fallback is
 * a good general voice used for all three, which is what the multilingual
 * model is designed for and is still leagues ahead of the browser.
 */
function chooseVoices(voices) {
  /*
   * A voice tagged for one language must never be offered for another.
   *
   * The first version of this matched English on the "indian" accent tag, to
   * prefer Indian-accented English over American — and promptly picked a Hindi
   * narration voice, because Hindi voices carry that accent tag too. English
   * would have been read by a voice built for Devanagari.
   */
  const belongsElsewhere = (voice, code) => {
    const tagged = voice.labels?.language
    return Boolean(tagged && tagged !== code)
  }

  const describes = (voice, words) => {
    const haystack = [voice.labels?.description, voice.name, voice.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return words.some((word) => haystack.includes(word))
  }

  // A calm, clear voice beats a characterful one for reading a fee to someone
  // who is unwell. Only voices not claimed by another language are eligible.
  const preferredNames = ['rachel', 'sarah', 'charlotte', 'alice', 'matilda', 'daniel', 'george']
  const neutral = voices.filter((v) => !v.labels?.language)
  const general =
    neutral.find((v) => preferredNames.includes(v.name?.toLowerCase())) ??
    neutral.find((v) => v.category === 'premade') ??
    neutral[0] ??
    voices[0]

  const pick = (code, words) =>
    // Tagged for exactly this language — the strongest signal there is.
    voices.find((v) => v.labels?.language === code) ??
    // Or named/described as it, provided it is not claimed by another.
    voices.find((v) => !belongsElsewhere(v, code) && describes(v, words)) ??
    general

  return {
    // English deliberately has no accent preference. An Indian-accented English
    // voice would be nicer, but there is no tag that distinguishes one from a
    // Hindi voice, and getting that wrong is worse than an ordinary accent.
    en: pick('en', ['english'])?.voice_id,
    hi: pick('hi', ['hindi'])?.voice_id,
    ta: pick('ta', ['tamil'])?.voice_id,
  }
}

async function resolve() {
  const [voiceList, modelList] = await Promise.all([get('/voices'), get('/models')])

  const chosenModel = config.speech.model ?? chooseModel(modelList ?? [])
  const auto = chooseVoices(voiceList?.voices ?? [])

  const result = {
    model: chosenModel ?? 'eleven_multilingual_v2',
    voices: {
      en: config.speech.voices.en ?? auto.en,
      hi: config.speech.voices.hi ?? auto.hi,
      ta: config.speech.voices.ta ?? auto.ta,
    },
    /* Reported so `npm run voices` can explain itself, and so a wrong-sounding
       language can be traced to the voice that produced it. */
    catalogue: (voiceList?.voices ?? []).map((v) => ({
      id: v.voice_id,
      name: v.name,
      labels: v.labels ?? {},
    })),
    models: (modelList ?? []).map((m) => ({
      id: m.model_id,
      name: m.name,
      languages: (m.languages ?? []).map((l) => l.language_id),
    })),
  }

  if (!chosenModel) {
    console.warn(
      '[speech] no model advertises all of English, Hindi and Tamil — falling back to eleven_multilingual_v2. Tamil may be mispronounced.',
    )
  }
  for (const code of NEEDED) {
    if (!result.voices[code]) console.warn(`[speech] no voice resolved for ${code}`)
  }

  return result
}

/** Resolved model and voices, or null if the API could not be reached. */
export async function speechSettings() {
  if (resolved) return resolved
  if (!config.speech.apiKey) return null
  // Collapse concurrent first-requests into one round trip.
  inFlight ??= resolve()
    .then((value) => {
      resolved = value
      console.log(
        `[speech] ElevenLabs ready — model ${value.model}, voices en=${value.voices.en} hi=${value.voices.hi} ta=${value.voices.ta}`,
      )
      return value
    })
    .catch((error) => {
      console.warn(`[speech] could not reach ElevenLabs: ${error.message}`)
      return null
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

/** Forget the cached choice — used by the voices script after a change. */
export const resetSpeechSettings = () => {
  resolved = null
  inFlight = null
}
