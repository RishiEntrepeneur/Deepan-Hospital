import { useId, useMemo } from 'react'
import { ArrowRight, CircleAlert, Phone, TriangleAlert } from 'lucide-react'
import { useLanguage } from '../../i18n/context'
import { DEPARTMENTS, GENDERS, HOSPITAL } from '../../data/hospital'
import { assessReason } from '../../lib/triage'
import { formatDateLong, formatFee, formatTime, telHref } from '../../lib/schedule'
import { visitTotal } from '../../lib/payment'
import { cx } from '../../lib/cx'
import AttachmentPicker from './AttachmentPicker'

function Field({ label, error, hint, children, htmlFor }) {
  const { t } = useLanguage()
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-800">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      <div className="mt-1.5">{children}</div>
      {error && (
        <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-rose-600">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {t(error)}
        </p>
      )}
    </div>
  )
}

const inputClass = (invalid) =>
  cx(
    'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400',
    invalid
      ? 'border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-100'
      : 'border-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100',
  )

export default function StepPatientDetails({
  patient,
  onChange,
  errors,
  doctor,
  dateKey,
  slot,
  isCallback = false,
  isGuest = false,
  onSignIn,
  prefilled = false,
  onSwitchDoctor,
  visitCharges,
  attachments = [],
  onAttachmentsChange,
}) {
  const { t, tl, lang } = useLanguage()

  /* Null until they have chosen — see the note by the total. */
  const fees = patient.visitType
    ? visitTotal(doctor, patient.visitType, visitCharges)
    : null

  /*
   * Reads what they typed and, only where it clearly points elsewhere, offers
   * a better-matched doctor. It never blocks the booking — a patient may have
   * good reasons for their choice that a keyword list cannot see.
   */
  const advice = useMemo(() => assessReason(patient.reason, doctor), [patient.reason, doctor])

  const ids = {
    name: useId(),
    age: useId(),
    phone: useId(),
    reason: useId(),
  }

  const set = (field) => (event) => onChange({ ...patient, [field]: event.target.value })

  return (
    <div className="space-y-6">
      {/*
        Say out loud that no account is needed.
        
        The booking already worked without one — it silently used the guest
        route — but nothing on screen said so, and a form asking for a name, an
        age and a phone number reads like the start of a sign-up. Somebody who
        does not want an account had no way to know they were not making one.
      */}
      {isGuest && !prefilled && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">{t('booking.guestTitle')}</p>
            {onSignIn && (
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
              >
                {t('booking.guestSignIn')}
              </button>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-600">{t('booking.guestBody')}</p>
        </div>
      )}

      {/* What they're booking */}
      <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
        <p className="text-xs font-bold tracking-wide text-brand-700 uppercase">
          {t('booking.summary')}
        </p>
        <p className="mt-1.5 text-sm font-bold text-slate-900">{tl(doctor.name)}</p>
        <p className="text-xs text-slate-600">{tl(doctor.specialization)}</p>
        {isCallback ? (
          <p className="mt-2 text-sm text-slate-700">{t('booking.callbackNote')}</p>
        ) : (
          <p className="mt-2 text-sm text-slate-700">
            {formatDateLong(dateKey, lang)} · {formatTime(slot, lang)}
          </p>
        )}
        {doctor.fee == null ? (
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {t('field.fee')}: {t('doctors.feeOnRequest')}
          </p>
        ) : (
          <div className="mt-1.5 space-y-0.5 text-sm">
            <p className="flex justify-between gap-4 text-slate-700">
              <span>{t('pay.consultationFee')}</span>
              {/*
                * `fees.consultation`, not `doctor.fee`. Several doctors charge
                * a lower consultation on a review, and this line used the
                * first-visit figure regardless — so a review with Gunasekaran
                * read "₹400" and "+₹20" above a total of "₹300". The line
                * items did not add up to the total, on a page asking somebody
                * to pay. Falls back to the plain fee only before a visit type
                * has been chosen, when no total is shown either.
                */}
              <span>{formatFee(fees ? fees.consultation : doctor.fee, lang)}</span>
            </p>
            {/*
              * Shown only once they have said which kind of visit it is.
              * Naming a total before then would mean picking one for them,
              * and the two differ by real money.
              */}
            {fees && (
              <p className="flex justify-between gap-4 text-slate-700">
                <span>
                  {patient.visitType === 'review' ? t('visit.reviewCharge') : t('visit.firstCharge')}
                </span>
                <span>+{formatFee(fees.visitCharge, lang)}</span>
              </p>
            )}
            <p className="flex justify-between gap-4 border-t border-slate-200 pt-1 font-bold text-slate-900">
              <span>{t('pay.total')}</span>
              <span>{fees ? formatFee(fees.total, lang) : t('visit.chooseToSeeTotal')}</span>
            </p>
          </div>
        )}
      </div>

      {/*
        * First visit or review.
        *
        * Asked as two plain buttons rather than a dropdown: it is two options,
        * it changes the price, and it should be readable at a glance by
        * somebody holding a phone in a waiting room.
        */}
      <div>
        <p className="text-sm font-semibold text-slate-800">{t('visit.question')}</p>
        <p className="mt-0.5 text-xs text-slate-500">{t('visit.hint')}</p>
        <div
          role="radiogroup"
          aria-label={t('visit.question')}
          className="mt-2 grid gap-2 sm:grid-cols-2"
        >
          {['first', 'review'].map((option) => {
            const active = patient.visitType === option
            const charge = visitCharges?.[option]
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ ...patient, visitType: option })}
                className={cx(
                  'rounded-xl border px-3.5 py-3 text-left transition',
                  active
                    ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                    : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/50',
                )}
              >
                <span className="block text-sm font-bold text-slate-900">
                  {t(option === 'first' ? 'visit.first' : 'visit.review')}
                </span>
                <span className="mt-0.5 block text-xs text-slate-600">
                  {t(option === 'first' ? 'visit.firstHint' : 'visit.reviewHint')}
                  {charge != null && doctor.fee != null && ` · +${formatFee(charge, lang)}`}
                </span>
              </button>
            )
          })}
        </div>
        {errors.visitType && (
          <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-rose-600">
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {t(errors.visitType)}
          </p>
        )}
      </div>

      <h3 className="text-sm font-bold text-slate-900">{t('booking.patientDetails')}</h3>

      {prefilled && (
        <p className="-mt-3 text-xs text-slate-500">{t('booking.prefilled')}</p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label={t('field.fullName')} error={errors.name} htmlFor={ids.name}>
            <input
              id={ids.name}
              type="text"
              autoComplete="name"
              value={patient.name}
              onChange={set('name')}
              placeholder={t('field.fullNamePlaceholder')}
              aria-invalid={Boolean(errors.name)}
              className={inputClass(errors.name)}
            />
          </Field>
        </div>

        <Field label={t('field.age')} error={errors.age} htmlFor={ids.age}>
          <input
            id={ids.age}
            type="number"
            inputMode="numeric"
            min="0"
            max="120"
            value={patient.age}
            onChange={set('age')}
            placeholder={t('field.agePlaceholder')}
            aria-invalid={Boolean(errors.age)}
            className={inputClass(errors.age)}
          />
        </Field>

        <Field label={t('field.phone')} error={errors.phone} htmlFor={ids.phone}>
          <input
            id={ids.phone}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            value={patient.phone}
            onChange={set('phone')}
            placeholder={t('field.phonePlaceholder')}
            aria-invalid={Boolean(errors.phone)}
            className={inputClass(errors.phone)}
          />
        </Field>

        <div className="sm:col-span-2">
          <fieldset>
            <legend className="text-sm font-semibold text-slate-800">{t('field.gender')}</legend>
            <div
              role="radiogroup"
              aria-label={t('field.gender')}
              className="mt-1.5 flex flex-wrap gap-2"
            >
              {GENDERS.map((option) => {
                const selected = patient.gender === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onChange({ ...patient, gender: option.value })}
                    className={cx(
                      'rounded-lg border px-4 py-2 text-sm font-semibold transition',
                      selected
                        ? 'border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-600/25'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50',
                    )}
                  >
                    {t(option.labelKey)}
                  </button>
                )
              })}
            </div>
            {errors.gender && (
              <p
                role="alert"
                className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-rose-600"
              >
                <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
                {t(errors.gender)}
              </p>
            )}
          </fieldset>
        </div>

        <div className="sm:col-span-2">
          <Field label={t('field.reason')} error={errors.reason} htmlFor={ids.reason}>
            <textarea
              id={ids.reason}
              rows={3}
              value={patient.reason}
              onChange={set('reason')}
              placeholder={t('field.reasonPlaceholder')}
              aria-invalid={Boolean(errors.reason)}
              className={cx(inputClass(errors.reason), 'resize-y')}
            />

            {/*
              * Urgent first, and it does not offer a doctor at all. Somebody
              * describing chest pain or heavy bleeding needs casualty now, not
              * the first free slot on Thursday.
              */}
            {advice?.kind === 'urgent' && (
              <div
                role="alert"
                className="mt-2.5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3"
              >
                <p className="flex items-start gap-2 text-sm font-bold text-rose-900">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {t('triage.urgentTitle')}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-rose-900">{t('triage.urgentText')}</p>
                <a
                  href={telHref(HOSPITAL.emergencyPhone)}
                  className="mt-2.5 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700"
                >
                  <Phone className="size-4" aria-hidden="true" />
                  {t('triage.callNow', { number: HOSPITAL.emergencyPhone })}
                </a>
              </div>
            )}

            {/* A suggestion, not a correction — the booking continues either way. */}
            {advice?.kind === 'mismatch' && (
              <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm leading-relaxed text-amber-900">
                  {t('triage.mismatchText', {
                    department: tl(
                      DEPARTMENTS.find((d) => d.id === advice.departmentId)?.name ?? {
                        en: advice.departmentId,
                        ta: advice.departmentId,
                      },
                    ),
                    doctor: tl(doctor.name),
                  })}
                </p>
                {onSwitchDoctor && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {advice.alternatives.map((alt) => (
                      <button
                        key={alt.id}
                        type="button"
                        onClick={() => onSwitchDoctor(alt)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                      >
                        {tl(alt.name)}
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-amber-800">{t('triage.mismatchHint')}</p>
              </div>
            )}
          </Field>

          {onAttachmentsChange && (
            <div className="mt-5 border-t border-slate-200 pt-5">
              <AttachmentPicker files={attachments} onChange={onAttachmentsChange} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
