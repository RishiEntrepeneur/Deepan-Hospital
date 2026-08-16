import { CircleAlert, Info, Lock } from 'lucide-react'
import { useLanguage } from '../../i18n/context'
import { PAYMENT_METHODS, calculateTotal, visitTotal } from '../../lib/payment'
import { formatFee } from '../../lib/schedule'
import { cx } from '../../lib/cx'

/**
 * Choose how to pay. The appointment already exists at this point — the slot is
 * held either way, so a patient who abandons payment keeps their booking and
 * simply settles at the counter.
 */
export default function StepPayment({
  methodId,
  onMethodChange,
  consultationFee,
  doctor,
  visitType,
  visitCharges,
  convenienceFee,
  onlineAvailable,
  processing,
  errorKey,
  appointmentId,
}) {
  const { t, lang } = useLanguage()
  const { convenience, total } = calculateTotal(consultationFee, methodId, convenienceFee)
  /*
   * `consultationFee` here is the figure the server stored on the appointment,
   * which already includes the case-sheet charge — so showing it under a
   * "consultation fee" label overstated the consultation by ₹20–₹50. Split it
   * back into its parts where we know them, and fall back to the single line
   * where we do not.
   */
  const parts = visitTotal(doctor, visitType, visitCharges)
  const showParts = parts != null && parts.total === consultationFee

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-mint-200 bg-mint-50 px-4 py-3 text-sm text-mint-900">
        {t('pay.slotHeld', { id: appointmentId })}
      </div>

      {consultationFee == null ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
          <p className="text-sm text-slate-700">{t('pay.feeNotPublished')}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200">
          <dl className="divide-y divide-slate-100 text-sm">
            {showParts ? (
              <>
                <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <dt className="text-slate-600">{t('pay.consultationFee')}</dt>
                  <dd className="font-semibold text-slate-800">{formatFee(parts.consultation, lang)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <dt className="text-slate-600">
                    {visitType === 'review' ? t('visit.reviewCharge') : t('visit.firstCharge')}
                  </dt>
                  <dd className="font-semibold text-slate-800">{formatFee(parts.visitCharge, lang)}</dd>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="text-slate-600">{t('pay.appointmentFee')}</dt>
                <dd className="font-semibold text-slate-800">{formatFee(consultationFee, lang)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 px-4 py-2.5">
              <dt className="text-slate-600">{t('pay.convenienceFee')}</dt>
              <dd className="font-semibold text-slate-800">
                {convenience > 0 ? formatFee(convenience, lang) : t('pay.waived')}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 bg-slate-50 px-4 py-3">
              <dt className="font-bold text-slate-900">{t('pay.total')}</dt>
              <dd className="text-lg font-extrabold text-brand-700">{formatFee(total, lang)}</dd>
            </div>
          </dl>
        </div>
      )}

      <section>
        <h3 className="text-sm font-bold text-slate-900">{t('pay.choose')}</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {PAYMENT_METHODS.map((method) => {
            const Icon = method.icon
            const disabled =
              processing || (method.online && (!onlineAvailable || consultationFee == null))
            const selected = method.id === methodId
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => onMethodChange(method.id)}
                aria-pressed={selected}
                disabled={disabled}
                className={cx(
                  'flex items-start gap-3 rounded-xl border p-3.5 text-start transition',
                  disabled && 'cursor-not-allowed opacity-50',
                  !disabled && selected
                    ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-200'
                    : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50',
                )}
              >
                <Icon
                  className={cx('mt-0.5 size-5 shrink-0', selected ? 'text-brand-600' : 'text-slate-400')}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-900">{t(method.labelKey)}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{t(method.hintKey)}</span>
                </span>
              </button>
            )
          })}
        </div>

        {!onlineAvailable && (
          <p className="mt-2 text-xs text-slate-500">{t('pay.onlineUnavailableNote')}</p>
        )}
      </section>

      {methodId === 'counter' && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
          {t('pay.counterNote')}
        </p>
      )}

      {errorKey && (
        <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-rose-600">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {t(errorKey)}
        </p>
      )}

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
        <Lock className="size-3.5 shrink-0" aria-hidden="true" />
        {t('pay.gatewayNote')}
      </p>
    </div>
  )
}
