import { Hono } from 'hono'
import { createAuth } from './auth/index.ts'
import { bindingsGuard } from './middleware/bindings-guard.ts'
import { errorSanitizer } from './middleware/error-sanitizer.ts'
import type { HonoEnv } from './types.ts'

const app = new Hono<HonoEnv>()

app.onError(errorSanitizer)
app.use('*', bindingsGuard)

app.get('/api/health', (c) => c.json({ ok: true }))

app.on(['GET', 'POST'], '/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw))

export default app
