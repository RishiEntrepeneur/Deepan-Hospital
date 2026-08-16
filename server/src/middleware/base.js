import { buildCsp } from '../../../csp.js'
import { config, isProduction } from '../config.js'
import { ApiError, forbidden } from '../lib/validate.js'

/** Minimal cookie parsing — avoids a dependency for one header. */
export function cookies(req, _res, next) {
  const header = req.headers.cookie
  req.cookies = {}
  if (header) {
    for (const part of header.split(';')) {
      const index = part.indexOf('=')
      if (index < 1) continue
      const key = part.slice(0, index).trim()
      const value = part.slice(index + 1).trim()
      try {
        req.cookies[key] = decodeURIComponent(value)
      } catch {
        req.cookies[key] = value
      }
    }
  }
  next()
}

/** Trusts X-Forwarded-For only when running behind a proxy we configured. */
export function clientIp(req, _res, next) {
  const forwarded = req.headers['x-forwarded-for']
  req.clientIp = isProduction && forwarded
    ? String(forwarded).split(',')[0].trim()
    : req.socket.remoteAddress
  next()
}

/** Credentialed CORS restricted to the configured origins. */
export function cors(req, res, next) {
  const origin = req.headers.origin
  if (origin && config.corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  // Authorization is here for reception device tokens — see lib/devices.js.
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  next()
}

/*
 * The policy itself lives at the repo root so the API header and the built
 * index.html cannot drift apart. See csp.js.
 */
export const CSP = buildCsp({ apiOrigin: config.publicApiOrigin })

export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site')
  res.setHeader('Content-Security-Policy', CSP)
  // Nothing here needs a camera, a microphone or a location.
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  )

  /*
   * HSTS, production only. Setting it in development would pin localhost to
   * HTTPS in the developer's browser for two years, which is a miserable and
   * hard-to-undo thing to do to someone.
   */
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
  }
  next()
}

/**
 * Rejects state-changing requests that came from another site.
 *
 * SameSite=strict on the session cookie already stops the browser sending
 * credentials cross-site, so this is a second lock on the same door. It is
 * here because the first lock depends on every browser in the waiting room
 * implementing SameSite correctly, and some older Android WebViews do not.
 *
 * Read-only methods are left alone: they change nothing, and blocking them
 * would break ordinary links into the site.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function sameOriginOnly(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next()

  /*
   * A request carrying a device token is not a CSRF risk. The whole attack
   * depends on the browser attaching a credential by itself; a bearer token
   * has to be read out of extension storage and put on the request by hand,
   * which a hostile page cannot do.
   */
  if (req.device) return next()

  const origin = req.headers.origin
  // No Origin header at all: a same-origin form post, curl, or a health probe.
  // Not something an attacker can arrange from a victim's browser.
  if (!origin) return next()

  /*
   * Genuinely same-origin: the front end served from this very server (the
   * normal deployment — see index.js). The Origin's host then equals the Host
   * the request arrived on, whatever the domain, so this needs no config and
   * works on localhost, an IP, or a real hostname alike. Without it, hosting
   * the site and API on one origin blocked every sign-in and booking with a
   * 403 — because the deployed domain was never in CORS_ORIGINS.
   */
  try {
    if (new URL(origin).host === req.headers.host) return next()
  } catch {
    /* malformed Origin — fall through to the allow-list check */
  }

  if (config.corsOrigins.includes(origin)) return next()

  return next(forbidden('CROSS_ORIGIN_BLOCKED', 'This request did not come from the hospital site.'))
}

/** Wraps an async handler so rejections reach the error middleware. */
export const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next)

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND' } })
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
export function errorHandler(error, req, res, _next) {
  if (error instanceof ApiError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    })
    return
  }

  console.error('[unhandled]', error)
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      // Never leak internals to the client in production.
      message: isProduction ? 'Something went wrong.' : String(error?.message ?? error),
    },
  })
}
