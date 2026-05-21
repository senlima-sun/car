import { describe, expect, test } from 'vitest'
import { FIXED_TIME_STEP } from './physics'

describe('physics constants', () => {
  test('uses the 120Hz player physics timestep', () => {
    expect(FIXED_TIME_STEP).toBe(1 / 120)
  })
})
