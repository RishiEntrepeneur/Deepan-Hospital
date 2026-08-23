import { Router } from 'express'

export const authRouter = Router()

// Health check / placeholder route for authentication
authRouter.get('/me', (req, res) => {
  res.json({ authenticated: false, message: 'Auth service active' })
})

authRouter.post('/login', (req, res) => {
  res.status(501).json({ error: 'Login handler not implemented' })
})

authRouter.post('/logout', (req, res) => {
  res.json({ ok: true })
})
