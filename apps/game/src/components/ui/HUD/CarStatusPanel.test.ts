import { describe, expect, test } from 'vitest'
import { biasColor, engineBrakeMeta } from './CarStatusPanel'
import { BRAKE_BIAS, ENGINE_BRAKING } from '../../../constants/colors'

describe('biasColor', () => {
  test('rear-biased below 58', () => {
    expect(biasColor(50)).toBe(BRAKE_BIAS.rear)
    expect(biasColor(57)).toBe(BRAKE_BIAS.rear)
  })

  test('balanced from 58 through 62 inclusive', () => {
    expect(biasColor(58)).toBe(BRAKE_BIAS.balanced)
    expect(biasColor(60)).toBe(BRAKE_BIAS.balanced)
    expect(biasColor(62)).toBe(BRAKE_BIAS.balanced)
  })

  test('front-biased above 62', () => {
    expect(biasColor(63)).toBe(BRAKE_BIAS.front)
    expect(biasColor(70)).toBe(BRAKE_BIAS.front)
  })
})

describe('engineBrakeMeta', () => {
  test('Low maps to L + low color', () => {
    expect(engineBrakeMeta('Low')).toEqual({ abbrev: 'L', color: ENGINE_BRAKING.low })
  })

  test('Medium maps to M + medium color', () => {
    expect(engineBrakeMeta('Medium')).toEqual({ abbrev: 'M', color: ENGINE_BRAKING.medium })
  })

  test('High maps to H + high color', () => {
    expect(engineBrakeMeta('High')).toEqual({ abbrev: 'H', color: ENGINE_BRAKING.high })
  })
})
