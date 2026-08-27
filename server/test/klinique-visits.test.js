import assert from 'node:assert/strict'
import test from 'node:test'
import { mapColumns, parseVisits, toClock, toIsoDate, toStatus } from '../src/lib/klinique-visits.js'

/*
 * Nobody outside the hospital can see Klinique's visits page, so these fixtures
 * are several plausible shapes of the same table rather than one captured
 * truth. That is the point: the parser is built to survive not knowing, and
 * these check it actually does — different column orders, different heading
 * words, different date formats, extra columns it has never heard of.
 */

const shape = ({ headings, rows, wrap = true }) => {
  const head = `<tr>${headings.map((h) => `<th>${h}</th>`).join('')}</tr>`
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')
  const table = `<table class="table">${wrap ? `<thead>${head}</thead><tbody>${body}</tbody>` : head + body}</table>`
  return `<div class="row-fluid"><div class="span12">${table}</div></div>`
}

test('reads a straightforward visits table', () => {
  const html = shape({
    headings: ['#', 'Patient', 'Mobile', 'Doctor', 'Date', 'Time', 'Status'],
    rows: [
      ['48213', '<a href="/patients/9912">Meena Ravi</a>', '9843074989', 'Dr. G. Deepan', '25/08/2026', '10:40 AM', '<span class="label">Confirmed</span>'],
      ['48214', '<a href="/patients/9913">Arun Kumar</a>', '95000 12345', 'Dr. S. Priya', '25/08/2026', '2:05 PM', 'Pending'],
    ],
  })
  const { visits } = parseVisits(html)
  assert.equal(visits.length, 2)
  assert.deepEqual(visits[0], {
    kliniqueId: null,
    patientId: '9912',
    patient: 'Meena Ravi',
    phone: '9843074989',
    doctor: 'Dr. G. Deepan',
    department: null,
    date: '2026-08-25',
    slot: '10:40',
    status: 'confirmed',
    reference: '48213',
  })
  /* Spaces inside a typed mobile number must not survive into the record. */
  assert.equal(visits[1].phone, '9500012345')
  assert.equal(visits[1].slot, '14:05')
  assert.equal(visits[1].status, 'pending')
})

test('columns can be in any order and still land in the right field', () => {
  const html = shape({
    headings: ['Visit Date', 'Consultant', 'Patient Name', 'Contact No', 'Visit Time', 'State'],
    rows: [['2026-09-01', 'Dr. K. Raman', 'Lakshmi N', '9444455555', '09:20', 'Completed']],
  })
  const { visits, columns } = parseVisits(html)
  assert.equal(columns.date, 0)
  assert.equal(columns.patient, 2)
  assert.equal(visits[0].patient, 'Lakshmi N')
  assert.equal(visits[0].doctor, 'Dr. K. Raman')
  assert.equal(visits[0].date, '2026-09-01')
  assert.equal(visits[0].status, 'completed')
})

test('a date-of-birth column does not steal the visit date', () => {
  const html = shape({
    headings: ['Patient', 'Date of Birth', 'Visit Date', 'Doctor'],
    rows: [['Meena R', '14/02/1984', '25/08/2026', 'Dr. G. Deepan']],
  })
  const { visits, columns } = parseVisits(html)
  assert.equal(columns.date, 2, 'the visit date, not the birthday')
  assert.equal(visits[0].date, '2026-08-25')
})

test('headings it does not recognise are reported, never silently dropped', () => {
  const html = shape({
    headings: ['Patient', 'Date', 'Billing Category', 'Referred By'],
    rows: [['Arun K', '25/08/2026', 'Cash', 'Self']],
  })
  const { unmapped } = parseVisits(html)
  assert.deepEqual(unmapped.map((u) => u.heading), ['Billing Category', 'Referred By'])
})

test('an ambiguous day/month date is flagged rather than quietly trusted', () => {
  assert.deepEqual(toIsoDate('03/04/2026'), { date: '2026-04-03', ambiguous: true })
  assert.deepEqual(toIsoDate('25/08/2026'), { date: '2026-08-25', ambiguous: false })
  assert.deepEqual(toIsoDate('25-Aug-2026'), { date: '2026-08-25', ambiguous: false })
  assert.deepEqual(toIsoDate('2026-08-25'), { date: '2026-08-25', ambiguous: false })

  const html = shape({
    headings: ['Patient', 'Date'],
    rows: [['A', '03/04/2026'], ['B', '25/08/2026']],
  })
  assert.equal(parseVisits(html).ambiguousDates, 1)
})

test('a table with no <thead> still works — the first row is the heading', () => {
  const html = shape({
    headings: ['Patient', 'Doctor', 'Date'],
    rows: [['Meena R', 'Dr. G. Deepan', '25/08/2026']],
    wrap: false,
  })
  assert.equal(parseVisits(html).visits[0].patient, 'Meena R')
})

test('the visits listing wins over a small sidebar table', () => {
  const side = '<table><tr><th>Today</th></tr><tr><td>4</td></tr></table>'
  const html = side + shape({
    headings: ['Patient', 'Date'],
    rows: [['Meena R', '25/08/2026'], ['Arun K', '25/08/2026'], ['Lakshmi N', '26/08/2026']],
  })
  assert.equal(parseVisits(html).visits.length, 3)
})

test('markup inside a cell is read as the text a person sees', () => {
  const html = shape({
    headings: ['Patient', 'Date', 'Status'],
    rows: [['<strong>Meena</strong><br>Ravi', '25/08/2026', '<span class="label label-success"><i class="icon"></i> Confirmed </span>']],
  })
  const { visits } = parseVisits(html)
  assert.equal(visits[0].patient, 'Meena Ravi')
  assert.equal(visits[0].status, 'confirmed')
})

test('a status Klinique invented keeps its own word', () => {
  assert.equal(toStatus('Rescheduled'), 'rescheduled')
  assert.equal(toStatus(''), null)
})

test('Klinique visit and patient ids are picked up from row links', () => {
  const html = `<table><thead><tr><th>Patient</th><th>Date</th><th></th></tr></thead><tbody>
    <tr><td><a href="/patients/9912">Meena R</a></td><td>25/08/2026</td>
        <td><a href="/visits/48213/edit">Edit</a></td></tr></tbody></table>`
  const { visits } = parseVisits(html)
  assert.equal(visits[0].kliniqueId, '48213')
  assert.equal(visits[0].patientId, '9912')
})

test('a page that is not the visits list fails loudly', () => {
  assert.throws(() => parseVisits('<h1>Sign in</h1>'), /no <table>/)
  assert.throws(
    () => parseVisits(shape({ headings: ['Invoice', 'Amount'], rows: [['INV-1', '500']] })),
    /no column looks like the patient/,
  )
})

test('an empty listing is a failure, not an empty day', () => {
  /*
   * The whole reason this throws: reception cannot tell "no appointments" from
   * "the parser broke" by looking at an empty screen, and only one of those is
   * safe to believe.
   */
  const html = shape({
    headings: ['Patient', 'Date', 'Doctor'],
    rows: [['', '', 'No records found']],
  })
  assert.throws(() => parseVisits(html), /produced no visits/)
})

test('12-hour times convert, including noon and midnight', () => {
  assert.equal(toClock('12:00 AM'), '00:00')
  assert.equal(toClock('12:30 PM'), '12:30')
  assert.equal(toClock('9:05 a.m.'), '09:05')
  assert.equal(toClock('14:20'), '14:20')
  assert.equal(toClock(''), null)
})

test('mapColumns claims each field once', () => {
  const { map } = mapColumns(['Date', 'Date', 'Patient'])
  assert.equal(map.date, 0)
  assert.equal(map.patient, 2)
})
