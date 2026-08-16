# Deepan Hospital → Klinique

A Chrome extension that fills a booking from the hospital website into
Klinique's appointment form. One click per booking, no typing.

It exists because Klinique has no API the hospital can use yet. When they
provide one, this becomes unnecessary — set `KLINIQUE_MODE=api` on the server
and bookings post themselves.

---

## What it does, and what it deliberately does not

**Does:** reads the list of bookings waiting to be entered, fills the fields on
Klinique's form, and marks each one done.

**Does not log in.** Reception is already signed in as themselves, in their own
browser. No password is stored anywhere in this extension, and Klinique's audit
log correctly records that a named receptionist created the appointment.

**Does not press Save.** It fills the form and stops. A person looks at it and
saves. That step is what stops a mis-mapped field becoming a wrong patient
record, and it costs a second.

---

## Installing it

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose this `extension` folder.
4. Pin the extension so its icon is visible.

Repeat on each reception computer. There is nothing to publish and no account
to create.

### Give the computer a token

The extension cannot use the staff sign-in cookie. That cookie is
`SameSite=strict` — a deliberate choice, because this app holds payment and
medical records — and a browser will not attach it to a request coming from a
`chrome-extension://` page. So each reception computer gets its own token.

On the server:

```bash
cd server && npm run device -- --new "Reception PC 1"
```

It prints a token starting `dhk_`. Paste it into the extension's
**Connection** box along with the address of the hospital app, and press
**Save**. Chrome will ask for permission to talk to that address — say yes.

The token is shown once and stored only as a hash. If it is lost, revoke that
device and issue another:

```bash
cd server && npm run device -- --list
cd server && npm run device -- --revoke <id>
```

A revoked token stops working on its very next request.

**What the token can do:** read the list of bookings waiting to be entered,
and tick one off. That is all. It cannot open patient records, take a payment,
or create a staff account — there are tests that hold it to that.

---

## Using it

**First time — teach it the form (once per computer):**

1. In Klinique, open the page where you would normally add an appointment.
2. Click the extension icon → **Teach the form**.
3. A green bar appears asking for one field at a time — *"Click the field for:
   Patient's name"*. Click that box on the Klinique page. Repeat for each.
4. It remembers. Press `Esc` at any point to stop.

**Every time after:**

1. Open Klinique's appointment form.
2. Click the extension icon. The bookings waiting to be entered are listed.
3. Click **Fill this form** on one — the fields populate and flash green.
4. Check it looks right and press **Save** in Klinique.
5. Click **Mark entered** so it drops off the list.

---

## When something looks wrong

**"Could not reach the app"** — check the address in the Connection box and
that the hospital app is actually running.

**"Token rejected"** — the token was revoked, mistyped, or belongs to a
different installation. Issue a new one with `npm run device -- --new`.

**A field stayed empty** — the popup names which ones it could not fill. Either
Klinique changed the page, or that field was not taught. Run **Teach the form
again**; it takes under a minute.

**A dropdown did not select** — the extension matches the option by its text.
If Klinique writes "M / F" where the booking says "male", set that one by hand
or teach a different field.

**Nothing happens at all** — the extension only works on `deepan.klinique.net`.
Check you are on that site and not a different tab.

---

## Why not a bot that logs in by itself

That was considered and rejected. It would need a real staff password stored on
a server, and every appointment it created would appear in Klinique's audit log
under that person's name — so when something looked wrong, the record would say
a receptionist did it, and she would have to explain something she never did.
It also fails silently: a renamed field means half-filled records submitted at
3am with nobody watching.

This keeps a human in the loop for the one second that matters, and stores no
credentials at all.
