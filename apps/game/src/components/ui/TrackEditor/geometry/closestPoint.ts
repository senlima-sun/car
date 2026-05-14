import type { Anchor, Path, Point } from './types'
import { eq } from './point'
import { resolveAnchor } from './path'

export type ClosestPoint = {
  pathId: string
  segmentIndex: number
  t: number
  point: Point
  tangent: Point
  distance: number
}

export function sampleSegment(from: Anchor, to: Anchor, t: number): Point {
  const hasOut = !eq(from.outHandle, from.point)
  const hasIn = !eq(to.inHandle, to.point)
  const c1 = hasOut ? from.outHandle : from.point
  const c2 = hasIn ? to.inHandle : to.point
  const u = 1 - t
  return {
    x:
      u * u * u * from.point.x +
      3 * u * u * t * c1.x +
      3 * u * t * t * c2.x +
      t * t * t * to.point.x,
    y:
      u * u * u * from.point.y +
      3 * u * u * t * c1.y +
      3 * u * t * t * c2.y +
      t * t * t * to.point.y,
  }
}

export function segmentTangent(from: Anchor, to: Anchor, t: number): Point {
  const hasOut = !eq(from.outHandle, from.point)
  const hasIn = !eq(to.inHandle, to.point)
  const c1 = hasOut ? from.outHandle : from.point
  const c2 = hasIn ? to.inHandle : to.point
  const u = 1 - t
  const tx =
    3 * u * u * (c1.x - from.point.x) + 6 * u * t * (c2.x - c1.x) + 3 * t * t * (to.point.x - c2.x)
  const ty =
    3 * u * u * (c1.y - from.point.y) + 6 * u * t * (c2.y - c1.y) + 3 * t * t * (to.point.y - c2.y)
  const len = Math.hypot(tx, ty)
  if (len < 1e-9) {
    const dx = to.point.x - from.point.x
    const dy = to.point.y - from.point.y
    const fallback = Math.hypot(dx, dy)
    if (fallback < 1e-9) return { x: 1, y: 0 }
    return { x: dx / fallback, y: dy / fallback }
  }
  return { x: tx / len, y: ty / len }
}

function segmentAnchorPair(
  path: Path,
  segmentIndex: number,
  allPaths: Path[],
): [Anchor, Anchor] | null {
  const { anchors, closed } = path
  if (anchors.length < 2) return null
  if (segmentIndex < 0) return null
  if (segmentIndex < anchors.length - 1) {
    const from = resolveAnchor(allPaths, anchors[segmentIndex]!)
    const to = resolveAnchor(allPaths, anchors[segmentIndex + 1]!)
    if (!from || !to) return null
    return [from, to]
  }
  if (closed && segmentIndex === anchors.length - 1) {
    const from = resolveAnchor(allPaths, anchors[anchors.length - 1]!)
    const to = resolveAnchor(allPaths, anchors[0]!)
    if (!from || !to) return null
    return [from, to]
  }
  return null
}

export function segmentCount(path: Path): number {
  if (path.anchors.length < 2) return 0
  return path.closed ? path.anchors.length : path.anchors.length - 1
}

export function pointOnPath(
  path: Path,
  segmentIndex: number,
  t: number,
  allPaths: Path[] = [path],
): { point: Point; tangent: Point } | null {
  const pair = segmentAnchorPair(path, segmentIndex, allPaths)
  if (!pair) return null
  return {
    point: sampleSegment(pair[0], pair[1], t),
    tangent: segmentTangent(pair[0], pair[1], t),
  }
}

export function pointOnPathAt(
  path: Path,
  pathPos: number,
  allPaths: Path[] = [path],
): { point: Point; tangent: Point } | null {
  const segCount = segmentCount(path)
  if (segCount === 0) return null
  const clamped = Math.max(0, Math.min(pathPos, segCount - 1e-9))
  const segIndex = Math.floor(clamped)
  const localT = clamped - segIndex
  return pointOnPath(path, segIndex, localT, allPaths)
}

const COARSE_SAMPLES = 32
const REFINE_ITERATIONS = 18

function distSq(a: Point, b: Point): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

export function closestPointOnPath(
  path: Path,
  query: Point,
  allPaths: Path[] = [path],
): ClosestPoint | null {
  const segCount = segmentCount(path)
  if (segCount === 0) return null

  let bestSeg = 0
  let bestT = 0
  let bestDistSq = Infinity

  for (let si = 0; si < segCount; si++) {
    const pair = segmentAnchorPair(path, si, allPaths)
    if (!pair) continue
    for (let i = 0; i <= COARSE_SAMPLES; i++) {
      const t = i / COARSE_SAMPLES
      const pt = sampleSegment(pair[0], pair[1], t)
      const d = distSq(pt, query)
      if (d < bestDistSq) {
        bestDistSq = d
        bestSeg = si
        bestT = t
      }
    }
  }

  const pair = segmentAnchorPair(path, bestSeg, allPaths)
  if (!pair) return null
  let lo = Math.max(0, bestT - 1 / COARSE_SAMPLES)
  let hi = Math.min(1, bestT + 1 / COARSE_SAMPLES)
  for (let i = 0; i < REFINE_ITERATIONS; i++) {
    const m1 = lo + (hi - lo) / 3
    const m2 = hi - (hi - lo) / 3
    const d1 = distSq(sampleSegment(pair[0], pair[1], m1), query)
    const d2 = distSq(sampleSegment(pair[0], pair[1], m2), query)
    if (d1 < d2) hi = m2
    else lo = m1
  }
  const t = (lo + hi) / 2
  const point = sampleSegment(pair[0], pair[1], t)
  const tangent = segmentTangent(pair[0], pair[1], t)

  return {
    pathId: path.id,
    segmentIndex: bestSeg,
    t,
    point,
    tangent,
    distance: Math.sqrt(distSq(point, query)),
  }
}

export function closestPointOnAnyPath(
  paths: Path[],
  query: Point,
  allPaths: Path[] = paths,
): ClosestPoint | null {
  let best: ClosestPoint | null = null
  for (const p of paths) {
    const c = closestPointOnPath(p, query, allPaths)
    if (!c) continue
    if (!best || c.distance < best.distance) best = c
  }
  return best
}
