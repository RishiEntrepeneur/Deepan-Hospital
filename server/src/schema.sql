-- Deepan Hospital — application schema.
-- SQLite dialect (node:sqlite). Written to port cleanly to Postgres later:
-- no SQLite-only column types, ISO-8601 text timestamps, explicit constraints.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

/* ------------------------------------------------------------------ *
 * Catalogue
 * ------------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS departments (
  id            TEXT PRIMARY KEY,
  name_en       TEXT NOT NULL,
  name_ta       TEXT NOT NULL,
  description_en TEXT NOT NULL DEFAULT '',
  description_ta TEXT NOT NULL DEFAULT '',
  icon          TEXT NOT NULL DEFAULT 'Stethoscope',
  sort_order    INTEGER NOT NULL DEFAULT 100,
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS doctors (
  id             TEXT PRIMARY KEY,
  department_id  TEXT NOT NULL REFERENCES departments(id),
  name_en        TEXT NOT NULL,
  name_ta        TEXT NOT NULL DEFAULT '',
  grade          TEXT NOT NULL DEFAULT 'consultant',
  spec_en        TEXT NOT NULL,
  spec_ta        TEXT NOT NULL DEFAULT '',
  qualification  TEXT NOT NULL DEFAULT '',

  -- Nullable on purpose. An unverified registration number must stay empty
  -- rather than be guessed; the UI hides the field when it is null.
  reg_no         TEXT,
  experience     INTEGER,
  fee            INTEGER,
  room           TEXT,

  languages      TEXT NOT NULL DEFAULT '["ta","en"]',   -- JSON array
  days           TEXT,                                   -- JSON array of 0-6, null = not set
  morning_start  TEXT,
  morning_end    TEXT,
  evening_start  TEXT,
  evening_end    TEXT,

  -- 'live'    → online slot booking is open
  -- 'pending' → listed, but timings not yet supplied; patients request a callback
  -- 'offline' → seen by referral only, not bookable online
  booking_mode   TEXT NOT NULL DEFAULT 'pending'
                 CHECK (booking_mode IN ('live', 'pending', 'offline')),

  featured       INTEGER NOT NULL DEFAULT 0,
  active         INTEGER NOT NULL DEFAULT 1,
  sort_order     INTEGER NOT NULL DEFAULT 100,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_doctors_department ON doctors(department_id, active);

/* ------------------------------------------------------------------ *
 * People
 * ------------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS patients (
  id            TEXT PRIMARY KEY,
  phone         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL DEFAULT '',
  email         TEXT,
  age           INTEGER,
  gender        TEXT,
  -- DPDP Act 2023: consent must be recorded, not assumed. Null means the
  -- patient signed up before consent was captured and will be asked again.
  consent_at    TEXT,
  consent_version TEXT,

  created_at    TEXT NOT NULL,
  last_login_at TEXT,
  -- Set when a patient asks to be erased. The row is emptied immediately and
  -- removed by the retention job once no live appointment refers to it.
  erased_at     TEXT
);

CREATE TABLE IF NOT EXISTS staff (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('staff', 'admin')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS otp_codes (
  id          TEXT PRIMARY KEY,
  phone       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  code_salt   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,
  created_at  TEXT NOT NULL,
  ip          TEXT
);

CREATE INDEX IF NOT EXISTS ix_otp_phone ON otp_codes(phone, created_at);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  subject_id  TEXT NOT NULL,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('patient', 'staff')),
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  user_agent  TEXT,
  ip          TEXT
);

CREATE INDEX IF NOT EXISTS ix_sessions_subject ON sessions(subject_id);

/* ------------------------------------------------------------------ *
 * Appointments
 * ------------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS appointments (
  id             TEXT PRIMARY KEY,          -- public reference, e.g. DH-K7P2QM
  patient_id     TEXT REFERENCES patients(id),
  doctor_id      TEXT NOT NULL REFERENCES doctors(id),
  department_id  TEXT NOT NULL REFERENCES departments(id),

  kind           TEXT NOT NULL DEFAULT 'slot'
                 CHECK (kind IN ('slot', 'callback')),
  date           TEXT,                      -- 'YYYY-MM-DD', null for callback requests
  slot           TEXT,                      -- 'HH:MM'
  session        TEXT CHECK (session IN ('morning', 'evening')),

  fee            INTEGER,
  -- 'pending'   — booked online, waiting for the desk to approve it
  -- 'confirmed' — approved; the patient is expected
  -- 'requested' — a callback request, no slot held
  status         TEXT NOT NULL DEFAULT 'confirmed'
                 CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'requested')),

  patient_name   TEXT NOT NULL,
  patient_age    INTEGER NOT NULL,
  patient_phone  TEXT NOT NULL,
  patient_gender TEXT NOT NULL,
  reason         TEXT NOT NULL DEFAULT '',

  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  cancelled_at   TEXT,
  rescheduled_at TEXT
);

-- The single most important constraint in the app: one live booking per
-- doctor per slot, enforced by the database rather than by application code.
-- 'pending' is in here for a reason: a booking waiting for the desk to
-- approve it must hold its slot exactly as firmly as an approved one, or two
-- patients could each be told 8:30 and only find out at the counter.
CREATE UNIQUE INDEX IF NOT EXISTS ux_appointment_slot
  ON appointments(doctor_id, date, slot)
  WHERE status IN ('pending', 'confirmed', 'completed') AND kind = 'slot';

CREATE INDEX IF NOT EXISTS ix_appointments_patient ON appointments(patient_id, date);
CREATE INDEX IF NOT EXISTS ix_appointments_doctor_date ON appointments(doctor_id, date);

/* ------------------------------------------------------------------ *
 * Payments
 * ------------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS payments (
  id                TEXT PRIMARY KEY,
  appointment_id    TEXT NOT NULL REFERENCES appointments(id),
  provider          TEXT NOT NULL,           -- 'razorpay' | 'counter'
  provider_order_id TEXT,
  provider_ref      TEXT,                    -- gateway payment id
  amount            INTEGER NOT NULL,        -- paise
  currency          TEXT NOT NULL DEFAULT 'INR',
  status            TEXT NOT NULL
                    CHECK (status IN ('created', 'paid', 'failed', 'pending', 'refunded')),
  method            TEXT,
  instrument_hint   TEXT,                    -- masked only, never a full instrument
  created_at        TEXT NOT NULL,
  paid_at           TEXT
);

CREATE INDEX IF NOT EXISTS ix_payments_appointment ON payments(appointment_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_payments_order
  ON payments(provider_order_id) WHERE provider_order_id IS NOT NULL;

/* ------------------------------------------------------------------ *
 * Audit — who changed what. Health data needs a trail.
 * ------------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL,
  actor_type  TEXT NOT NULL,
  actor_id    TEXT,
  action      TEXT NOT NULL,
  entity      TEXT,
  entity_id   TEXT,
  detail      TEXT,
  ip          TEXT
);

CREATE INDEX IF NOT EXISTS ix_audit_entity ON audit_log(entity, entity_id);

/* ------------------------------------------------------------------ *
 * Doctor contact details.
 *
 * A separate table, not columns on `doctors`: a consultant's personal mobile
 * has a different consent, access and retention life from a roster row that
 * every anonymous visitor reads through GET /api/catalog. Contact data must
 * never travel that path.
 * ------------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS doctor_contacts (
  doctor_id    TEXT PRIMARY KEY REFERENCES doctors(id),
  phone        TEXT,
  phone_hint   TEXT,                       -- '•••••3210' — the only form any API returns
  verified_at  TEXT,                       -- NULL blocks all delivery
  notify_sms   INTEGER NOT NULL DEFAULT 1,
  lang         TEXT NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'ta')),
  consent_at   TEXT,                       -- DPDP: the doctor agreed to be contacted
  consent_by   TEXT REFERENCES staff(id),
  consent_note TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

-- Partial, so clearing a number never blocks re-entering it later.
CREATE UNIQUE INDEX IF NOT EXISTS ux_doctor_contacts_phone
  ON doctor_contacts(phone) WHERE phone IS NOT NULL;

/* ------------------------------------------------------------------ *
 * Notification outbox.
 *
 * Store-and-forward: routes enqueue a row and return immediately, a worker
 * delivers. No rendered message body and no recipient address are stored —
 * both are resolved at send time — so this table never becomes a second,
 * unaudited copy of patient data.
 * ------------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS notifications (
  id             TEXT PRIMARY KEY,
  event          TEXT NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('doctor', 'desk', 'patient')),
  recipient_id   TEXT,
  appointment_id TEXT REFERENCES appointments(id),
  channel        TEXT NOT NULL DEFAULT 'sms',
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts       INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  address_hint   TEXT,                     -- masked only, filled in on send
  last_error     TEXT,
  dedupe_key     TEXT,
  created_at     TEXT NOT NULL,
  sent_at        TEXT
);

-- One notification per event per recipient per appointment, so a retry storm
-- or a double-submit cannot text a consultant twice.
CREATE UNIQUE INDEX IF NOT EXISTS ux_notifications_dedupe
  ON notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_notifications_due
  ON notifications(status, next_attempt_at);

/* ================================================================== *
 * Clinical layer: queue tokens, prescriptions, records, teleconsult.
 * ================================================================== */

/* ---- Wayfinding: where a department physically is ---- */
-- (block/floor/directions added to `departments` by the column migration in db.js)

/* ------------------------------------------------------------------ *
 * OPD queue.
 *
 * Indian OPDs run on token numbers and rough sessions, not exact slots.
 * A queue_session is one doctor's sitting; tokens are issued against it.
 * ------------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS queue_sessions (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id),
  date          TEXT NOT NULL,
  session       TEXT NOT NULL CHECK (session IN ('morning', 'evening')),
  status        TEXT NOT NULL DEFAULT 'scheduled'
                CHECK (status IN ('scheduled', 'running', 'paused', 'closed')),
  current_token INTEGER NOT NULL DEFAULT 0,
  last_issued   INTEGER NOT NULL DEFAULT 0,
  avg_minutes   INTEGER NOT NULL DEFAULT 10,
  started_at    TEXT,
  closed_at     TEXT,
  note          TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_queue_session
  ON queue_sessions(doctor_id, date, session);

CREATE TABLE IF NOT EXISTS tokens (
  id             TEXT PRIMARY KEY,
  queue_id       TEXT NOT NULL REFERENCES queue_sessions(id),
  appointment_id TEXT REFERENCES appointments(id),
  number         INTEGER NOT NULL,
  kind           TEXT NOT NULL DEFAULT 'booked' CHECK (kind IN ('booked', 'walkin')),
  status         TEXT NOT NULL DEFAULT 'waiting'
                 CHECK (status IN ('waiting', 'called', 'in_consult', 'done', 'skipped')),
  patient_name   TEXT NOT NULL DEFAULT '',
  called_at      TEXT,
  done_at        TEXT,
  created_at     TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_token_number ON tokens(queue_id, number);
CREATE UNIQUE INDEX IF NOT EXISTS ux_token_appointment
  ON tokens(appointment_id) WHERE appointment_id IS NOT NULL;

/* ------------------------------------------------------------------ *
 * Prescriptions
 * ------------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS prescriptions (
  id             TEXT PRIMARY KEY,
  appointment_id TEXT REFERENCES appointments(id),
  patient_id     TEXT NOT NULL REFERENCES patients(id),
  doctor_id      TEXT NOT NULL REFERENCES doctors(id),
  diagnosis      TEXT NOT NULL DEFAULT '',
  advice         TEXT NOT NULL DEFAULT '',
  follow_up_on   TEXT,
  created_at     TEXT NOT NULL,
  created_by     TEXT REFERENCES staff(id)
);

CREATE INDEX IF NOT EXISTS ix_prescriptions_patient ON prescriptions(patient_id, created_at);

CREATE TABLE IF NOT EXISTS prescription_items (
  id              TEXT PRIMARY KEY,
  prescription_id TEXT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  drug            TEXT NOT NULL,
  strength        TEXT NOT NULL DEFAULT '',
  dose            TEXT NOT NULL DEFAULT '',
  frequency       TEXT NOT NULL DEFAULT '',
  duration        TEXT NOT NULL DEFAULT '',
  instructions    TEXT NOT NULL DEFAULT '',
  sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_items_prescription ON prescription_items(prescription_id, sort_order);

/* ------------------------------------------------------------------ *
 * Medical records — lab, imaging, discharge summaries, notes.
 *
 * `body` holds the result text. Files live outside the database with only a
 * relative path stored, so the DB never becomes a blob store.
 * ------------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS medical_records (
  id             TEXT PRIMARY KEY,
  patient_id     TEXT NOT NULL REFERENCES patients(id),
  appointment_id TEXT REFERENCES appointments(id),
  doctor_id      TEXT REFERENCES doctors(id),
  kind           TEXT NOT NULL
                 CHECK (kind IN ('lab', 'imaging', 'discharge', 'note', 'vaccination')),
  title          TEXT NOT NULL,
  body           TEXT NOT NULL DEFAULT '',
  file_path      TEXT,
  recorded_on    TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  created_by     TEXT REFERENCES staff(id)
);

CREATE INDEX IF NOT EXISTS ix_records_patient ON medical_records(patient_id, recorded_on);

/* ------------------------------------------------------------------ *
 * Teleconsultation sessions.
 *
 * Provider-agnostic: `join_url` may come from a configured video provider or
 * simply be a meeting link the desk pastes in, so this works before any
 * video vendor is chosen.
 * ------------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS consult_sessions (
  id             TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL REFERENCES appointments(id),
  mode           TEXT NOT NULL DEFAULT 'video' CHECK (mode IN ('video', 'audio')),
  provider       TEXT NOT NULL DEFAULT 'manual',
  join_url       TEXT,
  doctor_url     TEXT,
  status         TEXT NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  started_at     TEXT,
  ended_at       TEXT,
  created_at     TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_consult_appointment ON consult_sessions(appointment_id);

/* ------------------------------------------------------------------ *
 * Repeat prescription requests.
 *
 * A patient on long-term medication asks for the same prescription again.
 * It is never issued automatically: a doctor approves or declines, and
 * approval writes a NEW prescription rather than extending the old one, so
 * the record always shows who authorised what and when.
 * ------------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS repeat_requests (
  id              TEXT PRIMARY KEY,
  prescription_id TEXT NOT NULL REFERENCES prescriptions(id),
  patient_id      TEXT NOT NULL REFERENCES patients(id),
  doctor_id       TEXT NOT NULL REFERENCES doctors(id),
  status          TEXT NOT NULL DEFAULT 'requested'
                  CHECK (status IN ('requested', 'approved', 'declined')),
  patient_note    TEXT NOT NULL DEFAULT '',
  decision_note   TEXT NOT NULL DEFAULT '',
  issued_id       TEXT REFERENCES prescriptions(id),
  created_at      TEXT NOT NULL,
  actioned_at     TEXT,
  actioned_by     TEXT REFERENCES staff(id)
);

-- One open request per prescription, so a patient tapping twice does not
-- put two identical asks in front of the doctor.
CREATE UNIQUE INDEX IF NOT EXISTS ux_repeat_open
  ON repeat_requests(prescription_id) WHERE status = 'requested';

CREATE INDEX IF NOT EXISTS ix_repeats_doctor ON repeat_requests(doctor_id, status);

/* ------------------------------------------------------------------ *
 * Reception devices — the Chrome extension, and anything like it.
 *
 * A browser extension cannot ride on the staff session cookie. That cookie
 * is SameSite=strict, so the browser refuses to attach it to a request made
 * from a chrome-extension:// page. Weakening the cookie would weaken every
 * request in the app to fix one; instead each reception computer gets its
 * own bearer token.
 *
 * Only the SHA-256 of the token is stored, exactly as for sessions — the
 * raw value exists once, at the moment it is issued. A token opens the
 * Klinique worklist and nothing else: it cannot see patient records, take
 * payments or create staff. Revoking one takes effect on the next request.
 * ------------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS desk_devices (
  id           TEXT PRIMARY KEY,
  label        TEXT NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   TEXT NOT NULL,
  created_by   TEXT REFERENCES staff(id),
  last_used_at TEXT,
  revoked_at   TEXT
);

/* ------------------------------------------------------------------ *
 * Patient reviews.
 *
 * Every review hangs off one real, completed appointment — so only a patient
 * who actually visited can leave one, and only once per visit (appointment_id
 * is UNIQUE). Nothing a patient writes appears on the public site until a staff
 * member approves it: `status` starts at 'pending' and the front end only ever
 * shows 'approved'. That keeps spam and anything hurtful off a hospital's page
 * without turning away genuine feedback.
 *
 * patient_id is nullable so an erased patient's row can be unlinked rather than
 * blocking erasure; in practice the retention job deletes the review outright.
 * doctor_id is denormalised for display and to show a doctor their own reviews.
 * ------------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS reviews (
  id             TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL UNIQUE REFERENCES appointments(id),
  patient_id     TEXT REFERENCES patients(id),
  doctor_id      TEXT REFERENCES doctors(id),
  rating         INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT NOT NULL DEFAULT '',
  display_name   TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at     TEXT NOT NULL,
  moderated_at   TEXT,
  moderated_by   TEXT REFERENCES staff(id)
);

-- Moderation reads pending oldest-first; the public page reads approved
-- newest-first. One index by status covers both.
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status, created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_doctor ON reviews(doctor_id, status);
