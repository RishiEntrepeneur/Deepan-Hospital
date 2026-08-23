# Deepan Hospital · தீபன் மருத்துவமனை

Trilingual (English / Tamil / Hindi) appointment booking for Deepan Hospital, Tiruchirappalli.

- **Front end** — React 19, Vite, Tailwind CSS v4, Lucide icons
- **API** — Node (Express 5) with SQLite via Node's built-in `node:sqlite` — no native build step
- **Auth** — phone + OTP, httpOnly session cookies
- **Payments** — Razorpay hosted checkout (card details never touch this origin)

## Run it

Two processes. In one terminal:

```bash
cd server && cp .env.example .env && npm install && npm run migrate && npm run seed && npm run dev
```

`.env` is gitignored and does not exist until you copy it. The server starts
without one, but silently — so copy it first. The only value worth setting for
local use is `VIDEO_ROOM_SECRET`; generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

In another:

```bash
npm install && npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to the server on port 4000, so the session cookie is same-origin in development.

Create a staff login for the admin endpoints:

```bash
cd server && npm run create-staff -- --username admin --role admin
```

## How the important parts work

**One slot, one patient.** A partial unique index on `appointments(doctor_id, date, slot)` — restricted to live bookings — is what actually prevents a double booking. Two simultaneous requests for the same slot end with exactly one `201` and one `409 SLOT_TAKEN`; the loser is sent back to pick another time. Application code cannot get this wrong because it isn't application code.

**Availability is server-truth.** `GET /api/doctors/:id/availability?date=` returns each slot with `available` and a reason (`taken` / `past`). The picker re-fetches on every date change, so a slot someone else just took disappears without a reload.

**Sign-in is a real OTP.** Six digits, scrypt-hashed in the database, five-minute expiry, five attempts, rate limited per phone and per IP. The session token is random, stored only as a SHA-256 hash, and delivered in an httpOnly cookie. With `SMS_PROVIDER=console` the code is printed to the server log and echoed in the API response so the flow is testable before you have an SMS account — the server refuses to start that provider in production.

**Payments never touch card data.** The browser asks the server to create a Razorpay order, Razorpay's own iframe collects the instrument, and the server verifies the HMAC signature before marking anything paid. The webhook is the source of truth and is idempotent. Only a masked hint (`•••• 4242`, or a UPI handle) is ever stored. Without `RAZORPAY_KEY_ID` the app runs counter-payment only and says so.

**The appointment is created before payment.** The slot is held the moment patient details are submitted, so abandoning the payment sheet never loses the booking — it just leaves it payable at the counter.

## The doctor roster

The 26 consultants in `server/scripts/seed.js` are the hospital's own supplied list. Their **names, qualifications and designations are reproduced exactly as given**.

Registration numbers, consultation fees, consulting days, timings and room numbers are **deliberately absent**, because they were not supplied. Inventing any of them for a real, named doctor would put a false credential or a wrong clinic time in front of a patient.

So every doctor starts at `booking_mode = 'pending'`: they are listed and searchable, and patients can request a callback, but no online slots are offered. Publish a real schedule and the doctor becomes bookable automatically:

```bash
curl -X PATCH http://localhost:4000/api/admin/doctors/deepan-g \
  -H 'Content-Type: application/json' -b staff-cookie.jar \
  -d '{"days":[1,3,5],"morningStart":"10:00","morningEnd":"13:00","fee":500,"room":"OPD 3","bookingMode":"live"}'
```

Going `live` is refused unless consulting days, at least one session and a fee are all set — a doctor cannot be made bookable with half a schedule.

### Before publishing more detail

- **Verify every registration number** against the [Tamil Nadu Medical Council](https://www.tnmedicalcouncil.org/) (TNMC) or Dental Council (TNDC) register before entering it.
- **Get consent** from each doctor for their details appearing online.
- **Take timings and fees from the hospital's own scheduling system**, not from memory.
- Two entries in the supplied list need confirming: Dr. A. Kader Sahib is listed as "International Cardiologist" (likely *Interventional*), and several qualifications read "MCL" where the degree is almost certainly **M.Ch**. They are entered as Cardiologist and M.Ch respectively — correct them in the admin API if that is wrong.

## Layout

```
server/
├── src/
│   ├── schema.sql        tables, constraints, the slot unique index
│   ├── db.js             connection, migrations, transactions
│   ├── config.js         all environment configuration
│   ├── lib/              crypto, slots, validation, rate limiting, SMS, audit
│   ├── middleware/       cookies, CORS, sessions, error handling
│   └── routes/           auth, catalog, appointments, payments, admin
└── scripts/              migrate, seed, create-staff

src/
├── data/                 hospital catalogue registry, glossary, health tips
├── i18n/                 the EN/TA dictionary and language context
├── lib/                  api client, hooks, schedule maths, assistant
├── components/           layout, cards, booking wizard, assistant
└── pages/                Home, Doctors, Services, Appointments, Contact, Account, Glossary
```

## Configuration

Copy `server/.env.example` to `server/.env`. Nothing is required to run locally; everything below has a safe default.

| Variable | Purpose |
| --- | --- |
| `DATABASE_FILE` | SQLite path. Point at a volume in production. |
| `SMS_PROVIDER` | `console` (dev), `msg91` or `twilio`. |
| `RAZORPAY_KEY_ID` / `_SECRET` / `_WEBHOOK_SECRET` | Enables online payment. Test keys start `rzp_test_`. |
| `CONVENIENCE_FEE` | Added to online payments only, in rupees. |
| `SLOT_MINUTES`, `BOOKING_WINDOW_DAYS`, `BOOKING_LEAD_MINUTES` | Booking rules. |
| `COOKIE_SECURE` | Set `true` in production (HTTPS only). |
| `OTP_ECHO` | Must be `false` in production. |

## Still to do before real patients use it

1. **HTTPS and a real domain**, with `COOKIE_SECURE=true`.
2. **An SMS account** (MSG91 or Twilio) and a registered DLT template for OTP in India.
3. **A Razorpay account** with completed KYC, plus the webhook pointed at `POST /api/payments/webhook`.
4. **Backups.** The SQLite file is the entire hospital record — schedule an off-machine copy. For more than one server process, move to Postgres; the schema is written to port directly.
5. **A retention and consent policy.** The app stores patient names, ages, phone numbers and reasons for visit. India's DPDP Act applies. Decide how long records are kept, who on staff can read them, and publish a privacy notice.
6. **Staff training on the admin API** — the roster is only as accurate as whoever maintains it.
