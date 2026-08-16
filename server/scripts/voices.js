/**
 * Shows which ElevenLabs model and voices the app will speak with.
 *
 *   npm run voices          what is configured, and everything available
 *   npm run voices -- --try what it actually sounds like, written to /tmp
 *
 * Run this after adding the API key. It answers the two questions that
 * actually come up: "is the key working?" and "which voice is reading Hindi,
 * and can I have a different one?".
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { config } from '../src/config.js'
import { speechSettings } from '../src/lib/elevenlabs.js'

const SAMPLES = {
  en: 'Doctor G. Deepan, Orthopaedic Surgeon. Consultation five hundred rupees.',
  hi: 'डॉक्टर गो. दीपन, हड्डी रोग सर्जन। परामर्श शुल्क पाँच सौ रुपये।',
  ta: 'டாக்டர் கோ. தீபன், எலும்பியல் அறுவை சிகிச்சை நிபுணர். ஆலோசனைக் கட்டணம் ஐந்நூறு ரூபாய்.',
}

if (!config.speech.apiKey) {
  console.log(`
  ELEVENLABS_API_KEY is not set, so the app is using the browser's own voice.

  That voice is the robotic one. To change it:

    1. Sign up at https://elevenlabs.io and create an API key
    2. Add this line to server/.env:

         ELEVENLABS_API_KEY=your_key_here

    3. Restart the API, then run this again

  Nothing else needs configuring — the model and a voice per language are
  chosen automatically from your account.
`)
  process.exit(1)
}

const settings = await speechSettings()

if (!settings) {
  console.error(`
  Could not reach ElevenLabs with the key in server/.env.

  Usually one of:
    - the key is wrong or has been revoked
    - no internet from this machine
    - the account is out of quota

  The app is falling back to the browser's voice in the meantime, so patients
  still hear something.
`)
  process.exit(1)
}

const byId = new Map(settings.catalogue.map((v) => [v.id, v]))
const nameOf = (id) => byId.get(id)?.name ?? id ?? '(none)'

console.log()
console.log(`  Model:  ${settings.model}`)
console.log()
console.log('  Speaking with:')
for (const [code, label] of [['en', 'English'], ['hi', 'Hindi'], ['ta', 'Tamil']]) {
  const id = settings.voices[code]
  const overridden = Boolean(config.speech.voices[code])
  console.log(
    `    ${label.padEnd(8)} ${nameOf(id).padEnd(16)} ${id ?? ''}${overridden ? '  (set in .env)' : ''}`,
  )
}

console.log()
console.log(`  Available in this account (${settings.catalogue.length}):`)
for (const voice of settings.catalogue.slice(0, 40)) {
  const tags = [voice.labels.accent, voice.labels.language, voice.labels.description]
    .filter(Boolean)
    .join(', ')
  console.log(`    ${voice.name.padEnd(18)} ${voice.id}  ${tags}`)
}

console.log(`
  To choose a different voice, copy its ID into server/.env:

    ELEVENLABS_VOICE_HI=<id>

  Then delete the cached audio so the old voice stops being served:

    rm -rf server/data/speech
`)

/* ---------------------------------------------------------------- --try --- */

if (process.argv.includes('--try')) {
  console.log('  Generating a sample per language…\n')
  const out = path.join(os.tmpdir(), 'deepan-voices')
  fs.mkdirSync(out, { recursive: true })

  for (const [code, text] of Object.entries(SAMPLES)) {
    const voiceId = settings.voices[code]
    if (!voiceId) {
      console.log(`    ${code}: no voice resolved, skipped`)
      continue
    }
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': config.speech.apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({ text, model_id: settings.model }),
        signal: AbortSignal.timeout(30_000),
      })
      if (!response.ok) {
        console.log(`    ${code}: ElevenLabs returned ${response.status}`)
        continue
      }
      const file = path.join(out, `${code}.mp3`)
      fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()))
      console.log(`    ${code}: ${file}`)
    } catch (error) {
      console.log(`    ${code}: ${error.message}`)
    }
  }
  console.log(`\n  Play them:  open ${out}\n`)
}
