import { useState } from 'react'
import { Download, LoaderCircle, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react'
import { useLanguage } from '../i18n/context'
import { useCatalog } from '../lib/useCatalog'
import { api, errorKeyFor } from '../lib/api'
import { HOSPITAL } from '../data/hospital'
import Modal from '../components/Modal'

/**
 * Privacy notice and the two rights a patient is most likely to use.
 *
 * Written to be read by a patient, not by a lawyer, and wired to endpoints
 * that actually do the thing — a notice promising a right that has to be
 * requested by email is a promise nobody keeps.
 */
function Section({ title, children }) {
  return (
    <section className="border-t border-slate-200 pt-6">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  )
}

export default function Privacy({ currentUser, onSignedOut }) {
  const { t } = useLanguage()
  const catalog = useCatalog()
  // The named data-protection contact, or the hospital's general address.
  const privacyContact = catalog.privacy?.contact || HOSPITAL.email
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(false)

  const download = async () => {
    setBusy('export')
    setError(null)
    try {
      const data = await api.auth.exportData()
      // Built in the browser so the file never passes through anywhere else.
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'deepan-my-data.json'
      link.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(t(errorKeyFor(e)))
    } finally {
      setBusy(null)
    }
  }

  const erase = async () => {
    setBusy('erase')
    setError(null)
    try {
      await api.auth.erase()
      setConfirming(false)
      onSignedOut?.()
    } catch (e) {
      setError(t(errorKeyFor(e)))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <header>
        <span className="label-caps inline-flex items-center gap-2 text-brand-700">
          <ShieldCheck className="size-4" aria-hidden="true" />
          {t('privacy.badge')}
        </span>
        <h1 className="mt-3 text-3xl text-slate-900 sm:text-4xl">{t('privacy.title')}</h1>
        <p className="mt-2.5 text-slate-600">{t('privacy.intro')}</p>
      </header>

      <div className="mt-8 space-y-6">
        <Section title={t('privacy.whatTitle')}>
          <p>{t('privacy.whatText')}</p>
        </Section>

        <Section title={t('privacy.whyTitle')}>
          <p>{t('privacy.whyText')}</p>
        </Section>

        <Section title={t('privacy.sharingTitle')}>
          <p>{t('privacy.sharingText')}</p>
        </Section>

        <Section title={t('privacy.keepTitle')}>
          <p>{t('privacy.keepText')}</p>
        </Section>

        <Section title={t('privacy.rightsTitle')}>
          <p>{t('privacy.rightsText')}</p>

          {currentUser ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={download}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {busy === 'export' ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="size-4" aria-hidden="true" />
                )}
                {t('privacy.downloadCta')}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {t('privacy.eraseCta')}
              </button>
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {t('privacy.signInToUse')}
            </p>
          )}

          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-rose-700">
              {error}
            </p>
          )}
        </Section>

        <Section title={t('privacy.contactTitle')}>
          <p>
            {t('privacy.contactText')}{' '}
            {/* The data-protection contact where the hospital has named one,
                otherwise the general address. */}
            <a href={`mailto:${privacyContact}`} className="font-semibold text-brand-700 hover:underline">
              {privacyContact}
            </a>
          </p>
        </Section>
      </div>

      <Modal open={confirming} onClose={() => setConfirming(false)} title={t('privacy.eraseCta')}>
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-rose-600" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-slate-700">{t('privacy.eraseWarning')}</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {t('action.cancel')}
          </button>
          <button
            type="button"
            onClick={erase}
            disabled={busy === 'erase'}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            {busy === 'erase' && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            {t('privacy.eraseConfirm')}
          </button>
        </div>
      </Modal>
    </div>
  )
}
