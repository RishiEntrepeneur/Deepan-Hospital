import {
  ArrowLeft,
  BadgeCheck,
  CalendarPlus,
  Clock,
  DoorOpen,
  Languages,
  Phone,
  Stethoscope,
  TriangleAlert,
} from 'lucide-react'
import { useLanguage } from '../i18n/context'
import {
  DEPARTMENTS,
  GRADES,
  HOSPITAL,
  SPOKEN_LANGUAGES,
  WEEKDAYS,
  getDoctor,
  iconFor,
} from '../data/hospital'
import { seniorityLine } from '../lib/qualifications'
import { formatFee, formatTime, telHref } from '../lib/schedule'
import { useCatalog } from '../lib/useCatalog'
import { visitTotal } from '../lib/payment'
import Photo from '../components/Photo'
import SpeakButton from '../components/SpeakButton'

function Row({ icon: Icon, label, children }) {
  if (!children) return null
  return (
    <div className="flex items-start gap-3 border-t border-slate-100 py-3 first:border-t-0">
      <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
      <div className="min-w-0">
        <p className="label-caps text-slate-500">{label}</p>
        <div className="mt-0.5 text-sm text-slate-800">{children}</div>
      </div>
    </div>
  )
}

/**
 * One doctor, in full.
 *
 * Everything here comes from the hospital's own record. Nothing about which
 * conditions they treat or which operations they perform is inferred — those
 * would be clinical claims about a real, named person, and getting one wrong
 * would be the hospital's problem, not the app's.
 *
 * The qualification is printed as the hospital wrote it and left at that.
 * An earlier draft expanded each degree into a definition; it padded the page
 * without helping anyone choose a doctor.
 */
export default function DoctorProfile({ doctorId, onBook, onNavigate }) {
  const { t, tl, lang } = useLanguage()
  const { booking } = useCatalog()
  const visitCharges = booking?.visitCharges
  const doctor = getDoctor(doctorId)

  if (!doctor) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <p className="text-base font-semibold text-slate-700">{t('doctor.notFound')}</p>
        <button
          type="button"
          onClick={() => onNavigate('doctors')}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('nav.doctors')}
        </button>
      </div>
    )
  }

  const department = DEPARTMENTS.find((d) => d.id === doctor.departmentId)
  const DeptIcon = iconFor(department?.icon)
  const standing = seniorityLine(doctor, t)
  const bookable = doctor.bookingMode === 'live'

  const days = (doctor.days ?? [])
    .map((index) => WEEKDAYS.find((w) => w.index === index))
    .filter(Boolean)

  /* Both totals, so the page can say what a patient actually pays. */
  const firstTotal = visitTotal(doctor, 'first', visitCharges)?.total ?? null
  const reviewTotal = visitTotal(doctor, 'review', visitCharges)?.total ?? null

  const sessions = [
    doctor.sessions?.morning && {
      key: 'morning',
      label: t('doctor.morning'),
      from: doctor.sessions.morning[0],
      to: doctor.sessions.morning[1],
    },
    doctor.sessions?.evening && {
      key: 'evening',
      label: t('doctor.evening'),
      from: doctor.sessions.evening[0],
      to: doctor.sessions.evening[1],
    },
  ].filter(Boolean)

  /*
   * What the listen button reads.
   *
   * Composed rather than scraped off the page, because reading the layout
   * aloud — "Department. Cardiology. Consulting days. Mon dot Wed" — is a poor
   * listen. This is the same facts as a sentence, which is what someone who
   * cannot read the page actually needs, and it deliberately stops at the
   * facts the hospital has published.
   */
  const spokenSummary = [
    `${tl(doctor.name)}. ${tl(doctor.specialization)}.`,
    department ? `${t('doctor.department')}: ${tl(department.name)}.` : '',
    days.length > 0
      ? `${t('doctor.consultingDays')}: ${days.map((d) => tl(d.long ?? d.short)).join(', ')}. ` +
        sessions.map((s) => `${s.label} ${formatTime(s.from)} – ${formatTime(s.to)}`).join('. ')
      : t('doctor.timingsNotPublished'),
    doctor.room ? `${t('doctor.room')} ${doctor.room}.` : '',
    doctor.fee != null
      ? `${t('pay.consultationFee')}: ${formatFee(doctor.fee, lang)}.`
      : t('pay.feeNotPublished'),
    bookable ? '' : t('doctor.callbackOnly'),
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <button
        type="button"
        onClick={() => onNavigate('doctors')}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-brand-700"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('nav.doctors')}
      </button>

      {/* ---------------- Identity ---------------- */}
      <header className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
        <Photo
          src={`/doctors/${doctor.id}.jpg`}
          alt=""
          className="size-28 shrink-0 rounded-2xl border border-slate-200 object-cover"
        >
          <span className="grid size-28 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <Stethoscope className="size-10" aria-hidden="true" />
          </span>
        </Photo>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <h1 className="min-w-0 flex-1 text-2xl text-slate-900 sm:text-3xl">
              {tl(doctor.name)}
            </h1>
            <SpeakButton text={spokenSummary} label={t('doctor.listenSummary')} />
          </div>
          <p className="mt-1 text-base font-semibold text-brand-700">
            {tl(doctor.specialization)}
          </p>
          {doctor.qualification && (
            <p className="mt-0.5 text-sm text-slate-500">{doctor.qualification}</p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {tl(GRADES[doctor.grade] ?? GRADES.consultant)}
            </span>
            {standing.map((bit) => (
              <span
                key={bit}
                className="rounded-lg bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700"
              >
                {bit}
              </span>
            ))}
            <span
              className={`rounded-lg px-2.5 py-0.5 text-xs font-semibold ${
                bookable ? 'bg-mint-50 text-mint-800' : 'bg-amber-50 text-amber-800'
              }`}
            >
              {bookable ? t('doctor.bookableNow') : t('doctor.callbackOnly')}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onBook(doctor)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"
            >
              <CalendarPlus className="size-4" aria-hidden="true" />
              {bookable ? t('action.book') : t('doctor.requestCallback')}
            </button>
            <a
              href={telHref(HOSPITAL.receptionPhone)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Phone className="size-4" aria-hidden="true" />
              {t('doctor.callReception')}
            </a>
          </div>
        </div>
      </header>

      {doctor.away && (
        <p className="mt-6 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t('doctor.awayBetween', { from: doctor.away.from, to: doctor.away.to })}
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        {/* ---------------- About ---------------- */}
        <section className="lg:col-span-3">
          {doctor.about ? (
            <p className="text-sm leading-relaxed text-slate-700">{doctor.about}</p>
          ) : (
            <p className="text-sm leading-relaxed text-slate-500">
              {t('doctor.noAbout', { name: tl(doctor.name) })}
            </p>
          )}

          {/*
           * Shown only where the hospital has actually supplied a number.
           * An unverified registration number is worse than none at all.
           */}
          <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
            <BadgeCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {doctor.regNo
              ? t('doctor.regNoLine', { number: doctor.regNo })
              : t('doctor.regNoMissing')}
          </p>
        </section>

        {/* ---------------- Practical detail ---------------- */}
        <aside className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2">
            <Row icon={DeptIcon} label={t('doctor.department')}>
              <button
                type="button"
                onClick={() => onNavigate('services')}
                className="font-semibold text-brand-700 hover:underline"
              >
                {department ? tl(department.name) : doctor.departmentId}
              </button>
              {department?.description && (
                <span className="mt-0.5 block text-xs text-slate-500">
                  {tl(department.description)}
                </span>
              )}
            </Row>

            <Row icon={Clock} label={t('doctor.consultingDays')}>
              {days.length > 0 ? (
                <>
                  <span>{days.map((d) => tl(d.short)).join(' · ')}</span>
                  {sessions.length > 0 && (
                    <span className="mt-1 block text-xs text-slate-500">
                      {sessions
                        .map((s) => `${s.label} ${formatTime(s.from)}–${formatTime(s.to)}`)
                        .join(' · ')}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-slate-500">{t('doctor.timingsNotPublished')}</span>
              )}
            </Row>

            <Row icon={Languages} label={t('doctor.speaks')}>
              {doctor.languages.map((code) => tl(SPOKEN_LANGUAGES[code] ?? { en: code, ta: code })).join(', ')}
            </Row>

            <Row icon={DoorOpen} label={t('doctor.room')}>
              {doctor.room}
            </Row>

            <Row icon={CalendarPlus} label={t('pay.consultationFee')}>
              {doctor.fee != null ? formatFee(doctor.fee, lang) : t('pay.feeNotPublished')}
              {/*
                * Spelling out both totals here, not just the case-sheet
                * charge: this doctor may also charge a lower consultation on
                * a review, and a patient reading one number should not be
                * surprised at the counter either way.
                */}
              {doctor.fee != null && firstTotal != null && (
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                  {t('fee.payExplained', {
                    first: formatFee(firstTotal, lang),
                    review: formatFee(reviewTotal, lang),
                  })}
                </span>
              )}
            </Row>
          </div>
        </aside>
      </div>
    </div>
  )
}
