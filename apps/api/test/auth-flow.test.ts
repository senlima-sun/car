import { eq } from 'drizzle-orm'
import { describe, expect, test } from 'vitest'
import { createApp } from '../src/app.ts'
import { user } from '../src/db/schema/index.ts'
import { memoryHarness } from './helpers/memory-env.ts'

function makeApp() {
  const { env, authOverrides, db } = memoryHarness()
  return { app: createApp({ authOverrides, dbOverride: db }), env, db }
}

function signUp(app: ReturnType<typeof createApp>, env: ReturnType<typeof memoryHarness>['env']) {
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
    const { app, env } = makeApp()
    const signUpRes = await signUp(app, env)
    expect(signUpRes.status).toBe(200)
    const cookie = extractCookie(signUpRes)

    const meRes = await app.request('/api/me', { headers: { cookie } }, env)
    expect(meRes.status).toBe(200)
    const body = (await meRes.json()) as {
      user: { id: string; email: string; name: string }
      subscription: { tier: string | null; status: string | null; currentPeriodEnd: string | null }
      role: string
    }
    expect(body.user.email).toBe('alice@example.com')
    expect(body.user.name).toBe('Alice')
    expect(body.subscription).toEqual({ tier: null, status: null, currentPeriodEnd: null })
    expect(body.role).toBe('user')
  })

  test('/api/me returns role admin when the user row is admin', async () => {
    const { app, env, db } = makeApp()
    const signUpRes = await signUp(app, env)
    const cookie = extractCookie(signUpRes)

    const firstMe = await app.request('/api/me', { headers: { cookie } }, env)
    const { user: signedUpUser } = (await firstMe.json()) as { user: { id: string } }

    const now = new Date()
    await db
      .insert(user)
      .values({
        id: signedUpUser.id,
        name: 'Alice',
        email: 'alice@example.com',
        role: 'admin',
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({ target: user.id, set: { role: 'admin' } })
      .run()

    const meRes = await app.request('/api/me', { headers: { cookie } }, env)
    const body = (await meRes.json()) as { role: string }
    expect(body.role).toBe('admin')

    const stored = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, signedUpUser.id))
      .get()
    expect(stored?.role).toBe('admin')
  })

  test('/api/me without cookie returns 401', async () => {
    const { app, env } = makeApp()
    const res = await app.request('/api/me', {}, env)
    expect(res.status).toBe(401)
  })

  test('sign-out clears the session', async () => {
    const { app, env } = makeApp()
    const signUpRes = await signUp(app, env)
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
    const { app, env } = makeApp()
    const first = await signUp(app, env)
    expect(first.status).toBe(200)
    const second = await signUp(app, env)
    expect(second.status).toBeGreaterThanOrEqual(400)
    expect(second.status).toBeLessThan(500)
  })
})
