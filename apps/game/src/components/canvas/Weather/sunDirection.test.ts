import { describe, expect, it } from 'vitest'
import { computeSunDirection, isSunAboveHorizon, getSunIntensity } from './sunDirection'

describe('computeSunDirection', () => {
  it('sun is below horizon at midnight', () => {
    const sun = computeSunDirection(0)
    expect(sun.y).toBeLessThan(0)
  })

  it('sun is above horizon at noon', () => {
    const sun = computeSunDirection(12)
    expect(sun.y).toBeGreaterThan(0)
  })

  it('sun rises in the east at 06:00 (sunrise)', () => {
    const sun = computeSunDirection(6)
    expect(Math.abs(sun.y)).toBeLessThan(0.05)
    expect(sun.x).toBeGreaterThan(0.5)
  })

  it('sun sets in the west at 18:00 (sunset)', () => {
    const sun = computeSunDirection(18)
    expect(Math.abs(sun.y)).toBeLessThan(0.05)
    expect(sun.x).toBeLessThan(-0.5)
  })

  it('sun is highest at noon', () => {
    const noon = computeSunDirection(12)
    const morning = computeSunDirection(9)
    const afternoon = computeSunDirection(15)
    expect(noon.y).toBeGreaterThan(morning.y)
    expect(noon.y).toBeGreaterThan(afternoon.y)
  })

  it('returns unit-length vector', () => {
    const cases = [6, 9, 12, 15, 18, 21]
    for (const h of cases) {
      const s = computeSunDirection(h)
      const len = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z)
      expect(Math.abs(len - 1)).toBeLessThan(0.001)
    }
  })

  it('wraps hour values', () => {
    expect(computeSunDirection(24)).toEqual(computeSunDirection(0))
    expect(computeSunDirection(-1)).toEqual(computeSunDirection(23))
  })

  it('peak elevation depends on latitude', () => {
    const equator = computeSunDirection(12, 0)
    const arctic = computeSunDirection(12, 80)
    expect(equator.y).toBeGreaterThan(arctic.y)
  })
})

describe('isSunAboveHorizon', () => {
  it('false during night', () => {
    expect(isSunAboveHorizon(0)).toBe(false)
    expect(isSunAboveHorizon(3)).toBe(false)
    expect(isSunAboveHorizon(22)).toBe(false)
  })

  it('true during day', () => {
    expect(isSunAboveHorizon(9)).toBe(true)
    expect(isSunAboveHorizon(12)).toBe(true)
    expect(isSunAboveHorizon(15)).toBe(true)
  })
})

describe('getSunIntensity', () => {
  it('zero at night', () => {
    expect(getSunIntensity(0)).toBe(0)
    expect(getSunIntensity(2)).toBe(0)
  })

  it('peaks at noon', () => {
    const noon = getSunIntensity(12)
    const morning = getSunIntensity(9)
    expect(noon).toBeGreaterThan(morning)
  })
})
