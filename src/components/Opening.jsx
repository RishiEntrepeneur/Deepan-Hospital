import { useEffect, useRef } from 'react'
import { CalendarPlus, Phone, Stethoscope } from 'lucide-react'
import { useLanguage } from '../i18n/context'
import { HOSPITAL } from '../data/hospital'
import { LANGUAGES } from '../i18n/translations'
import BrandMark from './BrandMark'
import { cx } from '../lib/cx'

/**
 * The opening screen — the first thing a new visitor sees.
 *
 * It exists to answer one question before anything else: which language do you
 * read? The app runs in three, and a patient who cannot read the header cannot
 * find the switch that fixes it. Everything else on this screen is a way out of
 * it: book, browse, or call.
 *
 * Rules it follows, because it stands between a patient and a hospital:
 *
 *   - **The emergency number is on it.** Somebody arriving here mid-emergency
 *     must not have to dismiss a welcome screen to find a phone number.
 *   - **It appears once.** The choice is remembered per device, like the tour
 *     and the language switch. A splash screen every visit is an obstacle.
 *   - **It is not a gate.** Nothing behind it requires an account, and every
 *     button leads into the site rather than asking for anything.
 *   - **Escape closes it**, and focus starts inside it, so it is dismissible
 *     from a keyboard and legible to a screen reader.
 */
export default function Opening({ onEnter, onBook }) {
  const { t, lang, setLang } = useLanguage()
  const firstRef = useRef(null)

  useEffect(() => {
    firstRef.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') onEnter()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onEnter])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('opening.title')}
      className="fixed inset-0 z-50 overflow-y-auto bg-brand-900 text-white"
    >
      {/* Emergency first, and reachable without dismissing anything. */}
      <a
        href={`tel:${HOSPITAL.emergencyPhone.replace(/\s/g, '')}`}
        className="flex items-center justify-center gap-2 bg-black/25 px-4 py-3 text-center text-sm font-semibold hover:bg-black/40"
      >
        <Phone className="size-4 shrink-0" aria-hidden="true" />
        {t('opening.emergency', { number: HOSPITAL.emergencyPhone })}
      </a>

      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-xl flex-col justify-center px-6 py-10">
        <div className="flex flex-col items-center text-center">
          <BrandMark className="size-14" />
          <h1 className="mt-5 text-3xl font-extrabold sm:text-4xl">{t('brand.name')}</h1>
          <p className="mt-1 text-sm text-white/70">{t('brand.tagline')}</p>
          <p className="mt-6 text-base text-white/90">{t('opening.title')}</p>
        </div>

        {/*
         * The language choice is the point of this screen, so each option is
         * written in its own language — someone who cannot read the current one
         * can still recognise theirs.
         */}
        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          {LANGUAGES.map((option, index) => (
            <button
              key={option.code}
              ref={index === 0 ? firstRef : undefined}
              type="button"
              lang={option.code}
              onClick={() => setLang(option.code)}
              aria-pressed={lang === option.code}
              className={cx(
                'rounded-xl border px-4 py-3 text-base font-semibold transition',
                lang === option.code
                  ? 'border-white bg-white text-brand-800'
                  : 'border-white/30 text-white hover:border-white/70',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={onBook}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-bold text-brand-800 transition hover:bg-white/90"
          >
            <CalendarPlus className="size-5" aria-hidden="true" />
            {t('opening.book')}
          </button>
          <button
            type="button"
            onClick={onEnter}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/30 px-6 py-3.5 text-base font-semibold text-white transition hover:border-white/70"
          >
            <Stethoscope className="size-5" aria-hidden="true" />
            {t('opening.browse')}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-white/60">{t('opening.noAccount')}</p>
      </div>
    </div>
  )
}
