import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react'
import { useLanguage } from '../../i18n/context'
import { getDoctor } from '../../data/hospital'
import { errorKeyFor } from '../../lib/api'
import { payForAppointment } from '../../lib/razorpay'
import { formatFee } from '../../lib/schedule'
import { calculateTotal } from '../../lib/payment'
import Modal from '../Modal'
import Stepper from './Stepper'
import StepDepartmentDoctor from './StepDepartmentDoctor'
import StepDateTime from './StepDateTime'
import StepPatientDetails from './StepPatientDetails'
import StepPayment from './StepPayment'
import StepConfirmation from './StepConfirmation'
import { validatePatient, validateSchedule, validateSelection } from './validation'

const EMPTY_PATIENT = { name: '', age: '', phone: '', gender: '', reason: '', visitType: '' }

/**
 * Appointment wizard.
 *
 * The appointment is created on the server when the patient step is completed,
 * which is the moment the slot is actually held. Payment happens afterwards
 * against that record, so an abandoned payment never loses the booking.
 */
export default function BookingModal({
  open,
  onClose,
  onBook,
  onRequestCallback,
  onReschedule,
  onPayCounter,
  onPaid,
  initialDepartmentId = '',
  initialDoctorId = '',
  rescheduleOf = null,
  currentUser = null,
  onSignIn,
  payments,
  booking,
}) {
  const { t, tl, lang } = useLanguage()
  const isReschedule = Boolean(rescheduleOf)

  const [stepIndex, setStepIndex] = useState(0)
  const [departmentId, setDepartmentId] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [dateKey, setDateKey] = useState('')
  const [slot, setSlot] = useState('')
  const [patient, setPatient] = useState(EMPTY_PATIENT)
  /*
   * Which payment methods actually work right now. Razorpay is only wired up
   * when the hospital has supplied keys; without them the online option is
   * dead, and offering it anyway produced a "Pay ₹520" button that led to a
   * gateway error while the note underneath said to pay at the counter.
   */
  const onlineAvailable = payments?.provider === 'razorpay'
  const [methodId, setMethodId] = useState(onlineAvailable ? 'online' : 'counter')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverErrorKey, setServerErrorKey] = useState(null)
  const [result, setResult] = useState(null)

  const doctor = useMemo(() => (doctorId ? getDoctor(doctorId) : null), [doctorId])
  const isCallback = Boolean(doctor) && doctor.bookingMode !== 'live'

  /** Steps depend on the doctor: no slot picker when timings aren't published. */
  const steps = useMemo(() => {
    if (isReschedule) {
      return [
        { key: 'schedule', labelKey: 'booking.step2' },
        { key: 'confirm', labelKey: 'booking.step5' },
      ]
    }
    return [
      { key: 'doctor', labelKey: 'booking.step1' },
      ...(isCallback ? [] : [{ key: 'schedule', labelKey: 'booking.step2' }]),
      { key: 'patient', labelKey: 'booking.step3' },
      ...(isCallback ? [] : [{ key: 'payment', labelKey: 'booking.step4' }]),
      { key: 'confirm', labelKey: 'booking.step5' },
    ]
  }, [isReschedule, isCallback])

  // Identity-stable primitives only — object props change on parent renders.
  const latest = useRef({ currentUser, rescheduleOf, onlineAvailable })
  latest.current = { currentUser, rescheduleOf, onlineAvailable }
  const currentUserId = currentUser?.id ?? ''
  const rescheduleId = rescheduleOf?.id ?? ''

  useEffect(() => {
    if (!open) return
    const { currentUser: user, rescheduleOf: existing, onlineAvailable: canPayOnline } = latest.current
    setErrors({})
    setServerErrorKey(null)
    setResult(null)
    setStepIndex(0)
    setBusy(false)
    setMethodId(canPayOnline ? 'online' : 'counter')

    if (existing) {
      setDepartmentId(existing.departmentId)
      setDoctorId(existing.doctorId)
      setDateKey('')
      setSlot('')
      setPatient({ ...existing.patient, age: String(existing.patient.age) })
      return
    }

    setDepartmentId(
      initialDepartmentId || (initialDoctorId ? (getDoctor(initialDoctorId)?.departmentId ?? '') : ''),
    )
    setDoctorId(initialDoctorId)
    setDateKey('')
    setSlot('')
    setPatient(
      user
        ? {
            name: user.fullName ?? '',
            age: user.age == null ? '' : String(user.age),
            phone: user.phone ?? '',
            gender: user.gender ?? '',
            reason: '',
          }
        : EMPTY_PATIENT,
    )
  }, [open, rescheduleId, initialDepartmentId, initialDoctorId, currentUserId])

  const currentStep = steps[Math.min(stepIndex, steps.length - 1)].key

  const selectDepartment = useCallback((id) => {
    setDepartmentId(id)
    setDoctorId('')
    setDateKey('')
    setSlot('')
    setErrors({})
  }, [])

  /*
   * Choosing a doctor, or a time, moves on by itself.
   *
   * Picking the only thing on the screen and then hunting for a Next button is
   * a step of work that carries no decision. The two places it applies are the
   * ones where a tap IS the answer to the question the step asked — the doctor,
   * and the slot. Everything else on the way through has more than one field,
   * so it still advances on Next.
   *
   * Back still works from either, so an accidental tap costs one press to undo.
   */
  const selectDoctor = useCallback((id) => {
    setDoctorId(id)
    setDateKey('')
    setSlot('')
    setErrors((prev) => ({ ...prev, doctorId: undefined }))
    setStepIndex((i) => i + 1)
  }, [])

  const selectDate = useCallback((key) => {
    setDateKey(key)
    setSlot('')
    setErrors((prev) => ({ ...prev, date: undefined }))
  }, [])

  const selectSlot = useCallback(
    (value) => {
      setSlot(value)
      setErrors((prev) => ({ ...prev, slot: undefined }))
      // Not while rescheduling: there the slot is the whole change, and it is
      // confirmed on this same screen rather than leading anywhere.
      if (!isReschedule) setStepIndex((i) => i + 1)
    },
    [isReschedule],
  )

  /*
   * A catalogue refresh can switch online payment off mid-flow. Selecting a
   * method the server cannot honour is never valid, so fall back rather than
   * letting the footer offer to charge a card.
   */
  useEffect(() => {
    if (!onlineAvailable && methodId === 'online') setMethodId('counter')
  }, [onlineAvailable, methodId])

  const patientPayload = useCallback(
    () => ({
      name: patient.name.trim(),
      age: Number(patient.age),
      phone: patient.phone.replace(/[\s-]/g, ''),
      gender: patient.gender,
      reason: patient.reason.trim(),
    }),
    [patient],
  )

  /** Creates the appointment. This is when the slot is actually held. */
  const createAppointment = useCallback(async () => {
    setBusy(true)
    setServerErrorKey(null)
    try {
      const appointment = isCallback
        ? await onRequestCallback({
            doctorId: doctor.id,
            visitType: patient.visitType || undefined,
            patient: patientPayload(),
          })
        : await onBook(
            {
              doctorId: doctor.id,
              date: dateKey,
              slot,
              visitType: patient.visitType,
              patient: patientPayload(),
            },
            // No account: App routes this to the guest endpoint instead.
            { asGuest: !currentUser },
          )

      setResult(appointment)
      setStepIndex((i) => i + 1)
    } catch (error) {
      setServerErrorKey(errorKeyFor(error))
      // A lost race sends the patient back to pick another time.
      if (error.code === 'SLOT_TAKEN') {
        setSlot('')
        setStepIndex(steps.findIndex((s) => s.key === 'schedule'))
      }
    } finally {
      setBusy(false)
    }
    // patient.visitType is listed explicitly: it is read directly rather than
    // through patientPayload, so nothing else here would rebuild this callback
    // when only the visit type changes — and a stale one is the wrong price.
    // currentUser decides guest vs signed-in booking, so a stale value would
    // send a signed-in patient down the guest route and lose the link to
    // their account.
  }, [isCallback, onRequestCallback, onBook, doctor, dateKey, slot, patientPayload, patient.visitType, currentUser, steps])

  const applyReschedule = useCallback(async () => {
    setBusy(true)
    setServerErrorKey(null)
    try {
      const appointment = await onReschedule(rescheduleOf.id, { date: dateKey, slot })
      setResult(appointment)
      setStepIndex(steps.length - 1)
    } catch (error) {
      setServerErrorKey(errorKeyFor(error))
      if (error.code === 'SLOT_TAKEN') setSlot('')
    } finally {
      setBusy(false)
    }
  }, [onReschedule, rescheduleOf, dateKey, slot, steps.length])

  /** Settles payment for the appointment just created. */
  const settlePayment = useCallback(async () => {
    setBusy(true)
    setServerErrorKey(null)
    try {
      if (methodId === 'counter') {
        setResult(await onPayCounter(result.id))
      } else {
        const paid = await payForAppointment(result, {
          name: result.patient.name,
          phone: result.patient.phone,
          email: currentUser?.email,
          description: tl(doctor.name),
        })
        // `null` means the patient closed the sheet — keep the booking as is.
        if (paid) {
          setResult(paid)
          onPaid?.(paid)
        } else {
          setBusy(false)
          return
        }
      }
      setStepIndex((i) => i + 1)
    } catch (error) {
      setServerErrorKey(errorKeyFor(error))
    } finally {
      setBusy(false)
    }
  }, [methodId, onPayCounter, onPaid, result, currentUser, doctor, tl])

  const goNext = useCallback(() => {
    if (busy) return
    setServerErrorKey(null)

    if (currentStep === 'doctor') {
      const found = validateSelection({ departmentId, doctorId })
      setErrors(found)
      if (Object.keys(found).length === 0) setStepIndex((i) => i + 1)
      return
    }

    if (currentStep === 'schedule') {
      const found = validateSchedule({ date: dateKey, slot })
      setErrors(found)
      if (Object.keys(found).length > 0) return
      if (isReschedule) applyReschedule()
      else setStepIndex((i) => i + 1)
      return
    }

    if (currentStep === 'patient') {
      const found = validatePatient(patient)
      setErrors(found)
      if (Object.keys(found).length === 0) createAppointment()
      return
    }

    if (currentStep === 'payment') settlePayment()
  }, [
    busy,
    currentStep,
    departmentId,
    doctorId,
    dateKey,
    slot,
    patient,
    isReschedule,
    applyReschedule,
    createAppointment,
    settlePayment,
  ])

  const goBack = useCallback(() => {
    setErrors({})
    setServerErrorKey(null)
    setStepIndex((i) => Math.max(0, i - 1))
  }, [])

  /*
   * There is no sign-in wall any more.
   *
   * Booking used to stop here and demand an account, which meant a one-time
   * code, which meant an SMS gateway and TRAI registration. The hospital
   * decided against all of it, so a patient now books the way they would at
   * the counter — name, age, phone, reason — and takes away a reference.
   */

  const nextLabel = (() => {
    if (currentStep === 'patient') {
      return isCallback ? t('booking.sendRequest') : t('booking.holdSlot')
    }
    if (currentStep === 'payment') {
      if (methodId === 'counter') return t('pay.confirmCounter')
      const { total } = calculateTotal(result?.fee ?? doctor?.fee, methodId, payments?.convenienceFee)
      return t('pay.payNow', { amount: formatFee(total, lang) })
    }
    if (currentStep === 'schedule' && isReschedule) return t('action.confirm')
    return t('action.next')
  })()

  const footer =
    currentStep === 'confirm' ? (
      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          {t('action.done')}
        </button>
      </div>
    ) : (
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={stepIndex === 0 ? onClose : goBack}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {stepIndex === 0 ? t('action.cancel') : t('action.back')}
        </button>

        <button
          type="button"
          onClick={goNext}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700 disabled:opacity-70"
        >
          {busy ? (
            <>
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              {t('pay.processing')}
            </>
          ) : (
            <>
              {nextLabel}
              <ChevronRight className="size-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isReschedule ? t('booking.rescheduleTitle') : t('booking.title')}
      subtitle={
        currentStep === 'confirm'
          ? (doctor && tl(doctor.name)) || undefined
          : t('booking.step', { current: stepIndex + 1, total: steps.length })
      }
      footer={footer}
      closeOnBackdrop={currentStep !== 'confirm' && !busy}
    >
      {currentStep !== 'confirm' && <Stepper steps={steps} current={stepIndex} />}

      {serverErrorKey && currentStep !== 'payment' && (
        <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {t(serverErrorKey)}
        </p>
      )}

      {currentStep === 'doctor' && (
        <StepDepartmentDoctor
          departmentId={departmentId}
          doctorId={doctorId}
          onSelectDepartment={selectDepartment}
          onSelectDoctor={selectDoctor}
          errors={errors}
        />
      )}

      {currentStep === 'schedule' && doctor && (
        <StepDateTime
          doctor={doctor}
          dateKey={dateKey}
          slot={slot}
          onSelectDate={selectDate}
          onSelectSlot={selectSlot}
          errors={errors}
        />
      )}

      {currentStep === 'patient' && doctor && (
        <StepPatientDetails
          visitCharges={booking?.visitCharges}
          onSwitchDoctor={(alt) => {
            /*
             * Move the whole booking to the suggested doctor: department, and
             * back to the schedule step, because their consulting days will
             * differ and the slot already picked almost certainly does not
             * exist for them.
             */
            setDepartmentId(alt.departmentId)
            setDoctorId(alt.id)
            setSlot('')
            setStepIndex(steps.findIndex((s) => s.key === 'schedule'))
          }}
          patient={patient}
          onChange={setPatient}
          errors={errors}
          doctor={doctor}
          dateKey={dateKey}
          slot={slot}
          isCallback={isCallback}
          isGuest={!currentUser}
          onSignIn={onSignIn}
          prefilled={Boolean(currentUser?.fullName)}
        />
      )}

      {currentStep === 'payment' && doctor && result && (
        <StepPayment
          methodId={methodId}
          onMethodChange={setMethodId}
          consultationFee={result?.fee ?? doctor.fee}
          doctor={doctor}
          visitType={patient.visitType}
          visitCharges={booking?.visitCharges}
          convenienceFee={payments?.convenienceFee ?? 0}
          onlineAvailable={onlineAvailable}
          processing={busy}
          errorKey={serverErrorKey}
          appointmentId={result.id}
        />
      )}

      {currentStep === 'confirm' && result && (
        <StepConfirmation appointment={result} isReschedule={isReschedule} />
      )}
    </Modal>
  )
}
