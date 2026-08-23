import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'
import { migrate } from './db.js'
import {
  clientIp,
  cookies,
  cors,
  errorHandler,
  notFoundHandler,
  sameOriginOnly,
  securityHeaders,
} from './middleware/base.js'
import { authRouter } from './routes/auth.js'
import { catalogRouter } from './routes/catalog.js'
import { doctorRouter } from './routes/doctors.js'
import { appointmentsRouter, settlePastAppointments } from './routes/appointments.js'
import { paymentsRouter, webhookHandler } from './routes/payments.js'
import { adminRouter } from './routes/admin.js'
import { clinicalRouter } from './routes/clinical.js'
import { speechRouter } from './routes/speech.js'
import { loadDevice } from './lib/devices.js'
import { startNotificationWorker } from './lib/notify.js'
import { startBackups } from './lib/backup.js'
import { startRetention } from './lib/retention.js'
import { preflight } from './lib/preflight.js'

migrate()
settlePastAppointments()
preflight()

const app = express()
app.disable('x-powered-by')

app.use(clientIp)
app.use(securityHeaders)
app.use(cors)
app.use(cookies)
// Before sameOriginOnly, which lets a token-bearing request through.
app.use(loadDevice)
app.use(sameOriginOnly)

// The webhook signature covers the exact bytes Razorpay sent, so this route
// must see the raw body — it is mounted before the JSON parser.
app.post('/api/payments/webhook', express.raw({ type: '*/*', limit: '256kb' }), webhookHandler)

app.use(express.json({ limit: '128kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: config.env, payments: config.payments.provider })
})

app.use('/api/auth', authRouter)
app.use('/api', catalogRouter)
// After catalogRouter, which owns /doctors/:id/availability.
app.use('/api/doctors', doctorRouter)
app.use('/api/appointments', appointmentsRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/admin', adminRouter)
app.use('/api', clinicalRouter)
app.use('/api', speechRouter)

/*
 * Serve the built front-end from this same server, when it has been built.
 *
 * The front end calls the API at a relative '/api' (see src/lib/api.js), so
 * hosting both on one origin means one thing to deploy, one URL, and no CORS to
 * configure. In development this never runs — Vite serves the front end on its
 * own port and proxies '/api' here — because dist/ does not exist until
 * `npm run build`. Anything that is not an /api call falls through to
 * index.html so the in-browser router can handle the path.
 */
const clientDir = process.env.CLIENT_DIR
  ? path.resolve(process.env.CLIENT_DIR)
  : path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist')

// An unmatched /api route is always a JSON 404, whether or not a front end is
// present — never the front end's index.html.
app.use('/api', notFoundHandler)

if (fs.existsSync(path.join(clientDir, 'index.html'))) {
  // redirect:false so a client route like /doctors is not 301'd to /doctors/;
  // it falls straight through to the index.html handler below.
  app.use(express.static(clientDir, { index: false, maxAge: '1h', redirect: false }))
  app.get(/^\/(?!api\/).*/, (_req, res, next) => {
    res.sendFile(path.join(clientDir, 'index.html'), (error) => error && next())
  })
} else {
  // No build present: API only (development, or an API-only deploy).
  app.use(notFoundHandler)
}

app.use(errorHandler)

const server = app.listen(config.port, () => {
  console.info(`\n  ${config.hospital.name} API`)
  console.info(`  → http://localhost:${config.port}`)
  console.info(`  env       : ${config.env}`)
  console.info(`  database  : ${config.databaseFile}`)
  console.info(`  payments  : ${config.payments.provider}`)
  console.info('  alerts    : reception desk feed (no SMS gateway)\n')
})

startNotificationWorker()
startRetention()
startBackups()

/** Mark yesterday's appointments completed once an hour. */
setInterval(settlePastAppointments, 60 * 60 * 1000).unref()

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
