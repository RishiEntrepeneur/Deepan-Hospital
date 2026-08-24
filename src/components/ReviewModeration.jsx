import { useCallback, useEffect, useState } from 'react'
import { Check, LoaderCircle, Star, X } from 'lucide-react'
import { api } from '../lib/api'
import { cx } from '../lib/cx'

/**
 * Where staff decide what the public sees.
 *
 * Every review a patient writes lands here first and shows nowhere else until
 * somebody approves it. Rejecting keeps the row — so the same review cannot be
 * submitted again for that visit, and there is a record of the decision — it
 * simply never appears on the site.
 *
 * English only, like the rest of the desk: staff work in one language, patients
 * in three.
 */
export default function ReviewModeration({ onCountChange }) {
  const [status, setStatus] = useState('pending')
  const [state, setState] = useState({ loading: true, reviews: [], counts: {} })
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(
    async (which, signal) => {
      try {
        const data = await api.desk.reviews(which, signal)
        setState({ loading: false, reviews: data.reviews, counts: data.counts })
        onCountChange?.(data.counts.pending ?? 0)
      } catch (err) {
        if (err.name === 'AbortError') return
        setState((s) => ({ ...s, loading: false }))
      }
    },
    [onCountChange],
  )

  useEffect(() => {
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true }))
    load(status, controller.signal)
    return () => controller.abort()
  }, [status, load])

  const decide = async (id, decision) => {
    setBusyId(id)
    try {
      await api.desk.moderateReview(id, decision)
      await load(status)
    } finally {
      setBusyId(null)
    }
  }

  const tabs = [
    { id: 'pending', label: 'Waiting' },
    { id: 'approved', label: 'On the site' },
    { id: 'rejected', label: 'Hidden' },
  ]

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            onClick={() => setStatus(tabItem.id)}
            className={cx(
              'inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition',
              status === tabItem.id
                ? 'bg-brand-600 text-white'
                : 'border border-slate-300 text-slate-700 hover:bg-slate-50',
            )}
          >
            {tabItem.label}
            <span
              className={cx(
                'inline-flex min-w-5 justify-center rounded px-1.5 text-[11px] font-bold',
                status === tabItem.id ? 'bg-white/20' : 'bg-slate-100 text-slate-600',
              )}
            >
              {state.counts[tabItem.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
        A review is only shown on the website once it is approved here. Rejecting
        hides it for good — the patient is not told either way.
      </p>

      {state.loading ? (
        <div className="grid place-items-center py-16">
          <LoaderCircle className="size-6 animate-spin text-brand-600" aria-hidden="true" />
        </div>
      ) : state.reviews.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-14 text-center">
          <p className="text-sm font-semibold text-slate-600">
            {status === 'pending' ? 'Nothing waiting to be approved.' : 'Nothing here.'}
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {state.reviews.map((r) => (
            <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Stars value={r.rating} />
                    <span className="text-sm font-bold text-slate-900">{r.name}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {r.doctorName ? `${r.doctorName} · ` : ''}
                    {r.visitDate ? `visit ${r.visitDate}` : ''}
                  </p>
                </div>

                {status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => decide(r.id, 'approved')}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                      Show on site
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => decide(r.id, 'rejected')}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                      Hide
                    </button>
                  </div>
                )}
              </div>
              {r.comment && <p className="mt-2.5 text-sm text-slate-700">“{r.comment}”</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Stars({ value }) {
  return (
    <span className="inline-flex" role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cx(
            'size-3.5',
            n <= value ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200',
          )}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}
