/**
 * Reads the visits list out of Klinique and shows what it found.
 *
 *   npm run klinique-visits
 *
 * READ ONLY. It signs in, fetches one page and prints what it made of it.
 * Nothing is written to Klinique and nothing is written to this app's
 * database — this exists so a person can check the reading is right before
 * anything starts relying on it.
 *
 * WHY IT MASKS THE OUTPUT BY DEFAULT
 *
 * The obvious way to check a parser is to print the rows. Those rows are real
 * patients' names and mobile numbers, and the natural next step — pasting the
 * output into a chat window to ask why it looks wrong — sends them somewhere
 * they should never go. So names become `xxxxx` and numbers `9999999999` by
 * default: enough to see that the columns landed in the right fields, not
 * enough to identify anybody.
 *
 *   npm run klinique-visits -- --real     the actual values, for the hospital's
 *                                         own eyes, on the hospital's own screen
 */
import { config } from '../src/config.js'
import { fetchPage, isSessionMode } from '../src/lib/klinique-session.js'
import { parseVisits } from '../src/lib/klinique-visits.js'

const args = process.argv.slice(2)
const real = args.includes('--real')
const at = args.indexOf('--path')
const path = at !== -1 && args[at + 1] ? args[at + 1] : (process.env.KLINIQUE_VISITS_PATH ?? '/visits')

const mask = (s) =>
  s == null ? null : real ? s : String(s).replace(/[A-Za-z]/g, 'x').replace(/[0-9]/g, '9')

if (!isSessionMode()) {
  console.error(`
  Klinique session mode is not switched on, so there is nothing to read.

  server/.env needs:
      KLINIQUE_MODE=session
      KLINIQUE_BASE_URL=https://deepan.klinique.net
      KLINIQUE_USERNAME=...
      KLINIQUE_PASSWORD=...
`)
  process.exit(1)
}

let html
try {
  html = await fetchPage(path)
} catch (error) {
  console.error(`\n  Could not fetch ${path}: ${error.message}\n`)
  process.exit(1)
}

/* A login page comes back with a 200, so the fetch succeeding proves nothing. */
if (/name="[^"]*\[password\]"/.test(html) && !/<table/i.test(html)) {
  console.error(`
  ${path} came back as the sign-in page — the account did not stay signed in.
  Check KLINIQUE_USERNAME and KLINIQUE_PASSWORD, and KLINIQUE_LOGIN_SCOPE
  (whether this account signs in through the 'user' or the 'doctor' door).
`)
  process.exit(1)
}

let result
try {
  result = parseVisits(html)
} catch (error) {
  console.error(`
  Fetched ${path} (${html.length} characters) but could not read it:

      ${error.message}

  Nothing is broken at the hospital's end — this only means the page does not
  look the way the parser expects. Send that message on, with the list of
  headings in it, and the parser can be taught this shape.
`)
  process.exit(1)
}

const { visits, headings, columns, unmapped, ambiguousDates } = result

console.info(`\n  Read ${visits.length} visit(s) from ${path}\n`)
console.info('  Columns, and what each was taken to be:')
for (const [i, heading] of headings.entries()) {
  const field = Object.entries(columns).find(([, at2]) => at2 === i)?.[0]
  console.info(`      ${String(i).padStart(2)}  ${(heading || '(blank)').padEnd(22)} ${field ?? '— not used'}`)
}

if (unmapped.length) {
  console.info(`\n  Columns nothing claimed: ${unmapped.map((u) => u.heading).join(', ')}`)
  console.info('  If one of those matters, say so and it can be mapped.')
}

if (ambiguousDates) {
  console.info(`\n  ${ambiguousDates} date(s) could be read either way round (e.g. 03/04).`)
  console.info('  They were read day-first, as Indian dates. Check one against Klinique.')
}

console.info(`\n  First rows${real ? '' : ' (names and numbers masked — pass --real to see them)'}:\n`)
for (const v of visits.slice(0, 5)) {
  console.info(
    `      ${v.date ?? '????-??-??'} ${(v.slot ?? '--:--').padEnd(6)} ` +
      `${(mask(v.patient) ?? '?').padEnd(18)} ${(mask(v.phone) ?? '—').padEnd(12)} ` +
      `${(mask(v.doctor) ?? '—').padEnd(18)} ${v.status ?? '—'}`,
  )
}

const missing = ['phone', 'doctor', 'time', 'status'].filter((f) => columns[f] === undefined)
if (missing.length) {
  console.info(`\n  Not found on this page: ${missing.join(', ')}.`)
  console.info('  That may be fine — check whether Klinique shows them here at all.')
}

console.info(`\n  Read-only. Nothing was written to Klinique or to this app.\n`)
