import { describe, it, expect, beforeAll } from 'vitest'
import { looksUrgent, assessReason } from '../src/lib/triage'
import { seedCatalog, DOCTORS } from './fixtures'

/**
 * Reading the "reason for visit".
 *
 * This is the most safety-relevant logic in the front end: it decides whether
 * somebody typing "severe chest pain" into a booking form is offered Thursday
 * at 3pm or told to ring casualty now. Two failure modes matter, and they pull
 * in opposite directions — missing a real emergency, and crying wolf so often
 * that the warning gets clicked past on the day it counts.
 */

const doctorIn = (departmentId) => DOCTORS.find((d) => d.departmentId === departmentId)

beforeAll(seedCatalog)

describe('spotting something that cannot wait for an appointment', () => {
  it('catches emergencies in English', () => {
    expect(looksUrgent('severe chest pain')).toBe(true)
    expect(looksUrgent("can't breathe properly")).toBe(true)
    expect(looksUrgent('heavy bleeding after a fall')).toBe(true)
    expect(looksUrgent('snake bite')).toBe(true)
  })

  it('catches the same emergencies in Tamil and Hindi', () => {
    expect(looksUrgent('மார்பு வலி')).toBe(true)
    expect(looksUrgent('அதிக ரத்தம்')).toBe(true)
    expect(looksUrgent('सीने में दर्द है')).toBe(true)
    expect(looksUrgent('साँप ने काटा है')).toBe(true)
    expect(looksUrgent('बहुत खून बह रहा है')).toBe(true)
  })

  it('stays quiet for ordinary reasons — the warning has to keep meaning something', () => {
    expect(looksUrgent('routine checkup')).toBe(false)
    expect(looksUrgent('fever and cold for two days')).toBe(false)
    expect(looksUrgent('नियमित जाँच')).toBe(false)
    expect(looksUrgent('बुखार और सर्दी')).toBe(false)
    expect(looksUrgent('காய்ச்சல்')).toBe(false)
  })

  it('ignores input too short to read anything into', () => {
    expect(looksUrgent('')).toBe(false)
    expect(looksUrgent('hi')).toBe(false)
    expect(looksUrgent(null)).toBe(false)
  })
})

describe('offering a better-matched department', () => {
  it('says nothing when the chosen doctor already fits', () => {
    expect(assessReason('itchy rash on my arm', doctorIn('dermatology'))).toBeNull()
    expect(assessReason('blurred vision', doctorIn('ophthalmology'))).toBeNull()
  })

  it('flags a clear mismatch and names doctors who do fit', () => {
    // Booked with Cardiology, but the words point squarely at Dermatology.
    const advice = assessReason('itchy rash on my arm', doctorIn('cardiology'))
    expect(advice).not.toBeNull()
    expect(advice.kind).toBe('mismatch')
    expect(advice.departmentId).toBe('dermatology')
    expect(advice.alternatives.every((d) => d.departmentId === 'dermatology')).toBe(true)
  })

  it('suggests alternatives when the target department has other doctors', () => {
    /*
     * Deliberately avoids emergency wording. "chest pain" is in the emergency
     * list, so a reason containing it is reported as urgent and never reaches
     * the mismatch branch — which is correct, and cost this test two rewrites.
     */
    const advice = assessReason('palpitations for two weeks', doctorIn('general-medicine'))
    expect(advice).not.toBeNull()
    expect(advice.kind).toBe('mismatch')
    expect(advice.departmentId).toBe('cardiology')
    // Both cardiologists in the fixture qualify, and neither is the chosen doctor.
    expect(advice.alternatives.length).toBe(2)
  })

  it('never offers the doctor already chosen as an alternative to themselves', () => {
    const chosen = doctorIn('cardiology')
    const advice = assessReason('itchy rash on my arm', chosen)
    expect(advice.alternatives.some((d) => d.id === chosen.id)).toBe(false)
  })

  it('stays silent rather than pointing at an empty department', () => {
    /*
     * Ophthalmology has exactly one doctor in the fixture, so a patient
     * already booked with them has nobody to be referred to. Better to say
     * nothing than to raise a suggestion that leads nowhere.
     */
    const advice = assessReason('blurred vision and cataract', doctorIn('ophthalmology'))
    expect(advice).toBeNull()
  })

  it('reports urgency ahead of any department suggestion', () => {
    const advice = assessReason('severe chest pain, cannot breathe', doctorIn('dermatology'))
    expect(advice.kind).toBe('urgent')
  })

  it('says nothing for input too short, or with no doctor chosen yet', () => {
    expect(assessReason('hi', doctorIn('cardiology'))).toBeNull()
    expect(assessReason('chest pain', null)).toBeNull()
    expect(assessReason('', doctorIn('cardiology'))).toBeNull()
  })

  it('never names a condition — it maps to a department and stops', () => {
    const advice = assessReason('itchy rash on my arm', doctorIn('cardiology'))
    // The returned shape carries a department id and doctors, nothing diagnostic.
    expect(Object.keys(advice).sort()).toEqual(['alternatives', 'departmentId', 'kind'])
  })
})
