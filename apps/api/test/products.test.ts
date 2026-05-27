import { describe, expect, test } from 'vitest'
import {
  BILLING_PRODUCTS,
  getProducts,
  isBillingSlug,
  tierFromProductId,
} from '../src/billing/products.ts'
import { stubEnv } from './helpers/env.ts'

describe('BILLING_PRODUCTS', () => {
  test('registers the 2 Pro SKUs with their pricing metadata', () => {
    expect(BILLING_PRODUCTS).toEqual([
      {
        slug: 'pro-monthly',
        envVar: 'POLAR_PRODUCT_ID_PRO_MONTHLY',
        tier: 'pro',
        billingCycle: 'monthly',
        priceUsd: 4.99,
        displayPrice: '$4.99/mo',
      },
      {
        slug: 'pro-annual',
        envVar: 'POLAR_PRODUCT_ID_PRO_ANNUAL',
        tier: 'pro',
        billingCycle: 'annual',
        priceUsd: 39.99,
        displayPrice: '$39.99/yr ($3.33/mo)',
      },
    ])
  })
})

describe('getProducts', () => {
  test('returns the product id and tier for each slug', () => {
    const env = stubEnv()
    expect(getProducts(env)).toEqual({
      'pro-monthly': { polarProductId: 'test-product-pro-monthly', tier: 'pro' },
      'pro-annual': { polarProductId: 'test-product-pro-annual', tier: 'pro' },
    })
  })

  test('throws when the monthly env var is empty', () => {
    const env = stubEnv({ POLAR_PRODUCT_ID_PRO_MONTHLY: '' })
    expect(() => getProducts(env)).toThrow(/POLAR_PRODUCT_ID_PRO_MONTHLY/)
  })

  test('throws when the annual env var is empty', () => {
    const env = stubEnv({ POLAR_PRODUCT_ID_PRO_ANNUAL: '' })
    expect(() => getProducts(env)).toThrow(/POLAR_PRODUCT_ID_PRO_ANNUAL/)
  })
})

describe('tierFromProductId', () => {
  test("maps each of the 2 stub product ids to 'pro'", () => {
    const env = stubEnv()
    expect(tierFromProductId(env, 'test-product-pro-monthly')).toBe('pro')
    expect(tierFromProductId(env, 'test-product-pro-annual')).toBe('pro')
  })

  test('returns null for an unknown product id', () => {
    const env = stubEnv()
    expect(tierFromProductId(env, 'test-product-unknown')).toBeNull()
  })
})

describe('isBillingSlug', () => {
  test('accepts the registered slugs', () => {
    expect(isBillingSlug('pro-monthly')).toBe(true)
    expect(isBillingSlug('pro-annual')).toBe(true)
  })

  test('rejects unknown values', () => {
    expect(isBillingSlug('pro')).toBe(false)
    expect(isBillingSlug('enterprise')).toBe(false)
    expect(isBillingSlug(42)).toBe(false)
  })
})
