/**
 * Reading the visits list out of Klinique.
 *
 * The hospital books patients in two places: on this website, and directly in
 * Klinique when somebody walks up to the desk or phones. Reception could see
 * the first and not the second, which meant the day's real list existed only in
 * a system this app could not see.
 *
 * WHY THIS PARSES BY COLUMN HEADING
 *
 * The obvious way to read a table is to write down where each column sits —
 * patient in the second cell, date in the fifth — or to match the class names
 * the page happens to use. Both are wrong here, for the same reason: nobody
 * outside the hospital can see this page (it is behind Klinique's login), so
 * any such rule would have to be guessed, and a guess that is silently wrong
 * puts one patient's appointment under another patient's name.
 *
 * So it reads the heading row and works out which column is which from the
 * words in it — "Patient", "Mobile", "Doctor", "Date". Those are visible to
 * anyone who has ever looked at the screen, they survive columns being
 * reordered or restyled, and when a heading is one this does not recognise it
 * says so instead of assuming.
 *
 * WHAT IT WILL NOT DO
 *
 *   - It never writes to Klinique. GET only.
 *   - It never invents a field. A column it cannot identify is reported as
 *     unmapped rather than guessed at.
 *   - It never reports success on an empty read. A page that parses to zero
 *     rows is treated as a failure, because "the layout changed" and "nobody
 *     has any appointments today" look identical from here, and only one of
 *     them is safe to show reception as an empty list.
 */

/* ------------------------------------------------------------------ *
 * Tiny HTML helpers.
 *
 * Regex rather than a DOM library, matching klinique-doctors.js, which already
 * reads Klinique's markup this way. The input is one server-rendered table
 * from a Rails app, not arbitrary web HTML, and adding a parser dependency to
 * a server holding patient data is a cost of its own.
 * ------------------------------------------------------------------ */

const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'",
  '&nbsp;': ' ', '&#160;': ' ', '&ndash;': '–', '&mdash;': '—', '&#x2F;': '/',
}

const decode = (s) =>
  String(s ?? '').replace(/&[#a-zA-Z0-9]+;/g, (e) => ENTITIES[e] ?? ENTITIES[e.toLowerCase()] ?? e)

/** Cell markup → the text a person reads in it. */
const text = (html) =>
  decode(
    String(html ?? '')
      /* <br> and block ends are line breaks, not letters running together. */
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|li|tr)>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim()

const cells = (rowHtml, tag) =>
  [...String(rowHtml).matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'))].map(
    (m) => m[1],
  )

const rows = (html) => [...String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1])

/* ------------------------------------------------------------------ *
 * Which column is which
 * ------------------------------------------------------------------ */

/*
 * Heading words, in the order they are tried. Longer, more specific phrases
 * come first: a table with both "Visit Date" and "Date of Birth" must not have
 * the second one win the date column because it was checked first.
 *
 * These are the words that appear on the screen, so a receptionist can read a
 * new heading off Klinique and add it here without touching anything else.
 */
const COLUMNS = [
  ['date', ['visit date', 'appointment date', 'appt date', 'app date', 'date']],
  ['time', ['visit time', 'appointment time', 'appt time', 'slot', 'time']],
  ['patient', ['patient name', 'patient', 'name']],
  ['phone', ['mobile no', 'mobile number', 'phone number', 'contact no', 'mobile', 'phone', 'contact']],
  ['doctor', ['physician', 'consultant', 'doctor', 'dr']],
  ['department', ['department', 'speciality', 'specialty', 'unit']],
  ['status', ['status', 'state']],
  ['reference', ['visit no', 'visit id', 'token no', 'token', 'op no', 'uhid', 'reg no', 'ref', '#']],
]

/*
 * `#` survives, because it is a heading in its own right — Rails scaffolds
 * label the id column with it — and stripping it left that column nameless.
 */
const normalise = (s) =>
  text(s).toLowerCase().replace(/[^a-z0-9# ]+/g, ' ').replace(/\s+/g, ' ').trim()

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Does this heading contain this alias *as whole words*?
 *
 * Plain `includes` was the first attempt and it is quietly wrong in both
 * directions: "Referred By" contains "ref" and became the reference column,
 * and a status of "Rescheduled" contains "scheduled" and was reported to
 * reception as confirmed. Both are the kind of mistake that produces a
 * confident, wrong answer rather than an error.
 */
const wordMatch = (haystack, needle) =>
  needle === '#'
    ? haystack === '#'
    : new RegExp(`(^|\\s)${escapeRe(needle)}($|\\s)`).test(haystack)

/**
 * Maps heading text to field names.
 *
 * Each field is claimed once, by its best match, so two columns that both
 * mention "date" cannot both become the date. Headings nothing claims are
 * returned in `unmapped` — visible rather than discarded, because an unread
 * column is exactly where the thing you needed turns out to have been.
 */
export function mapColumns(headings) {
  const clean = headings.map(normalise)
  const map = {}
  const taken = new Set()

  for (const [field, aliases] of COLUMNS) {
    for (const alias of aliases) {
      const exact = clean.findIndex((h, i) => !taken.has(i) && h === alias)
      const i =
        exact !== -1 ? exact : clean.findIndex((h, j) => !taken.has(j) && wordMatch(h, alias))
      if (i !== -1) {
        map[field] = i
        taken.add(i)
        break
      }
    }
  }

  const unmapped = clean
    .map((h, i) => ({ heading: headings[i], i }))
    .filter(({ i }) => !taken.has(i) && clean[i] !== '')

  return { map, unmapped }
}

/* ------------------------------------------------------------------ *
 * Dates and times
 * ------------------------------------------------------------------ */

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

/**
 * Klinique's date → ISO `YYYY-MM-DD`.
 *
 * `03/04/2026` is genuinely ambiguous and no amount of care resolves it from
 * one row: it is 3 April in India and 4 March in America. Klinique is an
 * Indian product serving an Indian hospital, so day-first is the reading, and
 * `ambiguous` is set true whenever both halves are 12 or under so a caller can
 * surface it rather than silently trust it.
 */
export function toIsoDate(raw) {
  const s = text(raw)
  if (!s) return { date: null, ambiguous: false }

  const iso = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return { date: pad(iso[1], iso[2], iso[3]), ambiguous: false }

  const named = s.match(/(\d{1,2})[\s-]([A-Za-z]{3,})[\s-](\d{4})/)
  if (named) {
    const m = MONTHS[named[2].slice(0, 3).toLowerCase()]
    if (m) return { date: pad(named[3], m, named[1]), ambiguous: false }
  }

  const slash = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (slash) {
    const [, a, b, y] = slash
    const year = y.length === 2 ? `20${y}` : y
    return { date: pad(year, b, a), ambiguous: Number(a) <= 12 && Number(b) <= 12 }
  }

  return { date: null, ambiguous: false }
}

const pad = (y, m, d) => `${y}-${String(Number(m)).padStart(2, '0')}-${String(Number(d)).padStart(2, '0')}`

/** '10:40 AM' → '10:40'; '2:05 pm' → '14:05'. 24-hour input passes through. */
export function toClock(raw) {
  const s = text(raw)
  const m = s.match(/(\d{1,2}):(\d{2})\s*([ap])\.?m\.?/i)
  if (m) {
    let h = Number(m[1]) % 12
    if (m[3].toLowerCase() === 'p') h += 12
    return `${String(h).padStart(2, '0')}:${m[2]}`
  }
  const plain = s.match(/\b(\d{1,2}):(\d{2})\b/)
  return plain ? `${String(Number(plain[1])).padStart(2, '0')}:${plain[2]}` : null
}

/**
 * Klinique's status words → this app's own.
 *
 * Anything unrecognised keeps Klinique's word rather than being forced into a
 * category. A visit shown as "Rescheduled" is more use to reception than one
 * this code decided to call "pending".
 */
const STATUS = {
  confirmed: 'confirmed', booked: 'confirmed', scheduled: 'confirmed', active: 'confirmed',
  pending: 'pending', waiting: 'pending', new: 'pending',
  cancelled: 'cancelled', canceled: 'cancelled', deleted: 'cancelled',
  completed: 'completed', seen: 'completed', closed: 'completed', consulted: 'completed',
}

export const toStatus = (raw) => {
  const s = normalise(raw)
  for (const [word, mapped] of Object.entries(STATUS)) if (wordMatch(s, word)) return mapped
  return s || null
}

const digits = (s) => text(s).replace(/\D/g, '')

/* ------------------------------------------------------------------ *
 * The parse
 * ------------------------------------------------------------------ */

/** The table with the most rows — on a CRUD page that is the listing. */
function biggestTable(html) {
  const tables = [...String(html).matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map((m) => m[0])
  if (!tables.length) return null
  return tables.sort((a, b) => rows(b).length - rows(a).length)[0]
}

/**
 * Parses the visits page into rows.
 *
 * Throws rather than returning nothing: see the note at the top of the file —
 * "the page changed" and "no appointments" must not look the same to a caller.
 */
export function parseVisits(html) {
  const table = biggestTable(html)
  if (!table) throw new Error('no <table> on the page — is this the visits list, or a login?')

  const all = rows(table)
  if (!all.length) throw new Error('the table has no rows at all')

  /* The heading row is whichever row is built from <th>; fall back to the first. */
  const headIndex = all.findIndex((r) => cells(r, 'th').length > 1)
  const headRow = headIndex === -1 ? all[0] : all[headIndex]
  const headings = (cells(headRow, 'th').length ? cells(headRow, 'th') : cells(headRow, 'td')).map(text)
  if (headings.length < 2) throw new Error('could not find a heading row to read the columns from')

  const { map, unmapped } = mapColumns(headings)
  for (const required of ['patient', 'date']) {
    if (map[required] === undefined) {
      throw new Error(
        `no column looks like the ${required}. Headings found: ${headings.filter(Boolean).join(', ')}`,
      )
    }
  }

  const body = all.slice((headIndex === -1 ? 0 : headIndex) + 1)
  const visits = []
  let ambiguousDates = 0

  for (const row of body) {
    const td = cells(row, 'td')
    if (td.length < 2) continue // a spacer, or a "no records" row

    const at = (field) => (map[field] === undefined ? null : td[map[field]])
    const { date, ambiguous } = toIsoDate(at('date'))
    if (ambiguous) ambiguousDates++

    const patient = text(at('patient'))
    if (!patient && !date) continue

    visits.push({
      /* Klinique's own id for the visit, from whichever link carries it. */
      kliniqueId: row.match(/\/visits\/(\d+)/)?.[1] ?? null,
      patientId: row.match(/\/patients\/(\d+)/)?.[1] ?? null,
      patient,
      phone: digits(at('phone')) || null,
      doctor: text(at('doctor')) || null,
      department: text(at('department')) || null,
      date,
      slot: toClock(at('time')),
      status: toStatus(at('status')),
      reference: text(at('reference')) || null,
    })
  }

  if (!visits.length) {
    throw new Error(
      'the table parsed but produced no visits — the layout has probably changed. ' +
        `Headings found: ${headings.filter(Boolean).join(', ')}`,
    )
  }

  return { visits, headings, columns: map, unmapped, ambiguousDates }
}
