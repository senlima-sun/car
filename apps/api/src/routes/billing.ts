import { Hono } from 'hono'
import { type BillingSlug, isBillingSlug } from '../billing/products.ts'
import type { HonoEnv } from '../types.ts'

interface CheckoutBody {
  slug: BillingSlug
}

// Reject any body other than {slug}: clients must NOT smuggle
// successUrl/customerId/etc. — those are server-controlled.
function isCheckoutBody(value: unknown): value is CheckoutBody {
  if (!value || typeof value !== 'object') return false
  const keys = Object.keys(value)
  if (keys.length !== 1 || keys[0] !== 'slug') return false
  return isBillingSlug((value as { slug: unknown }).slug)
}

export const billingRoute = new Hono<HonoEnv>()
  .post('/api/billing/checkout', async c => {
    const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return c.json({ error: 'unauthenticated' }, 401)

    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'bad_request' }, 400)
    }
    if (!isCheckoutBody(body)) return c.json({ error: 'bad_request' }, 400)

    const url = `${c.env.BETTER_AUTH_URL}/api/auth/checkout`
    const checkoutRes = await c.var.auth.handler(
      new Request(url, {
        method: 'POST',
        headers: c.req.raw.headers,
        body: JSON.stringify({ slug: body.slug, successUrl: c.env.BILLING_SUCCESS_URL }),
      }),
    )
    const data = (await checkoutRes.json()) as { url?: string }
    if (!data.url) return c.json({ error: 'checkout_failed' }, 500)
    return c.json({ url: data.url })
  })
  .post('/api/billing/portal', async c => {
    const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return c.json({ error: 'unauthenticated' }, 401)

    const url = `${c.env.BETTER_AUTH_URL}/api/auth/customer/portal`
    const portalRes = await c.var.auth.handler(
      new Request(url, { method: 'GET', headers: c.req.raw.headers }),
    )
    if (portalRes.status >= 300 && portalRes.status < 400) {
      const location = portalRes.headers.get('location')
      if (location) return c.json({ url: location })
    }
    const data = (await portalRes.json().catch(() => ({}))) as { url?: string }
    if (!data.url) return c.json({ error: 'portal_failed' }, 500)
    return c.json({ url: data.url })
  })
