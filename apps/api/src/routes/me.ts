import { Hono } from 'hono'
import { createAuth } from '../auth/index.ts'
import type { HonoEnv } from '../types.ts'

export const meRoute = new Hono<HonoEnv>().get('/api/me', async c => {
  const auth = createAuth(c.env, c.env.__authOverrides)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'unauthenticated' }, 401)
  return c.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
  })
})
