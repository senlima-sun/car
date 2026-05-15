import { describe, expect, test } from 'bun:test'
import app from '../src/index.ts'
import { memoryEnv } from './helpers/memory-env.ts'

async function signUpAndGetCookie(env: ReturnType<typeof memoryEnv>) {
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
    const env = memoryEnv()
    const cookie = await signUpAndGetCookie(env)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).not.toContain('Secure')
  })

  test('https BETTER_AUTH_URL sets Secure', async () => {
    const env = memoryEnv()
    env.BETTER_AUTH_URL = 'https://api.example.test'
    const cookie = await signUpAndGetCookie(env)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Secure')
  })
})
