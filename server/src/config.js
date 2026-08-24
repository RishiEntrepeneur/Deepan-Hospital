import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))

const bool = (value, fallback = false) =>
  value === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),

  /** Where the SQLite file lives. Override with DATABASE_FILE. */
  databaseFile: process.env.DATABASE_FILE ?? path.join(here, '..', 'data', 'deepan.db'),

  /*
   * Where a patient's uploaded photos and reports are written.
   *
   * Beside the database rather than inside the code folder, for the same
   * reason: a deploy replaces the code wholesale, and a patient's wound
   * photograph must not be something a routine update can delete. Defaults to
   * an `uploads` folder next to the database file so it inherits whatever the
   * server was pointed at.
   */
  uploadDir:
    process.env.UPLOAD_DIR ??
    path.join(path.dirname(process.env.DATABASE_FILE ?? path.join(here, '..', 'data', 'deepan.db')), 'uploads'),

  /** Browsers allowed to call the API with credentials. */
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  session: {
    /*
     * Patients and staff hold SEPARATE cookies.
     * One shared cookie meant signing in at the desk silently signed you out
     * as a patient — and a doctor is often also a patient of their own
     * hospital. Two cookies let both sessions coexist in one browser.
     */
    patientCookie: 'dh_session',
    staffCookie: 'dh_staff',
    /** 30 days. */
    ttlMs: Number(process.env.SESSION_TTL_MS ?? 30 * 24 * 60 * 60 * 1000),
    secure: bool(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production'),
  },

  otp: {
    length: 6,
    ttlMs: Number(process.env.OTP_TTL_MS ?? 5 * 60 * 1000),
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
    /** Max OTP requests per phone per hour. */
    perPhonePerHour: Number(process.env.OTP_PER_PHONE_PER_HOUR ?? 5),
    /*
     * With no delivery channel there is nowhere to send a code, so it is
     * returned in the response and printed to the log. That is fine for
     * development and for staff-assisted use, and is refused outright in
     * production by preflight() — see the note on patient sign-in there.
     */
    echoInResponse: bool(process.env.OTP_ECHO, true),
  },

  payments: {
    /** 'razorpay' when keys are present, otherwise counter-only. */
    provider: process.env.RAZORPAY_KEY_ID ? 'razorpay' : 'none',
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID,
      keySecret: process.env.RAZORPAY_KEY_SECRET,
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    },
    /** Added to online payments, in rupees. */
    convenienceFee: Number(process.env.CONVENIENCE_FEE ?? 20),
  },

  notify: {
    /*
     * Notifications are delivered in-app to the reception desk feed.
     * There is no SMS gateway: that meant DLT registration, template approval
     * and a per-message cost, for something the desk reads on screen anyway.
     */
    channel: 'desk',
    /** How often the outbox worker runs. */
    pollMs: Number(process.env.NOTIFY_POLL_MS ?? 15_000),
    /*
     * The desk feed is behind a staff login and shows the booking anyway, so
     * the patient's name is included here — unlike an SMS to a personal
     * handset, this does not leave the hospital's own systems.
     */
    includePatientName: bool(process.env.NOTIFY_INCLUDE_PATIENT_NAME, true),
  },

  video: {
    /*
     * 'manual' — staff paste any meeting link (Meet, Zoom, WhatsApp).
     * 'jitsi'  — rooms are generated automatically. Free, no account, no SDK.
     * A paid provider can be added later without changing the patient side.
     */
    provider: process.env.VIDEO_PROVIDER ?? 'jitsi',
    jitsiHost: process.env.JITSI_HOST ?? 'meet.jit.si',
    /*
     * Jitsi rooms are public to anyone who knows the name, so the name must be
     * unguessable. It is derived from the appointment id with this secret —
     * set it, or room names become predictable from the reference printed on
     * the patient's slip.
     */
    roomSecret: process.env.VIDEO_ROOM_SECRET ?? '',
  },

  desk: {
    /*
     * When reception is actually staffed. Used to decide whether a new online
     * booking should wait for approval or be confirmed outright — see
     * lib/deskHours.js. Interpreted in config.hospital.timezone.
     */
    opensAt: process.env.DESK_OPENS_AT ?? '08:00',
    closesAt: process.env.DESK_CLOSES_AT ?? '20:00',
  },

  booking: {
    /*
     * 'desk-hours' — hold for approval only while reception is staffed
     * 'always'     — every online booking waits for approval
     * 'never'      — every online booking is confirmed immediately
     */
    approval: process.env.BOOKING_APPROVAL ?? 'desk-hours',
    slotMinutes: Number(process.env.SLOT_MINUTES ?? 20),
    windowDays: Number(process.env.BOOKING_WINDOW_DAYS ?? 30),
    /** Minutes of notice required for a same-day booking. */
    leadMinutes: Number(process.env.BOOKING_LEAD_MINUTES ?? 30),
    /*
     * Case-sheet charge, added to the doctor's consultation fee.
     *
     * A new patient needs a file opened, which costs more than pulling an
     * existing one — so a first visit is charged more than a review. These are
     * hospital-wide: they do not vary by doctor, because the charge is for the
     * paperwork rather than the consultation.
     *
     * Set to 0 to switch either off entirely.
     */
    visitCharges: {
      first: Number(process.env.FIRST_VISIT_CHARGE ?? 50),
      review: Number(process.env.REVIEW_CHARGE ?? 20),
    },
  },

  klinique: {
    /*
     * The hospital's clinical system at deepan.klinique.net, which holds the
     * physician portal and reception desk. This app is the public booking page
     * in front of it.
     *
     * 'manual' — the default and what runs today. Bookings are flagged for
     *            reception to enter, and ticked off when they have. Needs
     *            nothing from the vendor.
     * 'api'    — bookings are POSTed to Klinique. Needs a base URL and key the
     *            hospital must obtain from Klinique; there is no public
     *            documentation, and guessing an endpoint is not an option when
     *            the payload is a patient record.
     *
     * The auth header name is configurable because Klinique's own choice is
     * unknown until they document it — correcting it must not need a code
     * change.
     */
    mode: process.env.KLINIQUE_MODE ?? 'manual',
    baseUrl: process.env.KLINIQUE_BASE_URL ?? '',
    apiKey: process.env.KLINIQUE_API_KEY ?? '',
    appointmentPath: process.env.KLINIQUE_APPOINTMENT_PATH ?? '/api/appointments',
    authHeader: process.env.KLINIQUE_AUTH_HEADER ?? 'X-API-Key',
    /** Short: a patient is waiting on the confirmation screen. */
    timeoutMs: Number(process.env.KLINIQUE_TIMEOUT_MS ?? 5000),
    /** Shown at the desk so reception can open Klinique in a tab. */
    portalUrl: process.env.KLINIQUE_PORTAL_URL ?? 'https://deepan.klinique.net',

    /*
     * 'session' mode — the automation you asked for when Klinique will not give
     * you an API. The server signs in to Klinique's own web form the way a
     * browser does (fetch the page, carry its CSRF token and session cookie,
     * POST the credentials), then submits each booking through the appointment
     * form the same way. See lib/klinique-session.js.
     *
     * Use a DEDICATED Klinique account for this, not a person's — e.g. one
     * called "Website Bookings". Then the audit log truthfully says the website
     * created the appointment, you can revoke it without disturbing staff, and
     * no receptionist is answering for records a script made. That single
     * choice is what turns this from a liability into a supportable integration.
     *
     * The one thing that cannot be guessed is the appointment form's own URL
     * and field names — they live behind the login and differ per Klinique
     * build. Capture them once (DevTools → Network → make one booking by hand →
     * copy the POST) into KLINIQUE_BOOKING_PATH and a field map. Until they are
     * set, session mode falls back to the manual worklist and loses nothing.
     */
    username: process.env.KLINIQUE_USERNAME ?? '',
    password: process.env.KLINIQUE_PASSWORD ?? '',
    /*
     * Klinique has two sign-in doors with different form fields:
     *   'user'   → /users/sign_in,   user[login] / user[password]     (staff)
     *   'doctor' → /doctors/sign_in, doctor[login] / doctor[password]  (physicians)
     * A website-booking account is normally a staff 'user'. If sign-in is
     * refused for an account you know is correct, it is probably the other door.
     */
    loginScope: (process.env.KLINIQUE_LOGIN_SCOPE ?? 'user').toLowerCase() === 'doctor' ? 'doctor' : 'user',
    loginPath:
      process.env.KLINIQUE_LOGIN_PATH ??
      ((process.env.KLINIQUE_LOGIN_SCOPE ?? 'user').toLowerCase() === 'doctor'
        ? '/doctors/sign_in'
        : '/users/sign_in'),
    bookingPath: process.env.KLINIQUE_BOOKING_PATH ?? '',
    bookingNewPath: process.env.KLINIQUE_BOOKING_NEW_PATH ?? '',
    /*
     * How the booking maps onto Klinique's form fields, as JSON:
     *   {"appointment[patient_name]":"name","appointment[phone]":"phone", ...}
     * Key = the exact field name in Klinique's form; value = which piece of the
     * booking to put there (name, phone, age, gender, date, time, reason,
     * doctorRef, ref). Filled in from one captured request.
     */
    fieldMap: process.env.KLINIQUE_FIELD_MAP ?? '',
    /*
     * How to tell a Klinique doctor id from ours. JSON: {"deepan-g":"42",...}.
     *
     * A doctor missing from this map is NOT submitted automatically — the
     * booking stays on reception's worklist. Klinique's physician field is a
     * type-ahead over a directory far larger than Deepan's own list, with
     * near-duplicate names in it, so an id we are unsure of is an appointment
     * under the wrong doctor's name. That is the one failure here that a
     * patient would discover by being seen by a stranger.
     */
    doctorMap: process.env.KLINIQUE_DOCTOR_MAP ?? '',
    /*
     * Klinique's own code for each gender, as JSON: {"female":"1","male":"2"}.
     *
     * Deliberately empty by default. On Deepan's build the quick-registration
     * form uses 1 = Female and 2 = Male — inverted from the obvious order —
     * but a different build may want the plain word, and the two are
     * indistinguishable from outside. While this is unset, any booking whose
     * form maps a gender field goes to the worklist instead of being guessed:
     * the wrong sex on a medical record is not a cosmetic error.
     */
    genderMap: process.env.KLINIQUE_GENDER_MAP ?? '',
    /*
     * Klinique's "text the patient" checkboxes on the booking form. They are
     * set explicitly on every submit — off unless KLINIQUE_SEND_SMS says
     * otherwise — so a re-captured field map can never quietly start texting
     * real people from a test booking.
     */
    smsFields:
      process.env.KLINIQUE_SMS_FIELDS ??
      'send_sms[op_app_confirmation],send_sms[op_app_reminder]',
    sendSms: bool(process.env.KLINIQUE_SEND_SMS, false),
    /** Longer than the API timeout: a login plus a form post is two round trips. */
    sessionTimeoutMs: Number(process.env.KLINIQUE_SESSION_TIMEOUT_MS ?? 12000),
  },

  backup: {
    /*
     * On by default. The failure this prevents — one disk, one file, no copy —
     * is total and unrecoverable, so it should not need switching on.
     */
    enabled: bool(process.env.BACKUP_ENABLED, true),
    everyHours: Number(process.env.BACKUP_EVERY_HOURS ?? 6),
    keep: Number(process.env.BACKUP_KEEP ?? 28),
    directory: process.env.BACKUP_DIR ?? path.join(here, '..', 'backups'),
  },

  privacy: {
    /*
     * How long records are kept. Medical records in India are generally
     * retained for at least three years (Medical Council regulations), so the
     * default deletes only what nobody is required to hold: cancelled and
     * long-past bookings, spent OTPs and stale sessions.
     */
    version: process.env.PRIVACY_VERSION ?? '2026-08-05',
    /*
     * Where a patient writes to exercise their DPDP rights.
     *
     * Documented in .env.example and read by nothing until now — the page fell
     * back to the general enquiries address. Those are often different people:
     * under the Act this one has to reach somebody who can actually action an
     * access or erasure request.
     */
    contact: process.env.PRIVACY_CONTACT ?? null,
    auditDays: Number(process.env.RETAIN_AUDIT_DAYS ?? 365),
    cancelledDays: Number(process.env.RETAIN_CANCELLED_DAYS ?? 90),
    notificationDays: Number(process.env.RETAIN_NOTIFICATION_DAYS ?? 90),
    /** Contact the patient can write to about their data. */
    contactEmail: process.env.PRIVACY_CONTACT ?? process.env.HOSPITAL_EMAIL ?? 'dnhtrichy@gmail.com',
  },

  /*
   * Absolute origin the browser calls, when the API is not served from the
   * same host as the site. It has to appear in connect-src or the browser
   * blocks every request and the app looks entirely broken.
   */
  publicApiOrigin: process.env.PUBLIC_API_ORIGIN ?? null,

  hospital: {
    name: process.env.HOSPITAL_NAME ?? 'Deepan Hospital',
    timezone: process.env.TIMEZONE ?? 'Asia/Kolkata',
  },
}

export const isProduction = config.env === 'production'
