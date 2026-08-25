# Turning SMS on — DLT registration, step by step

**This is optional.** It used to be the only way to sign in; sign-in is now a
phone number and a password, so patients can register and book without it. SMS
buys appointment reminders. See §3 of [COSTS.md](COSTS.md).

**Realistic timeline: about a week**, if the documents are in order. Each of the
three approval steps takes roughly 24–48 working hours.

> Verify fees and portal URLs as you go — they change, and different operators
> charge differently for the same thing.

---

## Before you start: two things that will stop you

**1. The Principal Entity has to be Deepan Hospital, not you.**

Registration is done in the hospital's name, using the hospital's PAN, GST and
letterhead, signed by an authorised signatory. You cannot complete this on your
own account. **Speak to Dr. Deepan and whoever handles the hospital's
compliance paperwork before starting.**

**2. The app cannot send SMS yet.**

The sending code was removed earlier in the project. DLT approval gives you a
sender header and template IDs — but nothing in the app currently calls an SMS
provider. That's roughly a few hours of development work, and it can be done
while the registration is pending.

---

## Step 0 — Pick your SMS provider first

Do this before touching a DLT portal. Providers like **MSG91**, **Gupshup**,
**Kaleyra** or **Message Central** walk you through DLT registration as part of
onboarding, usually at no charge. It is much easier than reading operator
documentation on your own.

Ask each one: *"We're a hospital in Trichy sending OTP and appointment
confirmations. Can you help us through DLT registration, and what's your
per-SMS rate for Service Implicit traffic?"*

## Step 1 — Gather the documents

For the hospital, not for you personally:

- [ ] **PAN** of the hospital (the business, not an individual)
- [ ] **GST certificate** — or TAN, or CIN, or Udyam registration
- [ ] **Authorised signatory's ID** (PAN / Aadhaar)
- [ ] **Letter of Authorisation** on hospital letterhead, naming whoever will
      operate the account
- [ ] An **email address and mobile number** for the hospital that will receive
      OTPs during registration — use one that will still exist in three years,
      not a personal number

## Step 2 — Register as a Principal Entity

Register on **one** portal only. Registration propagates across Jio, Airtel, Vi
and BSNL via the shared ledger — you do not repeat it per operator.

| Operator | Portal |
| --- | --- |
| Vodafone Idea | `vilpower.in` |
| Jio | `trueconnect.jio.com` |
| Airtel | `dltconnect.airtel.in` |
| BSNL | `ucc-bsnl.co.in` |

Fees vary by platform — some charge nothing for entity registration, others
around ₹5,900. Ask your provider which portal they recommend; they will know
which is currently least painful.

You come away with a **Principal Entity ID** (a long number). Keep it.

**Approval: ~24–48 working hours.**

## Step 3 — Register a header (sender ID)

Six characters, alphanumeric, related to the hospital's name. For example
`DEEPAN` or `DPNHSP`.

Choose **transactional / service** type, not promotional. Promotional headers
are blocked by DND, which would stop your OTPs reaching half your patients.

Some platforms charge for the header (around ₹5,900), others don't.

**Approval: ~24–48 working hours.**

## Step 4 — Register content templates

This is the fiddly part. Every message the app sends must be pre-registered
word for word. Variables go in as `{#var#}` and are typically capped at 30
characters each.

Register all of these under the **Service Implicit** category — that covers
OTPs and transactional messages the patient triggered themselves, and needs no
separate consent. Do **not** file them as promotional.

Ready to paste:

**1. Sign-in code** *(required — without this nobody can use the app)*
```
{#var#} is your verification code for Deepan Hospital. Valid for 5 minutes. Do not share this code with anyone.
```

**2. Appointment confirmed**
```
Appointment confirmed at Deepan Hospital. Dr {#var#} on {#var#} at {#var#}. Reference {#var#}. Please arrive 15 minutes early.
```

**3. Slot held, awaiting confirmation**
```
Your slot at Deepan Hospital is held. Dr {#var#} on {#var#} at {#var#}. Reference {#var#}. Reception will confirm shortly.
```

**4. Appointment cancelled**
```
Your appointment {#var#} at Deepan Hospital on {#var#} has been cancelled. Please call {#var#} to book again.
```

Template 1 is the one that matters. Get it filed first — the others can follow.

**Approval: ~24–48 working hours each**, and they can be submitted together.

Each approved template returns a **Template ID**. You need all of them.

## Step 5 — Hand the IDs to your provider

Give your SMS provider:

- Principal Entity ID
- Header (e.g. `DEEPAN`)
- Every Template ID
- Their own API key, which they issue you

## Step 6 — Wire it into the app

**This code does not exist yet.** What needs building:

- An SMS client that calls the provider's API with a template ID and variables
- OTP delivery in `server/src/routes/auth.js`, which currently only logs the code
- Restoring the SMS path in `server/src/lib/notify.js` for booking alerts
- Config entries for the credentials, and a preflight check so the server
  refuses to start in production with SMS half-configured

A few hours of work. Best done while registration is pending, so both finish
at the same time.

---

## Sanity checks

- **Test with a real handset on each network** — Jio, Airtel and Vi behave
  differently, and a template that works on one can be silently dropped on
  another
- **OTP messages must be Service Implicit.** Filed as promotional, they get
  blocked by DND and roughly half your patients never receive them
- **Keep the template text exactly as registered.** Change one word in the app
  and the operator rejects the message — the mismatch is checked per send
- **Watch the first week's delivery reports.** Your provider's dashboard shows
  failures; a header or template problem shows up there before patients complain
