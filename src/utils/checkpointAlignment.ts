import type { PlacedObject } from '../types/trackObjects'
import { isCurveMode } from '../types/trackObjects'

export interface AlignmentResult {
  startPoint: [number, number, number]
  endPoint: [number, number, number]
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
