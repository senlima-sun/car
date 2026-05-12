import { describe, it, expect } from 'bun:test'
import { buildValidationCenterline } from './validationCenterline'
import type { PlacedObject, TrackRibbonPoint } from '@/types/trackObjects'

function ribbonPoint(x: number, z: number): TrackRibbonPoint {
  return { x, y: 0, z, isPitLane: false }
}

function makeRibbon(points: TrackRibbonPoint[], id = 'r1'): PlacedObject {
  return {
    id,
    type: 'track_ribbon',
    position: [0, 0, 0],
    rotation: 0,
    ribbonPoints: points,
  }
}

describe('buildValidationCenterline', () => {
  it('returns empty array on empty objects', () => {
    expect(buildValidationCenterline([])).toEqual([])
  })

  it('returns empty array when no track_ribbon objects', () => {
    const road: PlacedObject = {
      id: 'road-1',
      type: 'road',
      position: [0, 0, 0],
      rotation: 0,
    }
    expect(buildValidationCenterline([road])).toEqual([])
  })

  it('skips ribbons with fewer than 2 points', () => {
    const ribbon = makeRibbon([ribbonPoint(0, 0)])
    expect(buildValidationCenterline([ribbon])).toEqual([])
  })

  it('picks the longest ribbon when multiple are present', () => {
    const short = makeRibbon([ribbonPoint(0, 0), ribbonPoint(100, 0)], 'short')
    const long = makeRibbon([ribbonPoint(0, 0), ribbonPoint(200, 0)], 'long')
    const samples = buildValidationCenterline([short, long])
    expect(samples.length).toBeGreaterThan(0)
    const last = samples[samples.length - 1]!
    expect(Math.abs(last.x - 200)).toBeLessThan(5)
  })

  it('resamples a straight 100m ribbon at 5m spacing into 21 samples with monotonic cumulativeDistance', () => {
    const ribbon = makeRibbon([ribbonPoint(0, 0), ribbonPoint(100, 0)])
    const samples = buildValidationCenterline([ribbon])
    expect(samples.length).toBe(21)
    for (let i = 0; i < samples.length; i++) {
      expect(samples[i]!.cumulativeDistance).toBeCloseTo(i * 5, 4)
    }
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!.cumulativeDistance).toBeGreaterThanOrEqual(samples[i - 1]!.cumulativeDistance)
    }
  })

  it('returns empty array for a zero-length ribbon (identical points)', () => {
    const ribbon = makeRibbon([ribbonPoint(0, 0), ribbonPoint(0, 0)])
    expect(buildValidationCenterline([ribbon])).toEqual([])
  })

  it('preserves direction — +x ribbon produces samples with monotonically increasing x', () => {
    const ribbon = makeRibbon([ribbonPoint(0, 0), ribbonPoint(100, 0)])
    const samples = buildValidationCenterline([ribbon])
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!.x).toBeGreaterThanOrEqual(samples[i - 1]!.x)
    }
  })

  it('places samples on the polyline segments — L-shape at 75m lands near (50, 25)', () => {
    const ribbon = makeRibbon([
      ribbonPoint(0, 0),
      ribbonPoint(50, 0),
      ribbonPoint(50, 50),
    ])
    const samples = buildValidationCenterline([ribbon])

    const target = samples.find(s => Math.abs(s.cumulativeDistance - 75) < 5)
    expect(target).toBeDefined()
    expect(Math.abs(target!.x - 50)).toBeLessThan(5)
    expect(Math.abs(target!.z - 25)).toBeLessThan(5)
  })
})
