import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { daysFromToday } from './schedule'

/**
 * Appointments live on the server. This hook is a thin cache over the API —
 * every mutation returns the authoritative record, which replaces the local
 * copy, so the UI can never drift from the database.
 */
export function useAppointments(isSignedIn) {
  const [appointments, setAppointments] = useState([])
  const [status, setStatus] = useState('idle') // idle | loading | ready | error

  const load = useCallback(
    async (signal) => {
      if (!isSignedIn) {
        setAppointments([])
        setStatus('idle')
        return
      }
      setStatus('loading')
      try {
        const data = await api.appointments.list(signal)
        setAppointments(data.appointments)
        setStatus('ready')
      } catch (error) {
        if (error.name === 'AbortError') return
        setStatus('error')
      }
    },
    [isSignedIn],
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  const upsert = useCallback((appointment) => {
    setAppointments((list) => {
      const index = list.findIndex((a) => a.id === appointment.id)
      if (index === -1) return [appointment, ...list]
      const next = [...list]
      next[index] = appointment
      return next
    })
    return appointment
  }, [])

  /*
   * `asGuest` routes to the no-account endpoint. A guest booking is not added
   * to the signed-in list — there is no session to hold it — so the caller
   * gets it back to show on the confirmation screen and nothing is cached.
   */
  const book = useCallback(
    async (payload, { asGuest = false } = {}) => {
      if (asGuest) return (await api.appointments.bookAsGuest(payload)).appointment
      return upsert((await api.appointments.book(payload)).appointment)
    },
    [upsert],
  )

  const requestCallback = useCallback(
    async (payload) => upsert((await api.appointments.requestCallback(payload)).appointment),
    [upsert],
  )

  const cancel = useCallback(
    async (id) => upsert((await api.appointments.cancel(id)).appointment),
    [upsert],
  )

  const reschedule = useCallback(
    async (id, payload) => upsert((await api.appointments.reschedule(id, payload)).appointment),
    [upsert],
  )

  const payAtCounter = useCallback(
    async (id, phone) => upsert((await api.payments.counter(id, phone)).appointment),
    [upsert],
  )

  const { upcoming, past } = useMemo(() => {
    const up = []
    const done = []
    for (const a of appointments) {
      const active = ['pending', 'confirmed', 'requested'].includes(a.status)
      const future = a.date ? daysFromToday(a.date) >= 0 : true
      if (active && future) up.push(a)
      else done.push(a)
    }
    const key = (a) => `${a.date ?? '9999-99-99'} ${a.slot ?? ''}`
    up.sort((a, b) => key(a).localeCompare(key(b)))
    done.sort((a, b) => key(b).localeCompare(key(a)))
    return { upcoming: up, past: done }
  }, [appointments])

  return {
    appointments,
    upcoming,
    past,
    status,
    reload: load,
    book,
    requestCallback,
    cancel,
    reschedule,
    payAtCounter,
    upsert,
  }
}

/** Display status: 'pending' | 'confirmed' | 'requested' | 'completed' | 'cancelled'. */
export function displayStatus(appointment) {
  if (appointment.status === 'cancelled') return 'cancelled'
  // Held but not yet approved by the desk — never shown as confirmed.
  if (appointment.status === 'pending') return 'pending'
  if (appointment.status === 'requested') return 'requested'
  if (appointment.status === 'completed') return 'completed'
  return appointment.date && daysFromToday(appointment.date) < 0 ? 'completed' : 'confirmed'
}
