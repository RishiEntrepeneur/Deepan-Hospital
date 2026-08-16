import { CircleAlert } from 'lucide-react'
import { useLanguage } from '../../i18n/context'
import { DEPARTMENTS, GRADES, getDoctorsByDepartment, iconFor } from '../../data/hospital'
import { availabilityLabel, formatFee } from '../../lib/schedule'
import { cx } from '../../lib/cx'

function FieldError({ errorKey }) {
  const { t } = useLanguage()
  if (!errorKey) return null
  return (
    <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm font-medium text-rose-600">
      <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
      {t(errorKey)}
    </p>
  )
}

export default function StepDepartmentDoctor({
  departmentId,
  doctorId,
  onSelectDepartment,
  onSelectDoctor,
  errors,
}) {
  const { t, tl, lang } = useLanguage()
  const doctors = departmentId ? getDoctorsByDepartment(departmentId) : []

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-bold text-slate-900">{t('booking.selectDepartment')}</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DEPARTMENTS.map((dept) => {
            const Icon = iconFor(dept.icon)
            const selected = dept.id === departmentId
            return (
              <button
                key={dept.id}
                type="button"
                onClick={() => onSelectDepartment(dept.id)}
                aria-pressed={selected}
                className={cx(
                  'flex items-center gap-2 rounded-xl border p-2.5 text-start text-xs font-semibold transition',
                  selected
                    ? 'border-brand-600 bg-brand-50 text-brand-800 ring-2 ring-brand-200'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-slate-50',
                )}
              >
                <Icon
                  className={cx('size-4 shrink-0', selected ? 'text-brand-600' : 'text-slate-400')}
                  aria-hidden="true"
                />
                <span className="leading-tight">{tl(dept.name)}</span>
              </button>
            )
          })}
        </div>
        <FieldError errorKey={errors.departmentId} />
      </section>

      <section>
        <h3 className="text-sm font-bold text-slate-900">{t('booking.selectDoctor')}</h3>

        {!departmentId ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            {t('booking.chooseDeptFirst')}
          </p>
        ) : doctors.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            {t('booking.noDoctorsInDept')}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {doctors.map((doctor) => {
              const selected = doctor.id === doctorId
              return (
                <li key={doctor.id}>
                  <button
                    type="button"
                    onClick={() => onSelectDoctor(doctor.id)}
                    aria-pressed={selected}
                    className={cx(
                      'flex w-full items-start gap-3 rounded-xl border p-3.5 text-start transition',
                      selected
                        ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-200'
                        : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cx(
                        'mt-1 grid size-4 shrink-0 place-items-center rounded-full border-2 transition',
                        selected ? 'border-brand-600' : 'border-slate-300',
                      )}
                    >
                      {selected && <span className="size-2 rounded-full bg-brand-600" />}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-bold text-slate-900">{tl(doctor.name)}</span>
                        <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {tl(GRADES[doctor.grade])}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs font-medium text-brand-700">
                        {tl(doctor.specialization)}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {doctor.qualification}
                        {doctor.experience != null &&
                          ` · ${t('doctors.years', { count: doctor.experience })} ${t('doctors.experience')}`}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {doctor.bookingMode === 'live'
                          ? `${t('doctors.availableDays')}: ${availabilityLabel(doctor.days, lang)}`
                          : t('doctors.timingsOnRequest')}
                        {doctor.room ? ` · ${doctor.room}` : ''}
                      </span>
                    </span>

                    <span className="shrink-0 text-sm font-bold text-slate-900">
                      {doctor.fee == null ? (
                        <span className="text-xs font-semibold text-slate-400">
                          {t('doctors.feeOnRequest')}
                        </span>
                      ) : (
                        formatFee(doctor.fee, lang)
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <FieldError errorKey={errors.doctorId} />
      </section>
    </div>
  )
}
