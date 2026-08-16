import { Banknote, CircleCheck, Download, Printer } from 'lucide-react'
import { useLanguage } from '../../i18n/context'
import { downloadSummary, printSummary, summaryRows } from '../../lib/summary'
import { cx } from '../../lib/cx'

export default function StepConfirmation({ appointment, isReschedule }) {
  const { t, tl, lang } = useLanguage()
  const ctx = { t, tl, lang }
  const rows = summaryRows(appointment, ctx)
  const payment = appointment.payment
  const held = appointment.status === 'pending'

  return (
    <div className="text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-mint-100">
        <CircleCheck className="size-9 text-mint-600" aria-hidden="true" />
      </span>

      {/* A booking taken while reception is closed is confirmed outright; one
          taken during desk hours waits for approval. The patient is told which
          of the two happened rather than a single hopeful message. */}
      <h3 className="mt-4 text-xl font-bold text-slate-900">
        {t(
          isReschedule
            ? 'booking.rescheduleSuccessTitle'
            : held
              ? 'booking.heldTitle'
              : 'booking.successTitle',
        )}
      </h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
        {t(
          isReschedule
            ? 'booking.rescheduleSuccessText'
            : held
              ? 'booking.heldText'
              : 'booking.successText',
        )}
      </p>

      <div className="mt-5 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50 px-5 py-4">
        <p className="text-xs font-bold tracking-wider text-brand-700 uppercase">
          {t('booking.appointmentId')}
        </p>
        <p className="mt-1 font-mono text-2xl font-extrabold tracking-widest text-brand-800 sm:text-3xl">
          {appointment.id}
        </p>
        <p className="mt-1.5 text-xs text-slate-600">{t('booking.saveId')}</p>
      </div>

      {payment && (
        <div
          className={cx(
            'mt-3 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold',
            payment.status === 'paid'
              ? 'bg-mint-50 text-mint-800'
              : 'bg-amber-50 text-amber-800',
          )}
        >
          {payment.status === 'paid' ? (
            <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
          ) : (
            <Banknote className="size-4 shrink-0" aria-hidden="true" />
          )}
          {payment.status === 'paid'
            ? `${t('pay.paid')}${payment.instrument ? ` · ${payment.instrument}` : ''}`
            : t('pay.pending')}
        </div>
      )}

      <dl className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200 text-start">
        {rows.slice(1).map((row) => (
          <div key={row.label} className="flex gap-4 px-4 py-2.5">
            <dt className="w-2/5 shrink-0 text-xs text-slate-500">{row.label}</dt>
            <dd className="min-w-0 flex-1 text-sm font-semibold break-words text-slate-800">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => downloadSummary(appointment, ctx)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
        >
          <Download className="size-4" aria-hidden="true" />
          {t('action.download')}
        </button>
        <button
          type="button"
          onClick={() => printSummary(appointment, ctx)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
        >
          <Printer className="size-4" aria-hidden="true" />
          {t('action.print')}
        </button>
      </div>
    </div>
  )
}
