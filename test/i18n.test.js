import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { translations, LANGUAGES } from '../src/i18n/translations'
import { GLOSSARY, GLOSSARY_CATEGORIES } from '../src/data/glossary'
import { HEALTH_TOPICS } from '../src/data/healthTips'
import { FACILITIES, GRADES, WEEKDAYS, SPOKEN_LANGUAGES } from '../src/data/hospital'

/**
 * The translation dictionaries.
 *
 * `npm run i18n:check` runs these same invariants with a friendlier report;
 * they live here as well so they run in CI with everything else, and so a
 * broken dictionary fails the build rather than waiting for someone to
 * remember the extra command.
 *
 * The specific bugs behind each case were all found by eye, late: Tamil text
 * written into the English block, a placeholder dropped in translation, and
 * the same key defined twice — which JavaScript accepts silently, keeping the
 * last one and discarding a perfectly good translation with no error anywhere.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const TAMIL = /[஀-௿]/
const DEVANAGARI = /[ऀ-ॿ]/
const PLACEHOLDER = /\{(\w+)\}/g

const placeholders = (value) =>
  new Set(String(value).match(PLACEHOLDER)?.map((p) => p.slice(1, -1)) ?? [])

/** Share of a value's letters that belong to a given script. */
const scriptShare = (value, pattern) => {
  const letters = String(value).replace(/[^\p{L}]/gu, '')
  if (!letters) return 0
  return [...letters].filter((ch) => pattern.test(ch)).length / letters.length
}

describe('English and Tamil stay in lockstep', () => {
  it('define exactly the same keys', () => {
    const en = Object.keys(translations.en)
    const ta = Object.keys(translations.ta)
    expect(en.filter((k) => !translations.ta[k]  && !(k in translations.ta))).toEqual([])
    expect(ta.filter((k) => !(k in translations.en))).toEqual([])
  })
})

describe('every value is in the script its block claims', () => {
  /*
   * Proportion, not presence. An English string may legitimately contain a few
   * Tamil characters — "use the EN / தமிழ் switch" names a button — so the
   * test is whether the foreign script dominates the value.
   */
  const LIMIT = 0.3

  it('has no predominantly Tamil or Devanagari value in the English block', () => {
    const wrong = Object.entries(translations.en)
      .filter(([, v]) => scriptShare(v, TAMIL) > LIMIT || scriptShare(v, DEVANAGARI) > LIMIT)
      .map(([k]) => k)
    expect(wrong).toEqual([])
  })

  it('has no Devanagari value in the Tamil block', () => {
    const wrong = Object.entries(translations.ta)
      .filter(([, v]) => scriptShare(v, DEVANAGARI) > LIMIT)
      .map(([k]) => k)
    expect(wrong).toEqual([])
  })

  it('has no Tamil value in the Hindi block', () => {
    const wrong = Object.entries(translations.hi ?? {})
      .filter(([, v]) => scriptShare(v, TAMIL) > LIMIT)
      .map(([k]) => k)
    expect(wrong).toEqual([])
  })
})

describe('placeholders survive translation', () => {
  it('keeps every {placeholder} the English string has, and invents none', () => {
    const problems = []
    for (const lang of ['ta', 'hi']) {
      for (const [key, value] of Object.entries(translations[lang] ?? {})) {
        if (!(key in translations.en)) continue
        const want = placeholders(translations.en[key])
        const got = placeholders(value)
        for (const name of want) if (!got.has(name)) problems.push(`${lang}: {${name}} dropped from ${key}`)
        for (const name of got) if (!want.has(name)) problems.push(`${lang}: {${name}} invented in ${key}`)
      }
    }
    expect(problems).toEqual([])
  })
})

describe('no key is defined twice', () => {
  /*
   * Read from the source text, not the parsed object: a JavaScript object
   * literal accepts a repeated key without complaint and keeps the last one,
   * so by the time these are objects the evidence is gone.
   */
  const duplicatesIn = (file) => {
    const source = fs.readFileSync(path.join(here, '..', file), 'utf8')
    const seen = new Map()
    const dupes = []
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
      if (seen.get(key) === 2) dupes.push(key)
    }
    return dupes
  }

  it('has no duplicate key in translations.js', () => {
    expect(duplicatesIn('src/i18n/translations.js')).toEqual([])
  })

  it('has no duplicate key in hi.js', () => {
    expect(duplicatesIn('src/i18n/hi.js')).toEqual([])
  })
})

describe('Hindi is a deliberate partial translation', () => {
  it('is listed as an available language', () => {
    expect(LANGUAGES.map((l) => l.code)).toContain('hi')
  })

  it('defines no key that English does not', () => {
    // A Hindi-only key is a typo — it can never be reached.
    const stray = Object.keys(translations.hi ?? {}).filter((k) => !(k in translations.en))
    expect(stray).toEqual([])
  })

  it('defines every key English defines', () => {
    /*
     * Hindi began as a deliberately partial dictionary covering the booking
     * journey, with everything else falling back to English. It is complete
     * now, so this asserts parity rather than a floor — a new English key
     * added without its Hindi fails here instead of silently reintroducing
     * an English line into a Hindi patient's screen.
     */
    const missing = Object.keys(translations.en).filter((k) => !(k in (translations.hi ?? {})))
    expect(missing).toEqual([])
  })
})

describe('the data files carry all three languages', () => {
  /*
   * Nothing in translations.js covers these — the glossary, the health topics
   * and the facility list keep their own `{ en, ta, hi }` values, and `tl()`
   * falls back to English silently when one is missing. The glossary sat at 16
   * of 57 terms translated for exactly that reason: nothing failed.
   */
  const langs = ['en', 'ta', 'hi']
  const gaps = (rows, fields, id = (r) => r.id) =>
    rows.flatMap((row) =>
      fields.flatMap((field) =>
        row[field] == null
          ? []
          : langs.filter((l) => !row[field][l]).map((l) => `${id(row)}.${field}.${l}`),
      ),
    )

  it('glossary terms and categories', () => {
    expect(gaps(GLOSSARY_CATEGORIES, ['name'])).toEqual([])
    expect(gaps(GLOSSARY, ['term', 'expansion', 'definition'])).toEqual([])
  })

  it('health topics', () => {
    expect(gaps(HEALTH_TOPICS, ['title', 'body'])).toEqual([])
  })

  it('facilities', () => {
    expect(gaps(FACILITIES, ['name', 'text'])).toEqual([])
  })

  it('grades, weekdays and spoken languages', () => {
    const asRows = (obj) => Object.entries(obj).map(([id, value]) => ({ id, value }))
    expect(gaps(asRows(GRADES), ['value'])).toEqual([])
    expect(gaps(asRows(SPOKEN_LANGUAGES), ['value'])).toEqual([])
    expect(gaps(WEEKDAYS, ['short', 'long'], (d) => `day${d.index}`)).toEqual([])
  })

  it('names a doctor grade the same way in the glossary as on the doctor card', () => {
    /*
     * The glossary exists to explain the label a patient just read on a doctor
     * card. Two different Hindi words for "Consultant" — one on the card, one
     * in the entry explaining it — makes the explanation look like a different
     * thing entirely.
     */
    const entry = (id) => GLOSSARY.find((g) => g.id === id)?.term
    const same = [
      ['grade-chief', GRADES.chief],
      ['grade-senior', GRADES.senior],
      ['grade-consultant', GRADES.consultant],
      ['grade-visiting', GRADES.visiting],
      ['grade-dmo', GRADES.dmo],
    ]
    for (const [id, grade] of same) {
      for (const lang of langs) expect(entry(id)?.[lang]).toBe(grade[lang])
    }
  })
})
