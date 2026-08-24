import { ArrowRight } from 'lucide-react'
import { useLanguage } from '../i18n/context'
import { DEPARTMENTS, DOCTORS, HOME_DEPARTMENT_IDS, HOSPITAL } from '../data/hospital'
import DepartmentCard from '../components/DepartmentCard'
import DoctorCard from '../components/DoctorCard'
import ReviewsSection from '../components/ReviewsSection'
import Hero from '../components/home/Hero'
import SectionHeading from '../components/home/SectionHeading'
import WhatToExpect from '../components/home/WhatToExpect'
import ClosingCta from '../components/home/ClosingCta'

/**
 * The home page, as a running order.
 *
 * This file used to be three hundred lines holding every section's markup and
 * four near-identical four-column card grids. It now decides only what appears
 * and in what order; each band is its own component, and every word on the page
 * comes from the translation dictionary. Changing the copy, the departments
 * shown or the reasons listed touches data, never this file.
 */
export default function Home({ onNavigate, onBook, onBookDoctor, onSelectDepartment, onStartTour }) {
  const { t } = useLanguage()

  const quickDepartments = HOME_DEPARTMENT_IDS.map((id) =>
    DEPARTMENTS.find((dept) => dept.id === id),
  ).filter(Boolean)

  const featured = (
    DOCTORS.filter((doctor) => doctor.featured).length > 0
      ? DOCTORS.filter((doctor) => doctor.featured)
      : DOCTORS.filter((doctor) => ['chief', 'senior'].includes(doctor.grade))
  ).slice(0, 4)

  /*
   * Counted from the live catalogue rather than written into the copy, so the
   * headline still reads true next year and in all three languages.
   */
  const facts = {
    doctors: DOCTORS.length,
    departments: DEPARTMENTS.length,
    established: HOSPITAL.established,
    years: new Date().getFullYear() - HOSPITAL.established,
  }

  const viewAll = (page) => (
    <button
      type="button"
      onClick={() => onNavigate(page)}
      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-700 underline underline-offset-4 transition-colors hover:text-brand-800"
    >
      {t('action.viewAll')}
      <ArrowRight className="size-4" aria-hidden="true" />
    </button>
  )

  return (
    <>
      <Hero
        facts={facts}
        departments={quickDepartments}
        onBook={onBook}
        onNavigate={onNavigate}
        onSelectDepartment={onSelectDepartment}
        onStartTour={onStartTour}
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <SectionHeading
          title={t('home.quickTitle')}
          subtitle={t('home.quickSubtitle')}
          action={viewAll('services')}
        />
        <div className="mt-8 grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          {quickDepartments.map((dept) => (
            <DepartmentCard
              key={dept.id}
              department={dept}
              onSelect={(d) => onSelectDepartment(d.id)}
              showHighlights
            />
          ))}
        </div>
      </section>

      <WhatToExpect facts={facts} />

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <SectionHeading
          title={t('home.featuredDoctors')}
          subtitle={t('home.featuredDoctorsSub')}
          action={viewAll('doctors')}
        />
        <div className="mt-8 grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((doctor) => (
            <DoctorCard key={doctor.id} doctor={doctor} onBook={onBookDoctor} compact />
          ))}
        </div>
      </section>

      <ReviewsSection />

      <ClosingCta onBook={onBook} phone={HOSPITAL.receptionPhone} />
    </>
  )
}
