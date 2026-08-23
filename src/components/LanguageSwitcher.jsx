import { Languages } from 'lucide-react'
import { useLanguage } from '../i18n/context'
import { cx } from '../lib/cx'

/**
 * Segmented EN / தமிழ் control. Rendered as a radiogroup so screen readers
 * announce it as a single choice rather than two loose buttons.
 */
export default function LanguageSwitcher({ className, showIcon = true }) {
  const { lang, setLang, languages, t } = useLanguage()

  return (
    <div
      data-tour="language"
      role="radiogroup"
      aria-label={t('nav.switchLanguage')}
      className={cx(
        'inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1',
        className,
      )}
    >
      {showIcon && <Languages className="ms-1.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />}
      {languages.map((option) => {
        const active = option.code === lang
        return (
          <button
            key={option.code}
            type="button"
            role="radio"
            aria-checked={active}
            lang={option.code}
            title={option.name}
            onClick={() => setLang(option.code)}
            className={cx(
              // min-h-11: 44px, the smallest a thumb reliably hits. Was 28px, which is
              // fine for a mouse and awkward for the patients this is built for.
              'inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold transition',
              active
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white hover:text-brand-700',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
