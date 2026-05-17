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

const LOOP_WINDOW_MAX = 128

export function cleanInsideCornerSelfIntersections(
  left: Vector3[],
  right: Vector3[],
  closed: boolean,
): { left: Vector3[]; right: Vector3[]; stats: CleanupStats } {
  const stats: CleanupStats = { collapsed: 0 }

  for (const arr of [left, right]) {
    const n = arr.length
    let i = 0
    while (i < n - 1) {
      const segA0 = arr[i]!
      const segA1Idx = closed ? (i + 1) % n : i + 1
      const segA1 = arr[segA1Idx]!

      let found = false
      const jMax = Math.min(n, i + LOOP_WINDOW_MAX)
      for (let j = i + 2; j < jMax; j++) {
        const jWrap = closed ? j % n : j
        const jNext = closed ? (j + 1) % n : j + 1

        if (!closed && jNext >= n) break
        if (closed && jWrap === i) break

        const segB0 = arr[jWrap]!
        const segB1 = arr[jNext]!

        const hit = segmentIntersect2D(
          { x: segA0.x, z: segA0.z },
          { x: segA1.x, z: segA1.z },
          { x: segB0.x, z: segB0.z },
          { x: segB1.x, z: segB1.z },
        )

        if (hit) {
          const collapseEnd = jWrap
          let k = i + 1
          while (true) {
            const kWrap = closed ? k % n : k
            arr[kWrap]!.x = hit.point.x
            arr[kWrap]!.z = hit.point.z
            stats.collapsed++
            if (kWrap === collapseEnd) break
            k++
            if (!closed && k >= n) break
          }
          i = jWrap
          found = true
          break
        }
      }

      if (!found) i++
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

  const { stats } = cleanInsideCornerSelfIntersections(left, right, closed)

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
