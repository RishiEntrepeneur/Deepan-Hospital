import { describe, it, expect, beforeAll } from 'vitest'
import { answer } from '../src/lib/assistant'
import { translations } from '../src/i18n/translations'
import { seedCatalog, makeCtx } from './fixtures'

/**
 * The help assistant's intent routing.
 *
 * It is a deterministic matcher over the hospital's own listings, not a
 * language model, so its failures are ordering failures: two intents both
 * match and the wrong one is earlier in the chain. Every case here is one of
 * those, caught in production use rather than in review.
 *
 * The assertions deliberately check WHICH intent answered — usually by a
 * distinctive phrase from the expected reply — rather than the full text, so
 * rewording a translation does not break the suite.
 */

const en = makeCtx('en', translations)
const ta = makeCtx('ta', translations)
const hi = makeCtx('hi', translations)

const reply = (question, ctx = en) => answer(question, ctx)?.text ?? ''

/** Did the fallback answer, rather than a real intent? */
const isFallback = (text) =>
  /didn.t catch that|could not find anything|not certain what you meant/i.test(text) ||
  /புரியவில்லை|கண்டறிய/i.test(text) ||
  /समझ नहीं पाया|मिलता कुछ नहीं मिला|ठीक से समझ नहीं आया/.test(text)

beforeAll(seedCatalog)

describe('intent ordering', () => {
  it('treats "book an appointment" as booking, not as the ENT department', () => {
    /*
     * The ENT department's id is "ent", which sits inside "appointment". With
     * substring matching, the single most common question this app receives
     * was answered with a list of ear, nose and throat surgeons.
     */
    const text = reply('I want to book an appointment')
    expect(text).not.toMatch(/ear, nose/i)
    expect(isFallback(text)).toBe(false)
  })

  it('answers "what does OPD mean" with the definition, not the timings', () => {
    const text = reply('what does OPD mean')
    expect(text).toMatch(/Out-Patient Department/i)
  })

  it('answers a parking question with parking, not the hospital address', () => {
    /*
     * "where do I park my car" contains "where", which the location intent
     * claims. Parking has to be checked first or the patient is told the
     * street address in reply to a question about their car.
     */
    const text = reply('where do I park my car')
    expect(text).toMatch(/parking/i)
  })

  it('answers "who is the best doctor" instead of giving up', () => {
    const text = reply('who is the best doctor here')
    expect(isFallback(text)).toBe(false)
    expect(text).toMatch(/does not rank/i)
  })

  it('routes a symptom to the specialist department, not the catch-all', () => {
    expect(reply('skin infection')).toMatch(/Dermatology/i)
    expect(reply('I need an eye check up')).toMatch(/Ophthalmology/i)
  })
})

describe('answering in the language the patient is using', () => {
  it('answers a Tamil symptom in Tamil', () => {
    const text = reply('காய்ச்சல்', ta)
    expect(isFallback(text)).toBe(false)
    expect(text).toMatch(/[஀-௿]/)
  })

  it('answers a Hindi symptom in Hindi', () => {
    const text = reply('बुखार', hi)
    expect(isFallback(text)).toBe(false)
    expect(text).toMatch(/[ऀ-ॿ]/)
  })

  it('finds a department by its Hindi name', () => {
    const text = reply('हृदय रोग', hi)
    expect(isFallback(text)).toBe(false)
    expect(text).toMatch(/हृदय रोग/)
  })

  it('finds a doctor by their transliterated name', () => {
    const text = reply('डॉ. ब. हृदय', hi)
    expect(isFallback(text)).toBe(false)
    expect(text).toMatch(/हृदय रोग विशेषज्ञ/)
  })

  it('handles the same intents in every language', () => {
    for (const [ctx, label] of [[en, 'en'], [ta, 'ta'], [hi, 'hi']]) {
      for (const q of ['fever', 'காய்ச்சல்', 'बुखार']) {
        const text = reply(q, ctx)
        expect(text.length, `${label} answered "${q}" with nothing`).toBeGreaterThan(0)
      }
    }
  })
})

describe('never dead-ends', () => {
  it('offers something useful even for a question it cannot answer', () => {
    /*
     * The requirement was "every question gets an answer". The fallback is
     * allowed to say it did not understand, but it must still route the
     * patient somewhere — a reception number, or a suggestion to try.
     */
    for (const q of ['zxcvbnm', 'what is the meaning of life', 'do you sell shoes']) {
      const result = answer(q, en)
      const hasSomewhereToGo =
        (result.actions?.length ?? 0) > 0 ||
        (result.suggestKeys?.length ?? 0) > 0 ||
        (result.suggestions?.length ?? 0) > 0 ||
        /reception|\d{5}/i.test(result.text)
      expect(hasSomewhereToGo, `"${q}" dead-ended`).toBe(true)
    }
  })

  it('does not crash on empty, whitespace or punctuation-only input', () => {
    for (const q of ['', '   ', '???', '...']) {
      expect(() => answer(q, en)).not.toThrow()
      expect(typeof answer(q, en).text).toBe('string')
    }
  })

  it('does not crash on very long input', () => {
    const long = 'fever '.repeat(500)
    expect(() => answer(long, en)).not.toThrow()
  })

  it('survives a question containing regex metacharacters', () => {
    // Keywords are escaped before becoming regexes; the input must not be
    // able to break the matcher either.
    for (const q of ['what is (a) [test]?', 'cost of *everything*', 'a+b+c', '\\d{2}']) {
      expect(() => answer(q, en)).not.toThrow()
    }
  })
})

describe('what it must never do', () => {
  it('does not name a diagnosis when routing a symptom', () => {
    const text = reply('chest pain')
    // It may name the department; it must not name a condition.
    expect(text).not.toMatch(/angina|infarction|you (probably )?have/i)
  })

  it('gives an emergency number for an emergency question', () => {
    const result = answer('this is an emergency', en)
    const hasCall = (result.actions ?? []).some((a) => a.type === 'call')
    expect(hasCall).toBe(true)
  })
})
