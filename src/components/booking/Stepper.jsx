import { Check } from 'lucide-react'
import { useLanguage } from '../../i18n/context'
import { cx } from '../../lib/cx'

/** Horizontal progress rail above the booking form. */
export default function Stepper({ steps, current }) {
  const { t } = useLanguage()

  return (
    <ol className="mb-6 flex items-center gap-1.5 sm:gap-2" aria-label={t('booking.title')}>
      {steps.map((step, index) => {
        const done = index < current
        const active = index === current
        return (
          <li key={step.key} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              aria-current={active ? 'step' : undefined}
              className={cx(
                'grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold transition',
                done && 'bg-mint-500 text-white',
                active && 'bg-brand-600 text-white ring-4 ring-brand-100',
                !done && !active && 'bg-slate-200 text-slate-500',
              )}
            >
              {done ? <Check className="size-4" aria-hidden="true" /> : index + 1}
            </span>
            <span
              className={cx(
                'hidden min-w-0 truncate text-xs font-semibold sm:block',
                active ? 'text-brand-700' : 'text-slate-500',
              )}
            >
              {t(step.labelKey)}
            </span>
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cx('h-0.5 flex-1 rounded-full', done ? 'bg-mint-400' : 'bg-slate-200')}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
