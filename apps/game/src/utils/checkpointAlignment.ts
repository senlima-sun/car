import type { PlacedObject, TrackRibbonPoint } from '../types/trackObjects'
import { isCurveMode } from '../types/trackObjects'

export interface AlignmentResult {
  startPoint: [number, number, number]
  endPoint: [number, number, number]
  flipped: boolean
}

export interface RealignmentResult {
  startPoint: [number, number, number]
  endPoint: [number, number, number]
  midpoint: [number, number, number]
  rotation: number
  flipped: boolean
}

const SEARCH_RADIUS = 50

export const alignCheckpointToRoad = (
  startPoint: [number, number, number],
  endPoint: [number, number, number],
  roads: PlacedObject[],
): AlignmentResult => {
  const cx = (startPoint[0] + endPoint[0]) / 2
  const cz = (startPoint[2] + endPoint[2]) / 2

  const tangent = findNearestRoadTangent(cx, cz, roads)
  if (!tangent) return { startPoint, endPoint, flipped: false }

  const dx = endPoint[0] - startPoint[0]
  const dz = endPoint[2] - startPoint[2]
  const len = Math.sqrt(dx * dx + dz * dz)
  if (len < 1e-6) return { startPoint, endPoint, flipped: false }

  const normalX = -dz / len
  const normalZ = dx / len

  const dot = normalX * tangent[0] + normalZ * tangent[2]

  if (dot < 0) {
    return { startPoint: endPoint, endPoint: startPoint, flipped: true }
  }

  return { startPoint, endPoint, flipped: false }
}

const findNearestRoadTangent = (
  x: number,
  z: number,
  roads: PlacedObject[],
): [number, number, number] | null => {
  let bestTangent: [number, number, number] | null = null
  let bestDist = SEARCH_RADIUS

  for (const road of roads) {
    if (road.type !== 'road' || !road.startPoint || !road.endPoint) continue

    if (isCurveMode(road.trackMode) && road.controlPoint) {
      const result = findNearestOnCurve(x, z, road.startPoint, road.controlPoint, road.endPoint)
      if (result && result.dist < bestDist) {
        bestDist = result.dist
        bestTangent = result.tangent
      }
    } else {
      const result = findNearestOnLine(x, z, road.startPoint, road.endPoint)
      if (result && result.dist < bestDist) {
        bestDist = result.dist
        bestTangent = result.tangent
      }
    }
  }

  return bestTangent
}

const findNearestOnLine = (
  x: number,
  z: number,
  start: [number, number, number],
  end: [number, number, number],
): { dist: number; tangent: [number, number, number] } | null => {
  const dx = end[0] - start[0]
  const dz = end[2] - start[2]
  const len = Math.sqrt(dx * dx + dz * dz)
  if (len < 1e-6) return null

  const dirX = dx / len
  const dirZ = dz / len

  const toX = x - start[0]
  const toZ = z - start[2]
  const proj = toX * dirX + toZ * dirZ

  const t = Math.max(0, Math.min(len, proj))
  const closestX = start[0] + dirX * t
  const closestZ = start[2] + dirZ * t

  const dist = Math.sqrt((x - closestX) ** 2 + (z - closestZ) ** 2)
  return { dist, tangent: [dirX, 0, dirZ] }
}

const findNearestOnCurve = (
  x: number,
  z: number,
  start: [number, number, number],
  control: [number, number, number],
  end: [number, number, number],
): { dist: number; tangent: [number, number, number] } | null => {
  const SAMPLES = 32
  let bestDist = Infinity
  let bestTangent: [number, number, number] | null = null

  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES
    const t1 = 1 - t

    const curveX = t1 * t1 * start[0] + 2 * t1 * t * control[0] + t * t * end[0]
    const curveZ = t1 * t1 * start[2] + 2 * t1 * t * control[2] + t * t * end[2]

    const dist = Math.sqrt((x - curveX) ** 2 + (z - curveZ) ** 2)

    if (dist < bestDist) {
      bestDist = dist

      const tangentX = 2 * t1 * (control[0] - start[0]) + 2 * t * (end[0] - control[0])
      const tangentZ = 2 * t1 * (control[2] - start[2]) + 2 * t * (end[2] - control[2])
      const tangentLen = Math.sqrt(tangentX * tangentX + tangentZ * tangentZ)

      if (tangentLen > 1e-6) {
        bestTangent = [tangentX / tangentLen, 0, tangentZ / tangentLen]
      }
    }
  }

  if (!bestTangent) return null
  return { dist: bestDist, tangent: bestTangent }
}

export const realignCheckpointToRibbons = (
  midpoint: [number, number, number],
  desiredDirection: [number, number, number] | null,
  lineLength: number,
  ribbons: PlacedObject[],
): RealignmentResult | null => {
  const nearest = findNearestRibbonPoint(midpoint[0], midpoint[2], ribbons)
  if (!nearest) return null

  const halfLen = lineLength / 2
  let lineX = -nearest.tangent[2]
  let lineZ = nearest.tangent[0]
  let flipped = false

  if (desiredDirection) {
    const normalAlongTangent =
      nearest.tangent[0] * desiredDirection[0] + nearest.tangent[2] * desiredDirection[2]
    if (normalAlongTangent < 0) {
      lineX = -lineX
      lineZ = -lineZ
      flipped = true
    }
  }

  const newMidpoint: [number, number, number] = [nearest.point[0], nearest.point[1], nearest.point[2]]
  const startPoint: [number, number, number] = [
    newMidpoint[0] + lineX * halfLen,
    newMidpoint[1],
    newMidpoint[2] + lineZ * halfLen,
  ]
  const endPoint: [number, number, number] = [
    newMidpoint[0] - lineX * halfLen,
    newMidpoint[1],
    newMidpoint[2] - lineZ * halfLen,
  ]

  const dx = endPoint[0] - startPoint[0]
  const dz = endPoint[2] - startPoint[2]
  const rotation = Math.atan2(dx, dz)

  return { startPoint, endPoint, midpoint: newMidpoint, rotation, flipped }
}

const findNearestRibbonPoint = (
  x: number,
  z: number,
  ribbons: PlacedObject[],
): { point: [number, number, number]; tangent: [number, number, number]; dist: number } | null => {
  let best: {
    point: [number, number, number]
    tangent: [number, number, number]
    dist: number
  } | null = null

  for (const ribbon of ribbons) {
    if (ribbon.type !== 'track_ribbon' || !ribbon.ribbonPoints || ribbon.ribbonPoints.length < 2) {
      continue
    }
    const candidate = nearestOnPolyline(x, z, ribbon.ribbonPoints, ribbon.ribbonClosed ?? false)
    if (!candidate) continue
    if (!best || candidate.dist < best.dist) best = candidate
  }

  if (!best || best.dist > SEARCH_RADIUS) return null
  return best
}

const nearestOnPolyline = (
  x: number,
  z: number,
  points: TrackRibbonPoint[],
  closed: boolean,
): { point: [number, number, number]; tangent: [number, number, number]; dist: number } | null => {
  const segCount = closed ? points.length : points.length - 1
  if (segCount < 1) return null

  let bestDist = Infinity
  let bestPoint: [number, number, number] | null = null
  let bestTangent: [number, number, number] | null = null

  for (let i = 0; i < segCount; i++) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    const dx = b.x - a.x
    const dz = b.z - a.z
    const segLenSq = dx * dx + dz * dz
    if (segLenSq < 1e-12) continue

    const tRaw = ((x - a.x) * dx + (z - a.z) * dz) / segLenSq
    const tClamped = Math.max(0, Math.min(1, tRaw))
    const px = a.x + dx * tClamped
    const pz = a.z + dz * tClamped
    const d = Math.hypot(x - px, z - pz)

    if (d < bestDist) {
      bestDist = d
      bestPoint = [px, 0, pz]
      const segLen = Math.sqrt(segLenSq)
      bestTangent = [dx / segLen, 0, dz / segLen]
    }
  }

  if (!bestPoint || !bestTangent) return null
  return { point: bestPoint, tangent: bestTangent, dist: bestDist }
}
