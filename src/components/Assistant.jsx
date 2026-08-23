import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, Phone, Send, Sparkles, X } from 'lucide-react'
import { useLanguage } from '../i18n/context'
import { answer, greeting } from '../lib/assistant'
import { deskAnswer, deskGreeting } from '../lib/deskAssistant'
import { cx } from '../lib/cx'

const telHref = (number) => `tel:${number.replace(/[^\d+]/g, '')}`

/**
 * Floating help assistant. Answers from the app's own data, fully offline.
 *
 * Two answer sets behind one panel. `mode="desk"` swaps in the staff and
 * doctor topics — the same words mean different things to the two audiences,
 * so sharing one answer set would make both worse.
 */
export default function Assistant({
  onNavigate,
  onBook,
  onDepartment,
  hidden = false,
  mode = 'patient',
  desk = null,
  onTab,
}) {
  const { t, tl, lang } = useLanguage()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [keyboardInset, setKeyboardInset] = useState(0)
  const listRef = useRef(null)
  const inputRef = useRef(null)

  /*
   * Lift the panel above the on-screen keyboard.
   *
   * A `position: fixed` element anchors to the *layout* viewport, which does
   * not shrink when a phone keyboard opens — so the text box ends up behind
   * the keyboard and the panel looks like it cannot be typed into at all.
   * visualViewport reports how much is actually covered.
   */
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv || !open) {
      setKeyboardInset(0)
      return undefined
    }
    const update = () => {
      setKeyboardInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)))
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [open])

  const isDesk = mode === 'desk'

  // `t`/`tl` are already memoised per language, so this is stable per language.
  const ctx = useMemo(
    () => ({ t, tl, lang, isDoctor: desk?.isDoctor ?? false, username: desk?.username ?? '' }),
    [t, tl, lang, desk?.isDoctor, desk?.username],
  )

  // Greet on first open; the greeting stays in whatever language it was given.
  useEffect(() => {
    if (!open) return undefined
    setMessages((prev) =>
      prev.length > 0 ? prev : [{ from: 'bot', ...(isDesk ? deskGreeting(ctx) : greeting(ctx)) }],
    )
    const timer = setTimeout(() => inputRef.current?.focus(), 80)
    return () => clearTimeout(timer)
  }, [open, ctx, isDesk])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const ask = useCallback(
    (text) => {
      const question = text.trim()
      if (!question) return
      let reply
      try {
        reply = isDesk ? deskAnswer(question, ctx) : answer(question, ctx)
      } catch (error) {
        // A broken answer must cost the user one reply, not the whole panel.
        console.error('[assistant]', error)
        reply = { text: isDesk ? 'Something went wrong answering that.' : ctx.t('ai.fallback') }
      }
      setMessages((prev) => [...prev, { from: 'user', text: question }, { from: 'bot', ...reply }])
      setInput('')
    },
    [ctx, isDesk],
  )

  const runAction = (action) => {
    if (action.type === 'tab') onTab?.(action.tab)
    else if (action.type === 'navigate') onNavigate(action.page)
    else if (action.type === 'department') onDepartment(action.departmentId)
    else if (action.type === 'book') onBook({ departmentId: action.departmentId, doctorId: action.doctorId })
    setOpen(false)
  }

  if (hidden) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={isDesk ? 'Desk help' : t('ai.title')}
        data-tour="assistant"
        style={keyboardInset ? { bottom: `calc(1rem + ${keyboardInset}px)` } : undefined}
        className={cx(
          /*
           * Clear of the phone's bottom nav bar, which is 4rem tall plus the
           * home-indicator inset. At bottom-4 the button sat on top of it and,
           * before the bar existed, on top of the hero text — the paragraph a
           * patient reads first was underneath it.
           */
          'fixed end-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 grid size-14 place-items-center rounded-full shadow-lg transition active:scale-95 print-hide xl:bottom-4',
          open ? 'bg-slate-800 text-white' : 'bg-brand-600 text-white hover:bg-brand-700 hover:scale-105',
        )}
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>

      {open && (
        <div
          style={
            keyboardInset
              ? {
                  bottom: `calc(5rem + ${keyboardInset}px)`,
                  maxHeight: `calc(100dvh - ${keyboardInset}px - 7rem)`,
                }
              : undefined
          }
          className="animate-scale-in fixed inset-x-3 bottom-[calc(9rem+env(safe-area-inset-bottom))] z-50 flex max-h-[65dvh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:end-4 sm:w-96 print-hide xl:bottom-20 xl:max-h-[70dvh]"
        >
          <div className="flex items-center gap-2.5 border-b border-slate-200 bg-brand-600 px-4 py-3 text-white">
            <Sparkles className="size-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{isDesk ? 'Desk help' : t('ai.title')}</p>
              <p className="truncate text-xs text-brand-100">
                {isDesk ? 'How this screen works' : t('ai.subtitle')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('action.close')}
              className="grid size-8 place-items-center rounded-lg transition hover:bg-white/15"
            >
              <X className="size-4" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message, index) => (
              <div key={index}>
                <div
                  className={cx(
                    'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line',
                    message.from === 'user'
                      ? 'ms-auto bg-brand-600 text-white'
                      : 'bg-slate-100 text-slate-800',
                  )}
                >
                  {message.text}
                </div>

                {/*
                 * Only the assistant's own replies get a listen button — the
                 * patient does not need their own question read back, and a
                 * speaker icon on every bubble is clutter. Not shown on the
                 * desk, where staff are reading a screen they chose to open.
                 */}
                {message.from !== 'user' && !isDesk && (
                  <div className="mt-1.5">
                  </div>
                )}

                {message.actions && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.actions.map((action) =>
                      action.type === 'call' ? (
                        <a
                          key={action.label}
                          href={telHref(action.number)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700"
                        >
                          <Phone className="size-3.5" aria-hidden="true" />
                          {action.label} {action.number}
                        </a>
                      ) : (
                        <button
                          key={action.label}
                          type="button"
                          onClick={() => runAction(action)}
                          className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
                        >
                          {action.label}
                        </button>
                      ),
                    )}
                  </div>
                )}

                {/* Patient chips are translation keys; desk chips are already
                    English sentences, since the desk is English only. */}
                {(message.suggestKeys ?? message.suggestions) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(message.suggestKeys ?? message.suggestions).map((entry) => {
                      const label = message.suggestKeys ? t(entry) : entry
                      return (
                        <button
                          key={entry}
                          type="button"
                          onClick={() => ask(label)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              ask(input)
            }}
            className="flex items-center gap-2 border-t border-slate-200 bg-slate-50 px-3 py-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onFocus={(event) =>
                setTimeout(() => event.target.scrollIntoView({ block: 'nearest' }), 250)
              }
              enterKeyHint="send"
              placeholder={t('ai.placeholder')}
              aria-label={t('ai.placeholder')}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            />
            <button
              type="submit"
              aria-label={t('ai.send')}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700"
            >
              <Send className="size-4" />
            </button>
          </form>

          <p className="border-t border-slate-100 bg-white px-4 py-2 text-[11px] leading-snug text-slate-400">
            {isDesk
              ? 'A help index for this screen. No clinical knowledge, and it does not search patient records.'
              : t('ai.disclaimer')}
          </p>
        </div>
      )}
    </>
  )
}
