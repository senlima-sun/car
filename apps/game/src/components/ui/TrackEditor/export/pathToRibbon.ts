import type { Anchor, Path } from '../geometry/types'
import { resolveAnchor } from '../geometry/path'
import { eq } from '../geometry/point'
import type { PlacedObject, TrackRibbonPoint } from '@/types/trackObjects'
import { TRACK_WIDTH } from '@/constants/dimensions'
import { useTerrainStore } from '@/stores/useTerrainStore'

const SAMPLE_SPACING_METERS = 1

type Vec2 = { x: number; y: number }

function cubicPoint(p0: Vec2, c1: Vec2, c2: Vec2, p3: Vec2, t: number): Vec2 {
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
  }
}

function segmentEndpoints(from: Anchor, to: Anchor): { p0: Vec2; c1: Vec2; c2: Vec2; p3: Vec2 } {
  const hasOut = !eq(from.outHandle, from.point)
  const hasIn = !eq(to.inHandle, to.point)
  return {
    p0: from.point,
    c1: hasOut ? from.outHandle : from.point,
    c2: hasIn ? to.inHandle : to.point,
    p3: to.point,
  }
}

function segmentLength(from: Anchor, to: Anchor): number {
  const { p0, c1, c2, p3 } = segmentEndpoints(from, to)
  const isStraight = eq(c1, p0) && eq(c2, p3)
  if (isStraight) {
    return Math.hypot(p3.x - p0.x, p3.y - p0.y)
  }
  let total = 0
  const SAMPLES = 32
  let prev = p0
  for (let i = 1; i <= SAMPLES; i++) {
    const t = i / SAMPLES
    const cur = cubicPoint(p0, c1, c2, p3, t)
    total += Math.hypot(cur.x - prev.x, cur.y - prev.y)
    prev = cur
  }
  return total
}

function sampleSegmentDense(
  from: Anchor,
  to: Anchor,
  isPit: boolean,
  includeStart: boolean,
): TrackRibbonPoint[] {
  const { p0, c1, c2, p3 } = segmentEndpoints(from, to)
  const isStraight = eq(c1, p0) && eq(c2, p3)
  const length = segmentLength(from, to)
  const steps = Math.max(2, Math.ceil(length / SAMPLE_SPACING_METERS))
  const out: TrackRibbonPoint[] = []
  const startI = includeStart ? 0 : 1
  for (let i = startI; i <= steps; i++) {
    const t = i / steps
    const pt = isStraight
      ? { x: p0.x + (p3.x - p0.x) * t, y: p0.y + (p3.y - p0.y) * t }
      : cubicPoint(p0, c1, c2, p3, t)
    out.push({
      x: pt.x,
      y: useTerrainStore.getState().getHeightAt(pt.x, pt.y),
      z: pt.y,
      isPitLane: isPit,
    })
  }
  return out
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function pathToRibbon(path: Path, allPaths: Path[] = [path]): PlacedObject | null {
  const { anchors, closed } = path
  if (anchors.length < 2) return null
  const resolved: (Anchor | null)[] = anchors.map(a => resolveAnchor(allPaths, a))
  const pitSet = new Set(path.pitLaneSegments ?? [])

  const points: TrackRibbonPoint[] = []
  for (let i = 1; i < anchors.length; i++) {
    const from = resolved[i - 1]
    const to = resolved[i]
    if (!from || !to) continue
    const isPit = pitSet.has(i - 1)
    const includeStart = i === 1
    points.push(...sampleSegmentDense(from, to, isPit, includeStart))
  }
  if (closed && anchors.length > 1) {
    const closingIndex = anchors.length - 1
    const from = resolved[closingIndex]
    const to = resolved[0]
    if (from && to) {
      const isPit = pitSet.has(closingIndex)
      points.push(...sampleSegmentDense(from, to, isPit, false))
    }
  }

  if (points.length < 2) return null

  if (closed && points.length > 1) {
    const first = points[0]!
    const last = points[points.length - 1]!
    if (Math.hypot(first.x - last.x, first.z - last.z) < SAMPLE_SPACING_METERS * 0.6) {
      points.pop()
    }
  }

  let sumX = 0
  let sumY = 0
  let sumZ = 0
  for (const p of points) {
    sumX += p.x
    sumY += p.y
    sumZ += p.z
  }
  const centerX = sumX / points.length
  const centerY = sumY / points.length
  const centerZ = sumZ / points.length

  return {
    id: genId('ribbon'),
    type: 'track_ribbon',
    position: [centerX, centerY, centerZ],
    rotation: 0,
    width: TRACK_WIDTH,
    ribbonPoints: points,
    ribbonClosed: closed,
  }
}

export function documentToRibbons(paths: Path[]): PlacedObject[] {
  const out: PlacedObject[] = []
  for (const p of paths) {
    const ribbon = pathToRibbon(p, paths)
    if (ribbon) out.push(ribbon)
  }
  return out
}
