import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

/**
 * Phone + OTP authentication against the API.
 *
 * There is no client-side credential store any more: the session lives in an
 * httpOnly cookie the browser cannot read, and the patient record is fetched
 * from the server on load.
 */
export function useAuth() {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready
  const [profileComplete, setProfileComplete] = useState(false)
  /*
   * Tracked separately from the profile: consent is per version of the privacy
   * notice, so a patient who agreed to an older one is asked again rather than
   * being treated as having agreed to wording they never saw.
   */
  const [consent, setConsent] = useState({ needed: false, version: null })

  const refresh = useCallback(async (signal) => {
    try {
      const data = await api.auth.me(signal)
      setUser(data.patient)
      setProfileComplete(Boolean(data.profileComplete))
      setConsent({ needed: Boolean(data.consentNeeded), version: data.privacyVersion ?? null })
    } catch (error) {
      /*
       * An aborted request says nothing about the session, so it must not
       * clear it.
       *
       * The effect below aborts on cleanup, and React runs mount effects twice
       * in development. The first fetch is cancelled; its rejection can land
       * *after* the second has already succeeded, and clearing here then
       * signed a perfectly valid patient out of the interface — the header
       * offered "Sign in" to somebody who was signed in, and their sign-out
       * button vanished with it. The same race is reachable in production
       * whenever a request is cancelled by a quick navigation.
       */
      if (error?.name === 'AbortError') return
      setUser(null)
    } finally {
      setStatus('ready')
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    refresh(controller.signal)
    return () => controller.abort()
  }, [refresh])

  /** Sends a one-time code. Returns `{ isNewPatient, devCode? }`. */
  const requestOtp = useCallback((phone) => api.auth.requestOtp(phone), [])

  const verifyOtp = useCallback(async (phone, code) => {
    const data = await api.auth.verifyOtp(phone, code)
    setUser(data.patient)
    setProfileComplete(Boolean(data.profileComplete))
    setConsent({ needed: Boolean(data.consentNeeded), version: data.privacyVersion ?? null })
    return data
  }, [])

  const saveProfile = useCallback(async (profile) => {
    const data = await api.auth.saveProfile(profile)
    setUser(data.patient)
    setProfileComplete(Boolean(data.patient?.fullName))
    return data.patient
  }, [])

  const applySession = useCallback((data) => {
    setUser(data.patient)
    setProfileComplete(Boolean(data.profileComplete))
    setConsent({ needed: Boolean(data.consentNeeded), version: data.privacyVersion ?? null })
    return data.patient
  }, [])

  const login = useCallback(
    async (phone, password) => applySession(await api.auth.login(phone, password)),
    [applySession],
  )

  const register = useCallback(
    async (phone, password, fullName, bookingReference) =>
      applySession(await api.auth.register(phone, password, fullName, bookingReference)),
    [applySession],
  )

  const signOut = useCallback(async () => {
    await api.auth.signOut()
    setUser(null)
    setProfileComplete(false)
    setConsent({ needed: false, version: null })
  }, [])

  const giveConsent = useCallback(async () => {
    await api.auth.consent(consent.version)
    setConsent((c) => ({ ...c, needed: false }))
  }, [consent.version])

  return {
    user,
    patient: user,
    status,
    isSignedIn: Boolean(user),
    profileComplete,
    consentNeeded: consent.needed && Boolean(user),
    giveConsent,
    requestOtp,
    verifyOtp,
    saveProfile,
    login,
    register,
    signOut,
    refresh,
  }
}
