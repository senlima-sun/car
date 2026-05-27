import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import type { BetterAuthOptions } from 'better-auth'
import { createAuth, createAuthWithOverrides } from './auth/index.ts'
import { type Db, getDb } from './db/client.ts'
import { bindingsGuard } from './middleware/bindings-guard.ts'
import { corsMiddleware } from './middleware/cors.ts'
import { errorSanitizer } from './middleware/error-sanitizer.ts'
import { billingRoute } from './routes/billing.ts'
import { meRoute } from './routes/me.ts'
import { raceRoute } from './routes/race.ts'
import type { HonoEnv } from './types.ts'

declare module 'hono' {
  interface ContextVariableMap {
    auth: ReturnType<typeof createAuth>
    db: Db
  }
}

export interface CreateAppOptions {
  authOverrides?: Partial<BetterAuthOptions>
  dbOverride?: Db
}

export function createApp({ authOverrides, dbOverride }: CreateAppOptions = {}) {
  const authContext = createMiddleware<HonoEnv>(async (c, next) => {
    const auth = authOverrides ? createAuthWithOverrides(c.env, authOverrides) : createAuth(c.env)
    c.set('auth', auth)
    c.set('db', dbOverride ?? getDb(c.env))
    await next()
  })

  const app = new Hono<HonoEnv>()

  app.onError(errorSanitizer)
  app.use('*', bindingsGuard)
  app.use('*', corsMiddleware)
  app.use('*', authContext)

  app.get('/api/health', c => c.json({ ok: true }))
  app.on(['GET', 'POST'], '/api/auth/*', c => c.var.auth.handler(c.req.raw))
  app.route('/', meRoute)
  app.route('/', billingRoute)
  app.route('/', raceRoute)

  return app
}
