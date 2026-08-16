import { useEffect, useMemo, useState } from 'react'
import { CircleAlert, LoaderCircle, Moon, Sun } from 'lucide-react'
import { useLanguage } from '../../i18n/context'
import { api } from '../../lib/api'
import {
  formatDateLong,
  formatMonthYear,
  formatTime,
  isDoctorAvailableOn,
  toDateKey,
  upcomingDates,
  weekdayShort,
} from '../../lib/schedule'
import { cx } from '../../lib/cx'

function SlotGrid({ title, icon: Icon, slots, selected, onSelect }) {
  const { t, lang } = useLanguage()
  if (slots.length === 0) return null

  return (
    <div>
      <h4 className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-slate-500 uppercase">
        <Icon className="size-3.5" aria-hidden="true" />
        {title}
      </h4>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {slots.map((entry) => {
          const isSelected = entry.slot === selected
          return (
            <button
              key={entry.slot}
              type="button"
              disabled={!entry.available}
              onClick={() => onSelect(entry.slot)}
              aria-pressed={isSelected}
              title={entry.reason === 'taken' ? t('booking.slotTaken') : undefined}
              className={cx(
                'rounded-lg border px-2 py-2 text-xs font-semibold transition',
                !entry.available &&
                  'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through',
                entry.available &&
                  isSelected &&
                  'border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-600/25',
                entry.available &&
                  !isSelected &&
                  'border-slate-200 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50',
              )}
            >
              {formatTime(entry.slot, lang)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Availability comes from the server on every date change, so a slot another
 * patient just took disappears here without a page reload.
 */
export default function StepDateTime({ doctor, dateKey, slot, onSelectDate, onSelectSlot, errors }) {
  const { t, tl, lang } = useLanguage()
  const dates = useMemo(() => upcomingDates(), [])
  const [availability, setAvailability] = useState({ status: 'idle', slots: [] })

  useEffect(() => {
    if (!dateKey) {
      setAvailability({ status: 'idle', slots: [] })
      return undefined
    }
    const controller = new AbortController()
    setAvailability({ status: 'loading', slots: [] })
    api
      .availability(doctor.id, dateKey, controller.signal)
      .then((data) => setAvailability({ status: 'ready', slots: data.slots }))
      .catch((error) => {
        if (error.name === 'AbortError') return
        setAvailability({ status: 'error', slots: [] })
      })
    return () => controller.abort()
  }, [doctor.id, dateKey])

  const morning = availability.slots.filter((s) => s.session === 'morning')
  const evening = availability.slots.filter((s) => s.session === 'evening')
  const noneLeft =
    availability.status === 'ready' &&
    availability.slots.length > 0 &&
    availability.slots.every((s) => !s.available)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-brand-50 px-4 py-3">
        <span className="text-sm font-bold text-slate-900">{tl(doctor.name)}</span>
        <span className="text-xs font-medium text-brand-700">{tl(doctor.specialization)}</span>
        {doctor.room && <span className="ms-auto text-xs text-slate-500">{doctor.room}</span>}
      </div>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-900">{t('booking.selectDate')}</h3>
          <p className="text-xs text-slate-500">{formatMonthYear(dates[0], lang)}</p>
        </div>

        <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-2">
          {dates.map((date) => {
            const key = toDateKey(date)
            const available = isDoctorAvailableOn(doctor, date)
            const isSelected = key === dateKey
            return (
              <button
                key={key}
                type="button"
                disabled={!available}
                onClick={() => onSelectDate(key)}
                aria-pressed={isSelected}
                aria-label={formatDateLong(key, lang)}
                className={cx(
                  'flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-xl border px-1 py-2 transition',
                  !available && 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300',
                  available &&
                    isSelected &&
                    'border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-600/25',
                  available &&
                    !isSelected &&
                    'border-slate-200 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50',
                )}
              >
                <span className="text-[10px] font-semibold uppercase">
                  {weekdayShort(date.getDay(), lang)}
                </span>
                <span className="text-lg leading-none font-bold">{date.getDate()}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-1 text-xs text-slate-500">{t('booking.dateHint')}</p>
        {errors.date && (
          <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm font-medium text-rose-600">
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {t(errors.date)}
          </p>
        )}
      </section>

      {dateKey && (
        <section>
          <h3 className="text-sm font-bold text-slate-900">{t('booking.selectSlot')}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{formatDateLong(dateKey, lang)}</p>

          {availability.status === 'loading' && (
            <p className="mt-4 flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              {t('booking.loadingSlots')}
            </p>
          )}

          {availability.status === 'error' && (
            <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-sm text-rose-800">
              {t('error.network')}
            </p>
          )}

          {availability.status === 'ready' &&
            (noneLeft || availability.slots.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-5 text-center text-sm font-medium text-amber-800">
                {t('booking.noSlots')}
              </p>
            ) : (
              <div className="mt-3 space-y-5">
                <SlotGrid
                  title={t('booking.morningSlots')}
                  icon={Sun}
                  slots={morning}
                  selected={slot}
                  onSelect={onSelectSlot}
                />
                <SlotGrid
                  title={t('booking.eveningSlots')}
                  icon={Moon}
                  slots={evening}
                  selected={slot}
                  onSelect={onSelectSlot}
                />
              </div>
            ))}

          {errors.slot && (
            <p role="alert" className="mt-3 flex items-center gap-1.5 text-sm font-medium text-rose-600">
              <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
              {t(errors.slot)}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
