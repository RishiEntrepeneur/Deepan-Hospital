import { config } from '../config.js'

/**
 * What a patient actually pays.
 *
 * The consultation fee belongs to the doctor. On top of it the hospital adds a
 * case-sheet charge, which depends on whether this is a first visit or a
 * review — a new patient needs a new file opened, a returning one does not.
 *
 * Two rules, and both matter:
 *
 *   1. **The total is computed here and nowhere else.** The front end shows a
 *      breakdown, but it is showing what the server says, not proposing it.
 *      A client that could name its own price is a client that will.
 *   2. **The total is frozen onto the appointment at booking.** If the hospital
 *      raises a fee next month, a patient who booked today pays today's price.
 *      Payments read the stored figure, never a recomputed one.
 */

/** A visit is either a new patient's or a returning patient's. Nothing else. */
export const VISIT_TYPES = ['first', 'review']

export const isVisitType = (value) => VISIT_TYPES.includes(value)

/** The case-sheet charge alone, in rupees. */
export const visitCharge = (visitType) =>
  config.booking.visitCharges[isVisitType(visitType) ? visitType : 'first']

/**
 * The consultation fee itself, before the case-sheet charge.
 *
 * Several doctors charge less to see a returning patient than a new one — the
 * hospital's OP list has Gunasekaran at ₹400 first and ₹280 on review. Where
 * `fee_review` is null the two are the same, which is true of most of the
 * roster.
 */
export function baseFee(doctor, visitType) {
  if (doctor?.fee == null) return null
  if (visitType === 'review' && doctor.fee_review != null) return doctor.fee_review
  return doctor.fee
}

/**
 * Total payable for a consultation, in rupees.
 *
 * Returns null when the doctor has no published fee. That is not a zero — it
 * means the hospital has not said what this costs, and inventing a number
 * would be worse than admitting it. Those doctors are callback-only anyway;
 * reception quotes the fee on the phone.
 */
export function consultationFee(doctor, visitType) {
  const base = baseFee(doctor, visitType)
  if (base == null) return null
  return base + visitCharge(visitType)
}

/** The same figure broken out, for showing a patient what they are paying. */
export function feeBreakdown(doctor, visitType) {
  const charge = visitCharge(visitType)
  return {
    consultation: baseFee(doctor, visitType),
    visitType: isVisitType(visitType) ? visitType : 'first',
    visitCharge: charge,
    total: consultationFee(doctor, visitType),
  }
}
