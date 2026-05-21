import { describe, expect, test } from 'vitest'
import { SYNTHETIC_FIXTURES } from './syntheticFixtures'
import type { TrackRibbonPoint } from '@/types/trackObjects'

function ribbonPoints(key: string): TrackRibbonPoint[] {
  const fixture = SYNTHETIC_FIXTURES[key]!
  const ribbon = fixture.objects.find(o => o.type === 'track_ribbon')!
  return ribbon.ribbonPoints!
}

function curvature(a: TrackRibbonPoint, b: TrackRibbonPoint, c: TrackRibbonPoint): number {
  const ax = b.x - a.x, az = b.z - a.z
  const bx = c.x - b.x, bz = c.z - b.z
  const cross = ax * bz - az * bx
  const dot = ax * bx + az * bz
  return Math.atan2(cross, dot)
}

describe('SYNTHETIC_FIXTURES', () => {
  test('all three fixtures are present', () => {
    expect(SYNTHETIC_FIXTURES['synthetic:hairpin-4m']).toBeDefined()
    expect(SYNTHETIC_FIXTURES['synthetic:s-curve-50m']).toBeDefined()
    expect(SYNTHETIC_FIXTURES['synthetic:u-turn-mid']).toBeDefined()
  })

  test('each fixture has exactly one track_ribbon object', () => {
    for (const fixture of Object.values(SYNTHETIC_FIXTURES)) {
      const ribbons = fixture.objects.filter(o => o.type === 'track_ribbon')
      expect(ribbons.length).toBe(1)
    }
  })

  test('hairpin-4m: ribbon has at least 5 points and end x is negative (arc passed 90-degree apex)', () => {
    const pts = ribbonPoints('synthetic:hairpin-4m')
    expect(pts.length).toBeGreaterThanOrEqual(5)
    const last = pts[pts.length - 1]!
    expect(last.x).toBeLessThan(0)
  })

  test('s-curve-50m: ribbon has alternating curvature sign across first and second half', () => {
    const pts = ribbonPoints('synthetic:s-curve-50m')
    expect(pts.length).toBeGreaterThan(6)
    const q1 = Math.floor(pts.length * 0.15)
    const q2 = Math.floor(pts.length * 0.4)
    const q3 = Math.floor(pts.length * 0.6)
    const q4 = Math.floor(pts.length * 0.85)
    const firstCurve = curvature(pts[q1]!, pts[q2]!, pts[q2 + 1]!)
    const secondCurve = curvature(pts[q3]!, pts[q4]!, pts[q4 + 1]!)
    expect(Math.sign(firstCurve)).not.toBe(Math.sign(secondCurve))
  })

  test('u-turn-mid: ribbon ends on opposite side of turn (x close to start, z greater)', () => {
    const pts = ribbonPoints('synthetic:u-turn-mid')
    expect(pts.length).toBeGreaterThan(8)
    const first = pts[0]!
    const last = pts[pts.length - 1]!
    expect(Math.abs(last.x - first.x)).toBeLessThan(2)
    expect(last.z).toBeGreaterThan(first.z + 5)
  })

  test('all fixtures have trackLength = 0 and objects with ids', () => {
    for (const fixture of Object.values(SYNTHETIC_FIXTURES)) {
      expect(fixture.trackLength).toBe(0)
      for (const obj of fixture.objects) {
        expect(obj.id.length).toBeGreaterThan(0)
        expect(obj.type).toBeDefined()
      }
    }
  })
})
