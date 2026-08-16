import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'

const here = path.dirname(fileURLToPath(import.meta.url))

fs.mkdirSync(path.dirname(config.databaseFile), { recursive: true })

export const db = new DatabaseSync(config.databaseFile)

db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')
db.exec('PRAGMA busy_timeout = 5000')

/** Applies schema.sql. Safe to run repeatedly — every statement is IF NOT EXISTS. */
export function migrate() {
  const sql = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8')
  db.exec(sql)
}

/*
 * Run it here, at module scope.
 *
 * Route modules build their prepared statements at import time, and ESM
 * evaluates every import before the importing module's own body. So a
 * migrate() call in index.js runs *after* routes/auth.js has already done
 * db.prepare('… audit_log …') — which on a fresh database throws
 * "no such table" and the server cannot boot to create the tables it needs.
 * Migrating on first import of this module is the only ordering that works.
 */
/**
 * Columns added to existing tables after the fact.
 * SQLite has no ADD COLUMN IF NOT EXISTS, so each is checked first.
 */
function addColumns() {
  const additions = [
    ['staff', 'doctor_id', 'TEXT REFERENCES doctors(id)'],
    ['departments', 'block', "TEXT NOT NULL DEFAULT ''"],
    ['departments', 'floor', "TEXT NOT NULL DEFAULT ''"],
    ['departments', 'directions_en', "TEXT NOT NULL DEFAULT ''"],
    ['departments', 'directions_ta', "TEXT NOT NULL DEFAULT ''"],
    /*
     * Hindi, added as a third language.
     *
     * Empty by default, and the API falls back to English per field rather
     * than per row — so a department with a Hindi name but no Hindi
     * description shows the Hindi name and the English description, which is
     * still better than showing both in English.
     */
    ['departments', 'name_hi', "TEXT NOT NULL DEFAULT ''"],
    ['departments', 'description_hi', "TEXT NOT NULL DEFAULT ''"],
    ['departments', 'directions_hi', "TEXT NOT NULL DEFAULT ''"],
    ['appointments', 'mode', "TEXT NOT NULL DEFAULT 'in_person'"],
    /*
     * 'first' or 'review' — which case-sheet charge was applied.
     *
     * Nullable on purpose: appointments booked before this existed genuinely
     * do not have one, and writing a guess into a financial record would make
     * the record a lie. Their stored fee is still what was charged.
     */
    ['appointments', 'visit_type', 'TEXT'],
    /*
     * How far this booking has got towards Klinique, the hospital's clinical
     * system: pending | sent | entered | failed. Null means pending — every
     * appointment booked before this existed still has to be accounted for.
     */
    ['appointments', 'klinique_status', 'TEXT'],
    ['appointments', 'klinique_ref', 'TEXT'],
    ['appointments', 'klinique_at', 'TEXT'],
    ['doctors', 'away_from', 'TEXT'],
    ['doctors', 'away_to', 'TEXT'],
    ['doctors', 'about_en', "TEXT NOT NULL DEFAULT ''"],
    /*
     * A second consultation fee, for a review visit.
     *
     * The hospital's own OP list shows six doctors charging less to see a
     * returning patient than a new one — Gunasekaran is ₹400 first and ₹280
     * on review. One fee column could not represent that, and storing the
     * first-visit figure for both would have overcharged every review.
     *
     * Null means "same as the first-visit fee", which is true of most of the
     * roster, so nothing has to be written twice.
     */
    ['doctors', 'fee_review', 'INTEGER'],
    ['doctors', 'name_hi', "TEXT NOT NULL DEFAULT ''"],
    ['doctors', 'spec_hi', "TEXT NOT NULL DEFAULT ''"],
    /*
     * A real password, so a patient can sign in without a one-time code.
     *
     * Codes needed an SMS gateway, which needed TRAI registration — a week of
     * paperwork for a hospital that wanted to open bookings now. A password
     * the patient chooses at sign-up removes that dependency entirely and is
     * what people expect from every other site they use.
     *
     * Stored as scrypt with a per-row salt, the same as staff passwords.
     * Nullable because guest bookings create no account at all.
     */
    ['patients', 'password_hash', 'TEXT'],
    ['patients', 'password_salt', 'TEXT'],
    ['patients', 'consent_at', 'TEXT'],
    ['patients', 'consent_version', 'TEXT'],
    ['patients', 'erased_at', 'TEXT'],
  ]
  for (const [table, column, definition] of additions) {
    const has = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column)
    if (!has) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

/**
 * Teaches an existing database about the 'pending' status.
 *
 * SQLite cannot alter a CHECK constraint in place, so the table is rebuilt the
 * documented way. Guarded on the current definition, so it runs exactly once
 * and is a no-op on a database created from the current schema.
 */
function allowPendingStatus() {
  const current = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'appointments'")
    .get()
  if (!current || current.sql.includes("'pending'")) return

  console.log('[db] migrating appointments to allow pending bookings')

  // Foreign keys off for the swap: rows referencing appointments must survive
  // the table being dropped and recreated under the same name.
  db.exec('PRAGMA foreign_keys = OFF')
  try {
    db.exec('BEGIN IMMEDIATE')
    const columns = db
      .prepare('PRAGMA table_info(appointments)')
      .all()
      .map((c) => c.name)
      .join(', ')

    /*
     * Built from the table's *own* definition rather than from schema.sql, so
     * columns added later by addColumns() (and the data in them) survive the
     * rebuild. Only the status CHECK is rewritten; everything else is carried
     * across exactly as it was.
     */
    const widened = current.sql
      .replace('appointments', 'appointments_migrating')
      .replace(
        /CHECK\s*\(\s*status\s+IN\s*\([^)]*\)\s*\)/,
        "CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'requested'))",
      )
    if (!widened.includes("'pending'")) throw new Error('could not widen the status constraint')

    db.exec(widened)
    db.exec(
      `INSERT INTO appointments_migrating (${columns}) SELECT ${columns} FROM appointments`,
    )
    db.exec('DROP TABLE appointments')
    db.exec('ALTER TABLE appointments_migrating RENAME TO appointments')
    db.exec('COMMIT')
  } catch (error) {
    try {
      db.exec('ROLLBACK')
    } catch {
      /* already rolled back */
    }
    throw error
  } finally {
    db.exec('PRAGMA foreign_keys = ON')
  }

  // Dropping the table took its indexes with it; migrate() puts them back.
  migrate()
}

/** Widens ux_appointment_slot to cover pending bookings. */
function widenSlotIndex() {
  const index = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'ux_appointment_slot'")
    .get()
  if (!index || index.sql.includes("'pending'")) return
  db.exec('DROP INDEX ux_appointment_slot')
  migrate() // recreates it from schema.sql, now including pending
}

migrate()
addColumns()
allowPendingStatus()
widenSlotIndex()

/**
 * Runs `fn` inside a transaction, rolling back on any throw.
 * SQLite is single-writer, so this plus the UNIQUE slot index is what
 * actually prevents two patients taking the same appointment.
 */
export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    try {
      db.exec('ROLLBACK')
    } catch {
      /* already rolled back */
    }
    throw error
  }
}

export const nowIso = () => new Date().toISOString()
