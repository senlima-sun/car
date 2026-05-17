import { Vector3 } from 'three'
import { TRACK_LAYER_Y_OFFSETS } from '@/constants/trackLayers'
import type { TrackRibbonPoint } from '@/types/trackObjects'
import { RIBBON_MIN_STEP_M } from '@/components/ui/TrackEditor/export/pathToRibbon'
import { computeRibbonTangents, type Tangent2D } from './ribbonMath'
import { segmentIntersect2D, type SegmentIntersection } from './segmentIntersect'

export interface CleanupStats {
  collapsed: number
}

export interface RibbonBoundary {
  centerline: TrackRibbonPoint[]
  left: Vector3[]
  right: Vector3[]
  tangents: Tangent2D[]
  arcLength: number[]
  totalArcLength: number
  closed: boolean
  width: number
  cleanupStats: CleanupStats
}

const LOOP_WINDOW_FLOOR = 128
const LOOP_WINDOW_SAFETY_MARGIN = 1.25

function loopWindowFor(maxOffsetReach: number, sampleCount: number): number {
  const derived = Math.ceil((Math.PI * maxOffsetReach) / RIBBON_MIN_STEP_M)
  const margin = Math.ceil(derived * LOOP_WINDOW_SAFETY_MARGIN)
  return Math.min(sampleCount, Math.max(LOOP_WINDOW_FLOOR, margin))
}

function hasSharpInsideCorner(
  tangents: Tangent2D[],
  closed: boolean,
  halfWidth: number,
): boolean {
  if (halfWidth <= 0) return false
  const n = tangents.length
  const limit = closed ? n : n - 1
  const ratio = RIBBON_MIN_STEP_M / (2 * halfWidth)
  if (ratio >= 1) return false
  const cosThreshold = Math.cos(2 * Math.asin(ratio))
  for (let i = 0; i < limit; i++) {
    const a = tangents[i]!
    const b = tangents[closed ? (i + 1) % n : i + 1]!
    const dot = a.x * b.x + a.z * b.z
    if (dot < cosThreshold) return true
  }
  return false
}

interface ScanHit {
  step: number
  hit: SegmentIntersection
}

function scanForLoopIntersection(
  arr: Vector3[],
  i: number,
  window: number,
  closed: boolean,
  n: number,
): ScanHit | null {
  const segA0 = arr[i]!
  const segA1 = arr[closed ? (i + 1) % n : i + 1]!
  for (let step = 2; step < window; step++) {
    const j = closed ? (i + step) % n : i + step
    const jNext = closed ? (i + step + 1) % n : i + step + 1
    if (!closed && jNext >= n) return null
    if (closed && (j === i || jNext === i)) return null

    const segB0 = arr[j]!
    const segB1 = arr[jNext]!

    const hit = segmentIntersect2D(
      { x: segA0.x, z: segA0.z },
      { x: segA1.x, z: segA1.z },
      { x: segB0.x, z: segB0.z },
      { x: segB1.x, z: segB1.z },
    )

    if (hit) return { step, hit }
  }
  return null
}

function collapseRange(
  arr: Vector3[],
  startIdx: number,
  step: number,
  hitPoint: { x: number; z: number },
  fanY: number,
  closed: boolean,
  n: number,
  stats: CleanupStats,
): void {
  for (let s = 1; s <= step; s++) {
    const kWrap = closed ? (startIdx + s) % n : startIdx + s
    if (kWrap === startIdx) break
    arr[kWrap]!.x = hitPoint.x
    arr[kWrap]!.y = fanY
    arr[kWrap]!.z = hitPoint.z
    stats.collapsed++
  }
}

export function cleanInsideCornerSelfIntersections(
  left: Vector3[],
  right: Vector3[],
  closed: boolean,
  maxOffsetReach?: number,
): { left: Vector3[]; right: Vector3[]; stats: CleanupStats } {
  const stats: CleanupStats = { collapsed: 0 }
  const n = left.length
  const window = loopWindowFor(maxOffsetReach ?? 12, n)
  const iLimit = closed ? n : n - 1

  for (const arr of [left, right]) {
    let i = 0
    let samplesProcessed = 0
    while (samplesProcessed < iLimit) {
      if (!closed && i + 1 >= n) break

      const scan = scanForLoopIntersection(arr, i, window, closed, n)
      if (scan) {
        const segA0 = arr[i]!
        const segA1 = arr[closed ? (i + 1) % n : i + 1]!
        const fanY = segA0.y + (segA1.y - segA0.y) * scan.hit.t
        collapseRange(arr, i, scan.step, scan.hit.point, fanY, closed, n, stats)
        i = closed ? (i + scan.step) % n : i + scan.step
        samplesProcessed += scan.step
      } else {
        i = closed ? (i + 1) % n : i + 1
        samplesProcessed++
      }
    }
  }

  return { left, right, stats }
}

export function buildRibbonBoundary(
  points: TrackRibbonPoint[],
  closed: boolean,
  width: number,
  yOffset = TRACK_LAYER_Y_OFFSETS.ASPHALT,
): RibbonBoundary | null {
  if (points.length < 2 || width <= 0 || !isFinite(width) || isNaN(width)) return null

  const n = points.length
  const halfWidth = width / 2
  const tangents = computeRibbonTangents(points, closed)

  const left: Vector3[] = []
  const right: Vector3[] = []
  const arcLength: number[] = [0]

  for (let i = 0; i < n; i++) {
    const p = points[i]!
    const tan = tangents[i]!
    const nx = -tan.z
    const nz = tan.x

    left.push(new Vector3(p.x + nx * halfWidth, p.y + yOffset, p.z + nz * halfWidth))
    right.push(new Vector3(p.x - nx * halfWidth, p.y + yOffset, p.z - nz * halfWidth))

    if (i > 0) {
      const prev = points[i - 1]!
      const dx = p.x - prev.x
      const dz = p.z - prev.z
      arcLength.push(arcLength[i - 1]! + Math.hypot(dx, dz))
    }
  }

  const stats: CleanupStats = hasSharpInsideCorner(tangents, closed, halfWidth)
    ? cleanInsideCornerSelfIntersections(left, right, closed, halfWidth).stats
    : { collapsed: 0 }

  let totalArcLength = arcLength[n - 1]!
  if (closed) {
    const last = points[n - 1]!
    const first = points[0]!
    totalArcLength += Math.hypot(last.x - first.x, last.z - first.z)
  }

  return {
    centerline: points,
    left,
    right,
    tangents,
    arcLength,
    totalArcLength,
    closed,
    width,
    cleanupStats: stats,
  }
}
