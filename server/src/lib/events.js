/**
 * In-process event bus for the desk's live feed.
 *
 * Deliberately in-memory and deliberately lossy: a subscriber that connects
 * late sees nothing that happened before it arrived. That is safe here because
 * the stream is only ever a *hint* — every message tells the desk "something
 * changed, re-read", and the authoritative list still comes from the database
 * over the normal API. Nothing in the app is left inconsistent by a dropped
 * event, so this needs no broker, no queue and no persistence.
 *
 * One consequence worth knowing: with more than one Node process behind a load
 * balancer, a desk connected to process A would not see events published by
 * process B. The hospital runs a single process, and the desk's periodic
 * re-read covers the gap regardless.
 */
const subscribers = new Set()

/** Registers a listener. Returns the function that removes it again. */
export function subscribe(listener) {
  subscribers.add(listener)
  return () => subscribers.delete(listener)
}

/**
 * Fans an event out to every listener.
 *
 * Wrapped per listener: one broken socket must not stop the others from being
 * told, and must never take down the request that published the event.
 */
export function publish(event, payload) {
  for (const listener of subscribers) {
    try {
      listener({ event, payload })
    } catch (error) {
      console.error('[events] subscriber failed', error)
    }
  }
}

export const subscriberCount = () => subscribers.size
