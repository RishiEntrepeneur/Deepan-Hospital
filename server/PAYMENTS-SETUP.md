# Turning on online payment

The app takes online payments through **Razorpay**. Everything on the software
side is built and tested — this document is the account setup and the four
settings that switch it on.

Until it is switched on the app runs **counter-payment only**: patients book
online and pay at the hospital. Nothing is broken in that state; online payment
is an addition, not a dependency.

---

## What the hospital needs first

Razorpay is a regulated payment company, so opening the account needs the
hospital's own documents. **This is Deepan Hospital's task, not the
developer's** — the money lands in the hospital's bank account, so the account
must be in the hospital's name.

They will need:

- Hospital PAN card
- Hospital bank account number and IFSC (this is where money arrives)
- Registration/incorporation proof of the hospital
- GST number, if the hospital has one
- Address proof
- A mobile number and email for the account

Sign up at **https://razorpay.com** → *Sign Up* → choose the business type.
Verification (KYC) usually takes **2–5 working days**. Nothing below works until
Razorpay marks the account **Activated**.

---

## Step 1 — get the three secrets

Once the account is activated, in the Razorpay **Dashboard**:

**Key ID and Key Secret**
`Settings → API Keys → Generate Key`

It shows the **Key Secret once only** — copy it immediately. If it is lost,
regenerate a new pair and update `.env`.

- Test keys start with `rzp_test_` — money is fake, cards are fake. **Start here.**
- Live keys start with `rzp_live_` — real money.

**Webhook Secret**
`Settings → Webhooks → Add New Webhook`

- **Webhook URL:** `https://YOUR-SITE/api/payments/webhook`
  (replace with the hospital's real domain — it must be **https** and reachable
  from the internet; Razorpay cannot call `localhost`)
- **Secret:** invent a long random string and paste it in. Generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
  ```
- **Active Events:** tick **`payment.captured`**. That is the only event this
  app acts on — ticking others is harmless but pointless.

---

## Step 2 — put them in `server/.env`

```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=the-random-string-you-invented
```

The Key Secret and Webhook Secret **never leave this server** — they are not
sent to the browser and cannot be read from the page source.

Restart the server:

```bash
cd server && npm start
```

**Confirm it is live** — this should now say `razorpay` instead of `none`:

```bash
curl localhost:4000/api/health
```

---

## Step 3 — the convenience fee

```
CONVENIENCE_FEE=20
```

Added to online payments only, in rupees. Razorpay charges the hospital about
2% per transaction; this is where that is recovered. Set it to `0` to absorb the
cost instead. The patient is always shown the breakdown before paying.

---

## Step 4 — test with a fake card

With **test** keys, book an appointment and pay. Use Razorpay's test card:

| Field | Value |
| --- | --- |
| Card number | `4111 1111 1111 1111` |
| Expiry | any future date |
| CVV | any 3 digits |
| OTP | any |

No real money moves. Then check:

- The desk shows the appointment as **paid**
- Razorpay Dashboard → *Transactions* shows the payment
- Razorpay Dashboard → *Webhooks* shows a **200** delivery, not a failure

If the webhook shows a failure, the URL is wrong or not reachable from the
internet. The payment still succeeds — the app also verifies the signature
directly when the patient returns — but fix it, because the webhook is what
catches a payment where the patient closed the browser mid-transaction.

---

## Step 5 — going live

1. Complete Razorpay KYC and get **live** keys.
2. Replace the three values in `.env` with the live ones.
3. Point the webhook at the live domain.
4. **Do one real payment of a small amount and refund it** from the dashboard.
   Never trust a live payment path that has not moved one real rupee.

Settlement to the hospital's bank is usually **T+2 working days**. That is
Razorpay's schedule, not something this app controls.

---

## What is already protected

These were built and are covered by tests — worth knowing so nobody "fixes"
them later:

- **The amount is always computed on the server**, from the server's own copy of
  the fee. The browser is shown a figure; it can never propose one. A request
  that sends its own `fee` is ignored.
- **The webhook signature is verified** before anything is believed. A forged
  "payment succeeded" message is refused (`400`).
- **The amount is re-checked in the webhook.** A valid signature proves the
  message came from Razorpay; it does not prove the sum is right. A ₹1 capture
  against a ₹450 consultation is refused and recorded.
- **Replays are safe** — marking a paid appointment paid again does nothing.
- **Cannot pay twice**, cannot pay a cancelled appointment, cannot pay before a
  fee is published.
- Payment routes are rate limited (20 attempts / 5 minutes).

The suite `money cannot be tampered with` in `test/api.test.js` proves these,
and `npm run pentest` attacks the live server with forged signatures and
tampered amounts. Run both after any change near payments.

---

## If you are not ready

Leave `RAZORPAY_KEY_ID` unset. The app runs counter-payment only, the booking
flow works end to end, and no payment UI is shown. Switch it on whenever the
Razorpay account is ready — it needs no code change.
