# Making bookings reach Klinique automatically

There are three ways a booking on the website can end up in Klinique. This
document is about the third — the one that needs no API key and no staff
clicking. Read all three first, because the order matters.

| Mode | Staff effort | Needs from Klinique | How solid |
| --- | --- | --- | --- |
| **manual** | Type each one in | nothing | Rock solid |
| **extension** | One click each | nothing | Solid |
| **session** | None | nothing | Works, but brittle — read below |
| **api** | None | a key | Solid, and the real answer |

Manual and the extension are documented in `../extension/README.md`. `api` is a
two-line switch the day Klinique give you a key. This file is **session mode**:
the server signs in to Klinique's own web form and submits each booking the way
a browser would.

---

## Before you turn it on — three honest points

**1. Use a dedicated Klinique account.** Ask the hospital to make one called
"Website Bookings", not a receptionist's login. Klinique's audit log will then
say *the website* created the appointment, which is true. Point a script at a
person's account and every booking it makes shows *their* name — and when
something looks wrong, they answer for a record they never touched. A dedicated
account also means you can switch this off by disabling one login, without
disturbing anyone.

**2. It can break when Klinique changes their form.** This works by imitating a
browser. The day Klinique rename a field or add a step, the imitation is wrong.
That is the price of automating a system that gave you no API. The design
contains the damage: **any failure leaves the booking on reception's "To enter
in Klinique" list**, exactly as if session mode were off. A booking is never
lost — worst case, it falls back to being typed by hand, and the desk shows it.

**3. It may be against Klinique's terms.** Automating your own account is a
conversation to have with the vendor. In practice that conversation often ends
with them handing you the API — which is `api` mode, and strictly better. Ask
for the key first; use this while you wait.

If those three are acceptable to the hospital, it is a legitimate integration.
If they are not, stay on the extension.

---

## Setting it up

### 1. The login half (works immediately)

```
KLINIQUE_MODE=session
KLINIQUE_BASE_URL=https://deepan.klinique.net
KLINIQUE_USERNAME=<the dedicated account>
KLINIQUE_PASSWORD=<its password>
```

Restart the server. It will sign in to Klinique the way a browser does —
fetching the form, carrying its CSRF token and session cookie, posting the
credentials. On startup it prints which state it is in:

- *"session sign-in is set, but the booking form is not captured yet"* — the
  login works; you still need step 2.
- *"Klinique session mode is active"* — fully working.

### 2. The booking half (one capture)

The appointment form lives behind the login, so its URL and field names cannot
be seen from outside or guessed. Capture them once:

1. Sign in to Klinique in Chrome as the dedicated account.
2. DevTools (⌥⌘I) → **Network** tab → tick **Preserve log**.
3. Create one appointment by hand and press **Save**.
4. In the Network list, find the **POST** request that saving made.
   Right-click it → **Copy** → **Copy as cURL**.
5. Paste it into a file and run:

   ```bash
   npm run klinique-capture -- --file captured.txt
   ```

It prints a `KLINIQUE_BOOKING_PATH` and a `KLINIQUE_FIELD_MAP`, guessing what
each field holds from its name. **Check the guesses** — you are the one who
knows which Klinique field is the phone number — then paste the block into
`server/.env` and restart.

If Klinique uses its own doctor ids, add a translation so the right doctor is
selected:

```
KLINIQUE_DOCTOR_MAP={"deepan-g":"42","gunasekaran-r":"57"}
```

The doctor ids on the left are ours (see `npm run doctor-logins` or the desk);
the numbers on the right are Klinique's, read from their form.

---

## Checking it works

Book a test appointment on the website, then look at the desk's **To enter in
Klinique** tab:

- **It is not there, and it is in Klinique** — working.
- **It is there, marked failed** — the login or a field is wrong. The startup
  log and the server console say which. Fix it; the booking is safe on the list
  meanwhile.

The whole login-and-submit flow is covered by `test/klinique-session.test.js`,
which runs it against a Rails-faithful mock — so the machinery is proven before
it ever meets the real site. What the tests cannot check is your captured field
names; that is what the test booking above is for.

---

## If it starts failing later

Nothing breaks for patients — bookings pile up on the manual worklist and
reception keeps working. To diagnose: re-capture the form (step 2); Klinique
probably changed it. If it keeps happening, that is Klinique telling you to get
the API. Ask them for the key and switch `KLINIQUE_MODE=api`.
