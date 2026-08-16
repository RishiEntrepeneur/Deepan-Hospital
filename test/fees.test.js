import { describe, it, expect } from 'vitest'
import { visitTotal, calculateTotal, getMethod, PAYMENT_METHODS } from '../src/lib/payment'
import { formatFee, telHref, whatsappHref } from '../src/lib/schedule'

/**
 * What the patient is shown they will pay.
 *
 * The server computes the real total and the appointment comes back carrying
 * it — these functions only decide what the booking form displays before that
 * happens. That still has to be right: a form that quotes ₹250 and then bills
 * ₹300 is worse than one that quotes nothing.
 */

const CHARGES = { first: 50, review: 20 }

describe('doctors who charge less for a review', () => {
  /*
   * Six doctors on the hospital's OP list charge a lower consultation fee to
   * see a returning patient — Gunasekaran is ₹400 first, ₹280 on review. One
   * fee per doctor could not express that, and defaulting the review to the
   * first-visit figure overcharged every one of them.
   */
  const gunasekaran = { fee: 400, feeReview: 280 }
  const deepan = { fee: 250, feeReview: null }

  it('uses the review fee when there is one', () => {
    expect(visitTotal(gunasekaran, 'review', CHARGES)).toEqual({
      consultation: 280,
      visitCharge: 20,
      total: 300,
    })
  })

  it('still uses the first-visit fee for a first visit', () => {
    expect(visitTotal(gunasekaran, 'first', CHARGES).total).toBe(450)
  })

  it('falls back to the one fee when no review fee is set', () => {
    expect(visitTotal(deepan, 'review', CHARGES).total).toBe(270)
    expect(visitTotal(deepan, 'first', CHARGES).total).toBe(300)
  })

  it('still accepts a bare number, for callers that only have the fee', () => {
    expect(visitTotal(200, 'first', CHARGES).total).toBe(250)
    expect(visitTotal(200, 'review', CHARGES).total).toBe(220)
  })

  it('returns null for a doctor with no published fee', () => {
    expect(visitTotal({ fee: null, feeReview: null }, 'first', CHARGES)).toBeNull()
  })
})

describe('the visit-type breakdown shown before booking', () => {
  it('adds the first-visit charge', () => {
    expect(visitTotal(200, 'first', CHARGES)).toEqual({
      consultation: 200,
      visitCharge: 50,
      total: 250,
    })
  })

  it('adds the smaller review charge', () => {
    expect(visitTotal(200, 'review', CHARGES)).toEqual({
      consultation: 200,
      visitCharge: 20,
      total: 220,
    })
  })

  it('treats an unknown visit type as a first visit', () => {
    // The higher charge, matching what a front desk assumes when there is no
    // file: a new one gets opened.
    expect(visitTotal(200, 'nonsense', CHARGES).total).toBe(250)
    expect(visitTotal(200, undefined, CHARGES).total).toBe(250)
  })

  it('returns null when the doctor has no published fee', () => {
    /*
     * Not zero. "No fee on file" and "free" are different claims, and 21 of
     * the roster genuinely have no published fee — quoting ₹0 to a patient
     * would be a promise the hospital never made.
     */
    expect(visitTotal(null, 'first', CHARGES)).toBeNull()
    expect(visitTotal(undefined, 'first', CHARGES)).toBeNull()
  })

  it('copes with the charges not having loaded yet', () => {
    // The catalogue arrives over the network; the form renders before it does.
    expect(visitTotal(200, 'first', undefined)).toEqual({
      consultation: 200,
      visitCharge: 0,
      total: 200,
    })
  })

  it('handles a zero charge without treating it as missing', () => {
    expect(visitTotal(200, 'review', { first: 50, review: 0 }).total).toBe(200)
  })
})

describe('the online convenience fee', () => {
  it('adds nothing when paying at the counter', () => {
    const counter = PAYMENT_METHODS.find((m) => !m.online)
    const { total, convenience } = calculateTotal(300, counter.id, 20)
    expect(convenience).toBe(0)
    expect(total).toBe(300)
  })

  it('adds the fee for an online method', () => {
    const online = PAYMENT_METHODS.find((m) => m.online)
    const { total, convenience } = calculateTotal(300, online.id, 20)
    expect(convenience).toBe(20)
    expect(total).toBe(320)
  })

  it('treats a missing consultation fee as zero rather than NaN', () => {
    const { total } = calculateTotal(null, 'counter', 20)
    expect(Number.isNaN(total)).toBe(false)
  })

  it('returns undefined for an unknown payment method', () => {
    expect(getMethod('not-a-method')).toBeUndefined()
  })
})

describe('formatting money for the patient', () => {
  it('renders rupees in each language', () => {
    for (const lang of ['en', 'ta', 'hi']) {
      const shown = formatFee(250, lang)
      expect(shown, `no digits in ${lang}`).toMatch(/\d|[௦-௯]|[०-९]/)
    }
  })

  it('does not print a bare zero for a missing fee', () => {
    // Guards the same "no fee on file ≠ free" distinction as above.
    const shown = formatFee(null, 'en')
    expect(shown === '₹0' || shown === '0').toBe(false)
  })
})

describe('the breakdown must always add up', () => {
  /*
   * The invariant this file exists for.
   *
   * A review with Gunasekaran displayed "₹400" for the consultation, "+₹20"
   * for the case sheet, and "₹300" as the total — because the total honoured
   * his lower review fee and the line above it did not. Line items that do not
   * sum to the total are indefensible on a page asking somebody to pay, and no
   * amount of each-number-is-individually-correct saves it.
   *
   * Every fee display derives its parts from this one function, so asserting
   * the invariant here covers all of them.
   */
  const DOCTORS = [
    { label: 'same fee both ways', doctor: { fee: 250, feeReview: null } },
    { label: 'lower review fee', doctor: { fee: 400, feeReview: 280 } },
    { label: 'review dearer than first', doctor: { fee: 200, feeReview: 260 } },
    { label: 'zero consultation', doctor: { fee: 0, feeReview: 0 } },
  ]

  for (const { label, doctor } of DOCTORS) {
    for (const visitType of ['first', 'review']) {
      it(`${label}, ${visitType}: consultation + charge === total`, () => {
        const shown = visitTotal(doctor, visitType, CHARGES)
        expect(shown).not.toBeNull()
        expect(shown.consultation + shown.visitCharge).toBe(shown.total)
      })
    }
  }

  it('uses the fee that belongs to the visit type, not whichever is higher', () => {
    const gunasekaran = { fee: 400, feeReview: 280 }
    expect(visitTotal(gunasekaran, 'review', CHARGES).consultation).toBe(280)
    expect(visitTotal(gunasekaran, 'first', CHARGES).consultation).toBe(400)
  })

  it('never reports a total that contradicts its own parts, for any fee pair', () => {
    // Exhaustive over a realistic range, because one wrong pairing is enough.
    for (let fee = 0; fee <= 1000; fee += 50) {
      for (let review = 0; review <= 1000; review += 50) {
        for (const visitType of ['first', 'review']) {
          const shown = visitTotal({ fee, feeReview: review }, visitType, CHARGES)
          expect(
            shown.consultation + shown.visitCharge,
            `fee=${fee} review=${review} ${visitType}`,
          ).toBe(shown.total)
        }
      }
    }
  })
})

describe('phone links actually dial', () => {
  /*
   * The app had two sanitisers: one strict, one that removed only whitespace.
   * The hospital's numbers come from environment variables, so a number
   * written with brackets or hyphens would have produced an href some diallers
   * refuse. These pin the one that survived.
   */
  it('strips punctuation a dialler cannot parse', () => {
    expect(telHref('+91 98430 10800')).toBe('tel:+919843010800')
    expect(telHref('+91 (431) 245-6789')).toBe('tel:+914312456789')
    expect(telHref('0431 245 6789')).toBe('tel:04312456789')
  })

  it('keeps a leading plus, because it carries the country code', () => {
    expect(telHref('+919843010800').startsWith('tel:+')).toBe(true)
    expect(telHref('9843010800').startsWith('tel:+')).toBe(false)
  })

  it('produces only digits after the optional plus', () => {
    for (const raw of ['+91 (431) 245-6789', '98430-10800', '+91.98430.10800', '  9843010800  ']) {
      expect(telHref(raw)).toMatch(/^tel:\+?\d+$/)
    }
  })

  it('returns null rather than a link that dials nothing', () => {
    for (const raw of ['', '   ', null, undefined, 'call us', '+']) {
      expect(telHref(raw)).toBeNull()
    }
  })
})

describe('WhatsApp, the one link that connects from a laptop', () => {
  it('builds a wa.me link with the country code', () => {
    expect(whatsappHref('9843010800')).toBe('https://wa.me/919843010800')
    expect(whatsappHref('+91 98430 10800')).toBe('https://wa.me/919843010800')
  })

  it('does not double a country code that is already there', () => {
    expect(whatsappHref('919843010800')).toBe('https://wa.me/919843010800')
  })

  it('returns null when the hospital has not published one', () => {
    // Absent by default — a made-up number would send patients' messages
    // to a stranger.
    for (const raw of ['', null, undefined, '12345']) {
      expect(whatsappHref(raw)).toBeNull()
    }
  })

  it('encodes a prefilled message safely', () => {
    const href = whatsappHref('9843010800', 'Hello & thanks — appointment?')
    expect(href).toContain('?text=')
    expect(href).not.toMatch(/[ &](?!amp)/)
  })
})
