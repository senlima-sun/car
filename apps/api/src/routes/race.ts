import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { getOrCreateDailyGrant } from '../entitlements/dailyGrant.ts'
import { getEntitlements } from '../entitlements/features.ts'
import type { Db } from '../db/client.ts'
import { user } from '../db/schema/index.ts'
import type { HonoEnv } from '../types.ts'
import { resolveSubscription } from './me.ts'

type UserRole = 'user' | 'admin'

interface RaceStartBody {
  trackId: string
}

function auditLog(event: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ event, timestamp: new Date().toISOString(), ...fields }))
}

function isRaceStartBody(value: unknown): value is RaceStartBody {
  if (!value || typeof value !== 'object') return false
  const keys = Object.keys(value)
  if (keys.length !== 1 || keys[0] !== 'trackId') return false
  return typeof (value as { trackId: unknown }).trackId === 'string'
}

async function resolveRole(db: Db, userId: string): Promise<UserRole> {
  const row = await db.select({ role: user.role }).from(user).where(eq(user.id, userId)).get()
  if (!row || (row.role !== 'user' && row.role !== 'admin')) {
    auditLog('entitlement.role.fallback', { userId })
    return 'user'
  }
  return row.role
}

export const raceRoute = new Hono<HonoEnv>().post('/api/race/start', async c => {
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'unauthenticated' }, 401)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'bad_request' }, 400)
  }
  if (!isRaceStartBody(body)) return c.json({ error: 'bad_request' }, 400)

  const userId = session.user.id
  const db = c.var.db

  const [role, subscription] = await Promise.all([
    resolveRole(db, userId),
    resolveSubscription(c).catch(() => ({ tier: null } as const)),
  ])

  const features = getEntitlements({ role, tier: subscription.tier })

  switch (features.raceMode) {
    case 'denied':
      auditLog('entitlement.race.denied', {
        userId,
        requestedTrackId: body.trackId,
        reason: 'denied',
      })
      return c.json({ error: 'pro_required' }, 403)
    case 'unlimited':
      auditLog('entitlement.race.granted', { userId, trackId: body.trackId, mode: 'unlimited' })
      return c.json({ ok: true })
    case 'daily-only': {
      const grant = await getOrCreateDailyGrant(db, userId, new Date())
      if (body.trackId === grant.trackId) {
        auditLog('entitlement.race.granted', {
          userId,
          trackId: body.trackId,
          mode: 'daily-only',
        })
        return c.json({ ok: true, grantedTrackId: grant.trackId })
      }
      auditLog('entitlement.race.redirected', {
        userId,
        requestedTrackId: body.trackId,
        grantedTrackId: grant.trackId,
      })
      return c.json({ redirect: grant.trackId })
    }
  }
})
