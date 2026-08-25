import { useMemo, useState } from 'react'
import { Search, SlidersHorizontal, TriangleAlert, X } from 'lucide-react'
import { useLanguage } from '../i18n/context'
import { DEPARTMENTS, DOCTORS } from '../data/hospital'
import DoctorCard from '../components/DoctorCard'
import Reveal from '../components/Reveal'
import { cx } from '../lib/cx'

export default function Doctors({ departmentFilter, onDepartmentFilterChange, onBookDoctor, onOpenDoctor }) {
  const { t, tl } = useLanguage()
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return DOCTORS.filter((doctor) => {
      if (departmentFilter && doctor.departmentId !== departmentFilter) return false
      if (!needle) return true
      const haystack = [
        doctor.name.en,
        doctor.name.ta,
        doctor.specialization.en,
        doctor.specialization.ta,
        doctor.qualification,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [query, departmentFilter])

  const hasFilters = Boolean(query || departmentFilter)

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          {t('doctors.title')}
        </h1>
        <p className="mt-2.5 text-slate-600">{t('doctors.subtitle')}</p>
      </header>

      {/* Only shown while some doctors still have no published schedule. */}
      {DOCTORS.some((d) => d.bookingMode !== 'live') && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-amber-900">
            <span className="font-bold">{t('doctors.pendingNoticeTitle')}</span>{' '}
            {t('doctors.pendingNoticeText')}
          </p>
        </div>
      )}

      {/* Search + filters */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('doctors.searchPlaceholder')}
            aria-label={t('action.search')}
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 ps-10 pe-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
        </div>

        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-slate-500 uppercase">
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            {t('doctors.filterByDept')}
          </p>

          <div className="no-scrollbar mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onDepartmentFilterChange('')}
              aria-pressed={!departmentFilter}
              className={cx(
                'rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition',
                !departmentFilter
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50',
              )}
            >
              {t('doctors.allDepartments')}
            </button>

            {DEPARTMENTS.map((dept) => {
              const active = departmentFilter === dept.id
              return (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => onDepartmentFilterChange(active ? '' : dept.id)}
                  aria-pressed={active}
                  className={cx(
                    'rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition',
                    active
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50',
                  )}
                >
                  {tl(dept.name)}
                </button>
              )
            })}
          </div>
        </div>

      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        {/*
          * A heading, not a paragraph. It already names what follows, and as an
          * <h2> it closes the h1 → h3 gap that left screen-reader users jumping
          * a level straight into the cards.
          */}
        <h2 className="text-sm font-semibold text-slate-600">
          {results.length === 1
            ? t('doctors.countOne')
            : t('doctors.count', { count: results.length })}
        </h2>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              onDepartmentFilterChange('')
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
          >
            <X className="size-3.5" aria-hidden="true" />
            {t('action.clearFilters')}
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
          <p className="text-base font-semibold text-slate-700">{t('doctors.none')}</p>
          <p className="mt-1 text-sm text-slate-500">{t('doctors.noneHint')}</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((doctor, i) => (
            /* Staggered by column, not by index — filtering can leave this
               list long, and a card that waits a second to appear has been
               scrolled past by the time it does. */
            <Reveal key={doctor.id} delay={(i % 3) * 70} className="h-full">
              <DoctorCard doctor={doctor} onBook={onBookDoctor} onOpen={onOpenDoctor} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  )
}
