/**
 * Builds the doctor map: our roster → Klinique's physician ids.
 *
 *   npm run klinique-doctors
 *
 * READ ONLY. Reads the physician list out of Klinique's registration form and
 * matches it to the doctors in our own database by name. Prints a proposed
 * KLINIQUE_DOCTOR_MAP and, loudly, the ones it is UNSURE about — because a
 * wrong match books a patient with the wrong doctor, so every uncertain line
 * must be checked by a person before it is trusted.
 */
import { config } from '../src/config.js'
import { db } from '../src/db.js'
import { signIn } from '../src/lib/klinique-session.js'

/** Extract physician <option value>… entries, cleaned to name + reg no. */
function physicians(html) {
  const select = html.match(
    /<select\b[^>]*\bname="patient\[visits_attributes\]\[0\]\[physician_id\]"[^>]*>([\s\S]*?)<\/select>/i,
  )
  if (!select) return []
  const out = []
  for (const opt of select[1].matchAll(/<option\b[^>]*\bvalue="([^"]*)"[^>]*>([\s\S]*?)<\/option>/gi)) {
    if (!opt[1]) continue
    const decoded = opt[2]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, '&')
    const title = decoded.match(/dropdown-suggestion-title'>([^<]+)</)?.[1] ?? decoded.replace(/<[^>]+>/g, ' ')
    out.push({ id: opt[1], name: title.replace(/\s+/g, ' ').trim() })
  }
  return out
}

/** Strip to comparable tokens: drop Dr, initials punctuation, qualifications. */
function tokens(name) {
  return name
    .toUpperCase()
    .replace(/\bDR\b\.?/g, ' ')
    .replace(/[.,]/g, ' ')
    .replace(/\b(MS|MD|MBBS|MCH|DNB|DGO|DO|DM|MRCP|FRCS|DCH|DA|MDS|BDS|PHD|DIP)\b.*$/i, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
}

console.info('\n  Building the doctor map — READ ONLY\n')
const { cookie } = await signIn()
const res = await fetch(new URL('/visits/register_patient', config.klinique.baseUrl).toString(), {
  headers: { Cookie: cookie, Accept: 'text/html' },
})
const klinDoctors = physicians(await res.text())
console.info(`  Klinique lists ${klinDoctors.length} physicians.`)

const ours = db.prepare("SELECT id, name_en FROM doctors WHERE active = 1 AND booking_mode = 'live'").all()
console.info(`  We have ${ours.length} bookable doctors to match.\n`)

const map = {}
const unsure = []
for (const doc of ours) {
  const want = tokens(doc.name_en)
  let best = null
  let bestScore = 0
  for (const k of klinDoctors) {
    const have = new Set(tokens(k.name))
    const overlap = want.filter((w) => have.has(w)).length
    const score = overlap / Math.max(want.length, 1)
    if (score > bestScore) {
      bestScore = score
      best = k
    }
  }
  if (best && bestScore >= 0.9) {
    map[doc.id] = best.id
    console.info(`  ✓ ${doc.name_en.padEnd(34)} → ${best.id}  ${best.name}`)
  } else if (best && bestScore >= 0.5) {
    map[doc.id] = best.id
    unsure.push(`${doc.name_en}  →  ${best.id} ${best.name}  (${Math.round(bestScore * 100)}%)`)
    console.info(`  ? ${doc.name_en.padEnd(34)} → ${best.id}  ${best.name}   NEEDS CHECK`)
  } else {
    console.info(`  ✗ ${doc.name_en.padEnd(34)} → no confident match`)
  }
}

console.info('\n  Proposed KLINIQUE_DOCTOR_MAP (verify the ? lines in Klinique first):\n')
console.info(`  KLINIQUE_DOCTOR_MAP=${JSON.stringify(map)}\n`)
if (unsure.length) {
  console.info('  CHECK THESE BY HAND — a wrong match books the wrong doctor:')
  for (const u of unsure) console.info(`    ${u}`)
  console.info('')
}
