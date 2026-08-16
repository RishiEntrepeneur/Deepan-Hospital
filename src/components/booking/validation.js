/**
 * Client-side validation — a fast first pass only.
 * The server re-validates every field; nothing here is trusted.
 */

/** Letters (any script, so Tamil names pass), spaces and the usual name punctuation. */
const NAME_PATTERN = /^[\p{L}\p{M}\s.'-]+$/u
const PHONE_PATTERN = /^[6-9]\d{9}$/

export function validatePatient(patient) {
  const errors = {}
  const name = patient.name.trim()
  const phone = patient.phone.replace(/[\s-]/g, '')

  if (!name) errors.name = 'error.nameRequired'
  else if (name.length < 3) errors.name = 'error.nameTooShort'
  else if (!NAME_PATTERN.test(name)) errors.name = 'error.nameInvalid'

  if (patient.age === '') errors.age = 'error.ageRequired'
  else {
    const age = Number(patient.age)
    if (!Number.isInteger(age) || age < 0 || age > 120) errors.age = 'error.ageInvalid'
  }

  if (!phone) errors.phone = 'error.phoneRequired'
  else if (!PHONE_PATTERN.test(phone)) errors.phone = 'error.phoneInvalid'

  if (!patient.gender) errors.gender = 'error.genderRequired'

  /*
   * Required, not defaulted. It decides the case-sheet charge, and picking one
   * for the patient means picking what they pay.
   */
  if (patient.visitType !== 'first' && patient.visitType !== 'review') {
    errors.visitType = 'error.visitTypeRequired'
  }

  const reason = patient.reason.trim()
  if (!reason) errors.reason = 'error.reasonRequired'
  else if (reason.length < 5) errors.reason = 'error.reasonTooShort'

  return errors
}

export function validateSelection({ departmentId, doctorId }) {
  const errors = {}
  if (!departmentId) errors.departmentId = 'error.deptRequired'
  if (!doctorId) errors.doctorId = 'error.doctorRequired'
  return errors
}

export function validateSchedule({ date, slot }) {
  const errors = {}
  if (!date) errors.date = 'error.dateRequired'
  if (!slot) errors.slot = 'error.slotRequired'
  return errors
}
