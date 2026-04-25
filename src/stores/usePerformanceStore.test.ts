import { describe, expect, test } from 'bun:test'
import { resolveQualityTier } from './usePerformanceStore'

describe('resolveQualityTier', () => {
  test('keeps ultra stable near the old 100 fps boundary', () => {
    expect(resolveQualityTier('ultra', 97, 95, 20)).toBe('ultra')
    expect(resolveQualityTier('high', 101, 96, 20)).toBe('high')
  })

  test('downgrades when sustained frame pacing falls below tier budget', () => {
    expect(resolveQualityTier('ultra', 91, 93, 20)).toBe('high')
    expect(resolveQualityTier('high', 58, 45, 20)).toBe('medium')
  })

  test('waits for cooldown before upgrading expensive tiers', () => {
    expect(resolveQualityTier('high', 120, 100, 4)).toBe('high')
    expect(resolveQualityTier('high', 120, 100, 8)).toBe('ultra')
  })
})
