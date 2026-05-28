// Mirror of apps/api/src/billing/products.ts — kept in sync via apps/api/test/entitlements-parity.test.ts

export interface PricingProduct {
  slug: 'pro-monthly' | 'pro-annual'
  tier: 'pro'
  billingCycle: 'monthly' | 'annual'
  priceUsd: number
  displayPrice: string
}

export const PRICING_PRODUCTS: readonly PricingProduct[] = [
  {
    slug: 'pro-monthly',
    tier: 'pro',
    billingCycle: 'monthly',
    priceUsd: 4.99,
    displayPrice: '$4.99/mo',
  },
  {
    slug: 'pro-annual',
    tier: 'pro',
    billingCycle: 'annual',
    priceUsd: 39.99,
    displayPrice: '$39.99/yr ($3.33/mo)',
  },
]
