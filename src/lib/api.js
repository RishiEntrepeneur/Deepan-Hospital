/**
 * API client.
 *
 * Every call goes through here so error shapes and credential handling stay
 * consistent. The server sets an httpOnly session cookie; the browser sends it
 * automatically with `credentials: 'include'`.
 */

const BASE = import.meta.env.VITE_API_URL ?? '/api'

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message || code)
    this.status = status
    this.code = code
    this.details = details
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let response
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the hospital server.')
  }

  if (response.status === 204) return null

  let payload = null
  try {
    payload = await response.json()
  } catch {
    /* empty or non-JSON body */
  }

  if (!response.ok) {
    const error = payload?.error ?? {}
    throw new ApiError(response.status, error.code ?? 'REQUEST_FAILED', error.message, error.details)
  }

  return payload
}

/**
 * Absolute URL for the live feed. EventSource takes a URL, not a fetch config,
 * so it cannot reuse `request` — but it must resolve against the same base.
 */
export const liveAppointmentsUrl = () => `${BASE}/appointments/live`

export const api = {
  health: () => request('/health'),
  catalog: (signal) => request('/catalog', { signal }),
  availability: (doctorId, date, signal) =>
    request(`/doctors/${encodeURIComponent(doctorId)}/availability?date=${date}`, { signal }),

  auth: {
    me: (signal) => request('/auth/me', { signal }),
    requestOtp: (phone) => request('/auth/otp', { method: 'POST', body: { phone } }),
    verifyOtp: (phone, code) => request('/auth/verify', { method: 'POST', body: { phone, code } }),
    saveProfile: (profile) => request('/auth/profile', { method: 'POST', body: profile }),
    signOut: () => request('/auth/signout', { method: 'POST' }),
    /* Password sign-in — no code, no SMS. */
    register: (phone, password, fullName, bookingReference, captcha) =>
      request('/auth/register', {
        method: 'POST',
        body: {
          phone,
          password,
          fullName,
          bookingReference,
          captchaToken: captcha?.token,
          captchaAnswer: captcha?.answer,
        },
      }),
    login: (phone, password, captcha) =>
      request('/auth/login', {
        method: 'POST',
        body: {
          phone,
          password,
          captchaToken: captcha?.token,
          captchaAnswer: captcha?.answer,
        },
      }),
    /* The sum a patient answers, and whether signing in needs one yet. */
    captcha: (signal) => request('/auth/captcha', { signal }),
    loginChallenge: (signal) => request('/auth/login-challenge', { signal }),
    consent: (version) => request('/auth/consent', { method: 'POST', body: { version } }),
    exportData: (signal) => request('/auth/export', { signal }),
    erase: () => request('/auth/erase', { method: 'POST' }),
  },

  appointments: {
    list: (signal) => request('/appointments', { signal }),
    book: (payload) => request('/appointments', { method: 'POST', body: payload }),
    /*
     * Booking with no account. Same shape as `book`, different endpoint —
     * the server creates the appointment with no patient row at all, so
     * there is nothing to sign in to and nothing retained beyond the visit.
     */
    bookAsGuest: (payload) => request('/appointments/guest', { method: 'POST', body: payload }),
    /** Find or cancel a guest booking with its reference and phone number. */
    lookup: (reference, phone) =>
      request('/appointments/lookup', { method: 'POST', body: { reference, phone } }),
    lookupCancel: (reference, phone) =>
      request('/appointments/lookup/cancel', { method: 'POST', body: { reference, phone } }),
    requestCallback: (payload) => request('/appointments/callback', { method: 'POST', body: payload }),
    cancel: (id) => request(`/appointments/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
    reschedule: (id, payload) =>
      request(`/appointments/${encodeURIComponent(id)}/reschedule`, { method: 'POST', body: payload }),
  },

  /** Clinical: queue, prescriptions, records. */
  clinical: {
    myTokens: (signal) => request('/my-tokens', { signal }),
    prescriptions: (signal) => request('/prescriptions', { signal }),
    records: (signal) => request('/records', { signal }),
    publicQueue: (doctorId, date, signal) =>
      request(`/queue/${encodeURIComponent(doctorId)}${date ? `?date=${date}` : ''}`, { signal }),
    consult: (appointmentId, signal) =>
      request(`/consults/${encodeURIComponent(appointmentId)}`, { signal }),

    // staff / doctor
    openQueue: (doctorId, body) =>
      request(`/queue/${encodeURIComponent(doctorId)}/open`, { method: 'POST', body }),
    nextToken: (queueId) => request(`/queue/${encodeURIComponent(queueId)}/next`, { method: 'POST' }),
    queueStatus: (queueId, body) =>
      request(`/queue/${encodeURIComponent(queueId)}/status`, { method: 'POST', body }),
    walkIn: (queueId, name) =>
      request(`/queue/${encodeURIComponent(queueId)}/walkin`, { method: 'POST', body: { name } }),
    prescribe: (body) => request('/prescriptions', { method: 'POST', body }),
    history: (patientId, signal) =>
      request(`/patients/${encodeURIComponent(patientId)}/history`, { signal }),

    // repeats + follow-ups
    myRepeats: (signal) => request('/repeats', { signal }),
    askRepeat: (prescriptionId, note) =>
      request(`/prescriptions/${encodeURIComponent(prescriptionId)}/repeat`, {
        method: 'POST',
        body: { note },
      }),
    pendingRepeats: (signal) => request('/repeats/pending', { signal }),
    decideRepeat: (id, approve, note) =>
      request(`/repeats/${encodeURIComponent(id)}/decide`, { method: 'POST', body: { approve, note } }),
    followups: (signal) => request('/followups', { signal }),

    // doctor self-service
    myDoctor: (signal) => request('/admin/me/doctor', { signal }),
    saveMyDoctor: (body) => request('/admin/me/doctor', { method: 'PATCH', body }),
  },

  /** Patient reviews. The list is public; leaving one needs a patient session. */
  reviews: {
    list: (signal) => request('/reviews', { signal }),
    eligible: (signal) => request('/reviews/eligible', { signal }),
    submit: (body) => request('/reviews', { method: 'POST', body }),
  },

  /** Staff-only. Everything here is behind a staff session cookie. */
  desk: {
    me: (signal) => request('/admin/me', { signal }),
    // A doctor's own appointments for the day (read-only).
    myDay: (date, signal) =>
      request(`/admin/my-day${date ? `?date=${date}` : ''}`, { signal }),
    // Review moderation.
    reviews: (status = 'pending', signal) =>
      request(`/admin/reviews?status=${encodeURIComponent(status)}`, { signal }),
    moderateReview: (id, decision) =>
      request(`/admin/reviews/${encodeURIComponent(id)}/moderate`, {
        method: 'POST',
        body: { decision },
      }),
    signIn: (username, password, as) =>
      request('/admin/signin', { method: 'POST', body: { username, password, as } }),
    signOut: () => request('/admin/signout', { method: 'POST' }),
    changePassword: (currentPassword, newPassword) =>
      request('/admin/me/password', { method: 'POST', body: { currentPassword, newPassword } }),
    appointments: (params = {}, signal) => {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v),
      ).toString()
      return request(`/admin/appointments${qs ? `?${qs}` : ''}`, { signal })
    },
    notifications: (signal) => request('/admin/notifications', { signal }),
    drain: () => request('/admin/notifications/drain', { method: 'POST' }),
    contacts: (signal) => request('/admin/contacts', { signal }),
    doctors: (signal) => request('/admin/doctors', { signal }),
    saveDoctor: (id, body) =>
      request(`/admin/doctors/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
    freeSlots: (doctorId, date, signal) =>
      request(`/admin/availability/${encodeURIComponent(doctorId)}?date=${date}`, { signal }),
    bulkSchedule: (body) => request('/admin/doctors/bulk-schedule', { method: 'POST', body }),
    bookFor: (body) => request('/admin/appointments', { method: 'POST', body }),
    /* Bookings still to be entered into Klinique, and ticking one off. */
    kliniqueWorklist: (signal) => request('/admin/klinique', { signal }),
    kliniqueEntered: (id, kliniqueRef = null) =>
      request(`/admin/klinique/${encodeURIComponent(id)}/entered`, {
        method: 'POST',
        body: { kliniqueRef },
      }),
    /** action: 'approve' | 'complete' | 'cancel' */
    setStatus: (id, action) =>
      request(`/appointments/${encodeURIComponent(id)}`, { method: 'PATCH', body: { action } }),
    convert: (id, body) =>
      request(`/admin/appointments/${encodeURIComponent(id)}/convert`, { method: 'POST', body }),
    saveContact: (doctorId, body) =>
      request(`/admin/contacts/${encodeURIComponent(doctorId)}`, { method: 'PATCH', body }),
  },

  payments: {
    /*
     * `phone` is how a guest proves the booking is theirs — they have no
     * session, so the server matches the reference against the number the
     * appointment was made with. Signed-in patients are identified by their
     * cookie and the field is ignored.
     */
    counter: (appointmentId, phone) =>
      request('/payments/counter', { method: 'POST', body: { appointmentId, phone } }),
    createOrder: (appointmentId) => request('/payments/order', { method: 'POST', body: { appointmentId } }),
    verify: (payload) => request('/payments/verify', { method: 'POST', body: payload }),
  },
}

/** Maps an API error code to a translation key, with a sensible default. */
export function errorKeyFor(error) {
  const map = {
    NETWORK_ERROR: 'error.network',
    SLOT_TAKEN: 'error.slotTaken',
    SIGN_IN_REQUIRED: 'error.signInRequired',
    OTP_INCORRECT: 'error.otpIncorrect',
    OTP_EXPIRED: 'error.otpExpired',
    OTP_NOT_FOUND: 'error.otpExpired',
    OTP_ATTEMPTS_EXCEEDED: 'error.otpAttempts',
    OTP_PHONE_LIMIT: 'error.otpRateLimited',
    OTP_IP_LIMIT: 'error.otpRateLimited',
    RATE_LIMITED: 'error.otpRateLimited',
    // Register/sign-in throttle — without this it fell through to the generic
    // "something went wrong", which read like the account itself was broken.
    SIGNIN_LIMIT: 'error.tooManyAttempts',
    CAPTCHA_REQUIRED: 'captcha.errorRequired',
    CAPTCHA_INVALID: 'captcha.errorWrong',
    CAPTCHA_EXPIRED: 'captcha.errorExpired',
    CAPTCHA_USED: 'captcha.errorExpired',
    ACCOUNT_SIGNIN_LIMIT: 'error.tooManyAttempts',
    STAFF_SIGNIN_LIMIT: 'error.tooManyAttempts',
    BOOKING_LIMIT: 'error.tooManyAttempts',
    GUEST_BOOKING_LIMIT: 'error.tooManyAttempts',
    INVALID_PHONE: 'error.phoneInvalid',
    DOCTOR_NOT_BOOKABLE: 'error.doctorNotBookable',
    DOCTOR_NOT_AVAILABLE_THAT_DAY: 'error.doctorNotThatDay',
    SLOT_IN_PAST: 'error.slotPast',
    ALREADY_PAID: 'error.alreadyPaid',
    ONLINE_PAYMENT_UNAVAILABLE: 'error.onlinePaymentUnavailable',
    ALREADY_REQUESTED: 'error.alreadyRequested',
    NOT_YOUR_PRESCRIPTION: 'error.notYours',
    DOCTOR_USERNAME_PREFIX: 'error.doctorUsernamePrefix',
    RESERVED_USERNAME_PREFIX: 'error.reservedUsernamePrefix',
    INVALID_CREDENTIALS: 'error.invalidCredentials',
    CLAIM_PROOF_REQUIRED: 'error.claimProofRequired',
    PHONE_TAKEN: 'error.phoneTaken',
    WEAK_PASSWORD: 'error.weakPassword',
    /*
     * Only the single-file demo can raise this — it answers routes the real
     * server has and the mock does not. Mapped so it reads as "this part needs
     * the real server" rather than the catch-all "something went wrong", which
     * is alarming, uninformative, and in a demo simply untrue.
     */
    DEMO_ONLY: 'error.demoOnly',
  }
  return map[error?.code] ?? 'error.generic'
}
