import { useCallback, useEffect, useState } from 'react'
import {
  CircleUser,
  FileText,
  FlaskConical,
  LoaderCircle,
  Pill,
  RefreshCw,
  RotateCw,
  ScanLine,
  Stethoscope,
  Syringe,
  Users,
} from 'lucide-react'
import { useLanguage } from '../i18n/context'
import { api, errorKeyFor } from '../lib/api'
import { getDoctor } from '../data/hospital'
import { formatDateMedium } from '../lib/schedule'
import { cx } from '../lib/cx'
import { useState as useLocalState } from 'react'

const RECORD_ICON = {
  lab: FlaskConical,
  imaging: ScanLine,
  discharge: FileText,
  note: Stethoscope,
  vaccination: Syringe,
}

/**
 * The patient's own clinical view: where they stand in the queue right now,
 * what they were prescribed, and what results have been filed.
 *
 * The queue block refreshes on a timer — this is the screen someone keeps open
 * in the waiting room, or checks from home before setting out.
 */
function QueueCard({ token }) {
  const { t, tl, lang } = useLanguage()
  const doctor = getDoctor(token.doctorId)
  const isYourTurn = token.status === 'called' || token.status === 'in_consult'

  return (
    <div
      className={cx(
        'rounded-2xl border p-5',
        isYourTurn ? 'border-mint-300 bg-mint-50' : 'border-slate-200 bg-white',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {doctor ? tl(doctor.name) : token.doctorId}
          </p>
          <p className="text-xs text-slate-500">
            {formatDateMedium(token.date, lang)} · {token.session === 'morning' ? '☀' : '☾'}{' '}
            {token.appointmentId}
          </p>
        </div>
        <div className="text-end">
          <p className="label-caps text-slate-500">{t('health.tokenNumber')}</p>
          <p data-numeric className="font-display text-4xl leading-none text-slate-900">
            {token.number}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
        <div>
          <p className="label-caps text-slate-500">{t('health.nowServing')}</p>
          <p data-numeric className="font-display text-2xl text-brand-700">
            {token.currentToken || '—'}
          </p>
        </div>
        <div>
          <p className="label-caps text-slate-500">{t('doctors.timings')}</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">
            {isYourTurn
              ? t('health.beingSeen')
              : token.queueStatus === 'running'
                ? t('health.estWait', { count: token.estimatedWaitMinutes ?? 0 })
                : token.queueStatus === 'paused'
                  ? t('health.queuePaused')
                  : t('health.queueNotStarted')}
          </p>
        </div>
      </div>

      {!isYourTurn && token.queueStatus === 'running' && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <Users className="size-3.5" aria-hidden="true" />
          {t('health.aheadOfYou', { count: token.aheadOfYou })}
        </p>
      )}
    </div>
  )
}

/**
 * Repeat request control.
 *
 * Shows the state of any existing request rather than letting a patient send
 * the same ask twice — the server enforces that too, but a disabled button
 * with a reason is a better answer than an error.
 */
function RepeatControl({ prescription, repeat, onRequested }) {
  const { t } = useLanguage()
  const [open, setOpen] = useLocalState(false)
  const [note, setNote] = useLocalState('')
  const [busy, setBusy] = useLocalState(false)
  const [errorKey, setErrorKey] = useLocalState(null)

  if (repeat?.status === 'requested') {
    return (
      <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
        <RotateCw className="size-3.5" aria-hidden="true" />
        {t('health.repeatAsked')}
      </p>
    )
  }
  if (repeat?.status === 'declined') {
    return (
      <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
        <span className="font-semibold">{t('health.repeatDeclined')}</span>
        {repeat.decisionNote ? ` — ${repeat.decisionNote}` : ''}
      </p>
    )
  }
  if (repeat?.status === 'approved') {
    return (
      <p className="mt-3 rounded-lg bg-mint-50 px-3 py-2 text-xs font-semibold text-mint-800">
        {t('health.repeatApproved')}
      </p>
    )
  }

  const send = async () => {
    setBusy(true)
    setErrorKey(null)
    try {
      await api.clinical.askRepeat(prescription.id, note)
      await onRequested()
      setOpen(false)
      setNote('')
    } catch (error) {
      setErrorKey(errorKeyFor(error))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
      >
        <RotateCw className="size-3.5" aria-hidden="true" />
        {t('health.askRepeat')}
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-600">{t('health.repeatHelp')}</p>
      <textarea
        rows={2}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={t('health.repeatNote')}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
      />
      {errorKey && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-rose-700">
          {t(errorKey)}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={send}
          disabled={busy}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {t('health.repeatSend')}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600"
        >
          {t('action.cancel')}
        </button>
      </div>
    </div>
  )
}

export default function Health({ signedIn, onSignIn }) {
  const { t, tl, lang } = useLanguage()
  const [state, setState] = useState({ status: 'loading', tokens: [], prescriptions: [], records: [], repeats: [] })

  const load = useCallback(
    async (signal) => {
      if (!signedIn) return
      try {
        const [tokens, rx, records, repeats] = await Promise.all([
          api.clinical.myTokens(signal),
          api.clinical.prescriptions(signal),
          api.clinical.records(signal),
          api.clinical.myRepeats(signal),
        ])
        setState({
          status: 'ready',
          tokens: tokens.tokens,
          prescriptions: rx.prescriptions,
          records: records.records,
          repeats: repeats.repeats,
        })
      } catch (error) {
        if (error.name === 'AbortError') return
        setState((prev) => ({ ...prev, status: 'error' }))
      }
    },
    [signedIn],
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  // The queue moves without us; poll while the tab is open.
  useEffect(() => {
    if (!signedIn || state.tokens.length === 0) return undefined
    const timer = setInterval(() => load(), 20_000)
    return () => clearInterval(timer)
  }, [signedIn, state.tokens.length, load])

  if (!signedIn) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-50 text-brand-600">
          <CircleUser className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl text-slate-900">{t('health.signInPrompt')}</h1>
        <button
          type="button"
          onClick={onSignIn}
          className="mt-6 rounded-lg bg-brand-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-700"
        >
          {t('account.signIn')}
        </button>
      </div>
    )
  }

  if (state.status === 'loading') {
    return (
      <div className="grid place-items-center py-24">
        <LoaderCircle className="size-6 animate-spin text-brand-600" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-slate-900 sm:text-4xl">{t('health.title')}</h1>
          <p className="mt-2 text-slate-600">{t('health.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          {t('error.retry')}
        </button>
      </header>

      {/* ---- Live queue ---- */}
      <section className="mt-8">
        <h2 className="text-lg text-slate-900">{t('health.queueTitle')}</h2>
        {state.tokens.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
            {t('health.noQueue')}
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {state.tokens.map((token) => (
              <QueueCard key={token.tokenId} token={token} />
            ))}
          </div>
        )}
      </section>

      {/* ---- Prescriptions ---- */}
      <section className="mt-10">
        <h2 className="text-lg text-slate-900">{t('health.rxTitle')}</h2>
        {state.prescriptions.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
            {t('health.noRx')}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {state.prescriptions.map((rx) => {
              const doctor = getDoctor(rx.doctorId)
              return (
                <article key={rx.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {doctor ? tl(doctor.name) : rx.doctorName}
                    </p>
                    <p className="text-xs text-slate-500">{formatDateMedium(rx.createdAt.slice(0, 10), lang)}</p>
                  </div>
                  {rx.doctorQualification && (
                    <p className="text-xs text-slate-500">{rx.doctorQualification}</p>
                  )}

                  {rx.diagnosis && (
                    <p className="mt-3 text-sm text-slate-700">
                      <span className="label-caps text-slate-500">{t('health.diagnosis')}</span>{' '}
                      {rx.diagnosis}
                    </p>
                  )}

                  <ul className="mt-3 divide-y divide-slate-100 border-y border-slate-100">
                    {rx.items.map((item, index) => (
                      <li key={index} className="flex flex-wrap items-baseline gap-x-2 py-2.5 text-sm">
                        <Pill className="size-3.5 shrink-0 text-brand-600" aria-hidden="true" />
                        <span className="font-semibold text-slate-900">
                          {item.drug} {item.strength}
                        </span>
                        <span className="text-slate-600">
                          {[item.dose, item.frequency, item.duration].filter(Boolean).join(' · ')}
                        </span>
                        {item.instructions && (
                          <span className="text-xs text-slate-500">({item.instructions})</span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {rx.advice && <p className="mt-3 text-sm text-slate-600">{rx.advice}</p>}
                  {rx.followUpOn && (
                    <p className="mt-2 text-sm font-semibold text-brand-700">
                      {t('health.followUp', { date: formatDateMedium(rx.followUpOn, lang) })}
                    </p>
                  )}

                  <RepeatControl
                    prescription={rx}
                    repeat={state.repeats.find((r) => r.prescriptionId === rx.id)}
                    onRequested={() => load()}
                  />
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* ---- Records ---- */}
      <section className="mt-10">
        <h2 className="text-lg text-slate-900">{t('health.recordsTitle')}</h2>
        {state.records.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
            {t('health.noRecords')}
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {state.records.map((record) => {
              const Icon = RECORD_ICON[record.kind] ?? FileText
              return (
                <div key={record.id} className="border-t border-slate-200 px-5 py-4 first:border-t-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Icon className="size-4 shrink-0 text-brand-600" aria-hidden="true" />
                      {record.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t(`record.${record.kind}`)} · {formatDateMedium(record.recordedOn, lang)}
                    </p>
                  </div>
                  {record.body && (
                    <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-slate-600">
                      {record.body}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
