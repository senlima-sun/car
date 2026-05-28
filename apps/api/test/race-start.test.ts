import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { describe, expect, test } from 'vitest'
import { dailyTrackGrant, user } from '../src/db/schema/index.ts'
import { raceRoute } from '../src/routes/race.ts'
import type { Db } from '../src/db/client.ts'
import type { HonoEnv } from '../src/types.ts'
import { memoryHarness } from './helpers/memory-env.ts'

interface FakeSession {
  user: { id: string; email: string; name: string }
}

interface AuthFixture {
  session: FakeSession | null
  productId?: string
}

function fakeAuth(fixture: AuthFixture) {
  return {
    api: {
      getSession: async () => fixture.session,
    },
    handler: async (req: Request) => {
      if (req.url.includes('/customer/state') && fixture.productId) {
        return new Response(
          JSON.stringify({
            activeSubscriptions: [
              {
                productId: fixture.productId,
                status: 'active',
                currentPeriodEnd: '2026-12-31T00:00:00.000Z',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      return new Response('not found', { status: 404 })
    },
  }
}

function testApp(db: Db, _env: HonoEnv['Bindings'], fixture: AuthFixture) {
  const inject = createMiddleware<HonoEnv>(async (c, next) => {
    c.set('auth', fakeAuth(fixture) as never)
    c.set('db', db)
    await next()
  })
  return new Hono<HonoEnv>().use('*', inject).route('/', raceRoute)
}

async function seedUser(db: Db, id: string, role: 'user' | 'admin' = 'user'): Promise<void> {
  const now = new Date()
  await db
    .insert(user)
    .values({ id, name: id, email: `${id}@example.com`, role, createdAt: now, updatedAt: now })
    .run()
}

function post(app: Hono<HonoEnv>, env: HonoEnv['Bindings'], body: unknown) {
  return app.request(
    '/api/race/start',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    env,
  )
}

const SESSION: FakeSession = {
  user: { id: 'u1', email: 'u1@example.com', name: 'u1' },
}

describe('POST /api/race/start', () => {
  test('free user: first call seeds-then-matches the granted track', async () => {
    const { env, db } = memoryHarness()
    await seedUser(db, 'u1')
    await db
      .insert(dailyTrackGrant)
      .values({
        userId: 'u1',
        dateUTC: new Date().toISOString().slice(0, 10),
        trackId: 'f1_monaco',
        createdAt: new Date(),
      })
      .run()

    const app = testApp(db, env, { session: SESSION })
    const res = await post(app, env, { trackId: 'f1_monaco' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, grantedTrackId: 'f1_monaco' })
  })

  test('free user: requesting a different track redirects to the granted track', async () => {
    const { env, db } = memoryHarness()
    await seedUser(db, 'u1')
    await db
      .insert(dailyTrackGrant)
      .values({
        userId: 'u1',
        dateUTC: new Date().toISOString().slice(0, 10),
        trackId: 'f1_monaco',
        createdAt: new Date(),
      })
      .run()

    const app = testApp(db, env, { session: SESSION })
    const res = await post(app, env, { trackId: 'f1_spa' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ redirect: 'f1_monaco' })
  })

  test('free user: with no existing grant, the created grant is returned consistently', async () => {
    const { env, db } = memoryHarness()
    await seedUser(db, 'u1')

    const app = testApp(db, env, { session: SESSION })
    const first = await post(app, env, { trackId: 'definitely-not-the-grant' })
    expect(first.status).toBe(200)
    const firstBody = (await first.json()) as { redirect?: string; ok?: true }

    const granted = firstBody.redirect ?? 'definitely-not-the-grant'
    const second = await post(app, env, { trackId: granted })
    expect(second.status).toBe(200)
    expect(await second.json()).toEqual({ ok: true, grantedTrackId: granted })
  })

  test('pro user: any track is granted unlimited', async () => {
    const { env, db } = memoryHarness()
    await seedUser(db, 'u1')

    const app = testApp(db, env, { session: SESSION, productId: 'test-product-pro-monthly' })
    const res = await post(app, env, { trackId: 'any-track-at-all' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  test('admin user: any track is granted unlimited regardless of subscription', async () => {
    const { env, db } = memoryHarness()
    await seedUser(db, 'u1', 'admin')

    const app = testApp(db, env, { session: SESSION })
    const res = await post(app, env, { trackId: 'any-track-at-all' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  test('unauthenticated request is rejected with 401', async () => {
    const { env, db } = memoryHarness()
    const app = testApp(db, env, { session: null })
    const res = await post(app, env, { trackId: 'f1_monaco' })
    expect(res.status).toBe(401)
  })

  test('body with extra keys is rejected with 400 (IDOR closed)', async () => {
    const { env, db } = memoryHarness()
    await seedUser(db, 'u1')
    const app = testApp(db, env, { session: SESSION })
    const res = await post(app, env, { trackId: 'f1_monaco', userId: 'someone-else' })
    expect(res.status).toBe(400)
  })
})
