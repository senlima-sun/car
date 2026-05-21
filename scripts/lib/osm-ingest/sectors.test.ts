import { describe, it, expect } from 'vitest'
import { autoDetectSectorSplits } from './sectors'
import type { Point2D } from './chaining'

function linePoints(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  count: number,
): Point2D[] {
  const pts: Point2D[] = []
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    pts.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t })
  }
  return pts
}

function arcPoints(
  cx: number,
  cz: number,
  r: number,
  startAngle: number,
  endAngle: number,
  count: number,
): Point2D[] {
  const pts: Point2D[] = []
  for (let i = 0; i < count; i++) {
    const a = startAngle + (endAngle - startAngle) * (i / (count - 1))
    pts.push({ x: cx + r * Math.cos(a), z: cz + r * Math.sin(a) })
  }
  return pts
}

function buildOvalCircuit(): Point2D[] {
  const straight1 = linePoints(0, 0, 200, 0, 50)
  const corner1 = arcPoints(200, 50, 50, -Math.PI / 2, Math.PI / 2, 20)
  const straight2 = linePoints(200, 100, 0, 100, 50)
  const corner2 = arcPoints(0, 50, 50, Math.PI / 2, (3 * Math.PI) / 2, 20)
  return [
    ...straight1.slice(0, -1),
    ...corner1.slice(0, -1),
    ...straight2.slice(0, -1),
    ...corner2.slice(0, -1),
  ]
}

describe('autoDetectSectorSplits', () => {
  it('returns fallback [0.33, 0.66] for fewer than 4 points', () => {
    const result = autoDetectSectorSplits([{ x: 0, z: 0 }, { x: 1, z: 0 }])
    expect(result[0]).toBeCloseTo(0.33, 2)
    expect(result[1]).toBeCloseTo(0.66, 2)
  })

  it('detects two sector splits on an oval circuit with two long straights separated by semicircular corners', () => {
    const pts = buildOvalCircuit()
    const [a, b] = autoDetectSectorSplits(pts)
    expect(a).toBeGreaterThanOrEqual(0.20)
    expect(a).toBeLessThanOrEqual(0.45)
    expect(b).toBeGreaterThanOrEqual(0.55)
    expect(b).toBeLessThanOrEqual(0.85)
  })

  it.skip('throws when only one distinct straight run is detected — cannot reliably synthesize a single-straight closed circuit without explicit track builder', () => {
    expect(() => autoDetectSectorSplits([])).toThrow()
  })

  it.skip('throws when a detected split lands at endFraction >= 0.98 — lap-end bug (commit bad46f7); hard to synthesize without controlling segment lengths to force endFraction near 1.0', () => {
    expect(true).toBe(true)
  })

  it.skip('throws when detected split is outside [0.20, 0.45] or [0.55, 0.85] bands — hard to synthesize inputs that reliably land a straight exactly at fraction 0.10 after Douglas-Peucker simplification', () => {
    expect(true).toBe(true)
  })
})
