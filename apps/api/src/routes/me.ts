import { Hono } from 'hono'
import type { HonoEnv } from '../types.ts'

export const meRoute = new Hono<HonoEnv>().get('/api/me', async c => {
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'unauthenticated' }, 401)
  return c.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
  })
})
