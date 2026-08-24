import { CalendarPlus } from 'lucide-react'
import { useLanguage } from '../../i18n/context'

/**
 * The last thing on the page: book, or call.
 *
 * A full-width band in the brand colour, with the words on the left and the
 * action on the right — not a rounded, centred, floating panel. Centring
 * everything is what makes a closing section look like every other closing
 * section; a band that runs the width of the column reads as part of the page.
 */
export default function ClosingCta({ onBook, phone }) {
  const { t } = useLanguage()

  return (
    <section className="bg-brand-700">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="max-w-xl">
          <h2 className="font-display text-3xl leading-tight text-white sm:text-4xl">
            {t('home.ctaTitle')}
          </h2>
          <p className="mt-3 text-brand-100">{t('home.ctaText')}</p>
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onBook}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-white px-7 text-base font-bold text-brand-700 transition-colors hover:bg-brand-50"
          >
            <CalendarPlus className="size-5" aria-hidden="true" />
            {t('action.book')}
          </button>
          {phone && (
            <a
              href={`tel:${phone.replace(/\s/g, '')}`}
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-brand-300 px-7 text-base font-semibold text-white transition-colors hover:bg-brand-800"
            >
              {phone}
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
