import type { Bindings } from '../types.ts'

export const TIERS = ['pro'] as const
export type TierSlug = (typeof TIERS)[number]

export interface TierProduct {
  polarProductId: string
}

const ENV_VAR_FOR_TIER: Record<TierSlug, keyof Bindings> = {
  pro: 'POLAR_PRODUCT_ID_PRO',
}

export function getProducts(env: Bindings): Record<TierSlug, TierProduct> {
  const result = {} as Record<TierSlug, TierProduct>
  for (const tier of TIERS) {
    const varName = ENV_VAR_FOR_TIER[tier]
    const value = env[varName] as unknown as string | undefined
    if (!value) throw new Error(`Missing env var ${varName} for tier '${tier}'`)
    result[tier] = { polarProductId: value }
  }
  return result
}
