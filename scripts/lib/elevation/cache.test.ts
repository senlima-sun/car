import { describe, expect, test } from 'bun:test'

import { computeCacheKey } from './cache'

describe('computeCacheKey', () => {
  test('stable for identical inputs', () => {
    const a = computeCacheKey({
      provider: 'opentopography-cop30',
      south: 50.42,
      north: 50.45,
      west: 5.96,
      east: 5.99,
      targetCols: 256,
      targetRows: 256,
    })
    const b = computeCacheKey({
      provider: 'opentopography-cop30',
      south: 50.42,
      north: 50.45,
      west: 5.96,
      east: 5.99,
      targetCols: 256,
      targetRows: 256,
    })
    expect(a).toBe(b)
  })

  test('differs when provider changes', () => {
    const a = computeCacheKey({
      provider: 'opentopography-cop30',
      south: 50.42,
      north: 50.45,
      west: 5.96,
      east: 5.99,
      targetCols: 256,
      targetRows: 256,
    })
    const b = computeCacheKey({
      provider: 'open-elevation',
      south: 50.42,
      north: 50.45,
      west: 5.96,
      east: 5.99,
      targetCols: 256,
      targetRows: 256,
    })
    expect(a).not.toBe(b)
  })
})
