import { Banknote, Smartphone } from 'lucide-react'

/**
 * Payment presentation only.
 *
 * This app never collects card, UPI or bank credentials. Online payment hands
 * off to Razorpay's hosted checkout, which runs in its own iframe — so card
 * data never enters this origin and never reaches our server.
 */

export const PAYMENT_METHODS = [
  {
    id: 'online',
    icon: Smartphone,
    labelKey: 'pay.online',
    hintKey: 'pay.onlineHint',
    online: true,
  },
  {
    id: 'counter',
    icon: Banknote,
    labelKey: 'pay.counter',
    hintKey: 'pay.counterHint',
    online: false,
  },
]

export const getMethod = (id) => PAYMENT_METHODS.find((m) => m.id === id)

/** Mirrors the server's calculation for display; the server is authoritative. */
export function calculateTotal(consultationFee, methodId, convenienceFee) {
  const fee = consultationFee ?? 0
  const convenience = getMethod(methodId)?.online ? (convenienceFee ?? 0) : 0
  return { consultationFee: fee, convenience, total: fee + convenience }
}

/**
 * What the patient will pay, for showing them before they commit.
 *
 * The consultation fee is the doctor's; the case-sheet charge depends on
 * whether this is a first visit or a review. **This is for display only.** The
 * server computes the real total at booking from its own copy of the fee, and
 * the appointment comes back carrying it — once it does, show that figure
 * rather than this one. A price the browser worked out is a price the browser
 * could be wrong about.
 */
export function visitTotal(doctorOrFee, visitType, visitCharges) {
  /*
   * Accepts either a doctor or a bare fee. Several doctors charge less for a
   * review than for a first visit, so the base itself depends on the visit
   * type — passing a doctor lets that be honoured; passing a number keeps the
   * older call sites working.
   */
  const doctor = typeof doctorOrFee === 'object' && doctorOrFee !== null ? doctorOrFee : null
  const first = doctor ? doctor.fee : doctorOrFee
  if (first == null) return null

  const review = doctor?.feeReview ?? first
  const consultation = visitType === 'review' ? review : first
  const charge = visitCharges?.[visitType === 'review' ? 'review' : 'first'] ?? 0
  return { consultation, visitCharge: charge, total: consultation + charge }
}
