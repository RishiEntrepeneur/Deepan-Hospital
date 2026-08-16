import { useEffect, useRef, useState } from 'react'
import { liveAppointmentsUrl } from './api'

/** Events the desk reacts to. Anything else on the stream is ignored. */
const WATCHED = [
  'appointment.created',
  'appointment.callback',
  'appointment.approved',
  'appointment.completed',
  'appointment.cancelled',
  'appointment.rescheduled',
]

/**
 * Subscribes the desk to the server's live appointment feed.
 *
 * `onEvent` is called with `{ event, payload }` for anything worth reacting
 * to. It is held in a ref so a caller can pass an inline arrow function
 * without tearing the connection down on every render — a mistake that turns
 * a live feed into a reconnect loop.
 *
 * Two deliberate choices:
 *
 *   1. The stream is treated as a *hint*, never as the source of truth. Every
 *      event makes the desk re-read the list over the normal API, so a missed
 *      or duplicated event cannot leave the screen showing something the
 *      database does not say.
 *   2. When the connection cannot be held — an old browser, a proxy that
 *      buffers, a network that kills idle sockets — it falls back to polling
 *      rather than going quiet. A desk that silently stops updating is worse
 *      than one that updates a minute late, because nobody can tell.
 */
export function useLiveDesk(enabled, onEvent) {
  const [connection, setConnection] = useState('connecting') // connecting | live | polling
  const handler = useRef(onEvent)
  handler.current = onEvent

  useEffect(() => {
    if (!enabled) return undefined
    if (typeof EventSource === 'undefined') {
      setConnection('polling')
      return undefined
    }

    let source
    let pollTimer
    let retryTimer
    let failures = 0
    let closed = false

    const startPolling = () => {
      if (pollTimer) return
      setConnection('polling')
      pollTimer = setInterval(() => handler.current?.({ event: 'poll' }), 45_000)
    }

    const connect = () => {
      if (closed) return
      source = new EventSource(liveAppointmentsUrl(), { withCredentials: true })

      source.addEventListener('ready', () => {
        failures = 0
        clearInterval(pollTimer)
        pollTimer = null
        setConnection('live')
      })

      for (const name of WATCHED) {
        source.addEventListener(name, (message) => {
          let payload = null
          try {
            payload = JSON.parse(message.data)
          } catch {
            /* a malformed frame still means "something changed" */
          }
          handler.current?.({ event: name, payload })
        })
      }

      source.onerror = () => {
        source.close()
        if (closed) return
        failures += 1
        // Back off to a minute, then stay there; a desk left open overnight
        // must not hammer the server once it is unreachable.
        const wait = Math.min(1000 * 2 ** failures, 60_000)
        if (failures >= 3) startPolling()
        retryTimer = setTimeout(connect, wait)
      }
    }

    connect()
    return () => {
      closed = true
      source?.close()
      clearTimeout(retryTimer)
      clearInterval(pollTimer)
    }
  }, [enabled])

  return connection
}
