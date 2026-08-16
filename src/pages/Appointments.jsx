import { useState } from 'react'
import {
  CalendarClock,
  CalendarPlus,
  CircleUser,
  Clock,
  Download,
  DoorOpen,
  LoaderCircle,
  MapPin,
  Receipt,
  RefreshCw,
  Stethoscope,
  Trash2,
  Wallet,
} from 'lucide-react'
import { useLanguage } from '../i18n/context'
import { GENDERS, getDepartment, getDoctor } from '../data/hospital'
import { daysFromToday, formatDateLong, formatFee, formatTime } from '../lib/schedule'
// formatFee is used by the payment summary below.
import { displayStatus } from '../lib/useAppointments'
import { downloadSummary } from '../lib/summary'
import Modal from '../components/Modal'
import { cx } from '../lib/cx'

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  confirmed: 'bg-mint-50 text-mint-700 ring-mint-200',
  requested: 'bg-amber-50 text-amber-800 ring-amber-200',
  completed: 'bg-slate-100 text-slate-600 ring-slate-200',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200',
}

const STATUS_LABEL_KEYS = {
  pending: 'appt.statusPending',
  confirmed: 'appt.statusConfirmed',
  requested: 'appt.statusRequested',
  completed: 'appt.statusCompleted',
  cancelled: 'appt.statusCancelled',
}

function RelativeDay({ dateKey }) {
  const { t } = useLanguage()
  if (!dateKey) return null
  const diff = daysFromToday(dateKey)
  if (diff < 0) return null

  const label = diff === 0 ? t('appt.today') : diff === 1 ? t('appt.tomorrow') : t('appt.inDays', { count: diff })
  return (
    <span className="rounded-lg bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
      {label}
    </span>
  )
}

function AppointmentCard({ appointment, onCancel, onReschedule, onPay }) {
  const { t, tl, lang } = useLanguage()
  const doctor = getDoctor(appointment.doctorId)
  const department = getDepartment(appointment.departmentId)
  const status = displayStatus(appointment)
  const gender = GENDERS.find((g) => g.value === appointment.patient.gender)
  const isActive = ['pending', 'confirmed', 'requested'].includes(status)
  const isSlot = appointment.kind === 'slot'

  return (
    <article
      className={cx(
        'rounded-2xl border bg-white p-5 shadow-sm transition',
        status === 'cancelled' ? 'border-slate-200 opacity-75' : 'border-slate-200',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cx(
                'rounded-lg px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset',
                STATUS_STYLES[status],
              )}
            >
              {t(STATUS_LABEL_KEYS[status])}
            </span>
            {isActive && <RelativeDay dateKey={appointment.date} />}
          </div>

          {status === 'pending' && (
            <p className="mt-2 text-xs leading-relaxed text-amber-800">{t('appt.pendingNote')}</p>
          )}

          <h3 className="mt-2.5 text-base font-bold text-slate-900">{tl(doctor.name)}</h3>
          <p className="text-sm font-medium text-brand-700">{tl(doctor.specialization)}</p>
        </div>

        <div className="text-end">
          <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            {t('booking.appointmentId')}
          </p>
          <p className="font-mono text-sm font-extrabold tracking-wider text-slate-800">
            {appointment.id}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2.5 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-2.5">
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="text-xs text-slate-500">{t('field.date')}</dt>
            <dd className="font-semibold text-slate-800">
              {appointment.date ? formatDateLong(appointment.date, lang) : t('appt.callbackPending')}
            </dd>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <Clock className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="text-xs text-slate-500">{t('field.time')}</dt>
            <dd className="font-semibold text-slate-800">
              {appointment.slot
                ? `${formatTime(appointment.slot, lang)} · ${
                    appointment.session === 'morning' ? t('doctors.morning') : t('doctors.evening')
                  }`
                : t('appt.callbackPending')}
            </dd>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <Stethoscope className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="text-xs text-slate-500">{t('field.department')}</dt>
            <dd className="font-semibold text-slate-800">{tl(department.name)}</dd>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <DoorOpen className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="text-xs text-slate-500">{t('doctors.room')}</dt>
            <dd className="font-semibold text-slate-800">{doctor.room ?? '—'}</dd>
          </div>
        </div>

        {appointment.payment && (
          <div className="flex items-start gap-2.5">
            <Receipt className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-xs text-slate-500">{t('pay.status')}</dt>
              <dd
                className={cx(
                  'font-semibold',
                  appointment.payment.status === 'paid' ? 'text-mint-700' : 'text-amber-700',
                )}
              >
                {appointment.payment.status === 'paid' ? t('pay.paid') : t('pay.pending')} ·{' '}
                {formatFee(appointment.payment.amount, lang)}
              </dd>
              <dd className="font-mono text-xs text-slate-500">{appointment.payment.reference}</dd>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2.5 sm:col-span-2">
          <CircleUser className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="text-xs text-slate-500">{t('field.patient')}</dt>
            <dd className="font-semibold text-slate-800">
              {appointment.patient.name} · {appointment.patient.age} ·{' '}
              {gender ? t(gender.labelKey) : '—'} · {appointment.patient.phone}
            </dd>
            <dd className="mt-1 text-slate-600">{appointment.patient.reason}</dd>
          </div>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => downloadSummary(appointment, { t, tl, lang })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
        >
          <Download className="size-3.5" aria-hidden="true" />
          {t('action.download')}
        </button>

        {isActive && appointment.payment?.status === 'pending' && (
          <button
            type="button"
            onClick={() => onPay(appointment)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-mint-300 bg-mint-50 px-3.5 py-1.5 text-xs font-semibold text-mint-800 transition hover:bg-mint-100"
          >
            <Wallet className="size-3.5" aria-hidden="true" />
            {t('pay.payNowShort')}
          </button>
        )}

        {isActive && isSlot && (
          <>
            <button
              type="button"
              onClick={() => onReschedule(appointment)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-3.5 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              {t('action.reschedule')}
            </button>
            <button
              type="button"
              onClick={() => onCancel(appointment)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              {t('action.cancelBooking')}
            </button>
          </>
        )}

        {isActive && !isSlot && (
          <button
            type="button"
            onClick={() => onCancel(appointment)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            {t('action.cancelRequest')}
          </button>
        )}
      </div>
    </article>
  )
}

function EmptyState({ titleKey, hintKey, onBook }) {
  const { t } = useLanguage()
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-white text-slate-400 shadow-sm">
        <MapPin className="size-6" aria-hidden="true" />
      </span>
      <p className="mt-4 text-base font-semibold text-slate-700">{t(titleKey)}</p>
      <p className="mt-1 text-sm text-slate-500">{t(hintKey)}</p>
      {onBook && (
        <button
          type="button"
          onClick={onBook}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          <CalendarPlus className="size-4" aria-hidden="true" />
          {t('action.book')}
        </button>
      )}
    </div>
  )
}

export default function Appointments({
  signedIn,
  loading,
  upcoming,
  past,
  onCancel,
  onReschedule,
  onBook,
  onPay,
  onSignIn,
}) {
  const { t, tl, lang } = useLanguage()
  const [tab, setTab] = useState('upcoming')
  const [pendingCancel, setPendingCancel] = useState(null)

  const list = tab === 'upcoming' ? upcoming : past
  const tabs = [
    { id: 'upcoming', labelKey: 'appt.upcoming', count: upcoming.length },
    { id: 'past', labelKey: 'appt.past', count: past.length },
  ]

  const confirmCancel = () => {
    onCancel(pendingCancel.id)
    setPendingCancel(null)
  }

  const cancelDoctor = pendingCancel ? getDoctor(pendingCancel.doctorId) : null

  if (!signedIn) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6 lg:px-8">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-50 text-brand-600">
          <CircleUser className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-extrabold text-slate-900">{t('appt.signInPrompt')}</h1>
        <p className="mt-2 text-sm text-slate-600">{t('appt.signInText')}</p>
        <button
          type="button"
          onClick={onSignIn}
          className="mt-6 rounded-lg bg-brand-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-700"
        >
          {t('account.signIn')}
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {t('appt.title')}
          </h1>
          <p className="mt-2.5 text-slate-600">{t('appt.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={onBook}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700"
        >
          <CalendarPlus className="size-4" aria-hidden="true" />
          {t('action.bookShort')}
        </button>
      </header>

      <div role="tablist" aria-label={t('appt.title')} className="mt-8 flex gap-2 border-b border-slate-200">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cx(
              '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold transition',
              tab === item.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            {t(item.labelKey)}
            <span
              className={cx(
                'inline-flex min-w-5 items-center justify-center rounded-lg px-1.5 text-[11px] font-bold',
                tab === item.id ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500',
              )}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-6 space-y-4">
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            {t('appt.loading')}
          </p>
        ) : list.length === 0 ? (
          <EmptyState
            titleKey={tab === 'upcoming' ? 'appt.emptyUpcoming' : 'appt.emptyPast'}
            hintKey={tab === 'upcoming' ? 'appt.emptyUpcomingHint' : 'appt.emptyPastHint'}
            onBook={tab === 'upcoming' ? onBook : undefined}
          />
        ) : (
          list.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              onCancel={setPendingCancel}
              onReschedule={onReschedule}
              onPay={onPay}
            />
          ))
        )}
      </div>

      <Modal
        open={Boolean(pendingCancel)}
        onClose={() => setPendingCancel(null)}
        title={t('appt.confirmCancelTitle')}
        size="md"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="button"
              onClick={confirmCancel}
              className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              {t('action.yesCancel')}
            </button>
            <button
              type="button"
              onClick={() => setPendingCancel(null)}
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {t('action.keepIt')}
            </button>
          </div>
        }
      >
        {pendingCancel && (
          <p className="text-sm leading-relaxed text-slate-600">
            {pendingCancel.date
              ? t('appt.confirmCancelText', {
                  doctor: tl(cancelDoctor.name),
                  date: formatDateLong(pendingCancel.date, lang),
                  time: formatTime(pendingCancel.slot, lang),
                })
              : t('appt.confirmCancelRequestText', { doctor: tl(cancelDoctor.name) })}
          </p>
        )}
      </Modal>
    </div>
  )
}
