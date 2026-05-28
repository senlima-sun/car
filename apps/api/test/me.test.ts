import { describe, expect, test } from 'vitest'
import { resolveSubscription } from '../src/routes/me.ts'
import { stubEnv } from './helpers/env.ts'

function stateContext(productId: string) {
  const env = stubEnv()
  return {
    env,
    req: { raw: new Request('http://localhost/api/me') },
    var: {
      auth: {
        handler: async () =>
          new Response(
            JSON.stringify({
              activeSubscriptions: [
                { productId, status: 'active', currentPeriodEnd: '2026-12-31T00:00:00.000Z' },
              ],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      },
    },
  }
}

describe('resolveSubscription', () => {
  test('maps the monthly Pro product id to tier pro', async () => {
    const result = await resolveSubscription(stateContext('test-product-pro-monthly'))
    expect(result.tier).toBe('pro')
    expect(result.status).toBe('active')
  })

  test('maps the annual Pro product id to tier pro', async () => {
    const result = await resolveSubscription(stateContext('test-product-pro-annual'))
    expect(result.tier).toBe('pro')
    expect(result.status).toBe('active')
  })

  test('returns an empty subscription for an unknown product id', async () => {
    const result = await resolveSubscription(stateContext('test-product-unknown'))
    expect(result).toEqual({ tier: null, status: null, currentPeriodEnd: null })
  })
})
