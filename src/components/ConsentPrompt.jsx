import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useLanguage } from '../i18n/context'

/**
 * Records consent, once, in plain words.
 *
 * The DPDP Act wants consent that is informed, specific and freely given, so
 * this says what is collected and who sees it rather than pointing at a wall
 * of text — and "Not now" genuinely dismisses it. Nothing here blocks the app:
 * a patient who has not agreed can still browse doctors and read the notice.
 * It is asked again on the next visit, and again if the notice changes.
 */
export default function ConsentPrompt({ open, onAgree, onDismiss, onRead }) {
  const { t } = useLanguage()
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const agree = async () => {
    setBusy(true)
    try {
      await onAgree()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 sm:inset-x-auto sm:end-5 sm:w-[26rem] print-hide">
      <div
        role="dialog"
        aria-label={t('privacy.consentTitle')}
        className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
            <ShieldCheck className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">{t('privacy.consentTitle')}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{t('privacy.consentText')}</p>
            <button
              type="button"
              onClick={onRead}
              className="mt-1.5 text-xs font-semibold text-brand-700 underline-offset-2 hover:underline"
            >
              {t('privacy.consentRead')}
            </button>
          </div>
        </div>

        <div className="mt-3.5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 transition hover:text-slate-800"
          >
            {t('privacy.consentLater')}
          </button>
          <button
            type="button"
            onClick={agree}
            disabled={busy}
            className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {t('privacy.consentAgree')}
          </button>
        </div>
      </div>
    </div>
  )
}
