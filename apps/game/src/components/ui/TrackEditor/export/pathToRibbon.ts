import type { Anchor, Path, Point } from '../geometry/types'
import { resolveAnchor } from '../geometry/path'
import { eq } from '../geometry/point'
import type { PlacedObject, TrackRibbonPoint, TrackRibbonPoint2D } from '@/types/trackObjects'
import { TRACK_WIDTH } from '@/constants/dimensions'
import { useTerrainStore } from '@/stores/useTerrainStore'
import { subdivideCubicAdaptive, cubicPoint } from './bezierSubdivide'

export const RIBBON_MAX_CHORD_ERROR_M = 0.05
export const RIBBON_MIN_STEP_M = 0.25
export const RIBBON_MAX_STEP_M = 4.0

function segmentEndpoints(from: Anchor, to: Anchor): { p0: Point; c1: Point; c2: Point; p3: Point } {
  const hasOut = !eq(from.outHandle, from.point)
  const hasIn = !eq(to.inHandle, to.point)
  return {
    p0: from.point,
    c1: hasOut ? from.outHandle : from.point,
    c2: hasIn ? to.inHandle : to.point,
    p3: to.point,
  }
}

function sampleStraight2D(p0: Point, p3: Point): { points: Point[]; ts: number[] } {
  const chordLen = Math.hypot(p3.x - p0.x, p3.y - p0.y)
  const steps = Math.max(1, Math.ceil(chordLen / RIBBON_MAX_STEP_M))
  const points: Point[] = []
  const ts: number[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    points.push({ x: p0.x + (p3.x - p0.x) * t, y: p0.y + (p3.y - p0.y) * t })
    ts.push(t)
  }
  return { points, ts }
}

function sampleCubic2D(p0: Point, c1: Point, c2: Point, p3: Point): { points: Point[]; ts: number[] } {
  const ts = subdivideCubicAdaptive(p0, c1, c2, p3, {
    maxChordError: RIBBON_MAX_CHORD_ERROR_M,
    minStep: RIBBON_MIN_STEP_M,
    maxStep: RIBBON_MAX_STEP_M,
    maxDepth: 16,
    arcLengthChordRatio: 0.05,
  })
  const points: Point[] = []
  for (let i = 0; i < ts.length; i++) {
    points.push(cubicPoint(p0, c1, c2, p3, ts[i]!))
  }
  return { points, ts }
}

function sampleSegment2D(
  from: Anchor,
  to: Anchor,
  isPit: boolean,
  includeStart: boolean,
): TrackRibbonPoint2D[] {
  const { p0, c1, c2, p3 } = segmentEndpoints(from, to)
  const handlesCollapsed = eq(c1, p0) && eq(c2, p3)
  const { points, ts } = handlesCollapsed
    ? sampleStraight2D(p0, p3)
    : sampleCubic2D(p0, c1, c2, p3)
  const startIdx = includeStart ? 0 : 1
  const out: TrackRibbonPoint2D[] = []
  const hasElevation = from.elevation !== undefined && to.elevation !== undefined
  for (let i = startIdx; i < points.length; i++) {
    const pt = points[i]!
    const t = ts[i]!
    const elevation = hasElevation ? from.elevation! + (to.elevation! - from.elevation!) * t : undefined
    out.push({ x: pt.x, z: pt.y, isPitLane: isPit, elevation })
  }
  return out
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function hasFiniteAnchors(anchors: (Anchor | null)[]): boolean {
  for (const a of anchors) {
    if (!a) continue
    if (!isFinite(a.point.x) || !isFinite(a.point.y)) return false
    if (!isFinite(a.inHandle.x) || !isFinite(a.inHandle.y)) return false
    if (!isFinite(a.outHandle.x) || !isFinite(a.outHandle.y)) return false
  }
  return true
}

function logRibbonTelemetry(pathId: string, points: TrackRibbonPoint[]): void {
  if (!import.meta.env.DEV) return
  if (!(globalThis as { __RIBBON_SAMPLER_TELEMETRY?: boolean }).__RIBBON_SAMPLER_TELEMETRY) return
  let totalDist = 0
  let maxStep = 0
  let minStep = Infinity
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.z - points[i - 1]!.z)
    totalDist += d
    if (d > maxStep) maxStep = d
    if (d < minStep) minStep = d
  }
  const meanStep = points.length > 1 ? totalDist / (points.length - 1) : 0
  console.debug('[ribbon-sampler]', { path: pathId, samples: points.length, meanStep, maxStep, minStep })
}

/** @deprecated Phase 3+ ribbons resolve y at render time; use pathToRibbon2D. Removed in Phase 6.1. */
export function pathToRibbon(path: Path, allPaths: Path[] = [path]): PlacedObject | null {
  const flat = pathToRibbon2D(path, allPaths)
  if (!flat) return null

  const flatPoints = flat.ribbonPoints!
  const getHeightAt = useTerrainStore.getState().getHeightAt
  let sumY = 0
  const points: TrackRibbonPoint[] = flatPoints.map(p => {
    const y = getHeightAt(p.x, p.z)
    sumY += y
    return { x: p.x, y, z: p.z, isPitLane: p.isPitLane }
  })
  const centerY = sumY / points.length

  logRibbonTelemetry(path.id, points)

  return {
    ...flat,
    position: [flat.position[0], centerY, flat.position[2]],
    ribbonPoints: points,
  }
}

export function documentToRibbons(paths: Path[]): PlacedObject[] {
  const out: PlacedObject[] = []
  for (const p of paths) {
    const ribbon = pathToRibbon2D(p, paths)
    if (ribbon) out.push(ribbon)
  }
  return out
}

export function pathToRibbon2D(path: Path, allPaths: Path[] = [path]): PlacedObject | null {
  const { anchors, closed } = path
  if (anchors.length < 2) return null
  const resolved: (Anchor | null)[] = anchors.map(a => resolveAnchor(allPaths, a))
  if (!hasFiniteAnchors(resolved)) return null
  const pitSet = new Set(path.pitLaneSegments ?? [])

  const points: TrackRibbonPoint2D[] = []
  for (let i = 1; i < anchors.length; i++) {
    const from = resolved[i - 1]
    const to = resolved[i]
    if (!from || !to) continue
    const isPit = pitSet.has(i - 1)
    const includeStart = i === 1
    points.push(...sampleSegment2D(from, to, isPit, includeStart))
  }
  if (closed && anchors.length > 1) {
    const closingIndex = anchors.length - 1
    const from = resolved[closingIndex]
    const to = resolved[0]
    if (from && to) {
      const isPit = pitSet.has(closingIndex)
      points.push(...sampleSegment2D(from, to, isPit, false))
    }
  }

  if (points.length < 2) return null

  if (closed && points.length > 1) {
    const first = points[0]!
    const last = points[points.length - 1]!
    if (Math.hypot(first.x - last.x, first.z - last.z) < RIBBON_MIN_STEP_M) {
      points.pop()
    }
  }

  let sumX = 0
  let sumZ = 0
  for (const p of points) {
    sumX += p.x
    sumZ += p.z
  }
  const centerX = sumX / points.length
  const centerZ = sumZ / points.length

  const ribbonPoints: TrackRibbonPoint[] = points.map(p => ({
    x: p.x,
    y: 0,
    z: p.z,
    isPitLane: p.isPitLane,
    elevation: p.elevation,
  }))

  return {
    id: genId('ribbon'),
    type: 'track_ribbon',
    position: [centerX, 0, centerZ],
    rotation: 0,
    width: TRACK_WIDTH,
    ribbonPoints,
    ribbonClosed: closed,
  }
}
