import { useState } from 'react'
import { LoaderCircle, Search } from 'lucide-react'
import { api } from '../../lib/api'
import AttachmentStrip from '../AttachmentStrip'

/**
 * Look a booking up from the reference on the patient's slip.
 *
 * This is the commonest call the front desk takes — somebody rings and reads
 * out "DH-455QK9", or gives the number they booked with. Everything else in
 * the desk is a list of today and the days around it; a patient asking about a
 * booking from last month had nowhere to be found.
 *
 * The search runs on the server rather than filtering what is already on
 * screen, because the loaded list stops at 500 recent bookings and the whole
 * point is finding one that is not in it.
 */
export default function FindBooking() {
  const [term, setTerm] = useState('')
  const [state, setState] = useState({ idle: true, busy: false, results: [] })

  const search = async (event) => {
    event.preventDefault()
    const q = term.trim()
    if (!q) return
    setState({ idle: false, busy: true, results: [] })
    try {
      const data = await api.desk.findAppointments(q)
      setState({ idle: false, busy: false, results: data.appointments })
    } catch {
      setState({ idle: false, busy: false, results: [] })
    }
  }

  return (
    <section>
      <form onSubmit={search} className="flex flex-wrap gap-2">
        <label htmlFor="find-booking" className="sr-only">
          Reference, phone number or name
        </label>
        <input
          id="find-booking"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="DH-455QK9, 98430 74989, or a name"
          autoComplete="off"
          className="min-w-64 flex-1 rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-600"
        />
        <button
          type="submit"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-bold text-white transition-colors hover:bg-brand-700"
        >
          <Search className="size-4" aria-hidden="true" />
          Find
        </button>
      </form>

      <p className="mt-3 text-xs text-slate-500">
        The reference is printed on the patient&rsquo;s slip and read out when they book.
        The &ldquo;DH-&rdquo; is optional.
      </p>

      {state.busy && (
        <div className="grid place-items-center py-14">
          <LoaderCircle className="size-6 animate-spin text-brand-600" aria-hidden="true" />
        </div>
      )}

      {!state.idle && !state.busy && state.results.length === 0 && (
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
          <p className="text-sm font-semibold text-slate-600">Nothing matched that.</p>
          <p className="mt-1 text-xs text-slate-500">
            Check the reference, or try the phone number they booked with.
          </p>
        </div>
      )}

      {state.results.length > 0 && (
        <ul className="mt-5 space-y-2.5">
          {state.results.map((a) => (
            <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="font-mono text-sm font-bold text-slate-900">{a.id}</span>
                  <span className="text-sm font-semibold text-slate-800">{a.patient.name}</span>
                  <a href={`tel:${a.patient.phone}`} className="text-xs text-brand-700 hover:underline">
                    {a.patient.phone}
                  </a>
                </div>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {a.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {a.date ?? 'callback'} {a.slot ? `· ${a.slot}` : ''} · {a.patient.reason || 'No reason given'}
              </p>
              <AttachmentStrip attachments={a.attachments} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
