# Turning online payment on

The code is finished and tested. What is missing is a Razorpay account, which
only the hospital can open — it needs the hospital's bank account and KYC.

Until keys are set, the app shows only "Pay at the hospital" and never offers
to charge anyone. That is the correct behaviour, not a placeholder.

---

## What already works

Verified by the test suite, not by inspection:

- **The amount is calculated on the server** from the doctor's published fee.
  The browser cannot influence what is charged — the single most important
  control in a payment flow, and the one most often got wrong.
- **Signatures are verified** with HMAC-SHA256 and a constant-time comparison,
  so a forged "payment succeeded" callback is rejected.
- **Webhooks are idempotent.** Razorpay retries; a replayed webhook cannot
  mark a payment paid twice or double-credit an appointment.
- **Card and UPI details never touch this app.** Razorpay's hosted checkout
  runs in its own iframe on its own origin. Nothing sensitive reaches the
  hospital's server, which is what keeps PCI scope off your desk.
- **The server refuses to start in production** if the webhook secret is
  missing, because payment confirmations could not be trusted without it.

---

## Step 1 — Open the Razorpay account

Someone at the hospital with authority over the bank account:

1. Sign up at `razorpay.com` **as the hospital**, not as an individual
2. Complete KYC — expect to need the hospital's PAN, GST certificate,
   cancelled cheque or bank statement, and the authorised signatory's ID
3. Wait for activation. Test mode works immediately; live mode needs approval

Ask them what their current rates are while you are there. Published rates
move, and healthcare sometimes has its own pricing.

## Step 2 — Get three values

From the Razorpay dashboard:

| Value | Where | Notes |
| --- | --- | --- |
| `RAZORPAY_KEY_ID` | Settings → API Keys | Starts `rzp_test_` or `rzp_live_` |
| `RAZORPAY_KEY_SECRET` | Shown once when you generate the key | **Shown once.** Store it immediately |
| `RAZORPAY_WEBHOOK_SECRET` | Settings → Webhooks | You choose this string when creating the webhook |

## Step 3 — Create the webhook

In the Razorpay dashboard, Settings → Webhooks → Add:

- **URL:** `https://your-domain/api/payments/webhook`
- **Secret:** any long random string — put the same value in `.env`
- **Active events:** `payment.captured` and `payment.failed`

Without this, a patient who pays and then closes the browser before being
redirected back would be charged with no appointment updated. The webhook is
what closes that gap.

## Step 4 — Put them in `server/.env`

```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=a-long-random-string-you-chose
CONVENIENCE_FEE=20
```

Restart the server. It prints `payments : razorpay` instead of `payments :
none`, and the online option appears in the booking flow by itself.

## Step 5 — Test before real money

Use a `rzp_test_` key first. Razorpay's test cards are in their docs — one
succeeds, one fails, and you want to see both.

Check all four of these:

- [ ] A successful payment marks the appointment paid and shows the reference
- [ ] A **failed** payment leaves the appointment intact and still bookable —
      the slot must not be released
- [ ] Closing the payment sheet without paying leaves the booking alone
- [ ] The webhook arrives — Razorpay's dashboard shows delivery attempts and
      their response codes

Only then swap in the `rzp_live_` keys.

---

## What it costs

- **UPI** — historically nil for merchants in India, and most patients will
  use it
- **Cards, net banking, wallets** — around 2% + GST per transaction
- **No monthly fee.** If nobody pays online, you pay nothing

At a ₹400 consultation a card payment costs roughly ₹8–10. Confirm current
rates with Razorpay directly.

The `CONVENIENCE_FEE` setting adds a flat amount to online payments only, to
offset that. Set it to `0` if the hospital would rather absorb the cost —
patients notice a surcharge.

---

## Decide before switching it on

**Refunds are not built.** A cancelled appointment that was paid online does
not refund automatically; someone has to issue it from the Razorpay dashboard
and the app will not know. If online payment is going to be common, that needs
building, and it needs a policy first: does a patient who cancels an hour
before get their money back?

**Nothing forces payment.** A patient can always choose the counter. That is
deliberate — a booking system that refuses appointments to people without a
card is not appropriate for a hospital.
