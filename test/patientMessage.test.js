import { describe, expect, it } from 'vitest'
import { clockTime, patientMessage, smsLink, whatsappLink } from '../src/lib/patientMessage'
import { translations } from '../src/i18n/translations'

/**
 * The message reception sends a patient.
 *
 * Worth testing because every failure here is silent and lands on a patient:
 * a message that still has `{ref}` in it, a WhatsApp link missing the country
 * code that opens a chat with nobody, or a cheerful confirmation sent for an
 * appointment that was cancelled.
 */

const appointment = {
  id: 'DH-KZHFK8',
  status: 'confirmed',
  date: '2026-08-20',
  slot: '10:30',
  patient: { name: 'Test Patient', phone: '9843074989' },
}

describe('patientMessage', () => {
  it('renders in each language, with nothing left unfilled', () => {
    for (const lang of ['en', 'ta', 'hi']) {
      const text = patientMessage(appointment, 'Dr. Deepan G', lang)
      expect(text, lang).not.toMatch(/\{\w+\}/)
      expect(text, lang).toContain('DH-KZHFK8')
      expect(text, lang).toContain('Dr. Deepan G')
      /* The hospital's name in that language, not the English one everywhere. */
      expect(text, lang).toContain(translations[lang]['brand.name'])
    }
  })

  it('writes the date in the reader’s own script', () => {
    expect(patientMessage(appointment, 'Dr. X', 'en')).toContain('August')
    /* Tamil and Hindi must not fall back to Latin month names. */
    expect(patientMessage(appointment, 'Dr. X', 'ta')).not.toContain('August')
    expect(patientMessage(appointment, 'Dr. X', 'hi')).not.toContain('August')
  })

  it('says an appointment is cancelled rather than confirming it', () => {
    const text = patientMessage({ ...appointment, status: 'cancelled' }, 'Dr. X', 'en')
    expect(text).toMatch(/cancelled/i)
    expect(text).not.toMatch(/confirmed/i)
  })

  it('survives a callback request that has no date or slot', () => {
    const text = patientMessage(
      { ...appointment, date: null, slot: null },
      'Dr. X',
      'en',
    )
    expect(text).not.toMatch(/\{\w+\}/)
    expect(text).toContain('DH-KZHFK8')
  })

  it('formats the time as a patient reads it', () => {
    expect(clockTime('10:30')).toBe('10:30 AM')
    expect(clockTime('14:05')).toBe('2:05 PM')
    expect(clockTime('00:15')).toBe('12:15 AM')
    expect(clockTime('12:00')).toBe('12:00 PM')
    expect(clockTime('')).toBe('')
  })
})

describe('links', () => {
  it('adds the country code to a ten-digit number', () => {
    expect(whatsappLink('9843074989', 'hi')).toContain('wa.me/919843074989')
  })

  it('leaves a number that already carries one alone', () => {
    expect(whatsappLink('919843074989', 'hi')).toContain('wa.me/919843074989')
  })

  it('strips spaces and punctuation out of the number', () => {
    expect(whatsappLink('+91 98430 74989', 'hi')).toContain('wa.me/919843074989')
  })

  it('escapes the message so newlines survive the URL', () => {
    const link = whatsappLink('9843074989', 'one\ntwo & three')
    expect(link).toContain('%0A')
    expect(link).toContain('%26')
    expect(() => new URL(link)).not.toThrow()
  })

  it('uses ? for the sms body, which is all iOS accepts', () => {
    expect(smsLink('9843074989', 'hello')).toBe('sms:9843074989?body=hello')
  })
})
