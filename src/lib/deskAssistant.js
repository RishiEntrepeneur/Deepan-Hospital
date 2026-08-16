import { DOCTORS } from '../data/hospital'

/**
 * Help assistant for the reception desk and doctor portal.
 *
 * A separate answer set from the patient one, not a shared one with extra
 * branches. A doctor typing "how do I prescribe" must not be offered a
 * department to book into, and reception asking about "repeat requests" must
 * not get the patient-facing explanation of what a repeat prescription is.
 * The two audiences ask different questions in the same words.
 *
 * English only, matching the rest of the desk: this is an internal screen used
 * by a handful of trained staff, and a mistranslated operational term costs
 * more than an untranslated one.
 *
 * Two things it deliberately will not do:
 *
 *   1. Look up patients. Patient history has an audited route for a reason —
 *      a search box that quietly reads records around the side of it would
 *      make the audit log a lie.
 *   2. Answer clinical questions. It is a keyword matcher over this app's own
 *      help text. A doctor who types a dosage question must get a refusal,
 *      not a confident guess.
 */
const normalise = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const hasAny = (q, words) => words.some((w) => q.includes(w))

/** Jump straight to the tab being described. */
const tab = (id, label) => ({ type: 'tab', tab: id, label })

/*
 * Anything that looks like a request for medical judgement. Matched before
 * everything else — a question containing both "dose" and "prescribe" must be
 * refused, not answered with the how-to for the Prescribe tab.
 */
const CLINICAL = [
  'dose', 'dosage', 'mg', 'ml per', 'how much should i give', 'contraindicat',
  'side effect', 'interaction', 'diagnos', 'treatment for', 'treat a', 'antibiotic for',
  'which drug', 'what drug', 'prescribe for', 'is it safe to give', 'paediatric dose',
]

export function deskAnswer(rawQuery, ctx = {}) {
  const q = normalise(rawQuery)
  const { isDoctor = false } = ctx

  if (!q) return { text: 'Ask me about anything on this screen and I will point you at it.' }

  /* --- Clinical questions: refuse plainly, first, before any other match --- */
  if (hasAny(q, CLINICAL)) {
    return {
      text:
        'I cannot help with that, and you should not trust me if I tried.\n\n' +
        'I only match what you type against this app’s own help text — I have no ' +
        'clinical knowledge, no drug database and no way to check whether an answer ' +
        'is right. For anything about a medicine or a diagnosis, use your own ' +
        'references.\n\n' +
        'I can tell you where things are on this screen.',
    }
  }

  /* --- Patient lookup: refuse, and say where the proper route is --- */
  if (hasAny(q, ['find patient', 'search patient', 'look up patient', 'patient details for', 'phone number of'])) {
    return {
      text:
        'I do not search patient records.\n\n' +
        'Patient history is opened from a specific appointment, and every time it ' +
        'is opened the hospital records who looked and when. A search box here ' +
        'would go around that, which would make the audit log untrue.\n\n' +
        'Open the patient from Today or from your queue instead.',
      actions: [tab('today', 'Today')],
    }
  }

  /* --- Who/what are you --- */
  if (hasAny(q, ['who are you', 'what are you', 'are you ai', 'chatgpt', 'are you a bot'])) {
    return {
      text:
        'A help index for this screen, not an AI.\n\n' +
        'I match what you type against a fixed list of topics about how the desk ' +
        'works. I cannot reason, I know nothing about medicine, and I will ' +
        'sometimes fail to understand you. When that happens, the Show me around ' +
        'tour covers the same ground more slowly.',
    }
  }

  /* --- Approvals and the pending flow --- */
  if (hasAny(q, ['approve', 'pending', 'new request', 'waiting', 'confirm booking', 'unconfirmed'])) {
    return {
      text:
        'Bookings made while reception is open land in New requests and wait for ' +
        'you. The slot is already held, so nobody else can take it — approving ' +
        'just tells the patient they are expected.\n\n' +
        'Bookings made after the desk closes are confirmed automatically rather ' +
        'than sitting in a queue nobody is watching overnight.',
      actions: [tab('requests', 'New requests')],
    }
  }

  /* --- Queue and tokens --- */
  if (hasAny(q, ['queue', 'token', 'call next', 'sitting', 'waiting room', 'walk in', 'walkin'])) {
    return {
      text: isDoctor
        ? 'My queue → Open your sitting, and everyone booked into it gets a token ' +
          'automatically. "Call next" moves it along, and patients watching from ' +
          'home see their position change as you go. Walk-ins can be added to the ' +
          'end without an appointment.'
        : 'Queues belong to a doctor — they open their own sitting from their ' +
          'account, and tokens are issued automatically to everyone booked in. ' +
          'From reception you can see who is booked under Today.',
      actions: [isDoctor ? tab('queue', 'My queue') : tab('today', 'Today')],
    }
  }

  /* --- Prescribing --- */
  if (hasAny(q, ['prescri', 'medicine', 'medication', 'drug list', 'rx'])) {
    if (!isDoctor) {
      return {
        text:
          'Only a doctor account can write a prescription. Reception cannot, and ' +
          'that is deliberate.\n\n' +
          'If a patient is asking for a repeat of an existing prescription, that ' +
          'goes to the doctor through Repeat requests.',
        actions: [tab('repeats', 'Repeat requests')],
      }
    }
    return {
      text:
        'Prescribe → pick the appointment, add the diagnosis, advice and each ' +
        'medicine with its dose and duration. The patient sees it under My Health ' +
        'and can ask for a repeat later.\n\n' +
        'Approving a repeat writes a new prescription; the original is never ' +
        'edited, so the record of what you prescribed and when stays intact.',
      actions: [tab('prescribe', 'Prescribe'), tab('repeats', 'Repeat requests')],
    }
  }

  /* --- Schedules: the thing that actually blocks the app --- */
  if (hasAny(q, ['schedule', 'timing', 'bookable', 'not bookable', 'opd hour', 'consulting day', 'make bookable', 'fee'])) {
    const live = DOCTORS.filter((d) => d.bookingMode === 'live').length
    const total = DOCTORS.length
    return {
      text:
        `${live} of ${total} doctors can currently be booked online. ` +
        `${total - live > 0 ? `The other ${total - live} only take callback requests.` : ''}\n\n` +
        'A doctor becomes bookable once their consulting days, at least one ' +
        'session time and a fee are all set. Schedules → "Set several doctors at ' +
        'once" does a whole group who share OPD hours in one go.\n\n' +
        'This is the highest-value screen here — every doctor you complete is one ' +
        'more that patients can book directly instead of phoning.',
      actions: [tab('schedules', 'Schedules')],
    }
  }

  /* --- Booking for someone on the phone --- */
  if (hasAny(q, ['book for', 'phone', 'caller', 'walk up', 'counter booking', 'book a patient'])) {
    return {
      text:
        'Book for a caller is the main counter job. While someone is on the ' +
        'phone: pick the doctor, read out the free slots, take their name, age ' +
        'and number, done. Nothing for the patient to install and no code to ' +
        'wait for.',
      actions: [tab('book', 'Book for a caller')],
    }
  }

  /* --- Callbacks --- */
  if (hasAny(q, ['callback', 'call back', 'ring back', 'give them a time'])) {
    return {
      text:
        'To call back holds patients who asked for a doctor whose timings are not ' +
        'published yet. Ring them, then use "Give them a time" to turn the ' +
        'request into a real appointment without retyping their details.',
      actions: [tab('callbacks', 'To call back')],
    }
  }

  /* --- Follow-ups --- */
  if (hasAny(q, ['follow up', 'followup', 'come back', 'review appointment'])) {
    return {
      text:
        'Follow-ups due lists patients a doctor asked to return who have not been ' +
        'seen since, overdue first. "Book them in" carries their details straight ' +
        'into the booking form.',
      actions: [tab('followups', 'Follow-ups due')],
    }
  }

  /* --- Alerts / notifications --- */
  if (hasAny(q, ['alert', 'notification', 'not notified', 'skipped', 'why was', 'no sms', 'sms'])) {
    return {
      text:
        'Every booking, cancellation and callback lands in Alerts. If a doctor ' +
        'was not told, the reason is spelled out — usually a missing number or ' +
        'consent not recorded.\n\n' +
        'Note that the app sends no SMS at all at present. Alerts are on-screen ' +
        'only, so this feed is the notification.',
      actions: [tab('alerts', 'Alerts'), tab('contacts', 'Doctor contacts')],
    }
  }

  /* --- The live feed --- */
  if (hasAny(q, ['live', 'chime', 'sound', 'not updating', 'refresh', 'checking'])) {
    return {
      text:
        'The chip in the header says Live or Checking. Live means new bookings ' +
        'appear on their own. Checking means the connection dropped and it is ' +
        're-reading every 45 seconds instead — still correct, just slower.\n\n' +
        'Turn on Chime and Alerts once on the machine at the counter, so an ' +
        'arriving booking makes a noise rather than waiting to be noticed.',
    }
  }

  /* --- Password --- */
  if (hasAny(q, ['password', 'sign in', 'login', 'locked out', 'forgot'])) {
    return {
      text:
        'The Password button in the header changes your own. You need your ' +
        'current one, and every other device signed in as you is signed out — ' +
        'this screen stays signed in.\n\n' +
        'If you have forgotten it entirely, nobody can look it up; passwords are ' +
        'stored so that even the server cannot read them. Ask whoever runs the ' +
        'server to set you a new one.',
    }
  }

  /* --- Own profile / away dates --- */
  if (hasAny(q, ['my profile', 'away', 'leave', 'holiday', 'my room', 'my fee', 'my timing'])) {
    return {
      text: isDoctor
        ? 'My profile holds your consulting days, times, room and fee, plus an ' +
          'away range that blocks booking while you are gone.\n\n' +
          'Your name, qualification and registration number are hospital records ' +
          'and cannot be edited here — ask the front office to change those.'
        : 'Each doctor edits their own days, times, room and away dates from ' +
          'their own account. From reception, use Schedules.',
      actions: [isDoctor ? tab('profile', 'My profile') : tab('schedules', 'Schedules')],
    }
  }

  /* --- Patient history --- */
  if (hasAny(q, ['history', 'past visit', 'previous', 'old record', 'records'])) {
    return {
      text:
        'Open a patient from Today or from your queue and their history is on the ' +
        'appointment. A doctor sees only their own patients.\n\n' +
        'Every time a history is opened, who looked and when is recorded. That is ' +
        'deliberate and cannot be switched off.',
      actions: [tab('today', 'Today')],
    }
  }

  /* --- Cancel / reschedule --- */
  if (hasAny(q, ['cancel', 'reschedule', 'move appointment', 'change time', 'no show'])) {
    return {
      text:
        'Each row on Today and New requests has Approve, Seen and Cancel. Only ' +
        'the moves that are legal from that row’s current state are shown, so you ' +
        'cannot put an appointment into a state it should not be in.\n\n' +
        'To move someone to a different time, cancel and rebook from Book for a ' +
        'caller — the slot is released immediately.',
      actions: [tab('today', 'Today')],
    }
  }

  /* --- Money --- */
  if (hasAny(q, ['payment', 'paid', 'money', 'bill', 'razorpay', 'upi', 'card'])) {
    return {
      text:
        'Online payment is not switched on, so nothing is charged through the ' +
        'app. Patients pay at the billing counter as usual and the appointment ' +
        'records that it was settled there.\n\n' +
        'Card and UPI details are never stored by this app under any setting.',
    }
  }

  return {
    text:
      'I did not understand that one.\n\n' +
      'I only know about this screen — approvals, queues, schedules, booking for ' +
      'a caller, callbacks, follow-ups, alerts and prescriptions. Try naming one ' +
      'of those, or take the tour from the header.',
    suggestions: [
      'How do I make a doctor bookable?',
      'What is New requests for?',
      'Why was a doctor not notified?',
    ],
  }
}

export const deskGreeting = ({ isDoctor = false, username = '' } = {}) => ({
  text:
    `Signed in as ${username}. I can explain anything on this screen — approvals, ` +
    `schedules, booking for a caller, alerts${isDoctor ? ', your queue and prescribing' : ''}.\n\n` +
    'I do not answer clinical questions and I do not search patient records.',
  suggestions: isDoctor
    ? ['How do I open my queue?', 'How do I prescribe?', 'How do I set my away dates?']
    : ['How do I make a doctor bookable?', 'What is New requests for?', 'How do I book for a caller?'],
})
