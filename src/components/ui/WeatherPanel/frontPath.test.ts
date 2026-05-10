import { describe, expect, it } from 'bun:test'
import { arcLength, resampleByArcLength, pathToSources } from './frontPath'

describe('arcLength', () => {
  it('is zero for empty or single point', () => {
    expect(arcLength([])).toBe(0)
    expect(arcLength([{ x: 1, z: 1 }])).toBe(0)
  })

  it('computes straight-line distance', () => {
    expect(arcLength([{ x: 0, z: 0 }, { x: 3, z: 4 }])).toBeCloseTo(5, 5)
  })

  it('sums multi-segment paths', () => {
    const len = arcLength([
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 10 },
    ])
    expect(len).toBeCloseTo(20, 5)
  })
})

describe('resampleByArcLength', () => {
  it('returns empty for n=0', () => {
    expect(resampleByArcLength([{ x: 0, z: 0 }], 0)).toEqual([])
  })

  it('returns first point n times when single input', () => {
    expect(resampleByArcLength([{ x: 5, z: 7 }], 3)).toEqual([
      { x: 5, z: 7 },
      { x: 5, z: 7 },
      { x: 5, z: 7 },
    ])
  })

  it('returns first and last point when n=2', () => {
    const out = resampleByArcLength([{ x: 0, z: 0 }, { x: 10, z: 0 }], 2)
    expect(out[0]).toEqual({ x: 0, z: 0 })
    expect(out[1]).toEqual({ x: 10, z: 0 })
  })

  it('places samples evenly by arc-length', () => {
    const out = resampleByArcLength([{ x: 0, z: 0 }, { x: 100, z: 0 }], 5)
    expect(out).toHaveLength(5)
    expect(out[0].x).toBeCloseTo(0, 3)
    expect(out[1].x).toBeCloseTo(25, 3)
    expect(out[2].x).toBeCloseTo(50, 3)
    expect(out[3].x).toBeCloseTo(75, 3)
    expect(out[4].x).toBeCloseTo(100, 3)
  })

  it('handles polyline with corner', () => {
    const out = resampleByArcLength(
      [
        { x: 0, z: 0 },
        { x: 10, z: 0 },
        { x: 10, z: 10 },
      ],
      3,
    )
    expect(out).toHaveLength(3)
    expect(out[0]).toEqual({ x: 0, z: 0 })
    expect(out[2]).toEqual({ x: 10, z: 10 })
  })
})

describe('pathToSources', () => {
  it('returns N sources for a straight horizontal path', () => {
    const sources = pathToSources(
      [
        { x: 0, z: 0 },
        { x: 100, z: 0 },
      ],
      { sourceCount: 3, radius: 50, intensity: 0.8, velocityMagnitude: 5 },
    )
    expect(sources).toHaveLength(3)
    for (const s of sources) {
      expect(s.radius).toBe(50)
      expect(s.intensity).toBe(0.8)
    }
  })

  it('velocity is perpendicular to path direction', () => {
    const sources = pathToSources(
      [
        { x: 0, z: 0 },
        { x: 100, z: 0 },
      ],
      { sourceCount: 3, radius: 50, intensity: 1, velocityMagnitude: 10 },
    )
    const mid = sources[1]
    expect(Math.abs(mid.vx)).toBeLessThan(1e-3)
    expect(Math.abs(Math.abs(mid.vz) - 10)).toBeLessThan(1e-3)
  })

  it('returns empty for empty input', () => {
    expect(
      pathToSources([], { sourceCount: 5, radius: 50, intensity: 1, velocityMagnitude: 5 }),
    ).toEqual([])
  })

  it('handles zero source count', () => {
    expect(
      pathToSources(
        [{ x: 0, z: 0 }, { x: 10, z: 0 }],
        { sourceCount: 0, radius: 50, intensity: 1, velocityMagnitude: 5 },
      ),
    ).toEqual([])
  })
})
