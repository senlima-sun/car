import { eq } from 'drizzle-orm'
import { createAuthEndpoint } from 'better-auth/api'
import type { BetterAuthPlugin } from 'better-auth'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createApp } from '../src/app.ts'
import { dailyTrackGrant, user } from '../src/db/schema/index.ts'
import { PRESET_TRACK_IDS } from '../src/entitlements/dailyGrant.ts'
import type { Db } from '../src/db/client.ts'
import type { HonoEnv } from '../src/types.ts'
import { memoryHarness } from './helpers/memory-env.ts'

type App = ReturnType<typeof createApp>

interface PolarStub {
  productId: string
  status?: 'active' | 'canceled'
  currentPeriodEnd?: string
}

function polarStubPlugin(polar: PolarStub): BetterAuthPlugin {
  return {
    id: 'polar-stub',
    endpoints: {
      customerState: createAuthEndpoint(
        '/customer/state',
        { method: 'GET' },
        async ctx => {
          return ctx.json({
            activeSubscriptions: [
              {
                productId: polar.productId,
                status: polar.status ?? 'active',
                currentPeriodEnd:
                  polar.currentPeriodEnd ?? '2026-12-31T00:00:00.000Z',
              },
            ],
          })
        },
      ),
    },
  }
}

function makeApp(polar?: PolarStub): { app: App; env: HonoEnv['Bindings']; db: Db } {
  const extraAuth = polar ? { plugins: [polarStubPlugin(polar)] } : {}
  const { env, authOverrides, db } = memoryHarness(extraAuth)
  const app = createApp({ authOverrides, dbOverride: db })
  return { app, env, db }
}

async function signUpAndCookie(
  app: App,
  env: HonoEnv['Bindings'],
  db: Db,
  email = 'flow@example.com',
): Promise<{ cookie: string; userId: string }> {
  const res = await app.request(
    '/api/auth/sign-up/email',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'correct-horse-battery-staple', name: 'Flow' }),
    },
    env,
  )
  if (res.status !== 200) throw new Error(`sign-up failed (${res.status})`)
  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) throw new Error('no set-cookie')
  const cookie = setCookie.split(';')[0]

  const me = await app.request('/api/me', { headers: { cookie } }, env)
  const { user: meUser } = (await me.json()) as { user: { id: string; name: string; email: string } }

  // memoryAdapter (better-auth) and the in-memory Drizzle SQLite are separate stores.
  // Mirror the user row into Drizzle so FK-bearing inserts (dailyTrackGrant) succeed
  // and so resolveRole has a row to read.
  const now = new Date()
  await db
    .insert(user)
    .values({
      id: meUser.id,
      name: meUser.name,
      email: meUser.email,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .run()

  return { cookie, userId: meUser.id }
}

function postRace(
  app: App,
  env: HonoEnv['Bindings'],
  cookie: string,
  body: unknown,
): Promise<Response> {
  return app.request(
    '/api/race/start',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    },
    env,
  )
}

let logSpy: ReturnType<typeof vi.spyOn>
let logLines: unknown[]

beforeEach(() => {
  logLines = []
  logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logLines.push(...args)
  })
})

afterEach(() => {
  logSpy.mockRestore()
})

function auditEvents(): Array<{ event: string } & Record<string, unknown>> {
  return logLines
    .map(line => {
      if (typeof line !== 'string') return null
      try {
        return JSON.parse(line) as { event: string } & Record<string, unknown>
      } catch {
        return null
      }
    })
    .filter((entry): entry is { event: string } & Record<string, unknown> => entry !== null)
}

describe('race-flow: free user', () => {
  test('first call seeds-then-matches the granted track', async () => {
    const { app, env, db } = makeApp()
    const { cookie, userId } = await signUpAndCookie(app, env, db)

    const dateUTC = new Date().toISOString().slice(0, 10)
    await db
      .insert(dailyTrackGrant)
      .values({ userId, dateUTC, trackId: 'f1_monaco', createdAt: new Date() })
      .run()

    const res = await postRace(app, env, cookie, { trackId: 'f1_monaco' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, grantedTrackId: 'f1_monaco' })

    const granted = auditEvents().filter(e => e.event === 'entitlement.race.granted')
    expect(granted.length).toBeGreaterThan(0)
    expect(granted[0]).toMatchObject({ userId, trackId: 'f1_monaco', mode: 'daily-only' })
  })

  test('requesting a different track redirects to the granted track', async () => {
    const { app, env, db } = makeApp()
    const { cookie, userId } = await signUpAndCookie(app, env, db)

    const dateUTC = new Date().toISOString().slice(0, 10)
    await db
      .insert(dailyTrackGrant)
      .values({ userId, dateUTC, trackId: 'f1_monaco', createdAt: new Date() })
      .run()

    const res = await postRace(app, env, cookie, { trackId: 'f1_spa' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ redirect: 'f1_monaco' })

    const redirected = auditEvents().filter(e => e.event === 'entitlement.race.redirected')
    expect(redirected[0]).toMatchObject({
      userId,
      requestedTrackId: 'f1_spa',
      grantedTrackId: 'f1_monaco',
    })
  })

  test('with no existing grant, a grant is created and returned consistently', async () => {
    const { app, env, db } = makeApp()
    const { cookie } = await signUpAndCookie(app, env, db)

    const first = await postRace(app, env, cookie, { trackId: 'not-a-preset' })
    expect(first.status).toBe(200)
    const firstBody = (await first.json()) as { redirect?: string; ok?: true }
    const granted = firstBody.redirect
    expect(granted).toBeDefined()
    expect(PRESET_TRACK_IDS).toContain(granted)

    const second = await postRace(app, env, cookie, { trackId: granted! })
    expect(second.status).toBe(200)
    expect(await second.json()).toEqual({ ok: true, grantedTrackId: granted })
  })
})

describe('race-flow: admin user', () => {
  test('any track is granted unlimited', async () => {
    const { app, env, db } = makeApp()
    const { cookie, userId } = await signUpAndCookie(app, env, db)

    await db.update(user).set({ role: 'admin' }).where(eq(user.id, userId)).run()

    const res = await postRace(app, env, cookie, { trackId: 'any-track-at-all' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    const granted = auditEvents().filter(e => e.event === 'entitlement.race.granted')
    expect(granted[0]).toMatchObject({ userId, trackId: 'any-track-at-all', mode: 'unlimited' })
  })
})

describe('race-flow: pro user (stubbed Polar)', () => {
  test('any track is granted unlimited and /api/me reports tier=pro', async () => {
    const { app, env, db } = makeApp({ productId: 'test-product-pro-monthly' })
    const { cookie } = await signUpAndCookie(app, env, db)

    const meRes = await app.request('/api/me', { headers: { cookie } }, env)
    expect(meRes.status).toBe(200)
    const meBody = (await meRes.json()) as { subscription: { tier: string | null } }
    expect(meBody.subscription.tier).toBe('pro')

    const res = await postRace(app, env, cookie, { trackId: 'any-track-at-all' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})

describe('race-flow: rejections', () => {
  test('unauthenticated request is rejected with 401', async () => {
    const { app, env } = makeApp()
    const res = await app.request(
      '/api/race/start',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trackId: 'f1_monaco' }),
      },
      env,
    )
    expect(res.status).toBe(401)
  })

  test('body with extra keys is rejected with 400', async () => {
    const { app, env, db } = makeApp()
    const { cookie } = await signUpAndCookie(app, env, db)
    const res = await postRace(app, env, cookie, { trackId: 'f1_monaco', userId: 'someone-else' })
    expect(res.status).toBe(400)
  })
})
