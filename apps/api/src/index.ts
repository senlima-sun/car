import { Hono } from 'hono'
import { bindingsGuard } from './middleware/bindings-guard.ts'
import type { HonoEnv } from './types.ts'

const app = new Hono<HonoEnv>()

app.use('*', bindingsGuard)

app.get('/api/health', (c) => c.json({ ok: true }))

export default app
