import { describe, expect, test } from 'vitest'
import { createApp } from '../src/app.ts'
import { stubEnv } from './helpers/env.ts'
import { memoryHarness } from './helpers/memory-env.ts'

describe('GET /api/health', () => {
  test('returns 200 with { ok: true } when bindings present', async () => {
    const { env, authOverrides } = memoryHarness()
    const res = await createApp({ authOverrides }).request('/api/health', {}, env)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  test('returns 503 when bindings are missing', async () => {
    const app = createApp()
    const res = await app.request('/api/health')
    expect(res.status).toBe(503)
  })

  test('returns 503 when DB binding is missing', async () => {
    const { authOverrides } = memoryHarness()
    const env = stubEnv()
    delete (env as Partial<typeof env>).DB
    const res = await createApp({ authOverrides }).request('/api/health', {}, env)
    expect(res.status).toBe(503)
  })
})
