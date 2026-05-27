import { describe, expect, test } from 'vitest'
import { createApp } from '../src/app.ts'
import { memoryHarness } from './helpers/memory-env.ts'

async function makeAuthedApp() {
  const { env, authOverrides } = memoryHarness()
  const app = createApp({ authOverrides })
  const signUpRes = await app.request(
    '/api/auth/sign-up/email',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'billing@example.com',
        password: 'correct-horse-battery',
        name: 'Billing',
      }),
    },
    env,
  )
  const cookie = signUpRes.headers.get('set-cookie')?.split(';')[0] ?? ''
  return { app, env, cookie }
}

describe('billing alias routes', () => {
  test('POST /api/billing/checkout without session returns 401', async () => {
    const { env, authOverrides } = memoryHarness()
    const res = await createApp({ authOverrides }).request(
      '/api/billing/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: 'pro-monthly' }),
      },
      env,
    )
    expect(res.status).toBe(401)
  })

  test('POST /api/billing/checkout rejects unknown slug (400)', async () => {
    const { app, env, cookie } = await makeAuthedApp()
    const res = await app.request(
      '/api/billing/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ slug: 'enterprise' }),
      },
      env,
    )
    expect(res.status).toBe(400)
  })

  test('POST /api/billing/checkout rejects the legacy tier body (400)', async () => {
    const { app, env, cookie } = await makeAuthedApp()
    const res = await app.request(
      '/api/billing/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ tier: 'pro' }),
      },
      env,
    )
    expect(res.status).toBe(400)
  })

  test('POST /api/billing/checkout accepts each registered slug (passes validation)', async () => {
    const { app, env, cookie } = await makeAuthedApp()
    for (const slug of ['pro-monthly', 'pro-annual'] as const) {
      const res = await app.request(
        '/api/billing/checkout',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify({ slug }),
        },
        env,
      )
      expect(res.status).not.toBe(400)
      expect(res.status).not.toBe(401)
    }
  })

  test('POST /api/billing/checkout rejects extra body keys (400)', async () => {
    const { app, env, cookie } = await makeAuthedApp()
    const res = await app.request(
      '/api/billing/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ slug: 'pro-monthly', successUrl: 'http://evil.example/' }),
      },
      env,
    )
    expect(res.status).toBe(400)
  })

  test('POST /api/billing/portal without session returns 401', async () => {
    const { env, authOverrides } = memoryHarness()
    const res = await createApp({ authOverrides }).request(
      '/api/billing/portal',
      { method: 'POST' },
      env,
    )
    expect(res.status).toBe(401)
  })
})
