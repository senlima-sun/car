import { describe, expect, test } from 'vitest'
import { resolveQualityTier } from './usePerformanceStore'

describe('resolveQualityTier', () => {
  test('keeps ultra stable near the old 100 fps boundary', () => {
    expect(resolveQualityTier('ultra', 97, 95, 20)).toBe('ultra')
    expect(resolveQualityTier('high', 101, 96, 20)).toBe('high')
  })

  test('downgrades when sustained frame pacing falls below tier budget', () => {
    expect(resolveQualityTier('ultra', 91, 93, 20, 6)).toBe('high')
    expect(resolveQualityTier('high', 50, 45, 20, 6)).toBe('medium')
  })

  test('ignores isolated one-frame stalls for tier changes', () => {
    expect(resolveQualityTier('ultra', 97, 7, 20, 1)).toBe('ultra')
    expect(resolveQualityTier('medium', 96, 8, 20, 5)).toBe('medium')
    expect(resolveQualityTier('ultra', 120, 7, 20, 6)).toBe('ultra')
  })

  test('waits for cooldown before upgrading expensive tiers', () => {
    expect(resolveQualityTier('high', 120, 100, 4)).toBe('high')
    expect(resolveQualityTier('high', 120, 100, 8)).toBe('ultra')
  })
})
