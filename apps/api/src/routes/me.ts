import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { CustomerStateSubscription } from '@polar-sh/sdk/models/components/customerstatesubscription.js'
import { type LogicalTier, tierFromProductId } from '../billing/products.ts'
import type { Db } from '../db/client.ts'
import { user } from '../db/schema/index.ts'
import type { HonoEnv } from '../types.ts'

type UserRole = 'user' | 'admin'

function auditLog(event: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ event, timestamp: new Date().toISOString(), ...fields }))
}

interface SubscriptionShape {
  tier: LogicalTier | null
  status: 'active' | 'canceled' | null
  currentPeriodEnd: string | null
}

const EMPTY_SUBSCRIPTION: SubscriptionShape = {
  tier: null,
  status: null,
  currentPeriodEnd: null,
}

function logFailure(error: unknown) {
  console.error(
    JSON.stringify({
      event: 'subscription_resolve_failed',
      error: error instanceof Error ? error.name : 'unknown',
    }),
  )
}

function mapStatus(raw: string): SubscriptionShape['status'] {
  if (raw === 'active') return 'active'
  if (raw === 'canceled') return 'canceled'
  return null
}

export async function resolveSubscription(c: {
  env: HonoEnv['Bindings']
  var: { auth: { handler: (req: Request) => Promise<Response> } }
  req: { raw: Request }
}): Promise<SubscriptionShape> {
  const stateUrl = `${c.env.BETTER_AUTH_URL}/api/auth/customer/state`
  const res = await c.var.auth.handler(
    new Request(stateUrl, { method: 'GET', headers: c.req.raw.headers }),
  )
  if (!res.ok) return EMPTY_SUBSCRIPTION

  const state = (await res.json().catch(() => null)) as null | {
    activeSubscriptions?: CustomerStateSubscription[]
  }
  const active = state?.activeSubscriptions?.[0]
  if (!active) return EMPTY_SUBSCRIPTION

  const tier = tierFromProductId(c.env, active.productId)
  if (!tier) return EMPTY_SUBSCRIPTION

  const currentPeriodEnd =
    active.currentPeriodEnd instanceof Date
      ? active.currentPeriodEnd.toISOString()
      : (active.currentPeriodEnd ?? null)

  return {
    tier,
    status: mapStatus(active.status),
    currentPeriodEnd,
  }
}

async function resolveRole(c: { var: { db: Db } }, userId: string): Promise<UserRole> {
  const row = await c.var.db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .get()
  if (!row || (row.role !== 'user' && row.role !== 'admin')) {
    auditLog('entitlement.role.fallback', { userId })
    return 'user'
  }
  return row.role
}

export const meRoute = new Hono<HonoEnv>().get('/api/me', async c => {
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'unauthenticated' }, 401)

  const [subscription, role] = await Promise.all([
    resolveSubscription(c).catch(err => {
      logFailure(err)
      return EMPTY_SUBSCRIPTION
    }),
    resolveRole(c, session.user.id),
  ])

  return c.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
    subscription,
    role,
  })
})
