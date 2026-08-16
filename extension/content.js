/**
 * Runs on deepan.klinique.net and fills the appointment form.
 *
 * Two things this deliberately does NOT do:
 *
 *   - **It does not log in.** Reception is already signed in as themselves,
 *     in their own browser. No credential is stored anywhere, and Klinique's
 *     audit log correctly records that a named receptionist created the
 *     appointment — not a script wearing their name.
 *   - **It does not submit.** It fills the fields and stops. A human looks at
 *     the form and clicks Save. That one step is what keeps a mis-mapped field
 *     from becoming a wrong patient record, and it costs nothing.
 *
 * The form's field names are unknown until somebody teaches them, because
 * nobody building this has seen the page. Learn mode records a selector for
 * each field once; after that it is one click per booking.
 */

/** A selector that will still find this field on the next page load. */
function selectorFor(el) {
  if (el.id) return `#${CSS.escape(el.id)}`
  if (el.name) return `${el.tagName.toLowerCase()}[name="${CSS.escape(el.name)}"]`

  // No id or name: fall back to position among same-tag siblings, which is
  // stable for a server-rendered form even though it is uglier.
  const sameTag = [...document.querySelectorAll(el.tagName)]
  return `${el.tagName.toLowerCase()}:nth-of-type(${sameTag.indexOf(el) + 1})`
}

/**
 * Sets a value the way a real keystroke would.
 *
 * Assigning `.value` directly is invisible to any framework watching the
 * field, so the page keeps its own idea of what is typed and submits an empty
 * form. Going through the native setter and firing the events is what makes
 * React, Vue and Rails' own handlers notice.
 */
function setValue(el, value) {
  const text = String(value ?? '')
  if (el.tagName === 'SELECT') {
    const wanted = text.toLowerCase()
    const option = [...el.options].find(
      (o) => o.value.toLowerCase() === wanted || o.text.toLowerCase().includes(wanted),
    )
    if (!option) return false
    el.value = option.value
  } else {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set
    if (setter) setter.call(el, text)
    else el.value = text
  }
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

const flash = (el, colour = '#16a34a') => {
  const previous = el.style.outline
  el.style.outline = `3px solid ${colour}`
  setTimeout(() => {
    el.style.outline = previous
  }, 1200)
}

/* ------------------------------------------------------------- learn --- */

let learning = null

function startLearning(fields) {
  if (learning) stopLearning()
  const remaining = [...fields]
  const mapping = {}

  const banner = document.createElement('div')
  banner.style.cssText = `
    position: fixed; inset-inline: 0; top: 0; z-index: 2147483647;
    background: #1f6f5c; color: white; font: 600 14px system-ui, sans-serif;
    padding: 12px 16px; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,.25);
  `
  const say = () => {
    banner.textContent = remaining.length
      ? `Click the field for: ${remaining[0].label}   (${fields.length - remaining.length + 1} of ${fields.length}) — press Esc to stop`
      : 'Done — every field learned.'
  }
  say()
  document.body.appendChild(banner)

  const onClick = (event) => {
    const el = event.target
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
      return
    }
    event.preventDefault()
    event.stopPropagation()

    const field = remaining.shift()
    mapping[field.key] = selectorFor(el)
    flash(el)
    say()

    if (remaining.length === 0) {
      chrome.storage.local.set({ mapping }, () => {
        setTimeout(stopLearning, 900)
      })
    }
  }

  const onKey = (event) => {
    if (event.key === 'Escape') stopLearning()
  }

  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKey, true)
  learning = { banner, onClick, onKey }
}

function stopLearning() {
  if (!learning) return
  document.removeEventListener('click', learning.onClick, true)
  document.removeEventListener('keydown', learning.onKey, true)
  learning.banner.remove()
  learning = null
}

/* -------------------------------------------------------------- fill --- */

function fill(booking, mapping) {
  const filled = []
  const missed = []

  for (const [key, selector] of Object.entries(mapping)) {
    const el = document.querySelector(selector)
    const value = booking[key]
    if (!el) {
      missed.push(`${key} (field not on this page)`)
      continue
    }
    if (value == null || value === '') continue
    if (setValue(el, value)) {
      filled.push(key)
      flash(el)
    } else {
      missed.push(`${key} (no matching option)`)
      flash(el, '#dc2626')
    }
  }
  return { filled, missed }
}

/* ----------------------------------------------------------- routing --- */

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type === 'ping') {
    respond({ ok: true })
    return true
  }
  if (message.type === 'learn') {
    startLearning(message.fields)
    respond({ ok: true })
    return true
  }
  if (message.type === 'fill') {
    respond(fill(message.booking, message.mapping))
    return true
  }
  return false
})
