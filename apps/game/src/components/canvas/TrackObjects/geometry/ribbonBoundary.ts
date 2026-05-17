import { Vector3 } from 'three'
import { TRACK_LAYER_Y_OFFSETS } from '@/constants/trackLayers'
import type { TrackRibbonPoint } from '@/types/trackObjects'
import { computeRibbonTangents, computeRibbonMiterScales, type Tangent2D } from './ribbonMath'

export interface RibbonBoundary {
  centerline: TrackRibbonPoint[]
  left: Vector3[]
  right: Vector3[]
  tangents: Tangent2D[]
  arcLength: number[]
  totalArcLength: number
  closed: boolean
  width: number
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
  const miters = computeRibbonMiterScales(points, closed, tangents)

  const left: Vector3[] = []
  const right: Vector3[] = []
  const arcLength: number[] = [0]

  for (let i = 0; i < n; i++) {
    const p = points[i]!
    const tan = tangents[i]!
    const m = miters[i]!
    const nx = -tan.z * m
    const nz = tan.x * m

    left.push(new Vector3(p.x + nx * halfWidth, p.y + yOffset, p.z + nz * halfWidth))
    right.push(new Vector3(p.x - nx * halfWidth, p.y + yOffset, p.z - nz * halfWidth))

    if (i > 0) {
      const prev = points[i - 1]!
      const dx = p.x - prev.x
      const dz = p.z - prev.z
      arcLength.push(arcLength[i - 1]! + Math.hypot(dx, dz))
    }
  }

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
  }
}
