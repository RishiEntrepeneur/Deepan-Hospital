import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'
import { badRequest } from './validate.js'
import { randomToken, uuid } from './crypto.js'

/**
 * Photographs and reports a patient sends with a booking.
 *
 * Everything here is about not trusting the upload. A file arriving from the
 * internet is bytes and a claim about what they are; the claim is worth
 * nothing. So the declared type is used only to pick which signature to check
 * for, and a file whose first bytes do not match is refused — an HTML page
 * renamed to .pdf is the attack this prevents, because the browser that later
 * opened it would run it as a page on the hospital's own origin.
 *
 * What is allowed is deliberately narrow: three image formats a phone camera
 * actually produces, and PDF, which is how every lab in Trichy sends a report.
 */

/** First bytes that must be present for each accepted type. */
const SIGNATURES = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // 'RIFF', with 'WEBP' at offset 8
  'application/pdf': [[0x25, 0x50, 0x44, 0x46, 0x2d]], // '%PDF-'
}

export const ACCEPTED = Object.keys(SIGNATURES)

/** A phone photo compresses well below this; a scanned report rarely exceeds it. */
export const MAX_BYTES = 8 * 1024 * 1024
/** Enough for a rash, a report and an old prescription, without becoming a dump. */
export const MAX_PER_APPOINTMENT = 4

const startsWith = (buf, bytes) => bytes.every((byte, index) => buf[index] === byte)

/**
 * Confirm the bytes really are what the request claims, and say which family
 * they belong to. Throws a 400 the route can pass straight to the patient.
 */
export function sniff(mime, buf) {
  const signatures = SIGNATURES[mime]
  if (!signatures) throw badRequest('FILE_TYPE', 'Send a photo (JPG, PNG, WebP) or a PDF.')
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    throw badRequest('FILE_EMPTY', 'That file was empty.')
  }
  if (buf.length > MAX_BYTES) {
    throw badRequest('FILE_TOO_BIG', 'That file is too large. The limit is 8 MB.')
  }
  if (!signatures.some((sig) => startsWith(buf, sig))) {
    throw badRequest('FILE_CONTENTS', 'That file did not look like a photo or a PDF.')
  }
  // RIFF is also WAV and AVI; only WebP carries 'WEBP' at offset 8.
  if (mime === 'image/webp' && buf.subarray(8, 12).toString('ascii') !== 'WEBP') {
    throw badRequest('FILE_CONTENTS', 'That file did not look like a photo or a PDF.')
  }
  return mime === 'application/pdf' ? 'pdf' : 'image'
}

const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
}

/**
 * Write the bytes and return what the database row needs.
 *
 * The stored name is generated, never taken from the upload: a filename from
 * the internet is the classic way out of the folder it was meant to stay in.
 */
export function store(mime, buf) {
  fs.mkdirSync(config.uploadDir, { recursive: true })
  const id = uuid()
  const storedName = `${id}${EXTENSIONS[mime]}`
  // 0600: readable by the account running the app and by nobody else on the box.
  fs.writeFileSync(path.join(config.uploadDir, storedName), buf, { mode: 0o600 })
  return { id, storedName, token: randomToken(24) }
}

/** Absolute path of a stored file, guarded against anything but a plain name. */
export function pathFor(storedName) {
  const name = String(storedName ?? '')
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name.includes('..')) {
    throw badRequest('FILE_NAME', 'Unreadable file reference.')
  }
  return path.join(config.uploadDir, name)
}

/** Remove a stored file. Missing is success — the row is going either way. */
export function removeFile(storedName) {
  try {
    fs.unlinkSync(pathFor(storedName))
  } catch {
    /* already gone */
  }
}

/**
 * Tidy a name for display. Keeps the extension so a doctor can tell a report
 * from a photo at a glance, and drops any directory the browser included.
 */
export function safeName(raw) {
  const base = String(raw ?? '')
    .split(/[\\/]/)
    .pop()
    // Strip control characters, which have no business in a displayed name.
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 80)
  return base || 'attachment'
}
