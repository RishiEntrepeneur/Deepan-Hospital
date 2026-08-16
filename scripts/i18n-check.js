/**
 * Checks the translation dictionaries against each other.
 *
 * This exists because the same mistake was made four times in one day: a Tamil
 * string written into the English block, which shows a patient reading English
 * a line of Tamil. Every one of those was found by eye, late. None had to be.
 *
 * Three things are checked:
 *
 *   1. **Parity** — English and Tamil must define exactly the same keys. A key
 *      in one and not the other is a line that silently falls back.
 *   2. **Script** — a value in the English block written in Tamil or Devanagari
 *      is in the wrong block. This is the bug that kept happening.
 *   3. **Placeholders** — `{name}`, `{count}` and friends must survive
 *      translation. A dropped placeholder prints "Welcome back, " with nothing
 *      after it; an invented one prints the braces raw at a patient.
 *
 * Hindi used to be reported rather than enforced, because its coverage was
 * deliberately partial — the patient journey first, everything else falling
 * back to English. It is complete now, so it is held to the same parity as
 * Tamil. The fallback still exists and still works; it is simply no longer
 * something a new key is allowed to rely on.
 *
 *   node scripts/i18n-check.js          report, exit 1 on a real problem
 *   node scripts/i18n-check.js --list   also list every missing Hindi key
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { translations } from '../src/i18n/translations.js'

const here = path.dirname(fileURLToPath(import.meta.url))

const TAMIL = /[஀-௿]/
const DEVANAGARI = /[ऀ-ॿ]/
const PLACEHOLDER = /\{(\w+)\}/g

const keysOf = (lang) => Object.keys(translations[lang] ?? {})
const placeholders = (value) =>
  new Set(String(value).match(PLACEHOLDER)?.map((p) => p.slice(1, -1)) ?? [])

const problems = []
const notes = []

/* ---------- 0. Duplicate keys ---------- */

/*
 * Read from the source text, not the parsed object.
 *
 * A JavaScript object literal accepts the same key twice without complaint and
 * silently keeps the last one, so by the time these dictionaries are objects
 * every duplicate has already been swallowed. The earlier value — quite
 * possibly the correct translation someone wrote — is simply gone, and nothing
 * anywhere reports it. The only place the evidence survives is the file.
 */
for (const file of ['../src/i18n/translations.js', '../src/i18n/hi.js']) {
  const source = fs.readFileSync(path.join(here, file), 'utf8')
  const seen = new Map() // key -> count, per top-level block
  let block = path.basename(file) === 'hi.js' ? 'hi' : null

  for (const line of source.split('\n')) {
    const opens = line.match(/^ {2}(\w+):\s*\{/)
    if (opens) {
      block = opens[1]
      seen.clear()
      continue
    }
    const entry = line.match(/^\s+'([^']+)':/)
    if (!entry || !block) continue
    const key = `${block}:${entry[1]}`
    seen.set(key, (seen.get(key) ?? 0) + 1)
    if (seen.get(key) === 2) problems.push(`duplicate key (the first is discarded): ${key}`)
  }
}

/* ---------- 1. English / Tamil parity ---------- */
const en = new Set(keysOf('en'))
const ta = new Set(keysOf('ta'))

for (const key of en) if (!ta.has(key)) problems.push(`missing in Tamil:   ${key}`)
for (const key of ta) if (!en.has(key)) problems.push(`missing in English: ${key}`)

/* ---------- 2. Right script in the right block ---------- */
const WRONG_SCRIPT = [
  ['en', TAMIL, 'Tamil'],
  ['en', DEVANAGARI, 'Devanagari'],
  ['ta', DEVANAGARI, 'Devanagari'],
  ['hi', TAMIL, 'Tamil'],
]

/*
 * Proportion, not presence. An English string may legitimately contain a few
 * Tamil characters — "use the EN / தமிழ் switch" names a button, and printing
 * that button's label in Latin would make the sentence useless. What is never
 * legitimate is a whole value in the wrong script, so the test is whether the
 * foreign script dominates.
 */
const FOREIGN_LIMIT = 0.3
const share = (value, pattern) => {
  const letters = String(value).replace(/[^\p{L}]/gu, '')
  if (!letters) return 0
  const foreign = [...letters].filter((ch) => pattern.test(ch)).length
  return foreign / letters.length
}

for (const [lang, pattern, scriptName] of WRONG_SCRIPT) {
  for (const [key, value] of Object.entries(translations[lang] ?? {})) {
    if (share(value, pattern) > FOREIGN_LIMIT) {
      problems.push(`${scriptName} text in the ${lang} block: ${key}`)
    }
  }
}

// Tamil that contains no Tamil at all is usually an untranslated copy-paste.
// Not an error — proper nouns, phone numbers and "24 × 7" are legitimately
// the same in both — so it is reported and left alone.
const untranslatedTamil = [...ta].filter((key) => {
  const value = String(translations.ta[key])
  return value.length > 12 && !TAMIL.test(value) && value === String(translations.en[key])
})
if (untranslatedTamil.length) {
  notes.push(`${untranslatedTamil.length} Tamil values are identical to English — check they should be`)
}

/* ---------- 3. Placeholders survive translation ---------- */
for (const lang of ['ta', 'hi']) {
  for (const key of keysOf(lang)) {
    if (!en.has(key)) continue
    const expected = placeholders(translations.en[key])
    const actual = placeholders(translations[lang][key])
    for (const name of expected) {
      if (!actual.has(name)) problems.push(`${lang}: {${name}} dropped from ${key}`)
    }
    for (const name of actual) {
      if (!expected.has(name)) problems.push(`${lang}: {${name}} invented in ${key}`)
    }
  }
}

/* ---------- Hindi coverage ---------- */
const hi = new Set(keysOf('hi'))
const missingHindi = [...en].filter((key) => !hi.has(key))
const strayHindi = [...hi].filter((key) => !en.has(key))

for (const key of strayHindi) problems.push(`Hindi key that no longer exists: ${key}`)
for (const key of missingHindi) problems.push(`missing in Hindi:    ${key}`)

const done = en.size - missingHindi.length
const percent = Math.round((done / en.size) * 100)

console.log()
console.log(`  English  ${en.size} keys`)
console.log(`  Tamil    ${ta.size} keys`)
console.log(
  `  Hindi    ${hi.size} keys` +
    (missingHindi.length ? `  (${percent}% — the rest falls back to English)` : ''),
)

if (missingHindi.length && process.argv.includes('--list')) {
  const byArea = {}
  for (const key of missingHindi) {
    const area = key.split('.')[0]
    ;(byArea[area] ??= []).push(key)
  }
  console.log('\n  Not yet in Hindi:')
  for (const [area, keys] of Object.entries(byArea).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`    ${area.padEnd(10)} ${keys.length}`)
  }
} else if (missingHindi.length) {
  console.log('  Run with --list to see which areas are still English.')
}

for (const note of notes) console.log(`\n  Note: ${note}`)

if (problems.length) {
  console.log(`\n  ${problems.length} problem(s):\n`)
  for (const problem of problems) console.log(`    ${problem}`)
  console.log()
  process.exit(1)
}

console.log('\n  No problems.\n')
