import { describe, expect, test } from 'bun:test'
import { createApp } from '../src/app.ts'
import { memoryHarness } from './helpers/memory-env.ts'

describe('rate limit', () => {
  test('11th sign-in attempt within the window returns 429', async () => {
    const { env, authOverrides } = memoryHarness({
      rateLimit: { enabled: true, window: 60, max: 10, storage: 'secondary-storage' },
    })
    const app = createApp({ authOverrides })

    const attempt = () =>
      app.request(
        '/api/auth/sign-in/email',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-forwarded-for': '203.0.113.42',
          },
          body: JSON.stringify({ email: 'nope@example.com', password: 'wrongwrongwr' }),
        },
        env,
      )

    let lastStatus = 0
    for (let i = 0; i < 11; i++) {
      const res = await attempt()
      lastStatus = res.status
    }
    expect(lastStatus).toBe(429)
  })
})
