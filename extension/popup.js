/**
 * The popup: bookings waiting to be entered, and a button to fill each one.
 *
 * It authenticates with a device token issued by the hospital admin, not with
 * the staff session cookie. The cookie is SameSite=strict and a browser will
 * not attach it to a request from a chrome-extension:// page, so relying on it
 * would fail on the first click. The token opens the Klinique worklist and
 * nothing else.
 *
 * Stored here: the app's address, the device token, and the learned field
 * mapping. No password, ever.
 */

/** The fields a booking can fill, in the order learn mode asks for them. */
const FIELDS = [
  { key: 'name', label: "Patient's name" },
  { key: 'phone', label: 'Phone number' },
  { key: 'age', label: 'Age' },
  { key: 'gender', label: 'Gender' },
  { key: 'date', label: 'Appointment date' },
  { key: 'time', label: 'Appointment time' },
  { key: 'reason', label: 'Reason for visit' },
]

const app = document.getElementById('app')
const status = document.getElementById('status')

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props)
  for (const child of children) node.append(child)
  return node
}

const store = {
  get: (keys) => new Promise((r) => chrome.storage.local.get(keys, r)),
  set: (values) => new Promise((r) => chrome.storage.local.set(values, r)),
}

const activeTab = async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]

/**
 * Asks Chrome for access to the hospital app's origin.
 *
 * With it, the extension's requests skip the cross-origin checks entirely and
 * the server needs no configuring. Without it, the request still works if the
 * extension's own id has been added to CORS_ORIGINS — so this is an attempt,
 * not a requirement.
 */
async function askForHostAccess(appUrl) {
  try {
    const origin = new URL(appUrl).origin + '/*'
    if (await chrome.permissions.contains({ origins: [origin] })) return true
    return await chrome.permissions.request({ origins: [origin] })
  } catch {
    return false
  }
}

/** Turns an appointment from the API into the flat shape the form wants. */
const toFields = (a) => ({
  name: a.patient?.name ?? '',
  phone: a.patient?.phone ?? '',
  age: a.patient?.age ?? '',
  gender: a.patient?.gender ?? '',
  date: a.date ?? '',
  time: a.slot ?? '',
  reason: a.patient?.reason ?? '',
})

async function render() {
  const {
    appUrl = 'http://localhost:4000',
    token = '',
    mapping = null,
  } = await store.get(['appUrl', 'token', 'mapping'])
  app.replaceChildren()

  /* ---- settings: where the app is, and the device token ---- */
  const address = el('input', { value: appUrl, placeholder: 'https://…' })
  const tokenBox = el('input', {
    value: token,
    type: 'password',
    placeholder: 'dhk_…',
  })
  const save = el('button', { className: 'primary', textContent: 'Save' })

  save.onclick = async () => {
    const cleanUrl = address.value.trim().replace(/\/+$/, '')
    await store.set({ appUrl: cleanUrl, token: tokenBox.value.trim() })
    await askForHostAccess(cleanUrl)
    render()
  }

  const settings = el('details', { open: !token })
  settings.append(
    el('summary', { textContent: 'Connection' }),
    el('div', { className: 'stack', style: 'margin-top:8px' },
      el('div', {}, el('label', { textContent: 'Hospital app address' }), address),
      el('div', {},
        el('label', { textContent: 'Device token' }),
        tokenBox,
        el('div', { className: 'hint', textContent: 'From the hospital admin: npm run device -- --new "this computer"' })),
      save),
  )
  app.append(settings)

  if (!token) {
    status.textContent = 'Needs setting up'
    app.append(
      el('div', { className: 'note' },
        'Enter the address of the hospital app and the device token for this computer, then press Save.'),
    )
    return
  }

  /* ---- the worklist ---- */
  let worklist
  try {
    const res = await fetch(`${appUrl}/api/admin/klinique`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 401 || res.status === 403) {
      status.textContent = 'Token rejected'
      app.append(
        el('div', { className: 'note bad' },
          'The hospital app did not accept this device token. It may have been revoked. Ask for a new one and paste it above.'),
      )
      return
    }
    if (!res.ok) throw new Error(String(res.status))
    worklist = await res.json()
  } catch {
    status.textContent = 'Could not reach the app'
    app.append(
      el('div', { className: 'note bad' },
        'Could not reach the hospital app. Check the address above and that the app is running.'),
    )
    return
  }

  const outstanding = worklist.outstanding ?? []
  status.textContent = outstanding.length
    ? `${outstanding.length} booking${outstanding.length === 1 ? '' : 's'} to enter`
    : 'Everything is entered'

  if (worklist.mode === 'api' || worklist.mode === 'session') {
    app.append(
      el('div', { className: 'note ok' },
        'Klinique is connected — bookings send themselves. Anything listed here is one that failed and needs entering by hand.'),
    )
  }

  /* ---- teaching the form ---- */
  const teach = el('button', { textContent: mapping ? 'Teach the form again' : 'Teach the form' })
  teach.onclick = async () => {
    const tab = await activeTab()
    if (!/deepan\.klinique\.net/.test(tab.url ?? '')) {
      alert('Open the Klinique appointment form first, then press this.')
      return
    }
    await chrome.tabs.sendMessage(tab.id, { type: 'learn', fields: FIELDS })
    window.close()
  }
  app.append(
    el('div', {},
      el('div', { className: 'note' + (mapping ? ' ok' : '') },
        mapping
          ? 'The form is taught. Open a booking below and press Fill.'
          : 'First time: open the Klinique appointment form, press "Teach the form", then click each field as it asks.'),
      teach),
  )

  if (!outstanding.length) return

  /* ---- one card per booking ---- */
  for (const a of outstanding) {
    const fields = toFields(a)
    const card = el('div', { className: 'card' },
      el('div', { className: 'ref', textContent: a.reference ?? a.id }),
      el('div', { className: 'who', textContent: `${fields.name} · ${fields.phone}` }),
      el('div', { className: 'when', textContent: `${a.doctorName ?? a.doctor?.name ?? ''} — ${fields.date} ${fields.time}` }),
    )

    const fillBtn = el('button', { className: 'primary', textContent: 'Fill this form' })
    const doneBtn = el('button', { textContent: 'Mark entered' })
    const result = el('div', { className: 'muted' })

    fillBtn.onclick = async () => {
      if (!mapping) {
        result.className = 'note bad'
        result.textContent = 'Teach the form first.'
        return
      }
      const tab = await activeTab()
      if (!/deepan\.klinique\.net/.test(tab.url ?? '')) {
        result.className = 'note bad'
        result.textContent = 'Open the Klinique appointment form in this tab first.'
        return
      }
      let outcome
      try {
        outcome = await chrome.tabs.sendMessage(tab.id, { type: 'fill', booking: fields, mapping })
      } catch {
        result.className = 'note bad'
        result.textContent = 'Could not reach the page — reload the Klinique tab and try again.'
        return
      }
      result.className = outcome.missed?.length ? 'note' : 'note ok'
      result.textContent = outcome.missed?.length
        ? `Filled ${outcome.filled.length}. Check by hand: ${outcome.missed.join(', ')}`
        : `Filled ${outcome.filled.length} fields. Review, then press Save in Klinique.`
    }

    doneBtn.onclick = async () => {
      try {
        const res = await fetch(`${appUrl}/api/admin/klinique/${encodeURIComponent(a.id)}/entered`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: '{}',
        })
        if (!res.ok) throw new Error(String(res.status))
        card.remove()
      } catch {
        result.className = 'note bad'
        result.textContent = 'Could not mark it — tick it off in the app instead.'
      }
    }

    card.append(el('div', { className: 'row', style: 'margin-top:8px' }, fillBtn, doneBtn), result)
    app.append(card)
  }
}

render()
