import { useMemo, useState } from 'react'
import { BookOpen, Compass, Search, X } from 'lucide-react'
import { useLanguage } from '../i18n/context'
import { GLOSSARY, GLOSSARY_CATEGORIES } from '../data/glossary'
import { DEPARTMENTS } from '../data/hospital'
import { cx } from '../lib/cx'

export default function Glossary({ onStartTour }) {
  const { t, tl } = useLanguage()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')

  /* Departments are defined in the hospital data — fold them in as a category. */
  const entries = useMemo(() => {
    const departmentEntries = DEPARTMENTS.map((dept) => ({
      id: `dept-${dept.id}`,
      category: 'department',
      term: dept.name,
      definition: dept.description,
    }))
    return [...GLOSSARY, ...departmentEntries]
  }, [])

  const categories = useMemo(
    () => [
      ...GLOSSARY_CATEGORIES,
      { id: 'department', name: { en: 'Departments', ta: 'துறைகள்' } },
    ],
    [],
  )

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return entries.filter((entry) => {
      if (category && entry.category !== category) return false
      if (!needle) return true
      const haystack = [
        entry.term.en,
        entry.term.ta,
        entry.expansion?.en,
        entry.expansion?.ta,
        entry.definition.en,
        entry.definition.ta,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [entries, query, category])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const entry of results) {
      if (!map.has(entry.category)) map.set(entry.category, [])
      map.get(entry.category).push(entry)
    }
    return map
  }, [results])

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <header className="max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          <BookOpen className="size-3.5" aria-hidden="true" />
          {t('glossary.badge')}
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          {t('glossary.title')}
        </h1>
        <p className="mt-2.5 text-slate-600">{t('glossary.subtitle')}</p>

        <button
          type="button"
          onClick={onStartTour}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
        >
          <Compass className="size-4" aria-hidden="true" />
          {t('tour.replay')}
        </button>
      </header>

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
            placeholder={t('glossary.searchPlaceholder')}
            aria-label={t('action.search')}
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 ps-10 pe-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory('')}
            aria-pressed={!category}
            className={cx(
              'rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition',
              !category
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50',
            )}
          >
            {t('glossary.all')}
          </button>
          {categories.map((cat) => {
            const active = category === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(active ? '' : cat.id)}
                aria-pressed={active}
                className={cx(
                  'rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition',
                  active
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50',
                )}
              >
                {tl(cat.name)}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-600">
          {t('glossary.count', { count: results.length })}
        </p>
        {(query || category) && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setCategory('')
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
          >
            <X className="size-3.5" aria-hidden="true" />
            {t('action.clearFilters')}
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
          <p className="text-base font-semibold text-slate-700">{t('glossary.none')}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-8">
          {categories
            .filter((cat) => grouped.has(cat.id))
            .map((cat) => (
              <section key={cat.id}>
                <h2 className="text-sm font-bold tracking-wide text-slate-500 uppercase">
                  {tl(cat.name)}
                </h2>
                <dl className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {grouped.get(cat.id).map((entry) => (
                    <div key={entry.id} className="px-5 py-4">
                      <dt className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-base font-bold text-slate-900">{tl(entry.term)}</span>
                        {entry.expansion && (
                          <span className="text-sm text-slate-500">— {tl(entry.expansion)}</span>
                        )}
                      </dt>
                      <dd className="mt-1.5 text-sm leading-relaxed text-slate-600">
                        {tl(entry.definition)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
        </div>
      )}
    </div>
  )
}
