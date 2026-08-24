import { useLanguage } from '../i18n/context'
import { DEPARTMENTS, CONFIRMED_FACILITIES } from '../data/hospital'
import DepartmentCard from '../components/DepartmentCard'

export default function Services({ onSelectDepartment }) {
  const { t, tl } = useLanguage()

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          {t('services.title')}
        </h1>
        <p className="mt-2.5 text-slate-600">{t('services.subtitle')}</p>
      </header>

      {/*
        * The department grid had no heading of its own, so the h1 ran straight
        * into the cards' h3s. The visible page reads fine without one, so this
        * is for assistive tech only.
        */}
      <h2 className="sr-only">{t('services.departmentsHeading')}</h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DEPARTMENTS.map((dept) => (
          <DepartmentCard
            key={dept.id}
            department={dept}
            onSelect={(d) => onSelectDepartment(d.id)}
            showHighlights
          />
        ))}
      </div>

      <section className="mt-14">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
          {t('services.facilitiesTitle')}
        </h2>
        <p className="mt-2 text-slate-600">{t('services.facilitiesSub')}</p>

        <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {CONFIRMED_FACILITIES.map((facility) => {
            const Icon = facility.icon
            return (
              <li
                key={facility.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-sm font-bold text-slate-900">{tl(facility.name)}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{tl(facility.text)}</p>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
