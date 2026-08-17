/**
 * The reception desk's half of the fake server — demo build only.
 *
 * Split from mock-api.js because the desk is a different surface with a
 * different shape: a staff session, a worklist, schedules, a queue. Keeping it
 * beside the patient handlers made one 400-line switch statement where the two
 * halves were only related by both being fake.
 *
 * Same rules as the patient side. It answers what a visitor can reach by
 * clicking, from data held in memory, and returns a clear "not in the demo"
 * for anything else rather than pretending. Nothing here is imported by the
 * app; `npm run build` never sees this file.
 *
 * Two things the demo cannot show, and says so rather than faking:
 *
 *   - **The Klinique tab** loads deepan.klinique.net in a frame. A published
 *     page may not reach another origin at all, so it will stay empty here
 *     however well the rest works. That is the page's sandbox, not a fault in
 *     the app — see docs/klinique-status.
 *   - **The live feed** is server-sent events. There is no server, so the desk
 *     falls back to its polling path and shows "Checking" instead of "Live",
 *     which is exactly what it does when a real connection drops.
 */

const STAFF = {
  id: 'demo-staff',
  username: 'reception',
  role: 'admin',
  fullName: 'Front Office',
  doctorId: null,
}

/* Signed out until someone signs in, so the demo shows the real door. */
let staffSession = null

const pad = (n) => String(n).padStart(2, '0')
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

/**
 * A few bookings so the desk has something to be about.
 *
 * An empty desk demonstrates nothing — every tab reads "nothing today" and a
 * visitor cannot tell a working screen from a broken one. These are obviously
 * invented names, deliberately: nobody should mistake a demo for a real list of
 * patients, and no real person's details belong in a page that gets shared.
 */
export function seedDeskDemo(catalog, appointments) {
  if (appointments.length) return

  const doctorFee = (id) => catalog.doctors.find((d) => d.id === id)?.fee ?? 300
  /* The desk prints this straight into the page, so it must be a string.
     The real server sends name_en here, not the {en, ta, hi} object. */
  const name = (id) => catalog.doctors.find((d) => d.id === id)?.name?.en ?? id
  const dept = (id) => catalog.doctors.find((d) => d.id === id)?.departmentId ?? null

  const rows = [
    ['DH-DEMO01', 'gunasekaran-r', 0, '09:20', 'confirmed', 'pending', 'Anitha R', 34, 'female', 'Fever and body ache for three days'],
    ['DH-DEMO02', 'deepan-g', 0, '10:20', 'confirmed', 'entered', 'Murugan S', 58, 'male', 'Knee pain, difficulty climbing stairs'],
    ['DH-DEMO03', 'priyanka-v', 1, '11:00', 'pending', 'pending', 'Fathima B', 27, 'female', 'Antenatal check-up'],
    ['DH-DEMO04', 'kawin-g', 2, '18:20', 'confirmed', 'pending', 'Selvam K', 46, 'male', 'Review — kidney function report'],
  ]

  for (const [id, doctorId, dayOffset, slot, status, kliniqueStatus, pname, age, gender, reason] of rows) {
    appointments.push({
      id,
      doctorId,
      doctorName: name(doctorId),
      departmentId: dept(doctorId),
      kind: 'slot',
      date: addDays(dayOffset),
      slot,
      session: Number(slot.slice(0, 2)) < 14 ? 'morning' : 'evening',
      fee: doctorFee(doctorId),
      visitType: kliniqueStatus === 'entered' ? 'review' : 'first',
      klinique: { status: kliniqueStatus, ref: null, at: null },
      status,
      patient: { name: pname, age, phone: '98765' + String(10000 + age), gender, reason },
      payment: null,
      createdAt: new Date().toISOString(),
    })
  }

  /* One callback request, so "To call back" is not an empty tab either. */
  appointments.push({
    id: 'DH-DEMO05',
    doctorId: 'nithya',
    doctorName: name('nithya'),
    departmentId: dept('nithya'),
    kind: 'callback',
    date: null,
    slot: null,
    session: null,
    fee: null,
    visitType: 'first',
    klinique: { status: 'pending', ref: null, at: null },
    status: 'pending',
    patient: { name: 'Ramesh V', age: 41, phone: '9876512345', gender: 'male', reason: 'Would like to see a psychiatrist' },
    payment: null,
    createdAt: new Date().toISOString(),
  })
}

/**
 * Handles a desk call, or returns null to mean "not something the demo does".
 *
 * `ctx` carries what the patient half already owns — the catalogue snapshot,
 * the in-memory bookings and the slot calculator — so there is one source of
 * truth for both surfaces. A booking made on the patient site shows up on the
 * desk, which is the whole point of demonstrating them together.
 */
export function handleDesk(method, path, search, body, ctx) {
  const { catalog, appointments, availability, json, fail } = ctx

  /* ---------------- staff session ---------------- */
  if (path === '/admin/me') return json({ staff: staffSession })

  if (path === '/admin/signin') {
    /* Any credentials: there are no accounts to check against, and a demo that
       refuses to let you in demonstrates nothing. Said plainly in the caption
       rather than implied by a working password. */
    staffSession = { ...STAFF, username: String(body?.username || STAFF.username) }
    return json({ staff: staffSession })
  }

  if (path === '/admin/signout') {
    staffSession = null
    return json({ signedOut: true })
  }

  if (!staffSession && path.startsWith('/admin/')) {
    return fail(401, 'SIGN_IN_REQUIRED', 'Sign in to the desk first.')
  }

  if (path === '/admin/me/password') {
    return fail(501, 'DEMO_ONLY', 'Changing a password needs the real server.')
  }

  /* ---------------- the day's list ---------------- */
  if (path === '/admin/appointments' && method === 'GET') {
    const date = search.get('date')
    const status = search.get('status')
    const rows = appointments
      .filter((a) => (date ? a.date === date : true))
      .filter((a) => (status ? a.status === status : true))
    return json({ appointments: rows })
  }

  if (path === '/admin/appointments' && method === 'POST') {
    const doctor = catalog.doctors.find((d) => d.id === body?.doctorId)
    const created = {
      id: `DH-DESK${String(appointments.length + 1).padStart(2, '0')}`,
      ...body,
      doctorName: doctor?.name?.en ?? null,
      kind: body?.slot ? 'slot' : 'callback',
      fee: doctor?.fee ?? null,
      klinique: { status: 'pending', ref: null, at: null },
      status: 'confirmed',
      payment: null,
      createdAt: new Date().toISOString(),
    }
    appointments.push(created)
    return json({ appointment: created }, 201)
  }

  /* ---------------- status changes ---------------- */
  const patch = path.match(/^\/appointments\/([^/]+)$/)
  if (patch && method === 'PATCH') {
    const row = appointments.find((a) => a.id === decodeURIComponent(patch[1]))
    if (!row) return fail(404, 'NOT_FOUND', 'No such appointment.')
    const next = { approve: 'confirmed', complete: 'completed', cancel: 'cancelled' }[body?.action]
    if (next) row.status = next
    return json({ appointment: row })
  }

  /* ---------------- Klinique worklist ---------------- */
  if (path === '/admin/klinique') {
    return json({
      mode: 'manual',
      portalUrl: catalog.klinique?.portalUrl ?? 'https://deepan.klinique.net',
      outstanding: appointments.filter(
        (a) =>
          ['pending', 'failed'].includes(a.klinique?.status ?? 'pending') &&
          ['pending', 'confirmed'].includes(a.status) &&
          a.kind === 'slot',
      ),
    })
  }

  const entered = path.match(/^\/admin\/klinique\/([^/]+)\/entered$/)
  if (entered) {
    const row = appointments.find((a) => a.id === decodeURIComponent(entered[1]))
    if (row) row.klinique = { status: 'entered', ref: body?.kliniqueRef ?? null, at: new Date().toISOString() }
    return json({ ok: true })
  }

  /* ---------------- doctors and schedules ---------------- */
  if (path === '/admin/doctors') {
    return json({ doctors: catalog.doctors })
  }

  const saveDoctor = path.match(/^\/admin\/doctors\/([^/]+)$/)
  if (saveDoctor && method === 'PATCH') {
    const doctor = catalog.doctors.find((d) => d.id === decodeURIComponent(saveDoctor[1]))
    if (!doctor) return fail(404, 'DOCTOR_NOT_FOUND', 'No such doctor.')
    /* Edits stick for this visit so the change is visible, and vanish on
       reload like everything else in the demo. */
    Object.assign(doctor, body)
    return json({ doctor })
  }

  if (path === '/admin/doctors/bulk-schedule') {
    const ids = Array.isArray(body?.doctorIds) ? body.doctorIds : []
    let applied = 0
    for (const id of ids) {
      const doctor = catalog.doctors.find((d) => d.id === id)
      if (!doctor) continue
      Object.assign(doctor, body.schedule ?? {})
      applied++
    }
    return json({ applied, skipped: ids.length - applied })
  }

  const adminAvail = path.match(/^\/admin\/availability\/([^/]+)$/)
  if (adminAvail) {
    const result = availability(decodeURIComponent(adminAvail[1]), search.get('date') ?? '')
    return result ? json(result) : fail(404, 'DOCTOR_NOT_FOUND', 'No such doctor.')
  }

  /* ---------------- doctor contacts ---------------- */
  if (path === '/admin/contacts') {
    return json({
      contacts: catalog.doctors.map((d) => ({
        doctorId: d.id,
        name: d.name,
        departmentId: d.departmentId,
        bookingMode: d.bookingMode,
        /* No phone numbers in a demo, so nothing is contactable — which is
           also the truthful state of the real roster today. */
        phoneHint: null,
        verified: false,
        notifySms: false,
        lang: 'ta',
        consented: false,
        consentNote: '',
        contactable: false,
      })),
    })
  }

  const saveContact = path.match(/^\/admin\/contacts\/([^/]+)$/)
  if (saveContact) return json({ contact: null })

  /* ---------------- the outbox ---------------- */
  if (path === '/admin/notifications') {
    return json({
      notifications: [
        {
          id: 'n1',
          event: 'appointment.created',
          recipientType: 'desk',
          recipientName: null,
          appointmentId: 'DH-DEMO01',
          status: 'skipped',
          attempts: 0,
          addressHint: null,
          lastError: 'No SMS gateway configured',
          createdAt: new Date().toISOString(),
          sentAt: null,
        },
      ],
    })
  }
  if (path === '/admin/notifications/drain') return json({ processed: 0 })

  /* ---------------- clinical ---------------- */
  if (path === '/repeats/pending') return json({ repeats: [] })
  if (path.startsWith('/queue/')) {
    return fail(501, 'DEMO_ONLY', 'The consulting queue needs the real server.')
  }

  return null
}
