/**
 * Turns one captured booking request into the config session mode needs.
 *
 * The appointment form lives behind Klinique's login, so nobody outside can
 * see its URL or field names. You capture them once:
 *
 *   1. Sign in to Klinique in Chrome.
 *   2. Open DevTools → Network, tick "Preserve log".
 *   3. Create one appointment by hand and press Save.
 *   4. Find the POST request in the Network list, right-click →
 *      Copy → Copy as cURL.
 *   5. Paste it into a file and run:
 *        npm run klinique-capture -- --file captured.txt
 *      or pipe it:
 *        pbpaste | npm run klinique-capture
 *
 * It prints the KLINIQUE_BOOKING_PATH and a starter KLINIQUE_FIELD_MAP, with
 * each field's source guessed from its name. Check the guesses — you are the
 * one who knows which Klinique field is the phone number — then paste the
 * block into server/.env.
 *
 * Nothing is sent anywhere. This only reads the text you captured.
 */
import fs from 'node:fs'

const args = process.argv.slice(2)
const fileArg = args.indexOf('--file')
const raw =
  fileArg !== -1 && args[fileArg + 1]
    ? fs.readFileSync(args[fileArg + 1], 'utf8')
    : fs.readFileSync(0, 'utf8') // stdin

if (!raw.trim()) {
  console.error('\n  Nothing to read. Pass --file <captured.txt> or pipe a cURL command in.\n')
  process.exit(1)
}

/* -------- the POST URL -------- */
const urlMatch =
  raw.match(/curl\s+'([^']+)'/) ||
  raw.match(/curl\s+"([^"]+)"/) ||
  raw.match(/(https?:\/\/[^\s'"]+)/)
if (!urlMatch) {
  console.error('\n  Could not find a URL in that. Make sure it is a "Copy as cURL" of the Save request.\n')
  process.exit(1)
}
let path
try {
  const u = new URL(urlMatch[1])
  path = u.pathname
} catch {
  console.error(`\n  That URL did not parse: ${urlMatch[1]}\n`)
  process.exit(1)
}

/* -------- the posted fields -------- */
// --data / --data-raw / --data-urlencode, single or double quoted.
const dataMatches = [...raw.matchAll(/--data(?:-raw|-urlencode)?\s+'([^']*)'/g)].map((m) => m[1])
const dataMatchesDq = [...raw.matchAll(/--data(?:-raw|-urlencode)?\s+"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1])
const dataString = [...dataMatches, ...dataMatchesDq].join('&')

if (!dataString) {
  console.error('\n  No form data found in that request. Was it the Save POST, not the page load?\n')
  process.exit(1)
}

const params = new URLSearchParams(dataString)
const fields = [...params.keys()].filter((k) => k && k !== 'utf8' && k !== 'authenticity_token')

/* -------- guess each field's source -------- */
const guess = (field) => {
  const f = field.toLowerCase()
  if (/name/.test(f)) return 'name'
  if (/phone|mobile|contact|cell/.test(f)) return 'phone'
  if (/age/.test(f)) return 'age'
  if (/gender|sex/.test(f)) return 'gender'
  if (/date|dob|day/.test(f)) return 'date'
  if (/time|slot|hour/.test(f)) return 'time'
  if (/reason|complaint|note|symptom/.test(f)) return 'reason'
  if (/doctor|physician|consultant|provider/.test(f)) return 'doctorRef'
  if (/ref|external|source/.test(f)) return 'ref'
  return null // unknown — leave for a human to decide
}

const map = {}
const unknown = []
for (const field of fields) {
  const source = guess(field)
  if (source) map[field] = source
  else unknown.push(field)
}

/* -------- report -------- */
console.info('\n  Captured Klinique booking request\n')
console.info(`  Booking path : ${path}`)
console.info(`  Fields seen  : ${fields.length}  (mapped ${Object.keys(map).length}, unknown ${unknown.length})\n`)

console.info('  Paste into server/.env — CHECK the right-hand sides first:\n')
console.info(`  KLINIQUE_MODE=session`)
console.info(`  KLINIQUE_BASE_URL=https://deepan.klinique.net`)
console.info(`  KLINIQUE_USERNAME=<the dedicated "Website Bookings" account>`)
console.info(`  KLINIQUE_PASSWORD=<its password>`)
console.info(`  KLINIQUE_BOOKING_PATH=${path}`)
console.info(`  KLINIQUE_BOOKING_NEW_PATH=${path.replace(/\/?$/, '')}/new`)
console.info(`  KLINIQUE_FIELD_MAP=${JSON.stringify(map)}`)

if (unknown.length) {
  console.info('\n  These fields were posted but not recognised. Decide each one:')
  console.info('    - if it is patient data, add it to the map with the right source')
  console.info('      (name, phone, age, gender, date, time, reason, doctorRef, ref)')
  console.info('    - if it is a fixed value Klinique needs (a clinic id, a type),')
  console.info('      it is easier to leave it out and set it inside Klinique’s defaults\n')
  for (const field of unknown) console.info(`      ${field}`)
}

console.info('\n  Sources you can map to: name, phone, age, gender, date, time, reason, doctorRef, ref')
console.info('  doctorRef also needs KLINIQUE_DOCTOR_MAP if Klinique uses its own doctor ids,')
console.info('  e.g. KLINIQUE_DOCTOR_MAP={"deepan-g":"42","gunasekaran-r":"57"}\n')
