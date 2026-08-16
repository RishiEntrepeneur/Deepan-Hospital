import { describe, it, expect } from 'vitest'
import { includesWord, matchesAny, matchDepartment, SYMPTOM_MAP } from '../src/lib/symptoms'

/**
 * Symptom matching — where most of this app's real bugs have lived.
 *
 * Every case below is a regression: something that shipped wrong, was found by
 * someone reading the screen, and was fixed by hand. The tests exist so the
 * next person to touch the keyword lists finds out from a test run instead of
 * from a patient sent to the wrong department.
 */

describe('word-boundary matching', () => {
  /*
   * The original matcher used plain substring search. Short keywords then
   * matched inside longer, unrelated words — and because the ENT department's
   * id is literally "ent", "book an appointment" was answered with a list of
   * ear, nose and throat surgeons.
   */
  it('does not find a short keyword buried inside a longer word', () => {
    expect(includesWord('book an appointment', ['ent'])).toBeUndefined()
    expect(includesWord('my heart hurts', ['ear'])).toBeUndefined()
    expect(includesWord('kidney stone', ['kid'])).toBeUndefined()
    expect(includesWord('this is his problem', ['hi'])).toBeUndefined()
  })

  it('still finds those keywords when they stand alone', () => {
    expect(includesWord('ent problem', ['ent'])).toBe('ent')
    expect(includesWord('pain in my ear', ['ear'])).toBe('ear')
    expect(includesWord('my kid is unwell', ['kid'])).toBe('kid')
  })

  /*
   * Fixing the substring bug with a suffix rule promptly broke the opposite
   * case: a keyword written singular stopped matching the plural a patient
   * would actually type.
   */
  it('matches regular plurals of a singular keyword', () => {
    expect(includesWord('my eyes are itchy', ['eye'])).toBe('eye')
    expect(includesWord('both knees hurt', ['knee'])).toBe('knee')
  })

  it('does not treat a longer word as a plural of a shorter one', () => {
    // "consultation" is not a plural of "consult" — an over-eager suffix rule
    // made booking questions match clinical keywords.
    expect(includesWord('consultation fee', ['consult'])).toBeUndefined()
  })

  it('matches non-Latin keywords by substring, since \\b does not apply', () => {
    expect(includesWord('எனக்கு காய்ச்சல்', ['காய்ச்சல்'])).toBe('காய்ச்சல்')
    expect(includesWord('मुझे बुखार है', ['बुखार'])).toBe('बुखार')
  })

  it('never matches on an empty keyword', () => {
    /*
     * Glossary entries without an expansion normalise to '', and every string
     * contains '', so gibberish was scoring matches against them.
     */
    expect(includesWord('anything at all', [''])).toBeUndefined()
    expect(matchesAny('anything at all', [''])).toBeFalsy()
  })
})

describe('routing a symptom to a department', () => {
  it('routes plain symptoms in all three languages', () => {
    expect(matchDepartment('fever')).toBe('general-medicine')
    expect(matchDepartment('காய்ச்சல்')).toBe('general-medicine')
    expect(matchDepartment('बुखार')).toBe('general-medicine')
  })

  it('routes to the specialist department, not the catch-all', () => {
    /*
     * General Medicine owns deliberately broad words — "checkup", "infection",
     * "जाँच" — and sits near the top of the list. A plain first-match search
     * therefore answered "skin infection" with General Medicine, and, worse,
     * "cancer screening checkup" too.
     */
    expect(matchDepartment('skin infection')).toBe('dermatology')
    expect(matchDepartment('eye check up')).toBe('ophthalmology')
    expect(matchDepartment('cancer screening')).toBe('oncology')
  })

  it('still falls back to the catch-all when nothing specific matches', () => {
    expect(matchDepartment('fever and body pain')).toBe('general-medicine')
    expect(matchDepartment('routine health check')).toBe('general-medicine')
  })

  it('handles Hindi oblique forms, which inflect away from the listed word', () => {
    // "घुटना" (knee) becomes "घुटने" in "घुटने में दर्द". Non-Latin keywords
    // match by substring, so the inflected form has to be listed too.
    expect(matchDepartment('घुटने में दर्द')).toBe('orthopedics')
    expect(matchDepartment('दाँतों में दर्द')).toBe('maxillofacial')
    expect(matchDepartment('आँखों की जाँच')).toBe('ophthalmology')
  })

  it('does not route an ordinary booking request anywhere', () => {
    expect(matchDepartment('book an appointment')).toBeNull()
    expect(matchDepartment('अपॉइंटमेंट बुक करनी है')).toBeNull()
    expect(matchDepartment('hello')).toBeNull()
  })

  it('returns null for empty or whitespace input', () => {
    expect(matchDepartment('')).toBeNull()
    expect(matchDepartment('   ')).toBeNull()
    expect(matchDepartment(null)).toBeNull()
    expect(matchDepartment(undefined)).toBeNull()
  })
})

describe('the keyword map itself', () => {
  it('has no empty or whitespace-only keywords', () => {
    for (const entry of SYMPTOM_MAP) {
      for (const word of entry.words) {
        expect(word.trim(), `empty keyword in ${entry.departmentId}`).not.toBe('')
      }
    }
  })

  it('has no duplicate keyword within a department', () => {
    for (const entry of SYMPTOM_MAP) {
      const seen = new Set()
      for (const word of entry.words) {
        expect(seen.has(word), `"${word}" listed twice in ${entry.departmentId}`).toBe(false)
        seen.add(word)
      }
    }
  })

  it('names each department only once', () => {
    const ids = SYMPTOM_MAP.map((e) => e.departmentId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
