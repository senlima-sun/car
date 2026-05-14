import { describe, expect, test } from 'bun:test'
import {
  MAX_RPM,
  RPM_LIGHT_COUNT,
  litLights,
  rpmDigitAnimation,
  rpmLightColor,
  rpmPercent,
  rpmZone,
  rpmZoneColor,
} from './rpmZones'

describe('rpmPercent', () => {
  test('returns 0 for rpm = 0', () => {
    expect(rpmPercent(0)).toBe(0)
  })

  test('returns 1 for rpm = MAX_RPM', () => {
    expect(rpmPercent(MAX_RPM)).toBe(1)
  })

  test('clamps to 1 for rpm above MAX_RPM', () => {
    expect(rpmPercent(MAX_RPM * 2)).toBe(1)
  })

  test('clamps to 0 for negative rpm', () => {
    expect(rpmPercent(-100)).toBe(0)
  })

  test('returns 0 for NaN', () => {
    expect(rpmPercent(NaN)).toBe(0)
  })

  test('returns 1 for Infinity', () => {
    expect(rpmPercent(Infinity)).toBe(1)
  })

  test('returns 0 for -Infinity', () => {
    expect(rpmPercent(-Infinity)).toBe(0)
  })

  test('returns linear ratio for mid range', () => {
    expect(rpmPercent(MAX_RPM / 2)).toBeCloseTo(0.5)
  })
})

describe('litLights', () => {
  test('returns 0 at idle', () => {
    expect(litLights(0)).toBe(0)
  })

  test('returns RPM_LIGHT_COUNT at MAX_RPM', () => {
    expect(litLights(MAX_RPM)).toBe(RPM_LIGHT_COUNT)
  })

  test('returns RPM_LIGHT_COUNT above MAX_RPM', () => {
    expect(litLights(MAX_RPM * 2)).toBe(RPM_LIGHT_COUNT)
  })
})

describe('rpmZone', () => {
  test('idle at 0', () => {
    expect(rpmZone(0)).toBe('idle')
  })

  test('green from 1 to 7', () => {
    for (let i = 1; i <= 7; i++) {
      expect(rpmZone(i)).toBe('green')
    }
  })

  test('yellow from 8 to 12', () => {
    for (let i = 8; i <= 12; i++) {
      expect(rpmZone(i)).toBe('yellow')
    }
  })

  test('red from 13 to 14', () => {
    for (let i = 13; i <= 14; i++) {
      expect(rpmZone(i)).toBe('red')
    }
  })

  test('limiter at RPM_LIGHT_COUNT and above', () => {
    expect(rpmZone(RPM_LIGHT_COUNT)).toBe('limiter')
    expect(rpmZone(RPM_LIGHT_COUNT + 5)).toBe('limiter')
  })
})

describe('rpmZoneColor', () => {
  test('returns mapped colors for each zone', () => {
    expect(rpmZoneColor('idle')).toBe('rgba(255,255,255,0.85)')
    expect(rpmZoneColor('green')).toBe('#22c55e')
    expect(rpmZoneColor('yellow')).toBe('#f59e0b')
    expect(rpmZoneColor('red')).toBe('#ef4444')
    expect(rpmZoneColor('limiter')).toBe('#ff2929')
  })
})

describe('rpmLightColor', () => {
  test('returns unlit color when index >= litCount', () => {
    expect(rpmLightColor(5, 3)).toBe('rgba(255,255,255,0.06)')
    expect(rpmLightColor(3, 3)).toBe('rgba(255,255,255,0.06)')
  })

  test('green indices 0-6 when lit', () => {
    for (let i = 0; i < 7; i++) {
      expect(rpmLightColor(i, RPM_LIGHT_COUNT)).toBe('#22c55e')
    }
  })

  test('yellow indices 7-11 when lit', () => {
    for (let i = 7; i < 12; i++) {
      expect(rpmLightColor(i, RPM_LIGHT_COUNT)).toBe('#f59e0b')
    }
  })

  test('red indices 12-14 when lit', () => {
    for (let i = 12; i < RPM_LIGHT_COUNT; i++) {
      expect(rpmLightColor(i, RPM_LIGHT_COUNT)).toBe('#ef4444')
    }
  })

  test('highest-lit light color matches rpmZoneColor of zone (consistency invariant)', () => {
    for (let lit = 1; lit <= RPM_LIGHT_COUNT; lit++) {
      const highestLitIndex = lit - 1
      const lightColor = rpmLightColor(highestLitIndex, lit)
      const zoneColor = rpmZoneColor(rpmZone(lit))
      if (lit === RPM_LIGHT_COUNT) {
        expect(lightColor).toBe('#ef4444')
        expect(zoneColor).toBe('#ff2929')
      } else {
        expect(lightColor).toBe(zoneColor)
      }
    }
  })
})

describe('rpmDigitAnimation', () => {
  test('returns undefined outside limiter zone', () => {
    expect(rpmDigitAnimation(0)).toBeUndefined()
    expect(rpmDigitAnimation(7)).toBeUndefined()
    expect(rpmDigitAnimation(14)).toBeUndefined()
  })

  test('returns hud-shift animation at limiter', () => {
    expect(rpmDigitAnimation(RPM_LIGHT_COUNT)).toBe('hud-shift 0.18s linear infinite')
  })

  test('stable identity within a zone (same string returned twice)', () => {
    expect(rpmDigitAnimation(5)).toBe(rpmDigitAnimation(6))
    expect(rpmDigitAnimation(RPM_LIGHT_COUNT)).toBe(rpmDigitAnimation(RPM_LIGHT_COUNT + 1))
  })
})
