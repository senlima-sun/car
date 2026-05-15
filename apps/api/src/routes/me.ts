import { Hono } from 'hono'
import { TIERS, type TierSlug, getProducts } from '../billing/products.ts'
import type { HonoEnv } from '../types.ts'

interface SubscriptionShape {
  tier: TierSlug | null
  status: 'active' | 'canceled' | null
  currentPeriodEnd: string | null
}

const EMPTY_SUBSCRIPTION: SubscriptionShape = {
  tier: null,
  status: null,
  currentPeriodEnd: null,
}

async function resolveSubscription(c: {
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
    activeSubscriptions?: Array<{
      productId: string
      status: string
      currentPeriodEnd?: string | null
    }>
  }
  const active = state?.activeSubscriptions?.[0]
  if (!active) return EMPTY_SUBSCRIPTION

  const products = getProducts(c.env)
  const tier = TIERS.find(slug => products[slug].polarProductId === active.productId) ?? null
  if (!tier) return EMPTY_SUBSCRIPTION

  const status =
    active.status === 'active' ? 'active' : active.status === 'canceled' ? 'canceled' : null

  return {
    tier,
    status,
    currentPeriodEnd: active.currentPeriodEnd ?? null,
  }
}

export const meRoute = new Hono<HonoEnv>().get('/api/me', async c => {
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'unauthenticated' }, 401)

  const subscription = await resolveSubscription(c).catch(() => EMPTY_SUBSCRIPTION)

  return c.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
    subscription,
  })
})
