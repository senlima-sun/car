import type { Anchor, Path } from '../geometry/types'
import { resolveAnchor } from '../geometry/path'
import { eq } from '../geometry/point'
import type { PlacedObject, TrackRibbonPoint } from '@/types/trackObjects'
import { TRACK_WIDTH } from '@/constants/dimensions'
import { useTerrainStore } from '@/stores/useTerrainStore'
import { subdivideCubicAdaptive, cubicPoint } from './bezierSubdivide'
import type { Vec2 } from './bezierSubdivide'

export const RIBBON_MAX_CHORD_ERROR_M = 0.05
export const RIBBON_MIN_STEP_M = 0.25
export const RIBBON_MAX_STEP_M = 4.0

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

function sampleSegmentDense(
  from: Anchor,
  to: Anchor,
  isPit: boolean,
  includeStart: boolean,
): TrackRibbonPoint[] {
  const { p0, c1, c2, p3 } = segmentEndpoints(from, to)
  const isStraight = eq(c1, p0) && eq(c2, p3)

  const toPoint = (pt: Vec2): TrackRibbonPoint => ({
    x: pt.x,
    y: useTerrainStore.getState().getHeightAt(pt.x, pt.y),
    z: pt.y,
    isPitLane: isPit,
  })

  if (isStraight) {
    const chordLen = Math.hypot(p3.x - p0.x, p3.y - p0.y)
    const steps = Math.max(1, Math.ceil(chordLen / RIBBON_MAX_STEP_M))
    const out: TrackRibbonPoint[] = []
    const startIdx = includeStart ? 0 : 1
    for (let i = startIdx; i <= steps; i++) {
      const t = i / steps
      out.push(toPoint({ x: p0.x + (p3.x - p0.x) * t, y: p0.y + (p3.y - p0.y) * t }))
    }
    return out
  }

  const ts = subdivideCubicAdaptive(p0, c1, c2, p3, {
    maxChordError: RIBBON_MAX_CHORD_ERROR_M,
    minStep: RIBBON_MIN_STEP_M,
    maxStep: RIBBON_MAX_STEP_M,
    maxDepth: 16,
    arcLengthChordRatio: 0.05,
  })

  const startIdx = includeStart ? 0 : 1
  const out: TrackRibbonPoint[] = []
  for (let i = startIdx; i < ts.length; i++) {
    out.push(toPoint(cubicPoint(p0, c1, c2, p3, ts[i]!)))
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

export function pathToRibbon(path: Path, allPaths: Path[] = [path]): PlacedObject | null {
  const { anchors, closed } = path
  if (anchors.length < 2) return null
  const resolved: (Anchor | null)[] = anchors.map(a => resolveAnchor(allPaths, a))
  if (!hasFiniteAnchors(resolved)) return null
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
    if (Math.hypot(first.x - last.x, first.z - last.z) < RIBBON_MIN_STEP_M) {
      points.pop()
    }
  }

  if (import.meta.env.DEV && (globalThis as { __RIBBON_SAMPLER_TELEMETRY?: boolean }).__RIBBON_SAMPLER_TELEMETRY) {
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
    console.debug('[ribbon-sampler]', { path: path.id, samples: points.length, meanStep, maxStep, minStep })
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
