import { describe, expect, test } from 'bun:test'
import app from '../src/index.ts'
import { memoryEnv } from './helpers/memory-env.ts'

function signUp(env: ReturnType<typeof memoryEnv>) {
  return app.request(
    '/api/auth/sign-up/email',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'correct-horse-battery-staple',
        name: 'Alice',
      }),
    },
    env,
  )
}

function extractCookie(res: Response): string {
  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) throw new Error('no set-cookie header')
  return setCookie.split(';')[0]
}

describe('auth flow', () => {
  test('sign-up → /api/me round-trip', async () => {
    const env = memoryEnv()
    const signUpRes = await signUp(env)
    expect(signUpRes.status).toBe(200)
    const cookie = extractCookie(signUpRes)

    const meRes = await app.request('/api/me', { headers: { cookie } }, env)
    expect(meRes.status).toBe(200)
    const body = (await meRes.json()) as { user: { email: string; name: string } }
    expect(body.user.email).toBe('alice@example.com')
    expect(body.user.name).toBe('Alice')
  })

  test('/api/me without cookie returns 401', async () => {
    const env = memoryEnv()
    const res = await app.request('/api/me', {}, env)
    expect(res.status).toBe(401)
  })

  test('sign-out clears the session', async () => {
    const env = memoryEnv()
    const signUpRes = await signUp(env)
    const cookie = extractCookie(signUpRes)

    const signOutRes = await app.request(
      '/api/auth/sign-out',
      { method: 'POST', headers: { cookie } },
      env,
    )
    expect(signOutRes.status).toBe(200)

    const meRes = await app.request('/api/me', { headers: { cookie } }, env)
    expect(meRes.status).toBe(401)
  })

  test('duplicate sign-up returns 4xx', async () => {
    const env = memoryEnv()
    const first = await signUp(env)
    expect(first.status).toBe(200)
    const second = await signUp(env)
    expect(second.status).toBeGreaterThanOrEqual(400)
    expect(second.status).toBeLessThan(500)
  })
})
