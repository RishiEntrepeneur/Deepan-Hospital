import { ArrowRight, BadgeCheck, CalendarPlus, Clock, Compass, HeartHandshake, Languages, ShieldPlus, Sparkles } from 'lucide-react'
import { useLanguage } from '../i18n/context'
import { DEPARTMENTS, DOCTORS, HOME_DEPARTMENT_IDS, HOSPITAL, iconFor } from '../data/hospital'
import DepartmentCard from '../components/DepartmentCard'
import DoctorCard from '../components/DoctorCard'
import Photo from '../components/Photo'
import Reveal from '../components/Reveal'
import Vitals from '../components/anatomy/Vitals'
import CountUp from '../components/CountUp'
import ReviewsSection from '../components/ReviewsSection'

function SectionHeading({ title, subtitle, action }) {
  return (
    <Reveal className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
        {subtitle && <p className="mt-2 text-slate-600">{subtitle}</p>}
      </div>
      {action}
    </Reveal>
  )
}

const WHY_ITEMS = [
  { icon: ShieldPlus, titleKey: 'home.why1Title', textKey: 'home.why1Text', tone: 'bg-rose-50 text-rose-600' },
  { icon: BadgeCheck, titleKey: 'home.why2Title', textKey: 'home.why2Text', tone: 'bg-brand-50 text-brand-600' },
  { icon: Sparkles, titleKey: 'home.why3Title', textKey: 'home.why3Text', tone: 'bg-amber-50 text-amber-600' },
  { icon: Languages, titleKey: 'home.why4Title', textKey: 'home.why4Text', tone: 'bg-mint-50 text-mint-600' },
]

export default function Home({ onNavigate, onBook, onBookDoctor, onSelectDepartment, onStartTour }) {
  const { t, tl } = useLanguage()
  const quickDepartments = HOME_DEPARTMENT_IDS.map((id) =>
    DEPARTMENTS.find((dept) => dept.id === id),
  ).filter(Boolean)
  const featured = (
    DOCTORS.filter((doctor) => doctor.featured).length > 0
      ? DOCTORS.filter((doctor) => doctor.featured)
      : DOCTORS.filter((doctor) => ['chief', 'senior'].includes(doctor.grade))
  ).slice(0, 4)

  // Counted from the live catalogue, so the numbers can never drift from it.
  const stats = [
    { value: DOCTORS.length, labelKey: 'home.statDoctors' },
    { value: DEPARTMENTS.length, labelKey: 'home.statDepartments' },
    { value: new Date().getFullYear() - HOSPITAL.established, labelKey: 'home.statYears' },
  ]

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        {/*
         * public/hero.jpg — a photograph of the hospital itself.
         * Held behind a strong left-to-right scrim so the serif headline keeps
         * its contrast whatever the photograph turns out to be; without a file
         * the section is exactly as it was.
         */}
        <Photo
          src="/hero.jpg"
          alt=""
          className="pointer-events-none absolute inset-0 size-full"
          aria-hidden="true"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/70"
        />
        {/* Electrocardiograph ruling — see .ecg-paper in index.css. */}
        <div aria-hidden="true" className="ecg-paper pointer-events-none absolute inset-0" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="min-w-0 animate-fade-up">
              <span className="label-caps inline-flex items-center gap-2 text-slate-500">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-mint-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-mint-500" />
                </span>
                {t('home.heroBadge')}
              </span>

              <h1 className="mt-6 text-[2.75rem] leading-[1.05] text-slate-900 sm:text-6xl lg:text-7xl">
                {t('home.heroTitle')}
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                {t('home.heroSubtitle')}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  data-tour="book"
                  onClick={onBook}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-brand-600/25 transition hover:-translate-y-0.5 hover:bg-brand-700"
                >
                  <CalendarPlus className="size-5" aria-hidden="true" />
                  {t('action.book')}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('doctors')}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-7 py-3.5 text-base font-bold text-slate-700 transition hover:border-brand-400 hover:text-brand-700"
                >
                  {t('nav.doctors')}
                  <ArrowRight className="size-5" aria-hidden="true" />
                </button>
              </div>

              {/*
                * "Show me around" — the one obvious way into the walkthrough.
                *
                * The tour used to be reachable only from a button buried on the
                * glossary page, where no first-time patient ever looks. It sits
                * here, under the two main actions, so anyone unsure where to
                * start can be walked through booking in half a minute.
                */}
              {onStartTour && (
                <button
                  type="button"
                  onClick={onStartTour}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 underline underline-offset-4 transition hover:text-brand-800"
                >
                  <Compass className="size-4" aria-hidden="true" />
                  {t('tour.replay')}
                </button>
              )}

              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-x-6 gap-y-5">
                {stats.map((stat) => (
                  <div key={stat.labelKey}>
                    <dt className="sr-only">{t(stat.labelKey)}</dt>
                    <dd>
                      <span data-numeric className="block font-display text-3xl text-slate-900 sm:text-4xl">
                        <CountUp value={stat.value} />
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                        {t(stat.labelKey)}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Illustrative "next available" panel */}
            <div className="min-w-0 animate-fade-up lg:justify-self-end">
              <div className="mx-auto w-full max-w-md rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl shadow-brand-900/5 backdrop-blur">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-2xl bg-brand-600 text-white">
                    {/* A resting pulse, 70 a minute — see .animate-beat. */}
                    <HeartHandshake className="size-6 animate-beat" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t('home.ctaTitle')}</p>
                    <p className="text-xs text-slate-500">{t('home.ctaText')}</p>
                  </div>
                </div>

                <ul className="mt-5 space-y-2.5">
                  {quickDepartments.map((dept) => {
                    const Icon = iconFor(dept.icon)
                    return (
                      <li key={dept.id}>
                        <button
                          type="button"
                          onClick={() => onSelectDepartment(dept.id)}
                          className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-start transition hover:border-brand-300 hover:bg-brand-50"
                        >
                          <Icon className="size-5 shrink-0 text-brand-600" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                            {tl(dept.name)}
                          </span>
                          <ArrowRight
                            className="size-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600"
                            aria-hidden="true"
                          />
                        </button>
                      </li>
                    )
                  })}
                </ul>

                <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock className="size-3.5" aria-hidden="true" />
                  {t('contact.opdHours')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/*
          * The trace along the foot of the hero.
          *
          * Pinned to the section's bottom edge and clipped by it, so it reads
          * as the floor of the hero rather than as a band sitting on top of
          * the page. Low opacity on purpose: it should be the thing you notice
          * second, after the headline, and never the thing competing with it.
          */}
        <Vitals
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full text-brand-600/70"
        />
      </section>

      {/* ---------------- Quick departments ---------------- */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <SectionHeading
          title={t('home.quickTitle')}
          subtitle={t('home.quickSubtitle')}
          action={
            <button
              type="button"
              onClick={() => onNavigate('services')}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              {t('action.viewAll')}
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          }
        />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickDepartments.map((dept, i) => (
            <DepartmentCard
              key={dept.id}
              department={dept}
              onSelect={(d) => onSelectDepartment(d.id)}
              showHighlights
              delay={i * 70}
            />
          ))}
        </div>
      </section>

      {/* ---------------- Why us ---------------- */}
      <section className="bg-slate-50 py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading title={t('home.whyTitle')} subtitle={t('home.whySubtitle')} />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WHY_ITEMS.map((item, i) => {
              const Icon = item.icon
              return (
                <Reveal
                  key={item.titleKey}
                  delay={i * 70}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-300 hover:shadow-md"
                >
                  <span className={`grid size-11 place-items-center rounded-xl ${item.tone}`}>
                    <Icon className="draw-in size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-slate-900">{t(item.titleKey)}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{t(item.textKey)}</p>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* ---------------- Featured doctors ---------------- */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <SectionHeading
          title={t('home.featuredDoctors')}
          subtitle={t('home.featuredDoctorsSub')}
          action={
            <button
              type="button"
              onClick={() => onNavigate('doctors')}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              {t('action.viewAll')}
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          }
        />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((doctor, i) => (
            <Reveal key={doctor.id} delay={i * 70} className="h-full">
              <DoctorCard doctor={doctor} onBook={onBookDoctor} compact />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------- What patients say ---------------- */}
      <ReviewsSection />

      {/* ---------------- CTA ---------------- */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <Reveal className="relative overflow-hidden rounded-3xl bg-brand-700 px-6 py-12 text-center sm:px-12">
          <div className="relative">
            <h2 className="text-2xl font-extrabold text-white sm:text-3xl">{t('home.ctaTitle')}</h2>
            <p className="mx-auto mt-3 max-w-xl text-brand-100">{t('home.ctaText')}</p>
            <button
              type="button"
              onClick={onBook}
              className="mt-7 inline-flex items-center gap-2 rounded-lg bg-white px-7 py-3.5 text-base font-bold text-brand-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-brand-50"
            >
              <CalendarPlus className="size-5" aria-hidden="true" />
              {t('action.book')}
            </button>
          </div>
        </Reveal>
      </section>
    </>
  )
}
