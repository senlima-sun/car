import { describe, expect, test } from 'bun:test'
import { createApp } from '../src/app.ts'
import { memoryHarness } from './helpers/memory-env.ts'

async function signUpAndGetCookie(envOverride: Partial<ReturnType<typeof memoryHarness>['env']>) {
  const { env, authOverrides } = memoryHarness()
  Object.assign(env, envOverride)
  const app = createApp({ authOverrides })
  const res = await app.request(
    '/api/auth/sign-up/email',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'flagcheck@example.com',
        password: 'correct-horse-battery-staple',
        name: 'Flag Check',
      }),
    },
    env,
  )
  expect(res.status).toBe(200)
  return res.headers.get('set-cookie') ?? ''
}

describe('cookie security flags', () => {
  test('http localhost omits Secure', async () => {
    const cookie = await signUpAndGetCookie({})
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).not.toContain('Secure')
  })

  test('https BETTER_AUTH_URL sets Secure', async () => {
    const cookie = await signUpAndGetCookie({ BETTER_AUTH_URL: 'https://api.example.test' })
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Secure')
  })
})
