import { describe, expect, test } from 'vitest'
import { getProducts } from '../src/billing/products.ts'
import { stubEnv } from './helpers/env.ts'

describe('getProducts', () => {
  test('returns the product id for each tier', () => {
    const env = stubEnv({ POLAR_PRODUCT_ID_PRO: 'prod_abc' })
    expect(getProducts(env)).toEqual({ pro: { polarProductId: 'prod_abc' } })
  })

  test('throws when a tier env var is empty', () => {
    const env = stubEnv({ POLAR_PRODUCT_ID_PRO: '' })
    expect(() => getProducts(env)).toThrow(/POLAR_PRODUCT_ID_PRO/)
  })
})
