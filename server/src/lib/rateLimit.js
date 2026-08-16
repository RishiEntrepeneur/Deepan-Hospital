import { tooMany } from './validate.js'

/**
 * In-process fixed-window rate limiter.
 *
 * Adequate for a single server. Behind more than one instance, move the
 * counters to Redis — the interface here is deliberately small so the swap
 * is a one-file change.
 */
const buckets = new Map()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of buckets) if (entry.resetAt <= now) buckets.delete(key)
}, 60_000).unref()

export function hit(key, limit, windowMs) {
  const now = Date.now()
  const entry = buckets.get(key)

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfterMs: windowMs }
  }

  entry.count += 1
  const allowed = entry.count <= limit
  return {
    allowed,
    remaining: Math.max(0, limit - entry.count),
    retryAfterMs: entry.resetAt - now,
  }
}

/** Express middleware factory. `keyOf` defaults to the client IP. */
export function rateLimit({ limit, windowMs, keyOf, code = 'RATE_LIMITED' }) {
  return (req, res, next) => {
    const key = `${code}:${keyOf ? keyOf(req) : req.clientIp}`
    const result = hit(key, limit, windowMs)
    res.setHeader('X-RateLimit-Remaining', String(result.remaining))
    if (!result.allowed) {
      res.setHeader('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)))
      next(tooMany(code, 'Too many requests. Please wait and try again.'))
      return
    }
    next()
  }
}
