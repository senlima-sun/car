import { cors } from 'hono/cors'
import { createMiddleware } from 'hono/factory'
import { parseOrigins } from '../auth/origins.ts'
import type { HonoEnv } from '../types.ts'

export const corsMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  const allowed = parseOrigins(c.env)
  const handler = cors({
    origin: (origin) => (allowed.includes(origin) ? origin : null),
    credentials: true,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['content-type'],
    maxAge: 600,
  })
  return handler(c, next)
})
