import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarPlus, Phone } from 'lucide-react'
import { useLanguage } from '../i18n/context'
import { HOSPITAL } from '../data/hospital'
import { LANGUAGES } from '../i18n/translations'
import { createOpeningScene } from '../lib/openingScene'
import { cx } from '../lib/cx'
import BrandMark from './BrandMark'

/**
 * The opening screen — one continuous shot, scrubbed by scroll.
 *
 * Five chapters over a fixed canvas. Scrolling does not move the canvas; it
 * moves what the canvas shows, so a reader gets a single sequence rather than
 * five slides: a scattered field draws itself into a lattice, a pulse runs up
 * through it, and the ground sinks from bone to the brand's deepest teal for
 * the clinical chapters before returning to daylight for the way in.
 *
 * Rules it keeps, because it stands between a patient and a hospital:
 *
 *   - **The emergency number is on every chapter**, pinned, not buried at the
 *     end of a scroll. Somebody arriving mid-emergency must not have to watch
 *     an animation to find a phone number.
 *   - **Skip is always visible**, and Escape does the same thing.
 *   - **It appears once per device**, like the tour.
 *   - **Reaching the end enters the site by itself.** The sequence is the door,
 *     not a place to stay — so finishing it means arriving, with a moment's
 *     notice so it never feels like the page jumped. The trigger sits below a
 *     tail of empty space rather than on the last chapter, so nobody is swept
 *     inside at the moment the "Book an appointment" button appears; and
 *     scrolling back up cancels it, because doing so is a clear "not yet".
 *   - **All three languages**, switchable from inside it: a patient who cannot
 *     read the chapter cannot be expected to find the switch afterwards.
 *   - **Reduced motion** gets the same words as one ordinary page — no pinned
 *     chapters, no animation, no auto-entry — because a sequence that moves
 *     under you is exactly what that setting is asking us not to do.
 */
export default function Opening({ onEnter, onBook, onPrivacy }) {
  const { t, lang, setLang } = useLanguage()
  const scrollRef = useRef(null)
  const canvasRef = useRef(null)
  const [entering, setEntering] = useState(false)
  const [artworkFailed, setArtworkFailed] = useState(false)
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /* Guarded: scrolling to the end and pressing Skip can both fire. */
  const entered = useRef(false)
  const pending = useRef(0)
  const enterOnce = useCallback(() => {
    if (entered.current) return
    entered.current = true
    onEnter()
  }, [onEnter])

  useEffect(() => () => window.clearTimeout(pending.current), [])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') enterOnce()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [enterOnce])

  /* ---------------- the canvas ---------------- */
  useEffect(() => {
    const canvas = canvasRef.current
    const scroller = scrollRef.current
    if (!canvas || !scroller) return undefined

    const scene = createOpeningScene(canvas)
    if (!scene) return undefined

    const pointer = { x: 0, y: 0 }
    const eased = { x: 0, y: 0 }
    let progress = 0
    let frame = 0
    let last = performance.now()

    const readScroll = () => {
      const max = scroller.scrollHeight - scroller.clientHeight
      progress = max > 0 ? Math.min(1, Math.max(0, scroller.scrollTop / max)) : 0
      if (reduceMotion || entered.current) return
      /*
       * The end of the sequence is the way in. Announced and delayed rather
       * than instant: arriving the moment the last pixel scrolls past reads as
       * the page having crashed rather than as having finished.
       */
      if (progress > 0.985 && pending.current === 0) {
        setEntering(true)
        pending.current = window.setTimeout(enterOnce, 1500)
      } else if (progress < 0.92 && pending.current !== 0) {
        /* Scrolling back up is a "not yet" — take the hand off the door. */
        window.clearTimeout(pending.current)
        pending.current = 0
        setEntering(false)
      }
    }
    scroller.addEventListener('scroll', readScroll, { passive: true })

    const onPointer = (event) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1
    }
    if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
      window.addEventListener('pointermove', onPointer, { passive: true })
    }

    /*
     * Under reduced motion the lattice is a still illustration: drawn once,
     * fully assembled, with no loop running behind the words. Redrawn only if
     * the window changes size, since that is the one thing that would leave a
     * stale picture on screen.
     */
    if (reduceMotion) {
      const still = () => {
        scene.resize()
        scene.draw(0.45, 0, eased)
      }
      still()
      window.addEventListener('resize', still)
      return () => {
        scroller.removeEventListener('scroll', readScroll)
        window.removeEventListener('resize', still)
      }
    }

    const onResize = () => scene.resize()
    window.addEventListener('resize', onResize)

    const render = (now) => {
      frame = requestAnimationFrame(render)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const k = 1 - Math.pow(0.0015, dt)
      eased.x += (pointer.x - eased.x) * k
      eased.y += (pointer.y - eased.y) * k
      scene.draw(progress, now / 1000, eased)
    }
    frame = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(frame)
      scroller.removeEventListener('scroll', readScroll)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('resize', onResize)
    }
  }, [enterOnce, reduceMotion])

  /* Dark for the two clinical chapters, daylight for the rest. Driven off the
     same scroll position, but as a class rather than per-frame style writes. */
  const [dark, setDark] = useState(false)
  const onScroll = (event) => {
    if (reduceMotion) return
    const el = event.currentTarget
    const max = el.scrollHeight - el.clientHeight
    const p = max > 0 ? el.scrollTop / max : 0
    setDark(p > 0.16 && p < 0.72)
  }

  /*
   * A chapter fills the viewport so it reads as a shot in a sequence. With
   * reduced motion there is no sequence, so they become ordinary stacked
   * sections and the whole thing is one short page.
   */
  const section = reduceMotion
    ? 'px-6 py-12 sm:px-10'
    : 'flex min-h-full items-center px-6 py-24 sm:px-10'

  const chapters = [
    { label: 'opening.ch2Label', title: 'opening.ch2Title', body: 'opening.ch2Body' },
    { label: 'opening.ch3Label', title: 'opening.ch3Title', body: 'opening.ch3Body' },
    { label: 'opening.ch4Label', title: 'opening.ch4Title', body: 'opening.ch4Body' },
  ]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('opening.title')}
      className={cx(
        'fixed inset-0 z-50 transition-colors duration-700',
        dark ? 'bg-brand-900 text-slate-100' : 'bg-slate-50 text-slate-900',
      )}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 size-full" />

      {/*
        A wash of the page colour between the lattice and the words. Without it
        the mesh draws hairlines through the type, and the three languages fail
        differently — Tamil and Devanagari carry more of their meaning below the
        baseline, so a line crossing there costs more than it does in Latin.
        The gradient itself is in index.css — see .opening-scrim-light, which
        explains why it cannot be written with Tailwind's gradient utilities.
      */}
      <div
        aria-hidden="true"
        className={cx(
          'absolute inset-0 z-[5]',
          dark ? 'opening-scrim-dark' : 'opening-scrim-light',
        )}
      />

      {/* Pinned, above the story: the number, the language, the way out. */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 p-4 sm:p-5">
        <a
          href={`tel:${HOSPITAL.emergencyPhone.replace(/\s/g, '')}`}
          className={cx(
            'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold backdrop-blur-md transition sm:text-sm',
            dark
              ? 'border-white/25 bg-white/10 text-white hover:border-white/60'
              : 'border-slate-200 bg-white/80 text-slate-900 hover:border-brand-400',
          )}
        >
          <Phone className="size-4 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">{t('opening.emergency', { number: HOSPITAL.emergencyPhone })}</span>
          <span className="whitespace-nowrap sm:hidden">{HOSPITAL.emergencyPhone}</span>
        </a>

        <div className="flex items-center gap-2">
          {/*
            The language choice lives inside the opening, because a patient who
            cannot read this screen cannot be expected to find the switch on
            the one after it. Each option is written in its own script.
          */}
          <div
            className={cx(
              'flex items-center gap-0.5 rounded-full border p-0.5 backdrop-blur-md',
              dark ? 'border-white/25 bg-white/10' : 'border-slate-200 bg-white/80',
            )}
          >
            {LANGUAGES.map((option) => (
              <button
                key={option.code}
                type="button"
                lang={option.code}
                onClick={() => setLang(option.code)}
                aria-pressed={lang === option.code}
                className={cx(
                  'rounded-full px-2.5 py-1 text-xs font-bold transition',
                  lang === option.code
                    ? dark
                      ? 'bg-white text-brand-900'
                      : 'bg-brand-600 text-white'
                    : dark
                      ? 'text-white/80 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={enterOnce}
            className={cx(
              'rounded-full border px-3 py-2 text-xs font-bold backdrop-blur-md transition sm:text-sm',
              dark
                ? 'border-white/25 bg-white/10 text-white hover:border-white/60'
                : 'border-slate-200 bg-white/80 text-slate-900 hover:border-brand-400',
            )}
          >
            {t('opening.skip')}
          </button>
        </div>
      </div>

      {/* The story. Its own scroll container, so the page behind never moves. */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={cx(
          'relative z-10 h-full overflow-y-auto overscroll-contain',
          /* Chapters are vertically centred and clear the pinned bar on their
             own; the flat reduced-motion stack starts at the top and needs to
             be told to. */
          reduceMotion && 'pt-20',
        )}
      >
        {/* ---- chapter 1 ---- */}
        <section className={section}>
          <div className="mx-auto w-full max-w-5xl">
            <div className="max-w-xl">
              {/*
                The hospital's own lockup, not a typed wordmark. This is the
                first thing a patient sees of the place, and the mark on the
                sign outside the building is what tells them they are in the
                right one. Falls back to the drawn approximation the rest of
                the site uses if the artwork is ever missing.
              */}
              {artworkFailed ? (
                <BrandMark className="mb-7 size-12 sm:size-14" />
              ) : (
                <img
                  src="/logo.png"
                  alt={t('brand.name')}
                  onError={() => setArtworkFailed(true)}
                  className="mb-7 h-14 w-auto object-contain object-left sm:h-20"
                />
              )}
              <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
                {t('opening.h1a')}
                <em className={cx('block not-italic', dark ? 'text-brand-300' : 'text-brand-600')}>
                  <span className="italic">{t('opening.h1b')}</span>
                </em>
              </h1>
              <p className={cx('mt-6 max-w-md text-base sm:text-lg', dark ? 'text-brand-100' : 'text-slate-600')}>
                {t('opening.lede', { years: new Date().getFullYear() - HOSPITAL.established })}
              </p>
              <p className={cx('mt-10 flex items-center gap-3 text-xs font-bold tracking-[0.16em] uppercase', dark ? 'text-brand-200' : 'text-slate-500')}>
                <span className="relative h-px w-14 overflow-hidden bg-current/30">
                  <span className="animate-sweep absolute inset-0 bg-current" />
                </span>
                {t('opening.scroll')}
              </p>
            </div>
          </div>
        </section>

        {/* ---- chapters 2–4 ---- */}
        {chapters.map((chapter) => (
          <section
            key={chapter.title}
            className={section}
          >
            <div className="mx-auto w-full max-w-5xl">
              {/* Every chapter keeps the same left column: the scrim that makes
                  the type readable is directional, and alternating sides would
                  drop one chapter's words onto bare lattice. */}
              <div className="max-w-xl">
                <p className={cx('text-xs font-bold tracking-[0.14em] uppercase', dark ? 'text-leaf-400' : 'text-brand-600')}>
                  {t(chapter.label)}
                </p>
                <h2 className="font-display mt-3 text-3xl leading-tight tracking-tight sm:text-5xl">
                  {t(chapter.title)}
                </h2>
                <p className={cx('mt-5 max-w-md', dark ? 'text-brand-100' : 'text-slate-600')}>
                  {t(chapter.body)}
                </p>
              </div>
            </div>
          </section>
        ))}

        {/* ---- the way in ---- */}
        <section className={section}>
          <div className="mx-auto w-full max-w-5xl">
            <div className="max-w-xl">
              <h2 className="font-display text-3xl leading-tight tracking-tight sm:text-5xl">
                {t('opening.closeTitle')}
              </h2>
              <p className="mt-5 max-w-md text-slate-600">{t('opening.closeBody')}</p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    entered.current = true
                    onBook()
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-base font-bold text-white transition hover:bg-brand-700 active:scale-[0.98]"
                >
                  <CalendarPlus className="size-5" aria-hidden="true" />
                  {t('opening.book')}
                </button>
                <button
                  type="button"
                  onClick={enterOnce}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-6 py-3.5 text-base font-semibold transition hover:border-brand-400 active:scale-[0.98]"
                >
                  {t('opening.browse')}
                </button>
              </div>

              <p className="mt-6 text-xs text-slate-500">{t('opening.noAccount')}</p>

              {/*
                Who this is, where it is, and what happens to what you type.
                On the opening rather than only in the footer because this is
                the screen that asks a patient to hand over a name, a number
                and a reason for coming in — the DPDP Act calls for the notice
                at the point of collection, not three pages later.

                Every line here is drawn from the same reviewed strings the
                footer uses. Nothing about accreditation appears: the NABH
                claim stays off the site until the register entry is confirmed,
                and an opening screen is the worst possible place to put an
                unverified one.
              */}
              <div className="mt-8 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
                <p className="font-semibold text-slate-600">{t('brand.name')}</p>
                <p className="mt-1 max-w-md">{t('contact.addressLine')}</p>
                <p className="mt-3 max-w-md">{t('footer.disclaimer')}</p>
                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <button
                    type="button"
                    onClick={onPrivacy}
                    className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
                  >
                    {t('privacy.title')}
                  </button>
                  <span aria-hidden="true">·</span>
                  <span>{t('footer.rights', { year: new Date().getFullYear() })}</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/*
          The tail. Auto-entry fires at the bottom of the scroll, and this is
          what puts the bottom below the buttons rather than on them — a reader
          who wants to book gets to read and press without the site sliding in
          underneath them, and one who keeps scrolling has plainly finished.
        */}
        {!reduceMotion && <div aria-hidden="true" className="h-[45vh]" />}
      </div>

      {/* Said out loud, so arriving never feels like the page jumped. */}
      {entering && (
        <div
          role="status"
          className="absolute inset-x-0 bottom-0 z-30 bg-brand-600 px-6 py-3 text-center text-sm font-semibold text-white"
        >
          {t('opening.entering')}
        </div>
      )}
    </div>
  )
}
