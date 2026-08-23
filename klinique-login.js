/**
 * Puts the Klinique login into server/.env, by asking for it.
 *
 *   npm run klinique-login
 *
 * It prompts for the username and password (the password does not show as you
 * type) and writes them into .env for you, so nobody has to hand-edit the file
 * or paste a password anywhere it could be seen. Then run `npm run klinique-test`.
 *
 * The values are written only to your own .env on this machine.
 */
import readline from 'node:readline'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const envPath = process.env.ENV_FILE || path.join(here, '..', '.env')

// One shared interface — creating a fresh one per question loses buffered
// input (the first reader swallows it all), which hangs on piped input.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
let muted = false
rl._writeToOutput = (s) => {
  if (!muted) rl.output.write(s)
}

const ask = (prompt, { hidden = false } = {}) =>
  new Promise((resolve) => {
    muted = false
    rl.question(prompt, (value) => {
      if (hidden) rl.output.write('\n')
      resolve(value.trim())
    })
    if (hidden) muted = true
  })

/** Replaces `KEY=...` in the file, or appends it if there is no such line. */
function setEnv(contents, key, value) {
  const line = `${key}=${value}`
  const re = new RegExp(`^${key}=.*$`, 'm')
  if (re.test(contents)) return contents.replace(re, line)
  return contents.replace(/\n?$/, `\n${line}\n`)
}

if (!fs.existsSync(envPath)) {
  console.error(`\n  No .env at ${envPath}. Copy .env.example to .env first.\n`)
  process.exit(1)
}

console.info('\n  Klinique login — this is the account the website uses to file bookings.')
console.info('  Use a dedicated account if you can. Nothing is shown or sent anywhere.\n')

const username = await ask('  Klinique username (or email): ')
if (!username) {
  console.error('\n  No username entered. Nothing changed.\n')
  process.exit(1)
}
const password = await ask('  Klinique password (hidden): ', { hidden: true })
if (!password) {
  console.error('\n  No password entered. Nothing changed.\n')
  process.exit(1)
}
const scopeRaw = (await ask('  Login type — "user" for staff, "doctor" for physician [user]: ')) || 'user'
const scope = scopeRaw.toLowerCase() === 'doctor' ? 'doctor' : 'user'

let contents = fs.readFileSync(envPath, 'utf8')
contents = setEnv(contents, 'KLINIQUE_MODE', 'session')
contents = setEnv(contents, 'KLINIQUE_BASE_URL', 'https://deepan.klinique.net')
contents = setEnv(contents, 'KLINIQUE_USERNAME', username)
contents = setEnv(contents, 'KLINIQUE_PASSWORD', password)
contents = setEnv(contents, 'KLINIQUE_LOGIN_SCOPE', scope)
fs.writeFileSync(envPath, contents)
rl.close()

console.info(`\n  ✓  Saved to .env  (username "${username}", password ${'•'.repeat(password.length)}, ${scope} login)`)
console.info('\n  Now test it:\n     npm run klinique-test\n')
