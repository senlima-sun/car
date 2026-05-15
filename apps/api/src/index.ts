import { Hono } from 'hono'
import type { HonoEnv } from './types.ts'

const app = new Hono<HonoEnv>()

app.get('/api/health', c => c.json({ ok: true }))

export default app
