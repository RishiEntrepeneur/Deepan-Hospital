import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useLanguage } from '../i18n/context'

/**
 * Guided tour.
 *
 * Steps point at real elements by `data-tour` attribute. Two rules keep it
 * honest as the app changes:
 *
 *   1. A step whose element is missing is skipped, not shown against empty
 *      space — the desk's tabs differ between a doctor and reception, and a
 *      tour that describes a button nobody has is worse than no tour.
 *   2. Nothing is clickable through the overlay, so a half-finished tour can
 *      never leave someone mid-booking without realising.
 */
const PADDING = 6

/**
 * The first *visible* element matching the selector.
 *
 * querySelector alone was not enough. The header renders its controls twice —
 * once for wide screens and once for the mobile layout — so `[data-tour=…]`
 * matches two nodes and the first one is whichever the CSS has hidden. The
 * tour then pointed at a 0x0 box and showed the step with no highlight at all.
 * Scanning for the first one with a real size picks whichever layout is
 * actually on screen.
 */
function findTarget(selector) {
  if (!selector) return null
  for (const element of document.querySelectorAll(selector)) {
    const rect = element.getBoundingClientRect()
    if (rect.width > 0 || rect.height > 0) return element
  }
  return null
}

/** True when two measurements are close enough that redrawing is pointless. */
function sameRect(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  )
}

export default function Tour({ steps: allSteps, open, onClose, onNavigate }) {
  const { t } = useLanguage()
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const cardRef = useRef(null)

  /*
   * Drop steps whose target is not on this screen, when the tour opens.
   *
   * Two patient steps point at the desktop navigation, which collapses into the
   * menu button on a phone — where most patients are. Left in, they showed a
   * step highlighting nothing and describing a link the viewer did not have.
   * Filtering here rather than in the callers keeps the rule with the component
   * that owns it, and keeps Tour lazily loaded.
   */
  const steps = useMemo(() => (open ? usableSteps(allSteps) : allSteps), [open, allSteps])

  const step = steps[index]
  const total = steps.length

  /*
   * The step's identity as plain strings.
   *
   * The parent builds its step list inline — `patientTour(t)` — so the array
   * and every object in it is new on each of its renders. Depending on the
   * object meant the effect below re-ran constantly: re-navigating, restarting
   * the retry loop and firing another smooth scroll each time, which produced
   * more scroll events, which re-rendered, and round again. Depending on the
   * two strings that actually matter ends that loop.
   */
  const target = step?.target ?? null
  const page = step?.page ?? null

  /*
   * Measuring is rAF-throttled and bails out when nothing has moved.
   *
   * getBoundingClientRect returns a fresh object every call, so setting it
   * unconditionally re-rendered on every scroll event — hundreds during one
   * smooth scroll, each repainting a full-screen shadow.
   */
  const frame = useRef(0)
  const measure = useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const element = findTarget(target)
      const next = element ? element.getBoundingClientRect() : null
      setRect((current) => (sameRect(current, next) ? current : next))
    })
  }, [target])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  /* Move to the step's page, wait for it to render, then measure. */
  useEffect(() => {
    if (!open || !target) return undefined
    if (page) onNavigate?.(page)

    let cancelled = false
    let attempts = 0
    let timer = 0
    const tick = () => {
      if (cancelled) return
      const element = findTarget(target)
      if (element) {
        /*
         * Measure first, scroll second.
         *
         * Measuring only after a 320ms timer meant Next did nothing visible
         * for a third of a second and then everything moved at once — the tour
         * felt like it was thinking. Measuring straight away moves the
         * spotlight and card on the click; the scroll listener above already
         * tracks the target through the smooth scroll, so the follow-up
         * measure is only a backstop for scrolls that end somewhere the
         * listener did not report.
         */
        measure()

        const box = element.getBoundingClientRect()
        const alreadyVisible = box.top >= 0 && box.bottom <= window.innerHeight
        // Scrolling a target that is already fully on screen costs an
        // animation and buys nothing.
        if (!alreadyVisible) {
          element.scrollIntoView({ block: 'center', behavior: 'smooth' })
          timer = setTimeout(() => !cancelled && measure(), 320)
        }
        return
      }
      attempts += 1
      if (attempts < 12) timer = setTimeout(tick, 60)
      else setRect(null) // give up: show the step centred, without a spotlight
    }
    tick()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, target, page, onNavigate, measure])

  useEffect(() => {
    if (!open) return undefined
    // Passive: these only read geometry, and a non-passive scroll listener
    // makes the browser wait on it before it may paint the scroll.
    const options = { passive: true }
    window.addEventListener('resize', measure, options)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure, options)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, measure])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') setIndex((i) => Math.min(total - 1, i + 1))
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, total])

  useEffect(() => {
    if (open) setIndex(0)
  }, [open])

  useLayoutEffect(() => {
    // preventScroll: focusing the card otherwise yanks the page to it, fighting
    // the scrollIntoView that just centred the thing the step is pointing at.
    cardRef.current?.focus({ preventScroll: true })
  }, [index, open])

  if (!open || !step) return null

  const last = index === total - 1

  /*
   * Place the card below the highlight when there is room, otherwise above.
   *
   * Positioned with `top` or `bottom` — never with a transform. The card
   * carries `animate-scale-in`, and a CSS animation's transform overrides an
   * inline one for as long as it runs. Flipping the card above its target with
   * translateY(-100%) therefore did nothing, and the step highlighting the
   * assistant button (which sits at the bottom of the screen) rendered ~180px
   * below the fold where nobody could read or dismiss it.
   */
  const GAP = PADDING + 10

  /*
   * The card is as wide as it can be, up to 340px — not always 340px.
   *
   * A fixed 340 needs 364px of screen once both 12px margins are counted, so
   * on a 320px phone `window.innerWidth - 352` came out to -32 and the
   * Math.min below drove the card that far off the left edge: the step number,
   * the heading's first characters and the left edge of the Skip button were
   * all cut off, on the one screen a first-time visitor cannot avoid. Nothing
   * scrolled sideways to reveal them, so it read as a design that simply had
   * its text chopped.
   */
  const CARD_WIDTH = Math.min(340, window.innerWidth - 24)

  const cardStyle = (() => {
    if (!rect) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: CARD_WIDTH }
    }

    const room = { below: window.innerHeight - rect.bottom, above: rect.top }
    // max() last, so the 12px left margin wins on a screen too narrow for the
    // preferred position rather than being overridden by it.
    const left = Math.max(
      12,
      Math.min(
        rect.left + rect.width / 2 - CARD_WIDTH / 2,
        window.innerWidth - CARD_WIDTH - 12,
      ),
    )

    // Anchoring to `bottom` when going above is what makes this safe: the
    // browser keeps the whole card on screen without anyone measuring it.
    if (room.below > 240 || room.below >= room.above) {
      return { top: Math.min(rect.bottom + GAP, window.innerHeight - 12), left, width: CARD_WIDTH, maxHeight: `calc(100dvh - ${Math.round(rect.bottom + GAP + 12)}px)` }
    }
    return { bottom: Math.min(window.innerHeight - rect.top + GAP, window.innerHeight - 12), left, width: CARD_WIDTH, maxHeight: `calc(${Math.round(rect.top - GAP - 12)}px)` }
  })()

  return (
    <div className="fixed inset-0 z-[70] print-hide" role="dialog" aria-modal="true">
      {/* One element does the dimming: a giant spread shadow leaves the
          target lit without needing four separate panels. */}
      {rect ? (
        <div
          aria-hidden="true"
          onClick={onClose}
          /*
           * No transition here, deliberately.
           *
           * `transition-all` animated the 9999px spread shadow, so every step
           * change and every scroll frame repainted the entire viewport for
           * 200ms. Repositioning instantly costs one cheap paint instead, and
           * with the rAF throttle above the spotlight now tracks a scroll
           * smoothly rather than lurching behind it.
           */
          className="pointer-events-auto absolute rounded-lg"
          style={{
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
            boxShadow: '0 0 0 9999px rgba(22, 19, 15, 0.62)',
            // Its own layer, so moving it does not repaint the page beneath.
            willChange: 'top, left, width, height',
          }}
        />
      ) : (
        <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-slate-900/60" />
      )}

      <div
        ref={cardRef}
        tabIndex={-1}
        style={{ position: 'fixed', ...cardStyle }}
        className="animate-scale-in overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="label-caps text-slate-400">
            {index + 1} / {total}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('action.close')}
            className="-mt-1 grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-4" />
          </button>
        </div>

        <h2 className="mt-1 text-lg text-slate-900">{step.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 transition hover:text-slate-800"
          >
            {t('tour.skip')}
          </button>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((i) => i - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <ChevronLeft className="size-3.5" aria-hidden="true" />
                {t('action.back')}
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? onClose() : setIndex((i) => i + 1))}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700"
            >
              {last ? t('tour.done') : t('action.next')}
              {!last && <ChevronRight className="size-3.5" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Filters a step list down to what actually exists on this screen, so a tour
 * never describes a control the viewer does not have.
 */
export function usableSteps(steps) {
  return steps.filter((step) => !step.target || !step.requireTarget || findTarget(step.target))
}
