import { describe, expect, test } from 'bun:test'
import app from '../src/index.ts'
import { stubEnv } from './helpers/env.ts'

describe('GET /api/health', () => {
  test('returns 200 with { ok: true } when bindings present', async () => {
    const res = await app.request('/api/health', {}, stubEnv())
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  test('returns 503 when bindings are missing', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(503)
  })
})
