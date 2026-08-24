import { useLanguage } from '../../i18n/context'
import { WHAT_TO_EXPECT } from '../../data/homeSections'
import SectionHeading from './SectionHeading'

/**
 * The four things a patient most wants to know before choosing a hospital.
 *
 * Set as an editorial list rather than a row of four identical cards: each
 * point gets a full-width band divided by a hairline, with the heading held in
 * a narrow left column and the explanation given the room to be a real
 * sentence. Four boxes of equal size say "these are interchangeable"; a list
 * says "read these in order", which is what they are for.
 */
export default function WhatToExpect({ facts }) {
  const { t } = useLanguage()

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <SectionHeading title={t('home.whyTitle')} subtitle={t('home.whySubtitle')} />

      <dl className="mt-10">
        {WHAT_TO_EXPECT.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.id}
              className="grid gap-x-10 gap-y-2 border-t border-slate-200 py-6 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]"
            >
              <dt className="flex items-start gap-3">
                <Icon className={`mt-0.5 size-5 shrink-0 ${item.tone}`} aria-hidden="true" />
                <span className="font-display text-xl leading-snug text-slate-900">
                  {t(item.titleKey)}
                </span>
              </dt>
              <dd className="max-w-prose leading-relaxed text-slate-600 md:pt-1">
                {t(item.textKey, facts)}
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}
