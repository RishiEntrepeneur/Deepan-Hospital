import { ArrowRight, CalendarPlus, Clock, Compass } from 'lucide-react'
import { useLanguage } from '../../i18n/context'
import { iconFor } from '../../data/hospital'
import { HERO_STATS } from '../../data/homeSections'
import Photo from '../Photo'

/**
 * The opening of the site: who this hospital is, and the two things a visitor
 * came to do.
 *
 * Deliberately not the usual arrangement. The booking panel used to be a
 * translucent, blurred, heavily rounded card floating over a gradient — the
 * house style of every generated landing page — and the buttons carried a
 * coloured glow and lifted on hover. All of that is gone: the panel is opaque,
 * squared off and ruled, sitting on the grid rather than hovering above it,
 * and a button is a solid block of the brand colour that simply darkens when
 * you point at it.
 *
 * The columns are 7/5 rather than 6/6, so the headline and the panel are
 * plainly unequal — the page has a subject and a sidebar, not two equal halves.
 */
export default function Hero({ facts, onBook, onNavigate, onSelectDepartment, onStartTour, departments }) {
  const { t, tl } = useLanguage()

  return (
    <section className="relative overflow-hidden border-b border-slate-300 bg-white">
      <Photo
        src="/hero.jpg"
        alt=""
        className="pointer-events-none absolute inset-0 size-full"
        aria-hidden="true"
      />
      {/* A flat scrim, not a gradient: the photograph is background, not decoration. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-white/92" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="grid gap-x-16 gap-y-14 lg:grid-cols-12">
          {/* ---- The subject ---- */}
          <div className="min-w-0 lg:col-span-7">
            <p className="label-caps flex items-center gap-2 text-slate-500">
              <span className="inline-block size-1.5 rounded-full bg-mint-500" aria-hidden="true" />
              {t('home.heroBadge')}
            </p>

            <h1 className="mt-5 font-display text-[2.75rem] leading-[1.03] text-slate-900 sm:text-6xl lg:text-7xl">
              {t('home.heroTitle', facts)}
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              {t('home.heroSubtitle', facts)}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-tour="book"
                onClick={onBook}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-brand-600 px-7 text-base font-bold text-white transition-colors hover:bg-brand-700"
              >
                <CalendarPlus className="size-5" aria-hidden="true" />
                {t('action.book')}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('doctors')}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-400 px-7 text-base font-bold text-slate-800 transition-colors hover:border-slate-900 hover:bg-slate-50"
              >
                {t('nav.doctors')}
                <ArrowRight className="size-5" aria-hidden="true" />
              </button>
            </div>

            {onStartTour && (
              <button
                type="button"
                onClick={onStartTour}
                className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 underline underline-offset-4 transition-colors hover:text-brand-800"
              >
                <Compass className="size-4" aria-hidden="true" />
                {t('tour.replay')}
              </button>
            )}

            {/* Figures on a rule, rather than in three little boxes. */}
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-x-8 border-t border-slate-300 pt-5">
              {HERO_STATS.map((stat) => (
                <div key={stat.id}>
                  <dt className="sr-only">{t(stat.labelKey)}</dt>
                  <dd>
                    <span data-numeric className="block font-display text-4xl text-slate-900">
                      {facts[stat.factKey]}
                    </span>
                    <span className="mt-1 block text-xs leading-snug text-slate-500">
                      {t(stat.labelKey)}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* ---- The sidebar: start booking from here ---- */}
          <aside className="min-w-0 lg:col-span-5">
            <div className="border-t-2 border-slate-900 bg-white">
              <div className="border-x border-b border-slate-300 px-5 py-5 sm:px-6">
                <h2 className="font-display text-2xl leading-snug text-slate-900">
                  {t('home.ctaTitle')}
                </h2>
                <p className="mt-1 text-sm text-slate-600">{t('home.ctaText')}</p>

                <ul className="mt-5 divide-y divide-slate-200 border-y border-slate-200">
                  {departments.map((dept) => {
                    const Icon = iconFor(dept.icon)
                    return (
                      <li key={dept.id}>
                        <button
                          type="button"
                          onClick={() => onSelectDepartment(dept.id)}
                          className="group flex w-full items-center gap-3 py-3 text-start transition-colors hover:text-brand-700"
                        >
                          <Icon className="size-5 shrink-0 text-brand-600" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 group-hover:text-brand-700">
                            {tl(dept.name)}
                          </span>
                          <ArrowRight
                            className="size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </button>
                      </li>
                    )
                  })}
                </ul>

                <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock className="size-3.5" aria-hidden="true" />
                  {t('contact.opdHours')}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
