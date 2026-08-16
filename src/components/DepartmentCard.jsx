import { ArrowRight } from 'lucide-react'
import { useLanguage } from '../i18n/context'
import { getDoctorsByDepartment, iconFor } from '../data/hospital'
import { cx } from '../lib/cx'

const TONES = {
  emergency: 'bg-rose-50 text-rose-600 group-hover:bg-rose-600',
  cardiology: 'bg-rose-50 text-rose-600 group-hover:bg-rose-600',
  pediatrics: 'bg-amber-50 text-amber-600 group-hover:bg-amber-600',
  gynecology: 'bg-pink-50 text-pink-600 group-hover:bg-pink-600',
  neurology: 'bg-violet-50 text-violet-600 group-hover:bg-violet-600',
  oncology: 'bg-fuchsia-50 text-fuchsia-600 group-hover:bg-fuchsia-600',
  psychiatry: 'bg-teal-50 text-teal-600 group-hover:bg-teal-600',
  dermatology: 'bg-mint-50 text-mint-600 group-hover:bg-mint-600',
  pulmonology: 'bg-sky-50 text-sky-600 group-hover:bg-sky-600',
  nephrology: 'bg-cyan-50 text-cyan-600 group-hover:bg-cyan-600',
}

export default function DepartmentCard({ department, onSelect, showHighlights = false }) {
  const { t, tl } = useLanguage()
  const Icon = iconFor(department.icon)
  const doctorCount = getDoctorsByDepartment(department.id).length
  const tone = TONES[department.id] ?? 'bg-brand-50 text-brand-600 group-hover:bg-brand-600'

  return (
    <button
      type="button"
      onClick={() => onSelect(department)}
      className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
    >
      <span
        className={cx(
          'grid size-12 place-items-center rounded-xl transition group-hover:text-white',
          tone,
        )}
      >
        <Icon className="size-6" aria-hidden="true" />
      </span>

      <h3 className="mt-4 text-base leading-snug font-bold text-slate-900">{tl(department.name)}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{tl(department.description)}</p>

      {/* Highlights are optional — departments served by the API may not carry them. */}
      {showHighlights && Array.isArray(tl(department.highlights)) && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {tl(department.highlights).map((item) => (
            <li
              key={item}
              className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
            >
              {item}
            </li>
          ))}
        </ul>
      )}

      <span className="mt-auto flex items-center justify-between gap-2 pt-4 text-sm font-semibold text-brand-700">
        {/*
          * "0 doctors" is both useless and untrue. The hospital has these
          * departments — Emergency and Cardiology among them — they are simply
          * staffed by consultants who hold no published OPD list. Saying so
          * sends the patient to reception instead of into an empty page.
          */}
        {doctorCount === 0
          ? t('services.byArrangement')
          : doctorCount === 1
            ? t('services.doctorsInDeptOne')
            : t('services.doctorsInDept', { count: doctorCount })}
        <ArrowRight className="size-4 transition group-hover:translate-x-1 rtl:rotate-180" aria-hidden="true" />
      </span>
    </button>
  )
}
