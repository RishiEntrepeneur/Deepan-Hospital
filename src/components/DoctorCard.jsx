import { BadgeCheck, CalendarPlus, Clock, DoorOpen, Languages } from 'lucide-react'
import { useLanguage } from '../i18n/context'
import { GRADES, SPOKEN_LANGUAGES, getDepartment } from '../data/hospital'
import { availabilityLabel, formatFee, isDoctorAvailableOn, sessionRangeLabel } from '../lib/schedule'
import { useCatalog } from '../lib/useCatalog'
import { visitTotal } from '../lib/payment'
import { cx } from '../lib/cx'
import Photo from './Photo'

const GRADE_STYLES = {
  chief: 'bg-brand-100 text-brand-800',
  senior: 'bg-brand-50 text-brand-700',
  visiting: 'bg-amber-50 text-amber-700',
}

/** Initials avatar — always taken from the Latin name so it reads cleanly. */
function Avatar({ latinName, departmentId }) {
  const initials = latinName
    .replace(/^Dr\.\s*/, '')
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .replace(/\./g, '')
    .slice(0, 2)
    .toUpperCase()

  const palettes = {
    emergency: 'bg-rose-100 text-rose-700',
    cardiology: 'bg-rose-100 text-rose-700',
    pediatrics: 'bg-amber-100 text-amber-700',
    gynecology: 'bg-pink-100 text-pink-700',
    neurology: 'bg-violet-100 text-violet-700',
    oncology: 'bg-fuchsia-100 text-fuchsia-700',
    psychiatry: 'bg-teal-100 text-teal-700',
  }

  return (
    <span
      aria-hidden="true"
      className={cx(
        'grid size-12 shrink-0 place-items-center rounded-full text-base font-bold sm:size-14',
        palettes[departmentId] ?? 'bg-brand-100 text-brand-700',
      )}
    >
      {initials}
    </span>
  )
}

export default function DoctorCard({ doctor, onBook, onOpen, compact = false }) {
  const { t, tl, lang } = useLanguage()
  const { booking } = useCatalog()
  const visitCharges = booking?.visitCharges
  const department = getDepartment(doctor.departmentId)
  /* What the patient actually pays, each way. */
  const firstTotal = visitTotal(doctor, 'first', visitCharges)?.total ?? null
  const reviewTotal = visitTotal(doctor, 'review', visitCharges)?.total ?? null
  const availableToday = isDoctorAvailableOn(doctor, new Date())
  const morning = sessionRangeLabel(doctor.sessions.morning, lang)
  const evening = sessionRangeLabel(doctor.sessions.evening, lang)

  return (
    <article className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
      <div className="flex items-start gap-3.5">
        {/* public/doctors/<id>.jpg — initials until a real portrait exists. */}
        <Photo
          src={`/doctors/${doctor.id}.jpg`}
          alt=""
          className="size-12 shrink-0 rounded-full sm:size-14"
        >
          <Avatar latinName={doctor.name.en} departmentId={doctor.departmentId} />
        </Photo>

        <div className="min-w-0 flex-1">
          <h3 className="text-base leading-snug font-bold text-slate-900">{tl(doctor.name)}</h3>
          <p className="mt-0.5 text-sm leading-snug font-medium text-brand-700">
            {tl(doctor.specialization)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{doctor.qualification}</p>
          {doctor.regNo && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              <BadgeCheck className="size-3.5" aria-hidden="true" />
              {t('doctors.regNo')} {doctor.regNo}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span
          className={cx(
            'rounded-lg px-2.5 py-0.5 text-xs font-semibold',
            GRADE_STYLES[doctor.grade] ?? 'bg-slate-100 text-slate-600',
          )}
        >
          {tl(GRADES[doctor.grade])}
        </span>
        <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {tl(department.name)}
        </span>
        {doctor.experience != null && (
          <span className="rounded-lg bg-mint-50 px-2.5 py-0.5 text-xs font-semibold text-mint-700">
            {t('doctors.years', { count: doctor.experience })} {t('doctors.experience')}
          </span>
        )}
        {doctor.bookingMode === 'live' ? (
          <span
            className={cx(
              'rounded-lg px-2.5 py-0.5 text-xs font-semibold',
              availableToday ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
            )}
          >
            {availableToday ? t('doctors.availableToday') : t('doctors.notToday')}
          </span>
        ) : (
          <span className="rounded-lg bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            {t('doctors.timingsOnRequest')}
          </span>
        )}
      </div>

      {!compact && (
        <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
          <div className="flex gap-2.5">
            <Clock className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
            <div className="min-w-0">
              {doctor.bookingMode === 'live' ? (
                <>
                  <dt className="text-xs text-slate-500">
                    {t('doctors.availableDays')}: {availabilityLabel(doctor.days, lang)}
                  </dt>
                  <dd className="text-slate-700">
                    {morning && (
                      <span className="block">
                        {t('doctors.morning')} · {morning}
                      </span>
                    )}
                    {evening && (
                      <span className="block">
                        {t('doctors.evening')} · {evening}
                      </span>
                    )}
                  </dd>
                </>
              ) : (
                <>
                  <dt className="text-xs text-slate-500">{t('doctors.timings')}</dt>
                  <dd className="text-slate-700">{t('doctors.timingsCallReception')}</dd>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2.5">
            <Languages className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
            <div>
              <dt className="sr-only">{t('doctors.languages')}</dt>
              <dd className="text-slate-700">
                {doctor.languages.map((code) => tl(SPOKEN_LANGUAGES[code])).join(', ')}
              </dd>
            </div>
          </div>

          {doctor.room && (
            <div className="flex gap-2.5">
              <DoorOpen className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
              <div>
                <dt className="sr-only">{t('doctors.room')}</dt>
                <dd className="text-slate-700">{doctor.room}</dd>
              </div>
            </div>
          )}
        </dl>
      )}

      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <div>
          <p className="text-xs text-slate-500">{t('doctors.fee')}</p>
          <p className="text-lg font-bold text-slate-900">
            {doctor.fee == null ? (
              <span className="text-sm font-semibold text-slate-500">{t('doctors.feeOnRequest')}</span>
            ) : (
              formatFee(doctor.fee, lang)
            )}
          </p>
          {/*
            * The totals, not the charges.
            *
            * The first version said "plus case sheet — ₹50 first visit, ₹20
            * review", which reads as fee+50 and fee+20. That is wrong for the
            * doctors who also charge a lower consultation on a review: it
            * implied ₹420 for a review with Gunasekaran when the real figure
            * is ₹300. Stating what the patient actually pays cannot be
            * misread the same way, and holds for every doctor.
            */}
          {firstTotal != null && (
            <p className="mt-0.5 text-[11px] leading-tight text-slate-500">
              {t('fee.payShort', {
                first: formatFee(firstTotal, lang),
                review: formatFee(reviewTotal, lang),
              })}
            </p>
          )}
        </div>
        {onOpen && (
          <button
            type="button"
            onClick={() => onOpen(doctor)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
          >
            {t('doctor.viewProfile')}
          </button>
        )}
        <button
          type="button"
          onClick={() => onBook(doctor)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700"
        >
          <CalendarPlus className="size-4" aria-hidden="true" />
          {doctor.bookingMode === 'live' ? t('action.bookShort') : t('action.requestShort')}
        </button>
      </div>
    </article>
  )
}
