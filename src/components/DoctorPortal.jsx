import { useCallback, useEffect, useState } from 'react'
import { LoaderCircle, LogOut, RefreshCw, ExternalLink, CalendarDays, Phone } from 'lucide-react'
import { api } from '../lib/api'
import { useCatalog } from '../lib/useCatalog'
import { getDoctor } from '../data/hospital'
import { cx } from '../lib/cx'

/**
 * The doctor portal — a consultant's own day, and nothing more.
 *
 * Deliberately read-only. Prescriptions and patient history live in Klinique,
 * the hospital's clinical system; a second place to write them would be a
 * second record that could disagree about a real patient. This screen answers
 * one question — "who am I seeing today?" — without opening Klinique, and hands
 * off to Klinique for the actual work with one button.
 *
 * The list comes from GET /api/admin/my-day, which is scoped on the server to
 * the signed-in doctor's own id. Nothing here can read another doctor's list.
 */
export default function DoctorPortal({ staff, onSignedOut }) {
  const { klinique } = useCatalog()
  const portalUrl = klinique?.portalUrl || 'https://deepan.klinique.net'

  const [state, setState] = useState({ loading: true, error: null, date: null, appointments: [] })
  const [busy, setBusy] = useState(false)

  const name = staff.fullName?.trim() || getDoctor(staff.doctorId)?.name.en || 'Doctor'

  const load = useCallback(async (signal) => {
    try {
      const data = await api.desk.myDay(undefined, signal)
      setState({ loading: false, error: null, date: data.date, appointments: data.appointments })
    } catch (err) {
      if (err.name === 'AbortError') return
      setState((s) => ({ ...s, loading: false, error: err.message || 'Could not load your list.' }))
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  const refresh = async () => {
    setBusy(true)
    await load()
    setBusy(false)
  }

  const signOut = async () => {
    try {
      await api.desk.signOut()
    } finally {
      onSignedOut?.()
    }
  }

  const prettyDate = state.date
    ? new Date(`${state.date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'long', day: 'numeric', month: 'long',
      })
    : ''

  const list = state.appointments
  const waiting = list.filter((a) => a.kind === 'callback')
  const slots = list.filter((a) => a.kind !== 'callback')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
            <CalendarDays className="size-4" aria-hidden="true" />
            {prettyDate || 'Today'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            Open Klinique
          </a>
          <button
            type="button"
            onClick={refresh}
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className={cx('size-4', busy && 'animate-spin')} aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </header>

      <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
        This is your appointment list for the day. Write-ups, prescriptions and
        history stay in Klinique — the button above opens it.
      </p>

      {state.loading ? (
        <div className="grid place-items-center py-20">
          <LoaderCircle className="size-6 animate-spin text-brand-600" aria-hidden="true" />
        </div>
      ) : state.error ? (
        <p role="alert" className="mt-6 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {state.error}
        </p>
      ) : list.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
          <p className="text-base font-semibold text-slate-700">No appointments booked for today.</p>
          <p className="mt-1 text-sm text-slate-500">New bookings appear here as patients make them.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {slots.length > 0 && (
            <section>
              <h2 className="text-sm font-bold tracking-wide text-slate-500 uppercase">
                By appointment ({slots.length})
              </h2>
              <ul className="mt-3 space-y-2.5">
                {slots.map((a) => <Row key={a.id} appt={a} />)}
              </ul>
            </section>
          )}
          {waiting.length > 0 && (
            <section>
              <h2 className="text-sm font-bold tracking-wide text-slate-500 uppercase">
                Call-back requests ({waiting.length})
              </h2>
              <ul className="mt-3 space-y-2.5">
                {waiting.map((a) => <Row key={a.id} appt={a} />)}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

/** One appointment, read-only. */
function Row({ appt }) {
  const p = appt.patient
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-3">
          {appt.slot && (
            <span className="rounded-md bg-brand-50 px-2 py-0.5 text-sm font-bold text-brand-700 tabular-nums">
              {appt.slot}
            </span>
          )}
          <span className="text-base font-bold text-slate-900">{p.name}</span>
          {p.age != null && <span className="text-sm text-slate-500">{p.age} yrs</span>}
        </div>
        <span
          className={cx(
            'rounded-md px-2 py-0.5 text-xs font-semibold',
            appt.status === 'confirmed'
              ? 'bg-mint-50 text-mint-700'
              : appt.status === 'completed'
                ? 'bg-slate-100 text-slate-600'
                : 'bg-amber-50 text-amber-700',
          )}
        >
          {appt.status}
        </span>
      </div>
      {p.reason && <p className="mt-1.5 text-sm text-slate-700">{p.reason}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1.5 hover:text-brand-700">
          <Phone className="size-3.5" aria-hidden="true" />
          {p.phone}
        </a>
        {appt.visitType && <span>{appt.visitType === 'first' ? 'First visit' : 'Review'}</span>}
        <span className="uppercase">{appt.klinique?.status === 'done' ? 'in Klinique' : 'not yet in Klinique'}</span>
      </div>
    </li>
  )
}
