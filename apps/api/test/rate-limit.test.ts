import { describe, expect, test } from 'bun:test'
import app from '../src/index.ts'
import { memoryEnv } from './helpers/memory-env.ts'

describe('rate limit', () => {
  test('11th sign-in attempt within the window returns 429', async () => {
    const env = memoryEnv()
    // Disable test-default rate-limit override so we hit the real limiter
    env.__authOverrides = {
      ...env.__authOverrides,
      rateLimit: { enabled: true, window: 60, max: 10, storage: 'secondary-storage' },
    }

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
