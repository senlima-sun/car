import { Vector3 } from 'three'
import { TRACK_LAYER_Y_OFFSETS } from '@/constants/trackLayers'
import type { TrackRibbonPoint } from '@/types/trackObjects'
import { computeRibbonTangents, type Tangent2D } from './ribbonMath'
import { segmentIntersect2D } from './segmentIntersect'

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

const RIBBON_MIN_STEP_M = 0.25
const LOOP_WINDOW_FLOOR = 128

function loopWindowFor(maxOffsetReach: number, sampleCount: number): number {
  const derived = Math.ceil((Math.PI * maxOffsetReach) / RIBBON_MIN_STEP_M)
  const margin = Math.ceil(derived * 1.25)
  return Math.min(sampleCount, Math.max(LOOP_WINDOW_FLOOR, margin))
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
    let visited = 0
    while (visited < iLimit) {
      const segA0Idx = i
      const segA1Idx = closed ? (i + 1) % n : i + 1
      if (!closed && segA1Idx >= n) break
      const segA0 = arr[segA0Idx]!
      const segA1 = arr[segA1Idx]!

      let found = false
      for (let step = 2; step < window; step++) {
        const j = closed ? (i + step) % n : i + step
        const jNext = closed ? (i + step + 1) % n : i + step + 1
        if (!closed && jNext >= n) break
        if (closed && (j === i || jNext === i)) break

        const segB0 = arr[j]!
        const segB1 = arr[jNext]!

        const hit = segmentIntersect2D(
          { x: segA0.x, z: segA0.z },
          { x: segA1.x, z: segA1.z },
          { x: segB0.x, z: segB0.z },
          { x: segB1.x, z: segB1.z },
        )

        if (hit) {
          const fanY = segA0.y + (segA1.y - segA0.y) * hit.t
          for (let s = 1; s <= step; s++) {
            const kWrap = closed ? (i + s) % n : i + s
            if (kWrap === segA0Idx) break
            arr[kWrap]!.x = hit.point.x
            arr[kWrap]!.y = fanY
            arr[kWrap]!.z = hit.point.z
            stats.collapsed++
          }
          i = closed ? (i + step) % n : i + step
          visited += step
          found = true
          break
        }
      }

      if (!found) {
        i = closed ? (i + 1) % n : i + 1
        visited++
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

  const { stats } = cleanInsideCornerSelfIntersections(left, right, closed, halfWidth)

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
