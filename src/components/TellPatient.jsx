import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, MessageCircle, Send, X } from 'lucide-react'
import { LANGUAGES } from '../i18n/translations'
import { patientMessage, smsLink, whatsappLink } from '../lib/patientMessage'
import { cx } from '../lib/cx'

/**
 * "Tell patient" — the written confirmation, sent from reception's own phone.
 *
 * The desk has no outbound SMS gateway and deliberately so; see
 * lib/patientMessage.js for why one cannot simply be switched on in India.
 * This is the part that does not need anybody's permission: the message is
 * written for reception, in the patient's language, and one tap opens WhatsApp
 * or the SMS app with it already filled in. All reception does is press send.
 *
 * The language is remembered between patients. Reception at this hospital
 * types Tamil most of the day and should not be choosing it forty times.
 */

const LANG_KEY = 'deepan_patient_msg_lang'

const readLang = () => {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved && LANGUAGES.some((l) => l.code === saved)) return saved
  } catch {
    /* private mode — the default is fine */
  }
  /* Tiruchirappalli. Tamil is the likely answer, and it is one tap to change. */
  return 'ta'
}

export default function TellPatient({ appointment, doctorName }) {
  const [open, setOpen] = useState(false)
  const [lang, setLang] = useState(readLang)
  const [copied, setCopied] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const panelRef = useRef(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch {
      /* nothing to remember it with */
    }
  }, [lang])

  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 1400)
    return () => clearTimeout(timer)
  }, [copied])

  /*
   * Positioned by hand, in a portal on <body>.
   *
   * Not `absolute` inside the row, which is the obvious way and does not work:
   * every list on this screen is wrapped in `overflow-hidden` to round its
   * corners, and that clips a panel hanging out of a row to a sliver. Nothing
   * measurable on the panel itself reveals this — it reports its full height
   * and a position inside the window while the browser is drawing a few pixels
   * of it.
   *
   * So it is `fixed`, aligned to the button's right edge, and flipped above the
   * button when there is not room below — which the last row of Today and the
   * "Booked" banner at the foot of the booking form both need.
   */
  const place = useCallback(() => {
    if (!panelRef.current || !buttonRef.current) return
    const panel = panelRef.current.getBoundingClientRect()
    const button = buttonRef.current.getBoundingClientRect()
    const flip = window.innerHeight - button.bottom < panel.height + 16 && button.top > panel.height + 16
    setPos({
      top: flip ? button.top - panel.height - 6 : button.bottom + 6,
      /* Clamped so a button near the left edge cannot push it off-screen. */
      left: Math.max(8, Math.min(button.right - panel.width, window.innerWidth - panel.width - 8)),
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return undefined
    place()
    /* Capture phase: the desk scrolls the window, but a panel opened inside a
       scrollable area must follow that too. */
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, lang, place])

  /* Escape closes it, like every other transient panel on this screen. */
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const phone = appointment?.patient?.phone
  if (!phone) return null

  const text = patientMessage(appointment, doctorName, lang)

  return (
    <div className="relative">
      <button
        type="button"
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Send this patient their appointment details in writing"
        className={cx(
          'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition',
          open
            ? 'border-brand-600 bg-brand-600 text-white'
            : 'border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100',
        )}
      >
        <Send className="size-3" aria-hidden="true" />
        Tell patient
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 p-0.5">
              {LANGUAGES.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  lang={option.code}
                  onClick={() => setLang(option.code)}
                  aria-pressed={lang === option.code}
                  className={cx(
                    'rounded-lg px-2 py-0.5 text-xs font-bold transition',
                    lang === option.code
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* Shown, not hidden behind the button: reception is about to send
              this to a patient and should see exactly what it says. */}
          <p className="mt-2.5 max-h-40 overflow-y-auto rounded-lg bg-slate-50 px-2.5 py-2 text-xs leading-relaxed whitespace-pre-line text-slate-700">
            {text}
          </p>

          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            <a
              href={whatsappLink(phone, text)}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-700"
            >
              <MessageCircle className="size-3.5" aria-hidden="true" />
              WhatsApp
            </a>
            <a
              href={smsLink(phone, text)}
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Send className="size-3.5" aria-hidden="true" />
              SMS
            </a>
          </div>

          {/* The one that always works — a desk machine with neither WhatsApp
              nor a SIM can still paste this wherever it needs to go. */}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(text).then(() => setCopied(true), () => {})
            }}
            className="mt-1.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            {copied ? (
              <Check className="size-3.5 text-mint-600" aria-hidden="true" />
            ) : (
              <Copy className="size-3.5" aria-hidden="true" />
            )}
            {copied ? 'Copied' : 'Copy the message'}
          </button>

          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Sends from your own phone — the hospital has no SMS gateway.
          </p>
        </div>,
        document.body,
      )}
    </div>
  )
}
