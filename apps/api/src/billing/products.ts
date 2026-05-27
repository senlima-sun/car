import type { Bindings } from '../types.ts'

export interface BillingProduct {
  slug: 'pro-monthly' | 'pro-annual'
  envVar: 'POLAR_PRODUCT_ID_PRO_MONTHLY' | 'POLAR_PRODUCT_ID_PRO_ANNUAL'
  tier: 'pro'
  billingCycle: 'monthly' | 'annual'
  priceUsd: number
  displayPrice: string
}

export const BILLING_PRODUCTS = [
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
] as const satisfies readonly BillingProduct[]

export type BillingSlug = (typeof BILLING_PRODUCTS)[number]['slug']
export type LogicalTier = (typeof BILLING_PRODUCTS)[number]['tier']

const SLUGS: readonly BillingSlug[] = BILLING_PRODUCTS.map(product => product.slug)

export function isBillingSlug(value: unknown): value is BillingSlug {
  return typeof value === 'string' && (SLUGS as readonly string[]).includes(value)
}

export function getProducts(
  env: Bindings,
): Record<BillingSlug, { polarProductId: string; tier: LogicalTier }> {
  const result = {} as Record<BillingSlug, { polarProductId: string; tier: LogicalTier }>
  for (const product of BILLING_PRODUCTS) {
    const value = env[product.envVar] as unknown as string | undefined
    if (!value) throw new Error(`Missing env var ${product.envVar} for slug '${product.slug}'`)
    result[product.slug] = { polarProductId: value, tier: product.tier }
  }
  return result
}

export function tierFromProductId(env: Bindings, productId: string): LogicalTier | null {
  const products = getProducts(env)
  for (const slug of SLUGS) {
    if (products[slug].polarProductId === productId) return products[slug].tier
  }
  return null
}
