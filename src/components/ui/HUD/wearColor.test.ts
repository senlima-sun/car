import { describe, expect, test } from 'bun:test'
import { wearColor } from './wearColor'
import { TIRE_WEAR_CRITICAL, TIRE_WEAR_WARNING } from '../../../constants/tires'
import { STATUS } from '../../../constants/colors'

describe('wearColor', () => {
  test('returns success green for 0 wear', () => {
    expect(wearColor(0)).toBe(STATUS.success)
  })

  test('returns success green just below warning threshold', () => {
    expect(wearColor(TIRE_WEAR_WARNING - 0.01)).toBe(STATUS.success)
  })

  test('returns warning amber at warning threshold', () => {
    expect(wearColor(TIRE_WEAR_WARNING)).toBe(STATUS.warning)
  })

  test('returns warning amber just below critical threshold', () => {
    expect(wearColor(TIRE_WEAR_CRITICAL - 0.01)).toBe(STATUS.warning)
  })

  test('returns danger red at critical threshold', () => {
    expect(wearColor(TIRE_WEAR_CRITICAL)).toBe(STATUS.danger)
  })

  test('returns danger red at 100', () => {
    expect(wearColor(100)).toBe(STATUS.danger)
  })

  test('returns danger red above 100', () => {
    expect(wearColor(150)).toBe(STATUS.danger)
  })

  test('returns success green for NaN (defensive)', () => {
    expect(wearColor(NaN)).toBe(STATUS.success)
  })

  test('returns success green for Infinity (defensive)', () => {
    expect(wearColor(Infinity)).toBe(STATUS.success)
  })

  test('returns success green for negative wear', () => {
    expect(wearColor(-10)).toBe(STATUS.success)
  })
})
