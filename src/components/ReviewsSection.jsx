import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { api } from '../lib/api'
import { useLanguage } from '../i18n/context'
import { cx } from '../lib/cx'

/**
 * The public wall of patient reviews.
 *
 * Self-contained: it fetches its own list and renders nothing at all until it
 * has one, so a slow or failed request never leaves an empty heading stranded
 * on the home page. Only reviews a staff member has approved ever reach this
 * endpoint, so there is nothing to moderate here — just to show.
 */
export default function ReviewsSection() {
  const { t } = useLanguage()
  const [state, setState] = useState({ loading: true, summary: null, reviews: [] })

  useEffect(() => {
    const controller = new AbortController()
    api.reviews
      .list(controller.signal)
      .then((data) =>
        setState({ loading: false, summary: data.summary, reviews: data.reviews }),
      )
      .catch((err) => {
        if (err.name === 'AbortError') return
        setState({ loading: false, summary: null, reviews: [] })
      })
    return () => controller.abort()
  }, [])

  // Say nothing rather than show an empty section: a brand-new hospital site
  // with no reviews yet should not advertise that.
  if (state.loading || state.reviews.length === 0) return null

  const { summary, reviews } = state

  return (
    <section className="bg-slate-50 py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {t('reviews.title')}
            </h2>
            <p className="mt-2 text-slate-600">{t('reviews.subtitle')}</p>
          </div>
          {summary?.average != null && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <span className="text-3xl font-extrabold tabular-nums text-slate-900">
                {summary.average.toFixed(1)}
              </span>
              <div>
                <Stars value={Math.round(summary.average)} />
                <p className="mt-0.5 text-xs text-slate-500">
                  {summary.count === 1
                    ? t('reviews.countOne')
                    : t('reviews.count', { count: summary.count })}
                </p>
              </div>
            </div>
          )}
        </div>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5"
            >
              <Stars value={r.rating} />
              {r.comment && (
                <p className="mt-3 flex-1 text-slate-700">“{r.comment}”</p>
              )}
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                {r.doctorName && (
                  <p className="text-xs text-slate-500">{t('reviews.with', { doctor: r.doctorName })}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** A row of five stars, filled to `value`. Decorative — the number is the label. */
function Stars({ value }) {
  return (
    <span className="inline-flex" role="img" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cx(
            'size-4',
            n <= value ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200',
          )}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}
