import { DOCTORS } from '../data/hospital'
import { SYMPTOM_MAP, matchDepartment } from './symptoms'

/**
 * Reads the "reason for visit" and, where it clearly points somewhere else,
 * says so.
 *
 * Three rules keep this safe:
 *
 *   1. **It never blocks a booking.** A patient may know perfectly well why
 *      they want a particular doctor — a second opinion, a follow-up, a
 *      relative who works there. This offers; it does not decide.
 *   2. **It stays silent unless there is a clear mismatch.** If the words
 *      match the chosen doctor's own department at all, nothing is shown.
 *      A suggestion that fires on half of all bookings is noise, and noise
 *      gets clicked past — including the one time it mattered.
 *   3. **It never names a condition.** It maps words to a department and
 *      stops. "You may have angina" is a diagnosis; "chest pain is usually
 *      seen in Cardiology" is a signpost.
 *
 * The emergency case is the reason this is worth building at all. Somebody
 * typing "severe chest pain, can't breathe" into a booking form should be told
 * to ring casualty now — not offered the first free slot on Thursday.
 */

/** Words that mean "do not book an appointment, get help now". */
const EMERGENCY_WORDS = [
  'chest pain', 'severe chest', 'heart attack', 'cannot breathe', "can't breathe",
  'not breathing', 'breathless severe', 'unconscious', 'not responding', 'collapsed',
  'fainted', 'seizure now', 'fitting', 'stroke', 'slurred speech', 'face droop',
  'heavy bleeding', 'bleeding badly', 'severe bleeding', 'poison', 'overdose',
  'snake bite', 'suicide', 'kill myself', 'end my life',
  'accident', 'road accident', 'severe burn', 'deep cut',
  'மார்பு வலி', 'நெஞ்சு வலி', 'மூச்சு விட', 'மயக்கம்', 'வலிப்பு', 'பக்கவாத',
  'அதிக ரத்தம்', 'விஷம்', 'பாம்பு', 'விபத்து', 'தீக்காயம்',
  'सीने में दर्द', 'छाती में दर्द', 'दिल का दौरा', 'साँस नहीं', 'सांस नहीं',
  'बेहोश', 'होश नहीं', 'दौरा पड़', 'लकवा', 'बहुत खून', 'ज़हर', 'जहर',
  'साँप ने काटा', 'सांप ने काटा', 'दुर्घटना', 'गहरा घाव', 'आत्महत्या', 'जान देना',
]

const normalise = (text) =>
  String(text ?? '').toLowerCase().replace(/[.,!?;:'"()]/g, ' ').replace(/\s+/g, ' ').trim()

/*
 * Both sides get normalised, and that is not a tidiness point.
 *
 * `normalise` strips apostrophes from what the patient typed, so "can't
 * breathe" arrives as "can t breathe" — while the word list still held the
 * apostrophe. The contraction people actually type could therefore never
 * match, and only the formal "cannot breathe" fired. Normalising the list the
 * same way closes that, and keeps any future apostrophe entry working.
 */
const EMERGENCY_PHRASES = [...new Set(EMERGENCY_WORDS.map(normalise))].filter(Boolean)

/** Does the reason read like something that cannot wait for an appointment? */
export function looksUrgent(reason) {
  const q = normalise(reason)
  if (q.length < 4) return false
  return EMERGENCY_PHRASES.some((word) => q.includes(word))
}

/**
 * Assesses a reason against the doctor it is about to be booked with.
 *
 * Returns `null` when there is nothing useful to say — which is most of the
 * time, and deliberately so.
 */
export function assessReason(reason, doctor) {
  const q = normalise(reason)
  // Too short to read anything into. "Fever" is fine; "hi" is not.
  if (q.length < 4 || !doctor) return null

  if (looksUrgent(reason)) return { kind: 'urgent' }

  const suggestedId = matchDepartment(q)
  if (!suggestedId) return null

  // The chosen doctor already fits — say nothing.
  if (suggestedId === doctor.departmentId) return null

  /*
   * Silence also when the words match the doctor's own department *as well*
   * as another. "My child has a fever" hits both paediatrics and general
   * medicine; either doctor is a reasonable choice and second-guessing the
   * patient there would be wrong.
   */
  const ownDepartment = SYMPTOM_MAP.find((entry) => entry.departmentId === doctor.departmentId)
  if (ownDepartment && ownDepartment.words.some((word) => q.includes(word))) return null

  const alternatives = DOCTORS.filter(
    (d) => d.departmentId === suggestedId && d.id !== doctor.id,
  ).slice(0, 3)

  // Nobody to refer them to — better to stay quiet than to point at an
  // empty department.
  if (alternatives.length === 0) return null

  return { kind: 'mismatch', departmentId: suggestedId, alternatives }
}
