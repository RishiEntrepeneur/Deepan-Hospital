import express from 'express'
import { config } from '../config.js'
import { db, nowIso } from '../db.js'
import { hmacHex, safeEqualHex, uuid } from '../lib/crypto.js'
import { audit } from '../lib/audit.js'
import { badRequest, conflict, forbidden, notFound } from '../lib/validate.js'
import { asyncRoute } from '../middleware/base.js'
import { rateLimit } from '../lib/rateLimit.js'
import { loadSession, requirePatient } from '../middleware/session.js'
import { presentAppointment } from './appointments.js'

export const paymentsRouter = express.Router()

/*
 * Payment routes were the only unmetered ones in the API.
 *
 * /order in particular calls out to Razorpay on every request, so a loop
 * against it costs the hospital real money in gateway calls and floods the
 * payments table. Generous enough that a patient retrying a flaky connection
 * never notices, tight enough that a script does.
 */
const payLimiter = rateLimit({ limit: 20, windowMs: 5 * 60 * 1000, code: 'PAYMENT_RATE_LIMITED' })

const oneAppointment = db.prepare('SELECT * FROM appointments WHERE id = ?')
const insertPayment = db.prepare(`
  INSERT INTO payments (id, appointment_id, provider, provider_order_id, amount, currency, status, method, created_at)
  VALUES (?, ?, ?, ?, ?, 'INR', ?, ?, ?)
`)
const findByOrder = db.prepare('SELECT * FROM payments WHERE provider_order_id = ?')
const markPaid = db.prepare(`
  UPDATE payments SET status = 'paid', provider_ref = ?, method = ?, instrument_hint = ?, paid_at = ?
  WHERE id = ? AND status <> 'paid'
`)
const openPaymentFor = db.prepare(`
  SELECT * FROM payments WHERE appointment_id = ? AND status IN ('created', 'pending')
  ORDER BY created_at DESC LIMIT 1
`)
const paidFor = db.prepare("SELECT 1 FROM payments WHERE appointment_id = ? AND status = 'paid'")

/**
 * Refuses to take money for an appointment that should not be charged.
 *
 * Shared by both payment routes because they had drifted: /order checked for a
 * cancelled appointment and /counter did not, so a patient could cancel and
 * still be recorded as owing at the desk.
 */
function assertPayable(appointment) {
  if (appointment.status === 'cancelled') throw conflict('APPOINTMENT_CANCELLED')
  if (appointment.fee == null) {
    // Nothing has been published to charge. Better to refuse than to invent a
    // zero and record the visit as settled.
    throw conflict('FEE_NOT_PUBLISHED', 'No fee has been published for this appointment.')
  }
  if (paidFor.get(appointment.id)) throw conflict('ALREADY_PAID')
}

/** Consultation fee plus the online convenience fee, in paise. */
function amountFor(appointment, online) {
  const fee = appointment.fee ?? 0
  const total = online ? fee + config.payments.convenienceFee : fee
  return { rupees: total, paise: Math.round(total * 100) }
}

const ownedOr403 = (req, id) => {
  const row = oneAppointment.get(id)
  if (!row) throw notFound('APPOINTMENT_NOT_FOUND')
  if (row.patient_id !== req.patient.id) throw forbidden('NOT_YOUR_APPOINTMENT')
  return row
}

/* ------------------------------------------------------------------ *
 * POST /payments/counter — settle at the billing desk
 * ------------------------------------------------------------------ */
paymentsRouter.post(
  '/counter',
  payLimiter,
  loadSession,
  requirePatient,
  asyncRoute(async (req, res) => {
    const appointment = ownedOr403(req, String(req.body?.appointmentId ?? ''))
    /*
     * The old check read `openPaymentFor(...)?.status === 'paid'`, but that
     * query only selects 'created' and 'pending' rows — so it could never be
     * 'paid' and the guard never fired.
     */
    assertPayable(appointment)

    const { paise } = amountFor(appointment, false)
    /*
     * Reuse an open row rather than adding another. Pressing "pay at the
     * hospital" twice previously left two pending charges against one visit,
     * which the billing desk would have had to untangle by hand.
     */
    const existing = openPaymentFor.get(appointment.id)
    if (!existing) {
      insertPayment.run(uuid(), appointment.id, 'counter', null, paise, 'pending', 'counter', nowIso())
    }

    audit({
      actorType: 'patient',
      actorId: req.patient.id,
      action: 'payment.counter_selected',
      entity: 'appointment',
      entityId: appointment.id,
      ip: req.clientIp,
    })

    res.json({ appointment: presentAppointment(oneAppointment.get(appointment.id)) })
  }),
)

/* ------------------------------------------------------------------ *
 * POST /payments/order — open a Razorpay order
 * ------------------------------------------------------------------ */
paymentsRouter.post(
  '/order',
  payLimiter,
  loadSession,
  requirePatient,
  asyncRoute(async (req, res) => {
    if (config.payments.provider !== 'razorpay') {
      throw badRequest('ONLINE_PAYMENT_UNAVAILABLE', 'Online payment is not configured.')
    }

    const appointment = ownedOr403(req, String(req.body?.appointmentId ?? ''))
    assertPayable(appointment)

    const { keyId, keySecret } = config.payments.razorpay
    const { rupees, paise } = amountFor(appointment, true)

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: paise,
        currency: 'INR',
        receipt: appointment.id,
        notes: { appointmentId: appointment.id, doctorId: appointment.doctor_id },
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('[razorpay] order failed', response.status, detail)
      throw badRequest('GATEWAY_ERROR', 'Could not start the payment. Please try again.')
    }

    const order = await response.json()
    insertPayment.run(uuid(), appointment.id, 'razorpay', order.id, paise, 'created', null, nowIso())

    audit({
      actorType: 'patient',
      actorId: req.patient.id,
      action: 'payment.order_created',
      entity: 'appointment',
      entityId: appointment.id,
      detail: { orderId: order.id, amount: rupees },
      ip: req.clientIp,
    })

    res.json({
      orderId: order.id,
      amount: paise,
      currency: 'INR',
      keyId,
      appointmentId: appointment.id,
    })
  }),
)

/* ------------------------------------------------------------------ *
 * POST /payments/verify — checkout callback
 *
 * The webhook is the source of truth; this exists so the patient sees a
 * confirmed state immediately rather than waiting for the callback.
 * ------------------------------------------------------------------ */
paymentsRouter.post(
  '/verify',
  payLimiter,
  loadSession,
  requirePatient,
  asyncRoute(async (req, res) => {
    const orderId = String(req.body?.razorpay_order_id ?? '')
    const paymentId = String(req.body?.razorpay_payment_id ?? '')
    const signature = String(req.body?.razorpay_signature ?? '')
    if (!orderId || !paymentId || !signature) throw badRequest('MISSING_SIGNATURE')

    const payment = findByOrder.get(orderId)
    if (!payment) throw notFound('PAYMENT_NOT_FOUND')

    const appointment = ownedOr403(req, payment.appointment_id)

    const expected = hmacHex(config.payments.razorpay.keySecret, `${orderId}|${paymentId}`)
    if (!safeEqualHex(expected, signature)) {
      audit({
        actorType: 'patient',
        actorId: req.patient.id,
        action: 'payment.signature_invalid',
        entity: 'appointment',
        entityId: appointment.id,
        ip: req.clientIp,
      })
      throw badRequest('SIGNATURE_MISMATCH', 'Payment could not be verified.')
    }

    markPaid.run(paymentId, 'online', null, nowIso(), payment.id)
    audit({
      actorType: 'patient',
      actorId: req.patient.id,
      action: 'payment.captured',
      entity: 'appointment',
      entityId: appointment.id,
      detail: { orderId, paymentId },
      ip: req.clientIp,
    })

    res.json({ appointment: presentAppointment(oneAppointment.get(appointment.id)) })
  }),
)

/* ------------------------------------------------------------------ *
 * POST /payments/webhook — Razorpay server-to-server
 *
 * Mounted with a raw body parser in index.js: the signature is over the exact
 * bytes Razorpay sent, so it must not be re-serialised.
 * ------------------------------------------------------------------ */
export const webhookHandler = asyncRoute(async (req, res) => {
  const secret = config.payments.razorpay.webhookSecret
  if (!secret) {
    res.status(503).json({ error: { code: 'WEBHOOK_NOT_CONFIGURED' } })
    return
  }

  const signature = req.get('x-razorpay-signature') ?? ''
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('')
  if (!safeEqualHex(hmacHex(secret, raw.toString('utf8')), signature)) {
    audit({ action: 'payment.webhook_invalid_signature', ip: req.clientIp })
    res.status(400).json({ error: { code: 'SIGNATURE_MISMATCH' } })
    return
  }

  let event
  try {
    event = JSON.parse(raw.toString('utf8'))
  } catch {
    res.status(400).json({ error: { code: 'BAD_PAYLOAD' } })
    return
  }

  const entity = event?.payload?.payment?.entity
  if (event?.event === 'payment.captured' && entity) {
    const payment = findByOrder.get(entity.order_id)
    /*
     * The amount must match what we asked for.
     *
     * The signature proves the message came from Razorpay; it does not prove
     * the sum is the one this appointment owes. Recording a ₹1 capture against
     * a ₹450 consultation as "paid" would be the expensive kind of trusting.
     */
    if (payment && entity.amount != null && Number(entity.amount) !== Number(payment.amount)) {
      audit({
        action: 'payment.webhook_amount_mismatch',
        entity: 'appointment',
        entityId: payment.appointment_id,
        detail: { expected: payment.amount, received: entity.amount, orderId: entity.order_id },
      })
      res.status(202).json({ received: true, ignored: 'amount_mismatch' })
      return
    }
    if (payment) {
      // markPaid is a no-op when the row is already paid, so replays are safe.
      markPaid.run(
        entity.id,
        entity.method ?? 'online',
        entity.vpa ?? (entity.card?.last4 ? `•••• ${entity.card.last4}` : null),
        nowIso(),
        payment.id,
      )
      audit({
        action: 'payment.webhook_captured',
        entity: 'appointment',
        entityId: payment.appointment_id,
        detail: { orderId: entity.order_id, paymentId: entity.id },
      })
    }
  }

  res.json({ received: true })
})
