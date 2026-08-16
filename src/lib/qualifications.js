import { GLOSSARY } from '../data/glossary'

/**
 * Decodes the letters after a doctor's name.
 *
 * "M.S., M.Ch (Surgical Gastroenterology)" means nothing to most patients, and
 * a directory that prints it without explanation is showing off rather than
 * informing. Every degree the roster uses is already defined in the glossary,
 * so this matches against those definitions rather than inventing new copy —
 * one place to correct if a definition is ever wrong.
 */
const BY_TERM = new Map(
  GLOSSARY.filter((entry) => entry.category === 'qualification').map((entry) => [entry.id, entry]),
)

/*
 * Patterns are ordered longest-first: "M.Ch" must be tested before "M.D."
 * would otherwise swallow it, and "MDS" before "MD". Written to tolerate the
 * punctuation the hospital actually uses — M.S., MS, M.S, all appear.
 */
const PATTERNS = [
  { id: 'mds', re: /\bM\.?\s?D\.?\s?S\b/i },
  { id: 'mch', re: /\bM\.?\s?Ch\b/i },
  { id: 'dnb', re: /\bD\.?\s?N\.?\s?B\b/i },
  { id: 'dm', re: /\bD\.?\s?M\b/i },
  { id: 'mbbs', re: /\bM\.?\s?B\.?\s?B\.?\s?S\b/i },
  { id: 'ms', re: /\bM\.?\s?S\b/i },
  { id: 'md', re: /\bM\.?\s?D\b/i },
  { id: 'diploma', re: /\bD\.?\s?(?:C\.?H|G\.?O|L\.?O|O|Ortho|V\.?L|A)\b/i },
  { id: 'fellowship', re: /\bF\.?\s?(?:MAS|VRS|IAGES|ICP)\b/i },
  { id: 'royal', re: /\b(?:FRCP|MRCP|MRCEM|MRCS|FRCS)\b/i },
]

/**
 * Which degrees a qualification string contains.
 *
 * Used only to work out standing — nothing prints these definitions at a
 * patient any more. Spelling out "MS means Master of Surgery" on every profile
 * padded the page without helping anyone choose a doctor.
 */
function degreesIn(qualification) {
  if (!qualification) return []
  const found = []
  for (const { id, re } of PATTERNS) {
    if (!re.test(qualification)) continue
    const entry = BY_TERM.get(id)
    if (entry && !found.some((f) => f.id === entry.id)) found.push(entry)
  }
  // Present them roughly as a career runs: basic degree first, then higher.
  const order = ['mbbs', 'md', 'ms', 'dm', 'mch', 'dnb', 'mds', 'diploma', 'fellowship', 'royal']
  return found.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
}

/** A one-line summary of standing, for the top of the profile. */
export function seniorityLine(doctor, t) {
  const bits = []
  if (doctor?.experience) bits.push(t('doctor.yearsExperience', { count: doctor.experience }))
  const degrees = degreesIn(doctor?.qualification)
  if (degrees.some((d) => ['dm', 'mch'].includes(d.id))) bits.push(t('doctor.superSpecialist'))
  else if (degrees.some((d) => ['md', 'ms', 'mds', 'dnb'].includes(d.id))) bits.push(t('doctor.specialist'))
  return bits
}
