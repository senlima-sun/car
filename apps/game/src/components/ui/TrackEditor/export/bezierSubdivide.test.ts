import { describe, expect, test } from 'vitest'
import { cubicSplit, subdivideCubicAdaptive, cubicPoint } from './bezierSubdivide'
import type { Vec2 } from './bezierSubdivide'

const OPTS = {
  maxChordError: 0.05,
  minStep: 0.25,
  maxStep: 4.0,
  maxDepth: 16,
  arcLengthChordRatio: 0.05,
}

function dist(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

describe('cubicSplit', () => {
  test('left sub-cubic starts at p0 and right ends at p3', () => {
    const p0: Vec2 = { x: 0, y: 0 }
    const c1: Vec2 = { x: 1, y: 2 }
    const c2: Vec2 = { x: 3, y: 2 }
    const p3: Vec2 = { x: 4, y: 0 }
    const { left, right } = cubicSplit(p0, c1, c2, p3, 0.5)
    expect(left.p0).toEqual(p0)
    expect(right.p3).toEqual(p3)
    expect(left.p3).toEqual(right.p0)
  })

  test('split at t=0.5 midpoint matches cubic evaluation', () => {
    const p0: Vec2 = { x: 0, y: 0 }
    const c1: Vec2 = { x: 0, y: 10 }
    const c2: Vec2 = { x: 10, y: 10 }
    const p3: Vec2 = { x: 10, y: 0 }
    const { left, right } = cubicSplit(p0, c1, c2, p3, 0.5)
    const midFromOrig = cubicPoint(p0, c1, c2, p3, 0.5)
    expect(dist(left.p3, midFromOrig)).toBeLessThan(1e-10)
    expect(dist(right.p0, midFromOrig)).toBeLessThan(1e-10)
  })
})

describe('subdivideCubicAdaptive', () => {
  test('straight line collapses to 2 samples', () => {
    const p0: Vec2 = { x: 0, y: 0 }
    const c1: Vec2 = { x: 0, y: 0 }
    const c2: Vec2 = { x: 10, y: 0 }
    const p3: Vec2 = { x: 10, y: 0 }
    const ts = subdivideCubicAdaptive(p0, c1, c2, p3, OPTS)
    expect(ts).toHaveLength(2)
    expect(ts[0]).toBe(0)
    expect(ts[1]).toBe(1)
  })

  test('quarter-circle approximation: subdivides to chord error spec (>=12 samples per 90 deg)', () => {
    const k = (4 / 3) * Math.tan(Math.PI / 8)
    const R = 10
    const p0: Vec2 = { x: R, y: 0 }
    const c1: Vec2 = { x: R, y: k * R }
    const c2: Vec2 = { x: k * R, y: R }
    const p3: Vec2 = { x: 0, y: R }
    const ts = subdivideCubicAdaptive(p0, c1, c2, p3, { ...OPTS, maxStep: 1.0 })
    expect(ts.length).toBeGreaterThanOrEqual(12)
    for (const t of ts) {
      const pt = cubicPoint(p0, c1, c2, p3, t)
      const r = Math.hypot(pt.x, pt.y)
      expect(Math.abs(r - R)).toBeLessThan(OPTS.maxChordError * 2)
    }
  })

  test('S-curve preserves depth-first ordering and t-monotonicity', () => {
    const p0: Vec2 = { x: 0, y: 0 }
    const c1: Vec2 = { x: 0, y: 5 }
    const c2: Vec2 = { x: 10, y: -5 }
    const p3: Vec2 = { x: 10, y: 0 }
    const ts = subdivideCubicAdaptive(p0, c1, c2, p3, OPTS)
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i]!).toBeGreaterThan(ts[i - 1]!)
    }
    expect(ts[0]).toBe(0)
    expect(ts[ts.length - 1]).toBe(1)
  })

  test('determinism: same input twice produces identical array', () => {
    const p0: Vec2 = { x: 0, y: 0 }
    const c1: Vec2 = { x: 2, y: 8 }
    const c2: Vec2 = { x: 8, y: 8 }
    const p3: Vec2 = { x: 10, y: 0 }
    const ts1 = subdivideCubicAdaptive(p0, c1, c2, p3, OPTS)
    const ts2 = subdivideCubicAdaptive(p0, c1, c2, p3, OPTS)
    expect(ts1).toEqual(ts2)
  })

  test('t-values are unique within 1e-9', () => {
    const p0: Vec2 = { x: 0, y: 0 }
    const c1: Vec2 = { x: 1, y: 5 }
    const c2: Vec2 = { x: 4, y: 5 }
    const p3: Vec2 = { x: 5, y: 0 }
    const ts = subdivideCubicAdaptive(p0, c1, c2, p3, OPTS)
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i]! - ts[i - 1]!).toBeGreaterThan(1e-9)
    }
  })

  test('cusp (c1 === c2 === midpoint) terminates within bounded depth', () => {
    const p0: Vec2 = { x: 0, y: 0 }
    const p3: Vec2 = { x: 10, y: 0 }
    const mid: Vec2 = { x: 5, y: 0 }
    const ts = subdivideCubicAdaptive(p0, mid, mid, p3, OPTS)
    expect(ts.length).toBeLessThan(64)
    expect(ts[0]).toBe(0)
    expect(ts[ts.length - 1]).toBe(1)
  })

  test('self-touching cubic preserves loop: has >= 4 samples and midpoint is not near p0', () => {
    const p0: Vec2 = { x: 0, y: 0 }
    const p3: Vec2 = { x: 10, y: 0 }
    const c1: Vec2 = { x: p3.x + (p3.x - p0.x), y: p3.y + (p3.y - p0.y) }
    const c2: Vec2 = { x: p0.x + (p0.x - p3.x), y: p0.y + (p0.y - p3.y) }
    const ts = subdivideCubicAdaptive(p0, c1, c2, p3, { ...OPTS, maxStep: 20 })
    expect(ts.length).toBeGreaterThanOrEqual(4)
    const midT = ts[Math.floor(ts.length / 2)]!
    const midPt = cubicPoint(p0, c1, c2, p3, midT)
    expect(dist(midPt, p0)).toBeGreaterThan(OPTS.maxChordError)
  })

  test('degenerate zero-length handles (c1 === p0 && c2 === p3) produces exactly 2 samples', () => {
    const p0: Vec2 = { x: 0, y: 0 }
    const p3: Vec2 = { x: 5, y: 3 }
    const ts = subdivideCubicAdaptive(p0, p0, p3, p3, OPTS)
    expect(ts).toHaveLength(2)
  })

  test('self-touching cubic with p0 === p3 (true loop) preserves the loop', () => {
    const p0: Vec2 = { x: 0, y: 0 }
    const p3: Vec2 = { x: 0, y: 0 }
    const c1: Vec2 = { x: 10, y: 10 }
    const c2: Vec2 = { x: -10, y: 10 }
    const ts = subdivideCubicAdaptive(p0, c1, c2, p3, { ...OPTS, maxStep: 50 })
    expect(ts.length).toBeGreaterThanOrEqual(4)
    const midT = ts[Math.floor(ts.length / 2)]!
    const midPt = cubicPoint(p0, c1, c2, p3, midT)
    expect(dist(midPt, p0)).toBeGreaterThan(1)
  })

  test('small-chord high-curvature cubic respects chord error (no early bail on minStep)', () => {
    const p0: Vec2 = { x: 0, y: 0 }
    const p3: Vec2 = { x: 0.1, y: 0 }
    const c1: Vec2 = { x: 0, y: 5 }
    const c2: Vec2 = { x: 0.1, y: 5 }
    const ts = subdivideCubicAdaptive(p0, c1, c2, p3, OPTS)
    expect(ts.length).toBeGreaterThan(2)
    let maxDev = 0
    for (let i = 1; i < ts.length; i++) {
      const tMid = (ts[i - 1]! + ts[i]!) * 0.5
      const aSeg = cubicPoint(p0, c1, c2, p3, ts[i - 1]!)
      const bSeg = cubicPoint(p0, c1, c2, p3, ts[i]!)
      const mSeg = cubicPoint(p0, c1, c2, p3, tMid)
      const chordMx = (aSeg.x + bSeg.x) * 0.5
      const chordMy = (aSeg.y + bSeg.y) * 0.5
      const dev = Math.hypot(mSeg.x - chordMx, mSeg.y - chordMy)
      if (dev > maxDev) maxDev = dev
    }
    expect(maxDev).toBeLessThan(OPTS.maxChordError * 2)
  })

  test('maxDepth cap is respected on adversarial input', () => {
    const p0: Vec2 = { x: 0, y: 0 }
    const c1: Vec2 = { x: 0, y: 100 }
    const c2: Vec2 = { x: 0.001, y: 100 }
    const p3: Vec2 = { x: 0.001, y: 0 }
    const ts = subdivideCubicAdaptive(p0, c1, c2, p3, {
      maxChordError: 0.0001,
      minStep: 0.00001,
      maxStep: 0.1,
      maxDepth: 8,
      arcLengthChordRatio: 0.05,
    })
    expect(ts.length).toBeLessThanOrEqual(Math.pow(2, 8) + 2)
    expect(ts[0]).toBe(0)
    expect(ts[ts.length - 1]).toBe(1)
  })
})
