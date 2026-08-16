/**
 * Tour scripts.
 *
 * Steps are resolved against `data-tour` attributes in the markup, so adding
 * or moving a control breaks the tour loudly (the step is skipped) rather
 * than quietly pointing at the wrong thing.
 */

/** First-run tour for patients. Bilingual, like the rest of the patient app. */
export const patientTour = (t) => [
  {
    target: '[data-tour="book"]',
    page: 'home',
    title: t('tour.p1Title'),
    body: t('tour.p1Body'),
  },
  {
    target: '[data-tour="language"]',
    title: t('tour.p2Title'),
    body: t('tour.p2Body'),
  },
  /*
   * These two point at the desktop navigation, which collapses into the menu
   * button on anything narrower than a large screen — where most patients are.
   * requireTarget drops them there rather than showing a step that highlights
   * nothing and describes a link the viewer cannot see.
   */
  {
    target: '[data-tour="nav-doctors"]',
    requireTarget: true,
    title: t('tour.p3Title'),
    body: t('tour.p3Body'),
  },
  {
    target: '[data-tour="nav-health"]',
    page: 'home',
    requireTarget: true,
    title: t('tour.p5Title'),
    body: t('tour.p5Body'),
  },
  {
    target: '[data-tour="assistant"]',
    title: t('tour.p6Title'),
    body: t('tour.p6Body'),
  },
  {
    target: '[data-tour="emergency"]',
    title: t('tour.p7Title'),
    body: t('tour.p7Body'),
  },
]

/**
 * Desk tour. English only, matching the rest of the desk — this is an
 * internal screen used by a handful of trained staff, and a mistranslated
 * operational term costs more than an untranslated one.
 */
export const deskTour = [
  {
    target: '[data-tour="desk-today"]',
    requireTarget: true,
    title: 'Today',
    body: "Everyone booked in for today, in time order, with the patient's number to hand. This is the screen to leave open at the counter.",
  },
  {
    target: '[data-tour="desk-book"]',
    requireTarget: true,
    title: 'Book for a caller',
    body: 'The main job. While someone is on the phone: pick the doctor, read out the free slots, take their details, done. No app, no OTP, nothing for the patient to install.',
  },
  {
    target: '[data-tour="desk-callbacks"]',
    requireTarget: true,
    title: 'To call back',
    body: 'Patients who asked for a doctor whose timings are not published yet. Ring them, then use “Give them a time” to turn the request into a real appointment.',
  },
  {
    target: '[data-tour="desk-schedules"]',
    requireTarget: true,
    title: 'Schedules',
    body: 'A doctor only becomes bookable once their days, session times and fee are all set. This is the highest-value screen here — every doctor you complete is one more patients can book directly.',
  },
  {
    target: '[data-tour="desk-repeats"]',
    requireTarget: true,
    title: 'Repeat requests',
    body: 'Patients on long-term medication asking for the same prescription again. Approving writes a new prescription; the original is never edited. A decline needs a reason, which the patient sees.',
  },
  {
    target: '[data-tour="desk-followups"]',
    requireTarget: true,
    title: 'Follow-ups due',
    body: 'Patients a doctor asked to come back who have not been seen since. Overdue first. “Book them in” carries their details straight into the booking form.',
  },
  {
    target: '[data-tour="desk-alerts"]',
    requireTarget: true,
    title: 'Alerts',
    body: 'Every booking, cancellation and callback lands here. If a doctor was not notified, the reason is spelled out — usually a missing number or consent not yet recorded.',
  },
  {
    target: '[data-tour="desk-queue"]',
    requireTarget: true,
    title: 'My queue',
    body: 'Open your sitting and everyone booked into it gets a token automatically. “Call next” advances it, and patients watching from home see their position update.',
  },
  {
    target: '[data-tour="desk-profile"]',
    requireTarget: true,
    title: 'My profile',
    body: 'Your own consulting days, times, room and fee — and an away range that blocks booking while you are gone. Your name, qualification and registration number are hospital records; ask the front office to change those.',
  },
]
