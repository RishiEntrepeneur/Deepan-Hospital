import { useCallback, useEffect, useId, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { api } from '../lib/api'
import { useLanguage } from '../i18n/context'

/**
 * The "prove you are a person" field: a sum to answer.
 *
 * Deliberately not Google's or Cloudflare's. A patient booking a doctor should
 * not be profiled by a third party on the way in, and the hospital should not
 * have to hold an account with one to keep bots off its sign-up form.
 *
 * The parent owns the answer (it has to send it), so this component reports the
 * token and answer upward through `onChange` and holds only the question.
 * `refresh()` is exposed through a ref-like prop because a rejected sum must be
 * replaced — the server burns a token once it has been tried.
 */
export default function CaptchaField({ value, onChange, onReady }) {
  const { t } = useLanguage()
  const id = useId()
  const [question, setQuestion] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchOne = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.auth.captcha()
      setQuestion(data.question)
      onChange({ token: data.token, answer: '' })
    } catch {
      setQuestion(null)
    } finally {
      setLoading(false)
    }
  }, [onChange])

  useEffect(() => {
    fetchOne()
  }, [fetchOne])

  // Hand the refresher up, so a parent can replace a spent sum after a refusal.
  useEffect(() => {
    onReady?.(fetchOne)
  }, [onReady, fetchOne])

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
        {t('captcha.label')}
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <span
          className="inline-flex min-w-24 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-base font-bold tabular-nums text-slate-900 select-none"
          aria-hidden="true"
        >
          {loading ? '…' : (question ?? '—')}
        </span>
        <span className="text-lg font-bold text-slate-400" aria-hidden="true">
          =
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required
          aria-label={question ? t('captcha.aria', { sum: question }) : t('captcha.label')}
          value={value?.answer ?? ''}
          onChange={(e) => onChange({ token: value?.token, answer: e.target.value })}
          className="w-24 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base outline-none focus:border-brand-600"
        />
        <button
          type="button"
          onClick={fetchOne}
          aria-label={t('captcha.newSum')}
          title={t('captcha.newSum')}
          className="grid size-10 place-items-center rounded-xl border border-slate-300 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-1.5 text-xs text-slate-500">{t('captcha.hint')}</p>
    </div>
  )
}
