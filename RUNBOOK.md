# Deepan Hospital — operations runbook

For whoever looks after this app. Written on the assumption that the person
reading it did not build it and cannot ask the person who did.

---

## What this is

Two programs:

| Part | Where | What it does |
| --- | --- | --- |
| Front end | `src/` | The website patients use, and the desk screen staff use |
| API | `server/src/` | Everything real: bookings, logins, records, payments |
| Database | `server/data/deepan.db` | One SQLite file. **This is the hospital's records.** |

If the database file is lost, everything is lost. See **Backups**.

---

## Day-to-day

### Start it

```bash
cd server && npm start
```

Then, separately, serve the front end (`npm run build` produces `dist/`).

### Is it healthy?

```bash
curl localhost:4000/api/health
```

The server prints warnings on startup. **Read them** — they are the difference
between a working hospital app and one that quietly does nothing:

- `N of 25 doctors are bookable` — the rest can only take callback requests
- `NOTIFY_DESK_PHONE is not set` — nobody is texted when a booking arrives
- `BACKUP FAILED` — act on this today, not next week

### Run the tests before changing anything

```bash
cd server && npm test
```

23 tests against a real server on a throwaway database. They cover the things
that hurt when they break: double-booking, sign-in, who can see whose patients,
and status transitions. If these fail, do not deploy.

---

## The jobs that actually matter

### 1. Make doctors bookable

A doctor is only bookable once they have **consulting days, at least one
session time, and a fee**. Until then patients can only ask for a callback.

Desk → **Schedules**. The bar at the top shows how many of the roster are
bookable. Use **Set several doctors at once** for everyone who shares OPD
hours — tick them, set the pattern, "Open booking".

This is the single highest-value thing anyone can do with this app.

### 1b. What a patient pays

Two parts, added together:

| Part | Set where |
| --- | --- |
| The doctor's consultation fee | Desk → Schedules, per doctor |
| A case-sheet charge | `server/.env`, hospital-wide |

The case-sheet charge depends on the visit: **₹50 for a first visit** (a new
file has to be opened) and **₹20 for a review**. So a ₹250 consultation is
₹300 for a new patient and ₹270 for a returning one.

The booking form asks which it is and shows the patient the breakdown before
they commit. It will not let them continue without answering, because the
answer changes the price and choosing for them would mean choosing what they
pay.

Change the charges in `server/.env`:

```
FIRST_VISIT_CHARGE=50
REVIEW_CHARGE=20
```

Set either to `0` to switch it off. **The total is always computed on the
server** from its own copy of the fee — the browser is shown a figure, it never
proposes one, and a test proves a request that sends its own `fee` is ignored.

The total is frozen onto the appointment when it is booked. Raise a fee next
month and a patient who booked today still pays today's price.

### 2. Approve bookings

Desk → **New requests**. Bookings made while reception is open wait here for
approval. Bookings made when reception is closed are confirmed automatically —
see `BOOKING_APPROVAL` below.

Turn on **Chime** and **Alerts** in the desk header so an arriving booking makes
a noise. Do this on the machine at the counter, once.

### 3. Who signs in where

**One door for everyone who works here.** Account → *I work at the hospital*.
Reception and doctors use the same form; the account decides what it shows.
There is no separate doctor login any more — it only ever refused people who
had typed a correct password.

Doctors reach their own system from the desk: the **Klinique** tab embeds
`deepan.klinique.net`, physician login and all. If signing in inside the frame
does not stick, the browser is blocking cookies for an embedded site (Safari
does by default) — **Open in a new tab** is right there and works the same.

Making more accounts:

```bash
cd server && npm run create-staff -- --username <name> --role staff
cd server && npm run doctor-logins            # one per doctor on the roster
```

Both print the password once. Give people their own account rather than
sharing one — the audit log is only worth having if it names a person.

### 4. Desk help

Every desk screen has a **Desk help** button in the bottom corner. It explains
what each tab does and jumps you to it, and it knows live facts like how many
doctors are currently bookable.

It answers differently for a doctor than for reception, because the same
question means different things to each. It will **not** answer clinical
questions and will **not** search patient records — patient history has an
audited route, and a search box that went around it would make the audit log
untrue.

### 5. A patient who booked before passwords existed

Numbers were in this database long before passwords were: every guest booking,
and everyone who used the old code-by-SMS sign-in. Those accounts have records
but no password.

Setting a password on one needs **one of that patient's own booking
references** (the `DH-XXXXXX` on their confirmation). The sign-up form asks for
it only when the number turns out to have history, and reception can read the
reference out of Desk → Appointments if the patient has lost it.

Without that check, anyone who knew a phone number could set a password on it
and read that patient's name, email, age and every appointment they have had.
It is a one-time proof, not a login — afterwards it is an ordinary password.

### 6. Registration numbers

Doctors' qualifications are shown publicly. Registration numbers are shown only
where entered. Desk → Schedules warns you how many are missing. Enter them from
the hospital's own records — never guess one.

---

## Keeping it running

**A sleeping laptop serves nothing.** macOS suspends every process when the lid
closes or the machine sleeps, so the app is unreachable until it wakes. No
setting inside the app changes that — it is the operating system, not the code.

Three options, worst to best:

1. **Stop the machine sleeping** while it is serving:
   ```bash
   caffeinate -dimsu -w $(pgrep -f "server/src/index.js" | head -1)
   ```
   Works, but the laptop must stay open, awake and plugged in. Fine for a demo,
   not for a hospital.

2. **Restart automatically after a reboot** — see `scripts/install-autostart.sh`.
   The servers come back on login and restart if they crash. They still stop
   while the machine sleeps.

3. **Put it on a server that never sleeps.** This is the real answer, and the
   ₹6,000–18,000/year line in [COSTS.md](COSTS.md). A hospital booking system
   cannot depend on somebody's laptop being open.

---

## Languages

The app runs in **English, Tamil and Hindi**. The switch is in the header and
the choice is remembered per browser; a phone set to Tamil or Hindi gets that
language on first visit without touching anything.

**Coverage is not equal, and that is deliberate.** English and Tamil are
complete. Hindi covers the whole patient journey — finding a doctor, booking,
paying, cancelling, every error message — and falls back to English for the
rest. A missing Hindi string shows the English one; it never shows a broken key.

Check where it stands:

```bash
npm run i18n:check -- --list
```

Still English at the time of writing: the health-tips pages, the privacy notice,
the guided tour, and most glossary definitions. **The privacy notice should be
translated by a person, not generated** — it is the document patients consent
to under the DPDP Act, and a mistranslation there is a legal problem rather
than a cosmetic one.

That same command is worth running after *any* edit to a translation file. It
catches the mistakes this file structure invites:

- a key defined in one language and not another
- a whole value written in the wrong script — Tamil text sitting in the English
  block, which shows an English reader a line of Tamil
- a `{name}` or `{count}` placeholder dropped in translation, which prints
  "Welcome back," with nothing after it
- **the same key written twice** — JavaScript keeps the last one silently, and
  the earlier translation simply disappears

Hindi lives in its own file (`src/i18n/hi.js`). English and Tamil still share
`translations.js` as two long parallel blocks, which is where the misplaced-text
bugs kept coming from. Any language added after Hindi should get its own file.

### Doctor and department names

Names, specialities and department names come from the database, not the
translation files. Hindi versions live in `name_hi` / `spec_hi` /
`description_hi` columns. To fill them in for the current roster:

```bash
cd server && npm run seed-hindi
```

It only writes rows that are still empty, so anything corrected by hand
afterwards is left alone. Run it with `-- --dry` first to see what it would do.

Doctors' names are transliterated into Devanagari, following the convention
already used for Tamil. Qualifications are deliberately left in Latin —
"MBBS, MS (Ortho)" is how the degree is written on the certificate in every
language.

## Reading pages aloud

There is a speaker button on each assistant reply and on each doctor's profile.
It reads in whichever language the app is set to.

It works with no configuration, using the browser's own speech — free, offline,
already on nearly every phone. Setting `ELEVENLABS_API_KEY` upgrades it to
better voices, particularly for Tamil and Hindi. Full detail, including what it
costs and whether it is worth paying for, is in [SPEECH-SETUP.md](SPEECH-SETUP.md).

The button hides itself on a device with no voice for the current language,
rather than reading Tamil with an English engine.

## Getting bookings into Klinique

The hospital's clinical system is at deepan.klinique.net. This app is the
public booking page in front of it, so every booking has to end up there.

**Today, reception moves them across.** Desk → **To enter in Klinique** lists
everything outstanding, with one-tap copy on each field and a tick to mark it
done. The Klinique portal itself is the next tab along, so nobody changes
window.

**Faster: the Chrome extension** in `extension/`. Reception opens Klinique's
appointment form, clicks the extension, and the form fills itself. Install
instructions are in `extension/README.md`; it takes about a minute per
computer, plus a one-off "teach the form" step.

Each computer needs its own token:

```bash
cd server && npm run device -- --new "Reception PC 1"
```

`--list` shows every device and when it was last used; `--revoke <id>` kills
one instantly. A token opens the Klinique worklist and nothing else — not
patient records, not payments — and the audit log records the device, not a
person, so nobody's name ends up against something a script did.

**Automatic, when Klinique allow it.** Ask them for API access — documentation,
an endpoint and a key. Then in `server/.env`:

```
KLINIQUE_MODE=api
KLINIQUE_BASE_URL=https://deepan.klinique.net
KLINIQUE_API_KEY=<their key>
```

Bookings then post themselves and the worklist stays empty except for
failures. The code is written and tested — this is a config change, not a
project.

**Automatic without a key — session mode.** If Klinique will not give you an
API, the server can sign in to their web form and submit each booking itself.
No key, no staff clicking. It is brittle and it uses a Klinique login, so it
comes with conditions — use a dedicated "Website Bookings" account, expect to
re-capture the form if Klinique change it, and know that failures fall back to
the manual worklist so nothing is ever lost. Setup is one `.env` block plus one
captured request: see [server/KLINIQUE-AUTO.md](server/KLINIQUE-AUTO.md). The
login-and-submit flow is tested end to end against a mock; what you supply is
the form's field names, captured once with `npm run klinique-capture`.

**What was deliberately not built:** direct writes into Klinique's database.
That bypasses the validation Klinique's own application depends on, so their
next update corrupts patient records quietly. Session mode talks to the same
form a person would, which is why it is only as fragile as the form and never
worse. Writing to the database behind it is a different order of risk.

## Facts only the hospital knows

Some questions the app cannot answer because nobody has told it the answer. It
says so and offers reception, rather than guessing — a patient told there is
parking who then finds none is worse served than one who was told to ring.

**Parking.** Set `VITE_PARKING_NOTE` in the front-end environment and the
assistant answers with exactly those words:

```
VITE_PARKING_NOTE="Free parking for cars and two-wheelers inside the compound. If the front is full, the security staff will direct you to the rear gate."
```

Rebuild (`npm run build`) after changing it. Leave it unset and the honest
"ask reception" answer stands.

Others worth supplying the same way if patients keep asking: visiting hours,
which entrance to use after 8pm, and whether a particular insurer is accepted.

---

## Backups

Automatic, every 6 hours, into `server/backups/`. The 28 most recent are kept.
Each backup is read back and integrity-checked before it counts.

**They are on the same machine as the database.** That protects you from a bad
migration, not from a dead disk or a stolen laptop. Copy them somewhere else —
another machine, a external drive, cloud storage — on a schedule.

Restore:

```bash
cd server
# stop the server first
cp backups/deepan-<the-one-you-want>.db data/deepan.db
rm -f data/deepan.db-wal data/deepan.db-shm
npm start
```

Take one by hand at any time:

```bash
cd server && npm run backup
```

---

## Accounts

```bash
cd server
npm run create-staff -- --username reception --role staff
npm run create-staff -- --username doctorpriya --role staff --doctor priyanka-v
```

The password is printed **once**. Store it in a password manager immediately.

### Give every doctor a login

Only doctors with a staff account can use the doctor portal. To create one for
each doctor on the roster in a single pass:

```bash
cd server
npm run doctor-logins
```

It creates a login for every doctor who does not have one, prints each username
and password **once**, and leaves existing accounts alone. Add `-- --reset` to
give the existing ones new passwords too.

Usernames follow the doctor convention automatically: `deepan-g` becomes
`doctordeepan-g`. Hand each doctor their own line and nobody else's.

### Changing your own password

Any doctor or receptionist can change their own from inside the app: sign in at
the desk and use the **Password** button in the header. They need their current
password, and every *other* device signed in as them is signed out — the screen
they are standing at stays signed in.

Tell each doctor to do this the first time they sign in. The password you hand
them on a slip of paper should not still be in use a year later.

### Forgotten password

Passwords are salted scrypt hashes. Nobody can look one up — not you, not the
person who wrote this, not whoever runs the server. Set a new one:

```bash
cd server
npm run reset-password -- --username doctordeepan
```

Run it with no arguments to list every account on the server. It prints a new
random password once, and signs out any session still using the old one. To
choose the password yourself rather than have one generated:

```bash
STAFF_PASSWORD='something-long-and-unguessable' npm run reset-password -- --username doctordeepan
```

A username beginning with `doctor` is reserved for accounts linked to a doctor.
This is a naming convention that keeps the sign-in screen honest — it is not a
security control. The security control is `doctor_id` on the staff row, which
is what actually limits a doctor to their own patients.

---

## Who may hold an account

**Account holders must be 18 or over.** A patient under 18 entering their age
is shown a warning and cannot save the profile.

This restricts who holds an account, **not who may be treated**. Paediatrics is
one of the largest departments here — a parent creates the account and books
for their child, entering the child's age on the booking form, which accepts
any age from 0. There is a test that fails if child booking ever breaks.

The reason is not only preference: under the DPDP Act 2023 anyone under 18 is a
child, and processing their data requires verifiable parental consent. An adult
account holder booking on a child's behalf is the arrangement that satisfies
that.

---

## Patient data

Personal data is covered by India's **DPDP Act 2023**. What is already wired:

- **Consent** is recorded per version of the privacy notice, not assumed
- **Export** — a patient can download everything held about them
- **Erasure** — removes name and contact details immediately; clinical records
  the hospital must legally keep remain but stop identifying them
- **Retention** runs daily: cancelled bookings go after 90 days, spent codes and
  expired sessions immediately, audit lines after a year

Tune with `RETAIN_*` in `.env`. If you change the privacy notice wording, bump
`PRIVACY_VERSION` — every patient is then asked to agree again.

**Still your job:** naming a data controller, and answering
`PRIVACY_CONTACT` when somebody writes to it.

---

## Settings worth knowing

All in `server/.env`. Copy `server/.env.example` to start.

| Setting | Default | What happens if you get it wrong |
| --- | --- | --- |
| `BOOKING_APPROVAL` | `desk-hours` | `always` = bookings wait even at 3am with nobody there. `never` = no approval step at all |
| `DESK_OPENS_AT` / `DESK_CLOSES_AT` | `08:00` / `20:00` | When reception is staffed; decides the above |
| `BACKUP_ENABLED` | `true` | `false` means no backups. Do not |
| `OTP_ECHO` | `true` in dev | Sign-in codes shown on screen. **The server refuses to start in production with this on** |
| `COOKIE_SECURE` | on in production | Sessions over plain HTTP if wrong |
| `RAZORPAY_KEY_ID` etc. | unset | Online payment is off; patients pay at the counter. See [PAYMENTS-SETUP.md](PAYMENTS-SETUP.md) |
| `PUBLIC_API_ORIGIN` | unset | Only needed when the API is on a different host from the site. **Wrong or missing and the browser's CSP blocks every API call** |
| `VIDEO_ROOM_SECRET` | unset | Consultation room names become guessable from the appointment reference |
| `ELEVENLABS_API_KEY` | unset | Read-aloud uses the browser's own speech. Setting it buys better voices — see [SPEECH-SETUP.md](SPEECH-SETUP.md) |

### Security headers

The API sends a Content-Security-Policy, HSTS (production only) and the usual
hardening headers. The build stamps the same policy into `dist/index.html`,
because the policy that matters travels with the HTML, not with JSON.

**One thing your static host must add:** `Content-Security-Policy:
frame-ancestors 'none'`. That directive is ignored inside a meta tag, so
without it the app can still be embedded in someone else's page.

The server refuses to start in production with several of these wrong. That is
deliberate — see `server/src/lib/preflight.js`.

---

## When something is wrong

**"No appointments today" but patients say they booked**
Check Desk → New requests. They may be waiting for approval.

**Desk screen not updating**
The chip in the desk header says `Live` or `Checking`. `Checking` means the
live connection dropped and it is polling every 45 seconds instead — still
correct, just slower. If it stays there, check the server is up.

**A patient cannot book any doctor**
Almost always: that doctor has no published schedule. Desk → Schedules.

**Two patients given the same slot**
Should be impossible — a database constraint prevents it, and a test proves it.
If it ever happens, that is a serious bug: keep the database file and the logs.

---

## Things this app does not do

Being straight about this is more useful than a feature list:

- **No SMS.** Nobody is texted about anything. The desk screen is the only alert
- **Online payment is off** until Razorpay keys are set
- **One server, one file.** No redundancy. If the machine is off, the app is down
- **The assistant is not AI.** It matches what you type against the hospital's
  own listings. It cannot reason and will not always understand you
- **Hindi is not complete.** The patient journey is translated; the health tips,
  privacy notice and guided tour still read in English. See **Languages** above
