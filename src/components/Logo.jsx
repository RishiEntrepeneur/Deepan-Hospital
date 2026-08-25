import { useState } from 'react'
import { useLanguage } from '../i18n/context'
import { cx } from '../lib/cx'
import BrandMark from './BrandMark'

/** Hospital wordmark: a stethoscope-inspired glyph plus the name in the active language. */
export default function Logo({ compact = false, onClick, className }) {
  const { t } = useLanguage()

  /*
   * Prefer the hospital's own artwork at public/logo.png (or .svg — just
   * change the path). BrandMark is a hand-drawn approximation used only until
   * that file exists, so dropping the real file in is all that is needed to
   * make the logo exact.
   */
  const [artworkFailed, setArtworkFailed] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx('group flex items-center gap-2.5 text-left', className)}
    >
      {artworkFailed ? (
        <>
          <BrandMark className="size-10 shrink-0 transition group-hover:scale-105 sm:size-11" />
          <span className="min-w-0">
            <span className="block truncate text-base leading-tight font-extrabold tracking-tight text-brand-700 uppercase sm:text-lg">
              {t('brand.name')}
            </span>
            {!compact && (
              <span className="block truncate text-[11px] leading-tight text-slate-500 sm:text-xs">
                {t('brand.tagline')}
              </span>
            )}
          </span>
        </>
      ) : (
        /*
         * The hospital's file is a full lockup — leaf mark *and* the words
         * "DEEPAN HOSPITAL". Rendering it beside the typed wordmark showed the
         * name twice, so when the artwork is present it stands alone at its
         * own aspect ratio. The tagline sits underneath, since the lockup does
         * not carry one.
         */
        /*
         * The lockup already carries the hospital's name, so no typed wordmark
         * beside it — only the tagline underneath, which the artwork does not
         * include. Stacked rather than inline so the logo can be large without
         * pushing the header's controls off a narrow screen.
         */
        <span className="flex min-w-0 flex-col items-start">
          <img
            src="/logo.png"
            alt={t('brand.name')}
            onError={() => setArtworkFailed(true)}
            className="h-14 w-auto shrink-0 object-contain object-left transition group-hover:scale-105 sm:h-20 xl:h-16 2xl:h-20"
          />
          {!compact && (
            /*
             * Hidden between xl and 2xl only. The lockup is stacked, so this
             * line — not the artwork — is what sets the logo's width, and in
             * that range the header row has nothing to spare. The artwork
             * still carries the hospital's name; the tagline returns as soon
             * as there is room for it.
             */
            /*
             * `w-full` is what makes `truncate` mean anything here. The column
             * is `items-start`, so without it the line sizes to its own text
             * and simply runs out from under the logo — on a 390px phone it
             * crossed the language switcher sitting beside it.
             */
            <span className="mt-0.5 w-full truncate text-[11px] leading-tight text-slate-500 sm:text-xs xl:hidden 2xl:block">
              {t('brand.tagline')}
            </span>
          )}
        </span>
      )}
    </button>
  )
}
