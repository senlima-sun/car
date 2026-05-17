import type { Point } from '../geometry/types'
import { lerp } from '../geometry/point'

export type Vec2 = Point

export interface CubicSegment {
  p0: Point
  c1: Point
  c2: Point
  p3: Point
}

export interface SubdivideOptions {
  maxChordError: number
  minStep: number
  maxStep: number
  maxDepth?: number
  arcLengthChordRatio?: number
}

export function cubicPoint(p0: Point, c1: Point, c2: Point, p3: Point, t: number): Point {
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
  }
}

export function cubicSplit(
  p0: Point, c1: Point, c2: Point, p3: Point, t: number,
): { left: CubicSegment; right: CubicSegment } {
  const p01 = lerp(p0, c1, t)
  const p12 = lerp(c1, c2, t)
  const p23 = lerp(c2, p3, t)
  const p012 = lerp(p01, p12, t)
  const p123 = lerp(p12, p23, t)
  const p0123 = lerp(p012, p123, t)
  return {
    left: { p0, c1: p01, c2: p012, p3: p0123 },
    right: { p0: p0123, c1: p123, c2: p23, p3 },
  }
}

function controlPolygonLength(seg: CubicSegment): number {
  return (
    Math.hypot(seg.c1.x - seg.p0.x, seg.c1.y - seg.p0.y) +
    Math.hypot(seg.c2.x - seg.c1.x, seg.c2.y - seg.c1.y) +
    Math.hypot(seg.p3.x - seg.c2.x, seg.p3.y - seg.c2.y)
  )
}

function collectTValues(
  seg: CubicSegment,
  tMin: number, tMax: number,
  opts: Required<SubdivideOptions>,
  depth: number,
  out: number[],
): void {
  const { p0, c1, c2, p3 } = seg
  const chordLen = Math.hypot(p3.x - p0.x, p3.y - p0.y)
  const tSpan = tMax - tMin

  if (depth >= opts.maxDepth) {
    out.push(tMax)
    return
  }

  const polyLen = controlPolygonLength(seg)
  const arcLengthRatioBreach = polyLen - chordLen > opts.arcLengthChordRatio * chordLen

  const mid = cubicPoint(p0, c1, c2, p3, 0.5)
  const chordMidX = (p0.x + p3.x) * 0.5
  const chordMidY = (p0.y + p3.y) * 0.5
  const deviation = Math.hypot(mid.x - chordMidX, mid.y - chordMidY)

  if (chordLen < opts.minStep && !arcLengthRatioBreach && deviation <= opts.maxChordError) {
    out.push(tMax)
    return
  }

  if (!arcLengthRatioBreach && deviation <= opts.maxChordError && chordLen <= opts.maxStep) {
    out.push(tMax)
    return
  }

  const tMid = tMin + tSpan * 0.5
  const { left, right } = cubicSplit(p0, c1, c2, p3, 0.5)
  collectTValues(left, tMin, tMid, opts, depth + 1, out)
  collectTValues(right, tMid, tMax, opts, depth + 1, out)
}

function isStraightCubic(p0: Point, c1: Point, c2: Point, p3: Point): boolean {
  const dx = p3.x - p0.x
  const dy = p3.y - p0.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-18) {
    const h1dx = c1.x - p0.x
    const h1dy = c1.y - p0.y
    const h2dx = c2.x - p0.x
    const h2dy = c2.y - p0.y
    return h1dx * h1dx + h1dy * h1dy < 1e-18 && h2dx * h2dx + h2dy * h2dy < 1e-18
  }
  const cross1 = Math.abs((c1.x - p0.x) * dy - (c1.y - p0.y) * dx)
  const cross2 = Math.abs((c2.x - p0.x) * dy - (c2.y - p0.y) * dx)
  if (cross1 > 1e-9 * Math.sqrt(len2) || cross2 > 1e-9 * Math.sqrt(len2)) return false
  const t1 = ((c1.x - p0.x) * dx + (c1.y - p0.y) * dy) / len2
  const t2 = ((c2.x - p0.x) * dx + (c2.y - p0.y) * dy) / len2
  return t1 >= -1e-9 && t1 <= 1 + 1e-9 && t2 >= -1e-9 && t2 <= 1 + 1e-9
}

export function subdivideCubicAdaptive(
  p0: Point, c1: Point, c2: Point, p3: Point,
  opts: SubdivideOptions,
): number[] {
  if (isStraightCubic(p0, c1, c2, p3)) return [0, 1]

  const maxDepth = opts.maxDepth ?? 16
  const arcLengthChordRatio = opts.arcLengthChordRatio ?? 0.05
  const full: Required<SubdivideOptions> = { ...opts, maxDepth, arcLengthChordRatio }

  const out: number[] = [0]
  collectTValues({ p0, c1, c2, p3 }, 0, 1, full, 0, out)

  const deduped: number[] = [out[0]!]
  for (let i = 1; i < out.length; i++) {
    if (out[i]! - deduped[deduped.length - 1]! > 1e-9) {
      deduped.push(out[i]!)
    }
  }

  if (deduped[deduped.length - 1]! < 1 - 1e-9) {
    deduped.push(1)
  }

  return deduped
}
