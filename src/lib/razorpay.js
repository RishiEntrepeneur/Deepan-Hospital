import { api } from './api'

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

let loader = null

/** Loads Razorpay's checkout script once, on demand. */
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve()
  if (loader) return loader

  loader = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = CHECKOUT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loader = null
      reject(new Error('CHECKOUT_SCRIPT_FAILED'))
    }
    document.head.append(script)
  })
  return loader
}

/**
 * Opens Razorpay checkout for an appointment and verifies the result server-side.
 *
 * Card details are entered inside Razorpay's own iframe — this app never sees
 * or stores them. Resolves with the updated appointment, or `null` if the
 * patient closed the sheet.
 */
export async function payForAppointment(appointment, { name, phone, email, description }) {
  const order = await api.payments.createOrder(appointment.id)
  await loadCheckout()

  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: 'Deepan Hospital',
      description,
      prefill: { name, contact: phone, email: email ?? '' },
      theme: { color: '#0284c7' },
      modal: {
        ondismiss: () => resolve(null),
      },
      handler: (result) => {
        api.payments
          .verify({
            razorpay_order_id: result.razorpay_order_id,
            razorpay_payment_id: result.razorpay_payment_id,
            razorpay_signature: result.razorpay_signature,
          })
          .then((data) => resolve(data.appointment))
          .catch(reject)
      },
    })

    checkout.on('payment.failed', (event) => {
      reject(new Error(event?.error?.description ?? 'PAYMENT_FAILED'))
    })

    checkout.open()
  })
}
