import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { setCatalog } from '../data/hospital'
import { CatalogContext } from './catalogContext.js'

/**
 * Loads departments and doctors from the API once, and mirrors them into the
 * `hospital` module so synchronous helpers keep working.
 */
export function CatalogProvider({ children }) {
  const [state, setState] = useState({
    status: 'loading',
    departments: [],
    doctors: [],
    booking: { windowDays: 30, slotMinutes: 20, visitCharges: { first: 0, review: 0 } },
    klinique: { portalUrl: '' },
    privacy: { version: null, contact: null },
    payments: { provider: 'none', convenienceFee: 0, razorpayKeyId: null },
    error: null,
  })

  const load = useCallback(async (signal) => {
    try {
      const data = await api.catalog(signal)
      setCatalog({ departments: data.departments, doctors: data.doctors })
      setState({
        status: 'ready',
        departments: data.departments,
        doctors: data.doctors,
        booking: data.booking,
        klinique: data.klinique,
        privacy: data.privacy,
        payments: data.payments,
        error: null,
      })
    } catch (error) {
      if (error.name === 'AbortError') return
      setState((prev) => ({ ...prev, status: 'error', error }))
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  const value = useMemo(() => ({ ...state, reload: () => load() }), [state, load])

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}
