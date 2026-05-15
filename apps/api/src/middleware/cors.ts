import { cors } from 'hono/cors'
import { createMiddleware } from 'hono/factory'
import { parseOrigins } from '../auth/origins.ts'
import type { HonoEnv } from '../types.ts'

const cache = new WeakMap<HonoEnv['Bindings'], ReturnType<typeof cors>>()

function buildHandler(env: HonoEnv['Bindings']): ReturnType<typeof cors> {
  const allowed = parseOrigins(env)
  return cors({
    origin: origin => (allowed.includes(origin) ? origin : null),
    credentials: true,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['content-type'],
    maxAge: 600,
  })
}

export const corsMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  let handler = cache.get(c.env)
  if (!handler) {
    handler = buildHandler(c.env)
    cache.set(c.env, handler)
  }
  return handler(c, next)
})
