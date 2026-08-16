/**
 * A stand-in for Klinique's Rails/Devise site, faithful to the parts session
 * mode depends on: a CSRF `authenticity_token` on every form, an HttpOnly
 * `_session_id` cookie, a 302-on-success login, and a booking form that
 * rejects a request with the wrong token or no session.
 *
 * It exists so the session driver can be tested end to end without ever
 * touching the real Klinique or a real credential. If this mock accepts the
 * driver's requests, the real site — which speaks the same protocol — will too,
 * modulo the field names, which are config.
 *
 * Not part of the app. Imported only by the test suite.
 */
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'

export function startKliniqueMock({ username = 'website', password = 'correct-horse' } = {}) {
  const sessions = new Map() // sid -> { token, signedIn }
  const bookings = []
  // Mutable so a test can rotate the password and prove sign-in is then refused.
  let expectedPassword = password

  const newToken = () => randomBytes(16).toString('hex')
  const parseCookies = (req) =>
    Object.fromEntries(
      (req.headers.cookie ?? '')
        .split('; ')
        .filter(Boolean)
        .map((c) => [c.split('=')[0], c.split('=').slice(1).join('=')]),
    )

  const body = (req) =>
    new Promise((resolve) => {
      let data = ''
      req.on('data', (c) => (data += c))
      req.on('end', () => resolve(new URLSearchParams(data)))
    })

  const server = createServer(async (req, res) => {
    const cookies = parseCookies(req)
    let sid = cookies._session_id
    if (!sid || !sessions.has(sid)) {
      sid = randomBytes(12).toString('hex')
      sessions.set(sid, { token: newToken(), signedIn: false })
      res.setHeader('Set-Cookie', `_session_id=${sid}; path=/; HttpOnly`)
    }
    const sess = sessions.get(sid)

    // -------- login form --------
    if (req.method === 'GET' && req.url === '/users/sign_in') {
      sess.token = newToken()
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`<form><input name="authenticity_token" value="${sess.token}" /></form>`)
      return
    }

    // -------- login submit --------
    if (req.method === 'POST' && req.url === '/users/sign_in') {
      const form = await body(req)
      const tokenOk = form.get('authenticity_token') === sess.token
      const credsOk =
        form.get('user[login]') === username && form.get('user[password]') === expectedPassword
      if (tokenOk && credsOk) {
        sess.signedIn = true
        sess.token = newToken()
        res.writeHead(302, { Location: '/dashboard' })
        res.end()
      } else {
        // Devise re-renders the sign-in form with 200 on failure.
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<form action="/users/sign_in">wrong</form>')
      }
      return
    }

    // -------- booking form --------
    if (req.method === 'GET' && req.url === '/appointments/new') {
      if (!sess.signedIn) {
        res.writeHead(302, { Location: '/users/sign_in' })
        res.end()
        return
      }
      sess.token = newToken()
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`<form><input name="authenticity_token" value="${sess.token}" /></form>`)
      return
    }

    // -------- booking submit --------
    if (req.method === 'POST' && req.url === '/appointments') {
      if (!sess.signedIn) {
        res.writeHead(401)
        res.end('not signed in')
        return
      }
      const form = await body(req)
      if (form.get('authenticity_token') !== sess.token) {
        res.writeHead(422)
        res.end('bad token')
        return
      }
      if (!form.get('appointment[patient_name]')) {
        // A validation failure comes back as 200 with the form re-rendered.
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<form>name required</form>')
        return
      }
      const id = bookings.length + 1
      bookings.push(Object.fromEntries(form))
      res.writeHead(302, { Location: `/appointments/${id}` })
      res.end()
      return
    }

    res.writeHead(404)
    res.end('not found')
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        bookings,
        setPassword: (p) => {
          expectedPassword = p
        },
        close: () => new Promise((r) => server.close(r)),
      })
    })
  })
}
