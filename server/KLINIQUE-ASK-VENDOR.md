# The email to send Klinique

This is the single highest-value thing anyone can do for the website→Klinique
link. One reply from them settles which kind of automation you get, and two of
the three answers are better and more durable than anything we can build from
the outside.

Send it to Klinique support / your account manager. Fill in the two brackets.

---

**Subject:** Automated appointment booking from our hospital website

Hello,

We are Deepan Hospital (Klinique account: [your account name / hospital code]).
We have built a public website where patients book appointments, and we want
those bookings to appear in Klinique automatically rather than being re-typed
by our reception staff.

Could you tell us which of these you can provide:

1. **A public patient self-booking module or embeddable widget.** If our
   subscription includes (or can include) a patient-facing booking page — for
   example a link like `booking.klinique.net/deepan` or a widget we can place
   on our site — that would be ideal. Patients would book directly and it would
   sync into our schedule with no work on our side.

2. **An API for creating appointments.** If there is a documented endpoint we
   can call to create an appointment programmatically, please send the
   documentation and issue us an API key. We would use a dedicated integration
   account for this.

3. **Permission to submit through our own authenticated account.** If neither
   of the above is available, may we submit bookings automatically using a
   dedicated staff login we create for this purpose (e.g. "Website Bookings")?
   We want to confirm this is acceptable under our agreement before relying on
   it.

For contact: [your name], [phone], [email].

Thank you,
[your name], Deepan Hospital

---

## What each answer means for us

- **They say yes to #1** — best outcome. We embed their link/widget and delete
  all the sync machinery. Nothing to maintain.
- **They say yes to #2** — nearly as good. Set `KLINIQUE_MODE=api` with the key
  they give you (see `.env.example`), and bookings post themselves through an
  interface they support.
- **They say yes to #3** — we already have this built: `KLINIQUE_MODE=session`
  (see `KLINIQUE-AUTO.md`). Their yes is what makes it safe to switch on.
- **They say no to everything** — session mode still works, but now you know it
  is unsupported, so keep the manual worklist as the safety net (it already is).
