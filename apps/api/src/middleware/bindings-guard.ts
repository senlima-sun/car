import { createMiddleware } from 'hono/factory'
import type { HonoEnv } from '../types.ts'

export const bindingsGuard = createMiddleware<HonoEnv>(async (c, next) => {
  const env = c.env as Partial<HonoEnv['Bindings']> | undefined
  if (!env?.DB || !env.SESSIONS || !env.BETTER_AUTH_SECRET) {
    return c.json({ error: 'misconfigured' }, 503)
  }
  await next()
})
