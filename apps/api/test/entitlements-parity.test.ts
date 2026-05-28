import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { BILLING_PRODUCTS } from '../src/billing/products.ts'
import { PRICING_PRODUCTS } from '../../game/src/auth/pricingProducts.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKER_FEATURES = join(HERE, '../src/entitlements/features.ts')
const GAME_FEATURES = join(HERE, '../../game/src/auth/entitlements.ts')

function normalize(source: string): string {
  const lines = source.split('\n')
  const dropped = lines.filter(line => {
    const trimmed = line.trim()
    if (trimmed.startsWith('//')) return false
    if (trimmed.startsWith("import type { LogicalTier }")) return false
    return true
  })
  return dropped.join('\n').replace(/LogicalTier/g, "'pro'").replace(/\n{2,}/g, '\n').trim()
}

describe('entitlements parity (worker <-> SPA)', () => {
  test('features.ts and entitlements.ts have identical bodies (modulo leading comment + LogicalTier alias)', () => {
    const workerBody = normalize(readFileSync(WORKER_FEATURES, 'utf8'))
    const gameBody = normalize(readFileSync(GAME_FEATURES, 'utf8'))

    expect(
      gameBody,
      'apps/game/src/auth/entitlements.ts drifted from apps/api/src/entitlements/features.ts (canonical). Re-mirror the function body.',
    ).toBe(workerBody)
  })
})

describe('pricing product parity (worker <-> SPA)', () => {
  test('BILLING_PRODUCTS and PRICING_PRODUCTS agree on shared fields per slug', () => {
    const sharedFields = ['slug', 'tier', 'billingCycle', 'priceUsd', 'displayPrice'] as const

    const workerView = BILLING_PRODUCTS.map(product =>
      Object.fromEntries(sharedFields.map(field => [field, product[field]])),
    )
    const gameView = PRICING_PRODUCTS.map(product =>
      Object.fromEntries(sharedFields.map(field => [field, product[field]])),
    )

    expect(
      gameView,
      'apps/game/src/auth/pricingProducts.ts drifted from apps/api/src/billing/products.ts (canonical).',
    ).toEqual(workerView)
  })
})
