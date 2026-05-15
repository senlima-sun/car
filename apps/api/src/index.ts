import { Hono } from 'hono'
import { createAuth } from './auth/index.ts'
import { bindingsGuard } from './middleware/bindings-guard.ts'
import { corsMiddleware } from './middleware/cors.ts'
import { errorSanitizer } from './middleware/error-sanitizer.ts'
import { meRoute } from './routes/me.ts'
import type { HonoEnv } from './types.ts'

const app = new Hono<HonoEnv>()

app.onError(errorSanitizer)
app.use('*', bindingsGuard)
app.use('*', corsMiddleware)

app.get('/api/health', (c) => c.json({ ok: true }))

app.on(['GET', 'POST'], '/api/auth/*', (c) =>
  createAuth(c.env, c.env.__authOverrides).handler(c.req.raw),
)

app.route('/', meRoute)

export default app
