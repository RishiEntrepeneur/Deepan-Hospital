# What it costs to run the Deepan Hospital app

Prepared for discussion with the hospital. All figures in ₹ per year unless
stated otherwise.

> **Read this first.** Every price below is an *estimate* to be replaced with a
> real quote before anyone commits to a budget. Cloud and telecom pricing in
> India changes frequently. The figures are here to show the *shape* of the
> cost — which lines are big, which are trivial — not to be signed off as-is.
> Get written quotes for the three starred lines; the rest are small enough
> not to matter much either way.

---

## The short version

| | Per year |
| --- | --- |
| Software licences | **₹0** |
| Servers, domain, backups | **₹10,000 – ₹25,000** |
| Someone to look after it ★ | **₹60,000 – ₹2,50,000** |
| SMS — **required**, see §3 ★ | **₹15,000 – ₹25,000** |
| Online payment fees ★ | a % of what you collect, not a fixed cost |

**The server is not the expense. The person is.** A hospital administrator
looking at this will naturally focus on the hosting bill; that line is roughly
the cost of one month's tea for the reception desk. The line that decides
whether this app is still working in two years is the maintenance one.

---

## 1. Software — ₹0, permanently

The app is built entirely on free, open-source software. There are no licence
fees, no per-user charges, no per-doctor charges, and no vendor who can raise a
price later:

| What | Licence |
| --- | --- |
| React, Tailwind, Lucide (the website) | Free, open source |
| Node.js + Express (the server) | Free, open source |
| SQLite (the database) | Public domain |

Adding the 26th doctor, or the 200th, costs nothing. This will not change.

## 2. Servers and infrastructure — ₹10,000 – ₹25,000/year

The whole app is one small program and one database file. It does not need
anything large.

| Item | Estimate | Notes |
| --- | --- | --- |
| Server (VPS) | ₹6,000 – ₹18,000 | 1–2 GB RAM is ample. Host it in **India** (Mumbai or Bengaluru) — patient health data is better kept in-country under the DPDP Act, and it is faster from Trichy |
| Domain name (`.in`) | ₹800 – ₹1,500 | Renewed yearly |
| HTTPS certificate | **₹0** | Let's Encrypt, free and automatic |
| Off-site backup storage | ₹1,200 – ₹3,600 | A few GB of object storage. **Do not skip this** |

**On database size:** the file today is 308 KB holding 14 appointments. Even at
500 appointments a day, growth is on the order of a few hundred MB a year. This
app will not outgrow the cheapest server available on storage, ever.

## 3. SMS — required for patient self-booking, ₹15,000 – ₹25,000 in year one

**This is not an optional extra. Without it, patients cannot sign in.**

Signing in works by sending a one-time code to the patient's mobile. There is
currently no channel to send it on: in development the code is shown on screen,
and the server refuses to allow that in production for the obvious reason. So
on a live server the code is generated and delivered nowhere. A patient can
browse the doctor list and nothing else — not book, not even request a callback.

Two ways forward:

- **Turn SMS on** (below) — patients book themselves, which is what the app was
  built for
- **Run it staff-assisted only** — ₹0, works today. The public site becomes a
  doctor directory; patients phone reception, who book for them on the desk
  screen. Everything still works, but the headline feature is switched off

If you want patients booking their own appointments, this line is mandatory:

| Item | Estimate | Notes |
| --- | --- | --- |
| TRAI DLT registration | ₹0 – ₹12,000 one-time | Principal Entity plus sender header. Some platforms charge nothing for the entity, others around ₹5,900 each for entity and header; templates are free. Mandatory in India — you cannot send transactional SMS without it |
| Per message | ₹0.12 – ₹0.25 | At ~200 messages/day that is roughly ₹9,000 – ₹18,000/year |

**Start the DLT registration before anything else.** It has the longest lead
time here — three approval steps at roughly 24–48 working hours each, so about
a week if the paperwork is clean. It is also the one thing you cannot do alone:
registration is in the hospital's name, using the hospital's PAN, GST and
letterhead. Step-by-step instructions are in [SMS-SETUP.md](SMS-SETUP.md).

Note also that **the app has no SMS-sending code** — it was removed earlier in
the project. Budget a few hours of development alongside the registration.

## 4. Online payment — a percentage, not a bill

Nothing is charged today; online payment is switched off and patients pay at
the counter. If you turn on Razorpay:

- **UPI** — historically **nil** for merchants in India (MDR waived by law on
  UPI and RuPay debit). Most patients will use this.
- **Cards, net banking, wallets** — typically around **2% + GST** per
  transaction.

Note the amount charged is the consultation fee **plus the case-sheet charge**
(₹50 first visit, ₹20 review), so a ₹250 consultation is billed at ₹300 or
₹270. At a ₹300 total, a card payment costs you roughly ₹6–8. There is no
monthly fee — if nobody pays online, you pay nothing. **Confirm current rates
with Razorpay directly**; published rates move.

## 5. Reading pages aloud — ₹0 as built

The app reads text aloud to patients who would rather listen than read, in all
three languages. As built this uses the speech engine already inside the
patient's own phone or computer, so it costs **nothing** — no account, no
per-use charge, and it keeps working without internet.

Paying for better voices (ElevenLabs) is optional:

| | Cost |
| --- | --- |
| As built — the device's own voice | **₹0** |
| ElevenLabs, better Tamil and Hindi | roughly **₹9,000 – ₹22,000/year** at a low-usage tier |

The reason it is not more: generated audio is stored and reused. The app reads
a small, fixed set of phrases, so the hundredth patient to hear a department
name costs nothing — the first one paid for it.

**Recommendation: leave it off.** The built-in voices are adequate. Revisit
only if patients say the Tamil or Hindi is hard to follow. Detail in
[SPEECH-SETUP.md](SPEECH-SETUP.md).

## 6. Video consultation — ₹0 as built

Uses Jitsi Meet's free public service. No account, no per-minute charge.

If the hospital later decides patient consultations should not touch a
third-party public server — a reasonable position for clinical video — running
your own costs roughly **₹18,000 – ₹48,000/year** for a second, larger server.
Not needed to start.

## 7. Maintenance — the real number ★

This is the line that matters and the one I cannot price for you, because it
depends entirely on who does it.

**What it covers:** security updates to Node and the libraries, fixing things
that break, restoring from backup if something goes wrong, adding a doctor,
changing a fee, answering "why can't Mrs. Raman book?".

| Arrangement | Cost | What actually happens |
| --- | --- | --- |
| Nobody | ₹0 | It works until it doesn't. Security patches stop. In 18–24 months it is an unmaintained system holding patient data — the worst of the options |
| A few hours a month from a freelance developer | ₹60,000 – ₹1,50,000 | Realistic and adequate for an app this size |
| A part-time developer on retainer | ₹1,50,000 – ₹2,50,000+ | Only worth it if the hospital wants ongoing changes, not just upkeep |

Rates vary enormously by who you ask. **Get two or three written quotes locally
before putting a figure in front of the hospital.** Ask specifically for
"maintenance and support for an existing Node.js application", not new
development — it is a much cheaper conversation.

## 8. One-time setup

| Item | Estimate |
| --- | --- |
| Deploying it (server, domain, HTTPS, backups off-site) | 4–8 hours of a developer's time |
| Entering 25 doctors' schedules | ~1 hour of hospital staff time, **free**, and the single most valuable hour anyone will spend on this |

---

## Worked example — realistic first year

Modest setup: hosted in India, SMS on so patients can sign in, payments at the
counter, a freelancer on call for a few hours a month.

| | |
| --- | --- |
| Server, domain, backups | ₹15,000 |
| Software | ₹0 |
| SMS | ₹18,000 (required for patient sign-in) |
| Payment fees | ₹0 (counter only) |
| Maintenance | ₹90,000 |
| **First-year total** | **≈ ₹1,23,000** |

Drop SMS and run it staff-assisted only and it is roughly **₹1,05,000**, but
patients cannot book themselves. Add self-hosted video and roughly
**₹1,71,000**.

For context: that is in the region of what one full-time reception salary
costs. Whether it is worth it depends on whether the app saves more reception
time than that — which nobody can answer yet, because it has not been used by a
real patient.

---

## What I am *not* including, and you should ask about

- **Someone's time at the hospital** to approve bookings and keep schedules
  current. Not money, but not free either
- **A data controller** — the DPDP Act requires a named person accountable for
  patient data. Usually an existing staff member, but it must be someone
- **Legal review** of the privacy notice before real patient data goes in. A
  local advocate's opinion is worth having and I cannot estimate the fee
- **Medical registration verification** — 25 doctors' registration numbers need
  checking against the TN Medical Council register. Staff time
- **Insurance / liability** — whether the hospital's existing cover extends to
  an app that books appointments and holds records. Ask your insurer

---

*Figures are estimates for planning only, not a quote. Verify every starred
line with a written quote before budgeting.*
