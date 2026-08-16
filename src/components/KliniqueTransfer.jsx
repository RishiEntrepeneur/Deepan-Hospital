import { useCallback, useEffect, useState } from 'react'
import { Check, ClipboardList, Copy, ExternalLink, LoaderCircle, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'
import { useCatalog } from '../lib/useCatalog'
import { cx } from '../lib/cx'

/**
 * Moving a booking into Klinique.
 *
 * Until Klinique gives the hospital an API key there is no automatic path
 * between the two systems, so somebody types it across. This makes that the
 * fastest thing on the screen rather than the worst part of the day: every
 * field in one place, one tap to copy each, and a tick so nothing is entered
 * twice or missed.
 *
 * The tick is the important part. Without a record of what has been
 * transferred, the only way to know is to search Klinique for each one — and
 * the failure mode is a patient who turns up to a clinic that never heard of
 * them.
 */

/** One field, with its own copy button. */
function Field({ label, value, wide = false }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 1200)
    return () => clearTimeout(timer)
  }, [copied])

  if (value == null || value === '') return null

  return (
    <div className={cx('min-w-0', wide && 'sm:col-span-2')}>
      <p className="label-caps text-slate-500">{label}</p>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(String(value)).then(
            () => setCopied(true),
            () => {},
          )
        }}
        title="Copy"
        className="mt-0.5 flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-start text-sm text-slate-900 transition hover:bg-brand-50"
      >
        <span className="min-w-0 flex-1 break-words">{value}</span>
        {copied ? (
          <Check className="mt-0.5 size-3.5 shrink-0 text-mint-600" aria-hidden="true" />
        ) : (
          <Copy className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}

/**
 * Copies the whole appointment as one labelled block, so reception pastes once
 * rather than copying ten fields. This is as close to "automatic" as the
 * hospital can get until Klinique issue an API key — the parent app cannot
 * reach into the embedded portal to fill its form, because the browser's
 * same-origin rule forbids one site scripting another's page.
 */
function CopyAll({ appointment: a }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 1400)
    return () => clearTimeout(timer)
  }, [copied])

  const block = [
    `Reference: ${a.id}`,
    `Patient: ${a.patient?.name ?? ''}`,
    `Phone: ${a.patient?.phone ?? ''}`,
    `Age: ${a.patient?.age ?? ''}`,
    `Gender: ${a.patient?.gender ?? ''}`,
    `Doctor: ${a.doctorName ?? a.doctorId}`,
    `Date: ${a.date}`,
    `Time: ${a.slot}`,
    `Visit: ${a.visitType === 'review' ? 'Review' : 'First visit'}`,
    a.fee == null ? null : `Fee: ₹${a.fee}`,
    `Reason: ${a.patient?.reason ?? ''}`,
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(block).then(() => setCopied(true), () => {})}
      className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-100"
    >
      {copied ? <Check className="size-3.5" aria-hidden="true" /> : <ClipboardList className="size-3.5" aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy all'}
    </button>
  )
}

export default function KliniqueTransfer() {
  const { klinique } = useCatalog()
  const portalUrl = klinique?.portalUrl ?? 'https://deepan.klinique.net'
  const [state, setState] = useState({ status: 'loading', outstanding: [], mode: 'manual' })
  const [saving, setSaving] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await api.desk.kliniqueWorklist()
      setState({ status: 'ready', ...data })
    } catch {
      setState((prev) => ({ ...prev, status: 'error' }))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const markDone = async (id) => {
    setSaving(id)
    try {
      await api.desk.kliniqueEntered(id)
      // Drop it locally rather than refetching — the desk is often on a slow
      // connection and a full reload here loses the reader's place.
      setState((prev) => ({
        ...prev,
        outstanding: prev.outstanding.filter((a) => a.id !== id),
      }))
    } finally {
      setSaving(null)
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="grid place-items-center py-16">
        <LoaderCircle className="size-6 animate-spin text-brand-600" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            To enter in Klinique
            {state.outstanding.length > 0 && (
              <span className="ms-2 rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                {state.outstanding.length}
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {state.mode === 'api' || state.mode === 'session'
              ? 'Sending automatically. These are the ones that failed — enter them by hand.'
              : 'Copy each field across, then tick it off.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Refresh
          </button>
          <a
            href={portalUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            Open Klinique
          </a>
        </div>
      </div>

      {state.outstanding.length === 0 ? (
        <div className="rounded-xl border border-mint-200 bg-mint-50 px-4 py-6 text-center">
          <Check className="mx-auto size-6 text-mint-600" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-mint-900">
            Everything is in Klinique.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {state.outstanding.map((a) => (
            <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <span className="font-mono text-xs font-semibold text-brand-700">{a.id}</span>
                <div className="flex items-center gap-2">
                  <CopyAll appointment={a} />
                  <button
                    type="button"
                    onClick={() => markDone(a.id)}
                    disabled={saving === a.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-mint-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-mint-700 disabled:opacity-50"
                  >
                    <Check className="size-3.5" aria-hidden="true" />
                    Entered in Klinique
                  </button>
                </div>
              </div>

              {/*
                * Field order matches how a booking is usually keyed in: who,
                * then when, then why. Reception reads straight down.
                */}
              <div className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                <Field label="Patient" value={a.patient?.name} />
                <Field label="Phone" value={a.patient?.phone} />
                <Field label="Age" value={a.patient?.age} />
                <Field label="Gender" value={a.patient?.gender} />
                <Field label="Doctor" value={a.doctorName ?? a.doctorId} />
                <Field label="Date" value={a.date} />
                <Field label="Time" value={a.slot} />
                <Field label="Visit" value={a.visitType === 'review' ? 'Review' : 'First visit'} />
                <Field label="Fee" value={a.fee == null ? null : `₹${a.fee}`} />
                <Field label="Reason" value={a.patient?.reason} wide />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
