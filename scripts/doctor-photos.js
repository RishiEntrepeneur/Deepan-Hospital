/**
 * Checks the doctor photographs in public/doctors against the roster.
 *
 *   npm run photos
 *
 * Photographs are dropped in by hand, named after the doctor's id, and a
 * misspelt name fails silently: Photo.jsx renders the initials instead, which
 * looks exactly like "no photo supplied yet". Somebody can hand over eighteen
 * portraits, three of them never appear, and nothing anywhere says so.
 *
 * So this reports three things: who has a photograph, who does not, and which
 * files match no doctor at all — that last list is almost always a typo, and
 * it is the one you cannot see from the site.
 *
 * On consent: a photograph of a named person is their personal data under the
 * DPDP Act, and their likeness besides. Ask each doctor before publishing
 * theirs, and keep a note of who agreed. Never take one from another
 * hospital's website or a listing site — the copyright is not the hospital's,
 * and matching a stranger's face to a name by guesswork puts the wrong person
 * in front of a patient.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const here = path.dirname(fileURLToPath(import.meta.url))
const photoDir = path.join(here, '..', 'public', 'doctors')
const dbFile =
  process.env.DATABASE_FILE ?? path.join(here, '..', 'server', 'data', 'deepan.db')

if (!fs.existsSync(dbFile)) {
  console.error(`\n  No database at ${dbFile}`)
  console.error('  Run `cd server && npm run migrate && npm run seed` first.\n')
  process.exit(1)
}

const db = new DatabaseSync(dbFile, { readOnly: true })
const doctors = db
  .prepare('SELECT id, name_en, active FROM doctors ORDER BY name_en')
  .all()

/* Any extension the browser will display; the README suggests .jpg. */
const EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif']

const files = fs.existsSync(photoDir)
  ? fs.readdirSync(photoDir).filter((f) => EXTENSIONS.includes(path.extname(f).toLowerCase()))
  : []

const photoFor = (id) => files.find((f) => path.basename(f, path.extname(f)) === id)

const withPhoto = []
const withoutPhoto = []
for (const doctor of doctors) {
  const file = photoFor(doctor.id)
  ;(file ? withPhoto : withoutPhoto).push({ ...doctor, file })
}

const claimed = new Set(withPhoto.map((d) => d.file))
const orphans = files.filter((f) => !claimed.has(f))

const active = doctors.filter((d) => d.active)
const activeWith = withPhoto.filter((d) => d.active)

console.log()
console.log(`  ${activeWith.length} of ${active.length} active doctors have a photograph.`)

if (withoutPhoto.length) {
  console.log('\n  Still needed:')
  for (const d of withoutPhoto) {
    console.log(`    ${(d.id + '.jpg').padEnd(34)} ${d.name_en}${d.active ? '' : '   (inactive)'}`)
  }
}

if (orphans.length) {
  console.log('\n  Files matching no doctor — these are never shown:')
  for (const file of orphans) console.log(`    ${file}`)
  console.log('\n  Rename each to <doctor-id>.jpg. The ids are the left-hand column above.')
}

/*
 * A stray file is a photograph of a real person sitting in a public directory
 * doing nothing, so it is worth failing over — quietly ignoring it is how it
 * stays there.
 */
if (orphans.length) {
  console.log()
  process.exit(1)
}

console.log(
  withoutPhoto.length
    ? '\n  No misnamed files.\n'
    : '\n  Every doctor has a photograph, and nothing is misnamed.\n',
)
