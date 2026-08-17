/**
 * Builds the "Is Klinique working?" status page into one self-contained file.
 *
 *   node docs/klinique-status/build.mjs
 *   → demo-dist/klinique-status.html
 *
 * `page.html` is the writing; the screenshots are inlined as data URIs so the
 * result opens anywhere with no network and no asset folder beside it.
 *
 * The screenshots are NOT kept in the repository. They are pictures of the
 * reception desk mid-task, they go stale the moment the desk changes, and they
 * are cheap to retake — see RETAKING.md next to this file. Point SHOTS at
 * wherever yours are.
 */
import fs from 'node:fs'
import path from 'node:path'

const here = import.meta.dirname
const SHOTS = process.env.SHOTS ?? path.join(here, 'shots')
const SRC = path.join(here, 'page.html')
const OUT = path.join(here, '..', '..', 'demo-dist', 'klinique-status.html')

const IMAGES = {
  '{{IMG_WORKLIST}}': 'desk-02-worklist.png',
  '{{IMG_PORTAL}}': 'desk-03-portal.png',
  '{{IMG_DESK}}': 'desk-01.png',
}

const missing = Object.values(IMAGES).filter((f) => !fs.existsSync(path.join(SHOTS, f)))
if (missing.length) {
  console.error(`\n  Missing screenshots in ${SHOTS}:`)
  for (const f of missing) console.error(`    ${f}`)
  console.error('\n  See RETAKING.md, or set SHOTS=/path/to/them.\n')
  process.exit(1)
}

let html = fs.readFileSync(SRC, 'utf8')
for (const [token, file] of Object.entries(IMAGES)) {
  if (!html.includes(token)) throw new Error(`token missing from page.html: ${token}`)
  const uri = `data:image/png;base64,${fs.readFileSync(path.join(SHOTS, file)).toString('base64')}`
  html = html.replaceAll(token, uri)
}

/* A leftover token would publish as a broken image with no other symptom. */
const left = html.match(/\{\{[A-Z_]+\}\}/g)
if (left) throw new Error(`unsubstituted tokens: ${left.join(', ')}`)

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, html)
console.log(`\n  Wrote ${OUT} — ${(html.length / 1024 / 1024).toFixed(2)} MB\n`)
