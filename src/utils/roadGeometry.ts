import type { PlacedObject, SnapPointWithDirection, RoadEdgeResult, RoadEdgeHitResult, RoadSurfaceHitResult } from '../types/trackObjects'
import { isLinearObject } from '../types/trackObjects'
import { getOutwardTangent } from './roadSnapping'

const SNAP_THRESHOLD = 2
const ROAD_WIDTH = 16

export const getSnapPoints = (placedObjects: PlacedObject[]): SnapPointWithDirection[] => {
  const points: SnapPointWithDirection[] = []
  const halfWidth = ROAD_WIDTH / 2

  for (const obj of placedObjects) {
    if (isLinearObject(obj.type) && obj.startPoint && obj.endPoint) {
      const dx = obj.endPoint[0] - obj.startPoint[0]
      const dz = obj.endPoint[2] - obj.startPoint[2]
      const len = Math.sqrt(dx * dx + dz * dz)
      const dir: [number, number, number] = len > 0 ? [dx / len, 0, dz / len] : [0, 0, 1]

      const startTangent = getOutwardTangent(obj.startPoint, obj.endPoint, obj.controlPoint, true)
      const endTangent = getOutwardTangent(obj.startPoint, obj.endPoint, obj.controlPoint, false)

      const startTangentInward: [number, number, number] = [-startTangent[0], 0, -startTangent[2]]
      const startPerpX = -startTangentInward[2]
      const startPerpZ = startTangentInward[0]

      const endPerpX = -endTangent[2]
      const endPerpZ = endTangent[0]

      const startLeft: [number, number, number] = [
        obj.startPoint[0] + startPerpX * halfWidth,
        0,
        obj.startPoint[2] + startPerpZ * halfWidth,
      ]
      const startRight: [number, number, number] = [
        obj.startPoint[0] - startPerpX * halfWidth,
        0,
        obj.startPoint[2] - startPerpZ * halfWidth,
      ]
      points.push({
        position: obj.startPoint,
        direction: [-dir[0], 0, -dir[2]],
        leftEdge: startLeft,
        rightEdge: startRight,
        tangent: startTangent,
      })

      const endLeft: [number, number, number] = [
        obj.endPoint[0] + endPerpX * halfWidth,
        0,
        obj.endPoint[2] + endPerpZ * halfWidth,
      ]
      const endRight: [number, number, number] = [
        obj.endPoint[0] - endPerpX * halfWidth,
        0,
        obj.endPoint[2] - endPerpZ * halfWidth,
      ]
      points.push({
        position: obj.endPoint,
        direction: dir,
        leftEdge: endLeft,
        rightEdge: endRight,
        tangent: endTangent,
      })
    }
  }
  return points
}

export const findNearestSnapPoint = (
  pos: [number, number, number],
  snapPoints: SnapPointWithDirection[],
): SnapPointWithDirection | null => {
  let nearest: SnapPointWithDirection | null = null
  let minDist = SNAP_THRESHOLD

  for (const point of snapPoints) {
    const dx = pos[0] - point.position[0]
    const dz = pos[2] - point.position[2]
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < minDist) {
      minDist = dist
      nearest = point
    }
  }

  return nearest
}

export const findRoadAtPosition = (
  pos: [number, number, number],
  placedObjects: PlacedObject[],
  roadWidth: number = 16,
): RoadEdgeResult | null => {
  const halfWidth = roadWidth / 2

  for (const obj of placedObjects) {
    if (obj.type !== 'road' || !obj.startPoint || !obj.endPoint) {
      continue
    }

    if (obj.trackMode === 'curve' && obj.controlPoint) {
      const SAMPLES = 32
      let bestDist = halfWidth
      let bestResult: RoadEdgeResult | null = null

      for (let i = 0; i <= SAMPLES; i++) {
        const t = i / SAMPLES
        const t1 = 1 - t
        const curveX =
          t1 * t1 * obj.startPoint[0] + 2 * t1 * t * obj.controlPoint[0] + t * t * obj.endPoint[0]
        const curveZ =
          t1 * t1 * obj.startPoint[2] + 2 * t1 * t * obj.controlPoint[2] + t * t * obj.endPoint[2]

        const dist = Math.sqrt(Math.pow(pos[0] - curveX, 2) + Math.pow(pos[2] - curveZ, 2))

        if (dist < bestDist) {
          bestDist = dist

          const tangentX =
            2 * t1 * (obj.controlPoint[0] - obj.startPoint[0]) +
            2 * t * (obj.endPoint[0] - obj.controlPoint[0])
          const tangentZ =
            2 * t1 * (obj.controlPoint[2] - obj.startPoint[2]) +
            2 * t * (obj.endPoint[2] - obj.controlPoint[2])
          const tangentLen = Math.sqrt(tangentX * tangentX + tangentZ * tangentZ)
          if (tangentLen === 0) continue

          const perpX = -tangentZ / tangentLen
          const perpZ = tangentX / tangentLen

          bestResult = {
            roadId: obj.id,
            leftEdge: [curveX + perpX * halfWidth, 0, curveZ + perpZ * halfWidth],
            rightEdge: [curveX - perpX * halfWidth, 0, curveZ - perpZ * halfWidth],
            centerPoint: [curveX, 0, curveZ],
          }
        }
      }

      if (bestResult) return bestResult
    } else {
      const start = obj.startPoint
      const end = obj.endPoint

      const dx = end[0] - start[0]
      const dz = end[2] - start[2]
      const length = Math.sqrt(dx * dx + dz * dz)
      if (length === 0) continue

      const dirX = dx / length
      const dirZ = dz / length

      const toClickX = pos[0] - start[0]
      const toClickZ = pos[2] - start[2]

      const projection = toClickX * dirX + toClickZ * dirZ

      if (projection < 0 || projection > length) continue

      const closestX = start[0] + dirX * projection
      const closestZ = start[2] + dirZ * projection

      const perpDist = Math.sqrt(Math.pow(pos[0] - closestX, 2) + Math.pow(pos[2] - closestZ, 2))

      if (perpDist <= halfWidth) {
        const perpX = -dirZ
        const perpZ = dirX

        const leftEdge: [number, number, number] = [
          closestX + perpX * halfWidth,
          0,
          closestZ + perpZ * halfWidth,
        ]
        const rightEdge: [number, number, number] = [
          closestX - perpX * halfWidth,
          0,
          closestZ - perpZ * halfWidth,
        ]

        return {
          roadId: obj.id,
          leftEdge,
          rightEdge,
          centerPoint: [closestX, 0, closestZ],
        }
      }
    }
  }

  return null
}

const findCurvedRoadEdge = (
  road: PlacedObject,
  pos: [number, number, number],
  halfWidth: number,
  edgeThreshold: number,
): RoadEdgeHitResult | null => {
  if (!road.startPoint || !road.endPoint || !road.controlPoint) return null

  const SAMPLES = 32
  let bestResult: RoadEdgeHitResult | null = null
  let bestDist = edgeThreshold

  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES

    const t1 = 1 - t
    const curveX =
      t1 * t1 * road.startPoint[0] + 2 * t1 * t * road.controlPoint[0] + t * t * road.endPoint[0]
    const curveZ =
      t1 * t1 * road.startPoint[2] + 2 * t1 * t * road.controlPoint[2] + t * t * road.endPoint[2]

    const tangentX =
      2 * t1 * (road.controlPoint[0] - road.startPoint[0]) +
      2 * t * (road.endPoint[0] - road.controlPoint[0])
    const tangentZ =
      2 * t1 * (road.controlPoint[2] - road.startPoint[2]) +
      2 * t * (road.endPoint[2] - road.controlPoint[2])
    const tangentLen = Math.sqrt(tangentX * tangentX + tangentZ * tangentZ)
    if (tangentLen === 0) continue

    const perpX = -tangentZ / tangentLen
    const perpZ = tangentX / tangentLen

    const leftEdgeX = curveX + perpX * halfWidth
    const leftEdgeZ = curveZ + perpZ * halfWidth
    const rightEdgeX = curveX - perpX * halfWidth
    const rightEdgeZ = curveZ - perpZ * halfWidth

    const distToLeft = Math.sqrt(Math.pow(pos[0] - leftEdgeX, 2) + Math.pow(pos[2] - leftEdgeZ, 2))
    const distToRight = Math.sqrt(
      Math.pow(pos[0] - rightEdgeX, 2) + Math.pow(pos[2] - rightEdgeZ, 2),
    )

    if (distToLeft < bestDist) {
      bestDist = distToLeft
      bestResult = {
        roadId: road.id,
        road,
        edge: 'left',
        t,
        worldPosition: [leftEdgeX, 0, leftEdgeZ],
      }
    }
    if (distToRight < bestDist) {
      bestDist = distToRight
      bestResult = {
        roadId: road.id,
        road,
        edge: 'right',
        t,
        worldPosition: [rightEdgeX, 0, rightEdgeZ],
      }
    }
  }

  return bestResult
}

export const findRoadEdgeAtPosition = (
  pos: [number, number, number],
  placedObjects: PlacedObject[],
  roadWidth: number = 16,
  edgeThreshold: number = 3,
): RoadEdgeHitResult | null => {
  const halfWidth = roadWidth / 2

  for (const obj of placedObjects) {
    if (obj.type !== 'road' || !obj.startPoint || !obj.endPoint) {
      continue
    }

    if (obj.trackMode === 'curve' && obj.controlPoint) {
      const result = findCurvedRoadEdge(obj, pos, halfWidth, edgeThreshold)
      if (result) return result
    } else {
      const start = obj.startPoint
      const end = obj.endPoint

      const dx = end[0] - start[0]
      const dz = end[2] - start[2]
      const length = Math.sqrt(dx * dx + dz * dz)
      if (length === 0) continue

      const dirX = dx / length
      const dirZ = dz / length

      const toClickX = pos[0] - start[0]
      const toClickZ = pos[2] - start[2]

      const projection = toClickX * dirX + toClickZ * dirZ

      if (projection < 0 || projection > length) continue

      const closestX = start[0] + dirX * projection
      const closestZ = start[2] + dirZ * projection

      const perpX = -dirZ
      const perpZ = dirX

      const leftEdgeX = closestX + perpX * halfWidth
      const leftEdgeZ = closestZ + perpZ * halfWidth
      const rightEdgeX = closestX - perpX * halfWidth
      const rightEdgeZ = closestZ - perpZ * halfWidth

      const distToLeft = Math.sqrt(
        Math.pow(pos[0] - leftEdgeX, 2) + Math.pow(pos[2] - leftEdgeZ, 2),
      )
      const distToRight = Math.sqrt(
        Math.pow(pos[0] - rightEdgeX, 2) + Math.pow(pos[2] - rightEdgeZ, 2),
      )

      if (distToLeft <= edgeThreshold) {
        return {
          roadId: obj.id,
          road: obj,
          edge: 'left',
          t: projection / length,
          worldPosition: [leftEdgeX, 0, leftEdgeZ],
        }
      }
      if (distToRight <= edgeThreshold) {
        return {
          roadId: obj.id,
          road: obj,
          edge: 'right',
          t: projection / length,
          worldPosition: [rightEdgeX, 0, rightEdgeZ],
        }
      }
    }
  }

  return null
}

export const getRoadEdgePositionAt = (
  road: PlacedObject,
  edge: 'left' | 'right',
  t: number,
  halfWidth: number = 8,
): [number, number, number] => {
  if (road.trackMode === 'curve' && road.controlPoint && road.startPoint && road.endPoint) {
    const t1 = 1 - t
    const curveX =
      t1 * t1 * road.startPoint[0] + 2 * t1 * t * road.controlPoint[0] + t * t * road.endPoint[0]
    const curveZ =
      t1 * t1 * road.startPoint[2] + 2 * t1 * t * road.controlPoint[2] + t * t * road.endPoint[2]

    const tangentX =
      2 * t1 * (road.controlPoint[0] - road.startPoint[0]) +
      2 * t * (road.endPoint[0] - road.controlPoint[0])
    const tangentZ =
      2 * t1 * (road.controlPoint[2] - road.startPoint[2]) +
      2 * t * (road.endPoint[2] - road.controlPoint[2])
    const tangentLen = Math.sqrt(tangentX * tangentX + tangentZ * tangentZ)

    if (tangentLen > 0) {
      const perpX = -tangentZ / tangentLen
      const perpZ = tangentX / tangentLen
      const sign = edge === 'left' ? 1 : -1
      return [curveX + perpX * halfWidth * sign, 0, curveZ + perpZ * halfWidth * sign]
    }
  }

  if (road.startPoint && road.endPoint) {
    const dx = road.endPoint[0] - road.startPoint[0]
    const dz = road.endPoint[2] - road.startPoint[2]
    const length = Math.sqrt(dx * dx + dz * dz)

    if (length > 0) {
      const dirX = dx / length
      const dirZ = dz / length
      const perpX = -dirZ
      const perpZ = dirX

      const posX = road.startPoint[0] + dx * t
      const posZ = road.startPoint[2] + dz * t
      const sign = edge === 'left' ? 1 : -1

      return [posX + perpX * halfWidth * sign, 0, posZ + perpZ * halfWidth * sign]
    }
  }

  return [0, 0, 0]
}

const findCurvedRoadSurface = (
  road: PlacedObject,
  pos: [number, number, number],
  halfWidth: number,
): RoadSurfaceHitResult | null => {
  if (!road.startPoint || !road.endPoint || !road.controlPoint) return null

  const SAMPLES = 48
  let bestResult: RoadSurfaceHitResult | null = null
  let bestDist = halfWidth

  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES

    const t1 = 1 - t
    const curveX =
      t1 * t1 * road.startPoint[0] + 2 * t1 * t * road.controlPoint[0] + t * t * road.endPoint[0]
    const curveZ =
      t1 * t1 * road.startPoint[2] + 2 * t1 * t * road.controlPoint[2] + t * t * road.endPoint[2]

    const dist = Math.sqrt(Math.pow(pos[0] - curveX, 2) + Math.pow(pos[2] - curveZ, 2))

    if (dist < bestDist) {
      bestDist = dist
      bestResult = {
        roadId: road.id,
        road,
        t,
        centerPosition: [curveX, 0, curveZ],
      }
    }
  }

  return bestResult
}

export const findRoadSurfaceAtPosition = (
  pos: [number, number, number],
  placedObjects: PlacedObject[],
  roadWidth: number = 16,
): RoadSurfaceHitResult | null => {
  const halfWidth = roadWidth / 2

  for (const obj of placedObjects) {
    if (obj.type !== 'road' || !obj.startPoint || !obj.endPoint) {
      continue
    }

    if (obj.trackMode === 'curve' && obj.controlPoint) {
      const result = findCurvedRoadSurface(obj, pos, halfWidth)
      if (result) return result
    } else {
      const start = obj.startPoint
      const end = obj.endPoint

      const dx = end[0] - start[0]
      const dz = end[2] - start[2]
      const length = Math.sqrt(dx * dx + dz * dz)
      if (length === 0) continue

      const dirX = dx / length
      const dirZ = dz / length

      const toClickX = pos[0] - start[0]
      const toClickZ = pos[2] - start[2]

      const projection = toClickX * dirX + toClickZ * dirZ

      if (projection < 0 || projection > length) continue

      const closestX = start[0] + dirX * projection
      const closestZ = start[2] + dirZ * projection

      const perpDist = Math.sqrt(Math.pow(pos[0] - closestX, 2) + Math.pow(pos[2] - closestZ, 2))

      if (perpDist <= halfWidth) {
        return {
          roadId: obj.id,
          road: obj,
          t: projection / length,
          centerPosition: [closestX, 0, closestZ],
        }
      }
    }
  }

  return null
}

export const getRoadCenterPositionAt = (
  road: PlacedObject,
  t: number,
): [number, number, number] => {
  if (!road.startPoint || !road.endPoint) return [0, 0, 0]

  if (road.trackMode === 'curve' && road.controlPoint) {
    const t1 = 1 - t
    return [
      t1 * t1 * road.startPoint[0] + 2 * t1 * t * road.controlPoint[0] + t * t * road.endPoint[0],
      0,
      t1 * t1 * road.startPoint[2] + 2 * t1 * t * road.controlPoint[2] + t * t * road.endPoint[2],
    ]
  }

  return [
    road.startPoint[0] + (road.endPoint[0] - road.startPoint[0]) * t,
    0,
    road.startPoint[2] + (road.endPoint[2] - road.startPoint[2]) * t,
  ]
}

const subdivideBezier = (
  P0: [number, number, number],
  P1: [number, number, number],
  P2: [number, number, number],
  t0: number,
  t1: number,
): {
  start: [number, number, number]
  control: [number, number, number]
  end: [number, number, number]
} => {
  const lerp = (
    a: [number, number, number],
    b: [number, number, number],
    t: number,
  ): [number, number, number] => [a[0] + (b[0] - a[0]) * t, 0, a[2] + (b[2] - a[2]) * t]

  const splitAt = (
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    t: number,
  ) => {
    const q0 = lerp(p0, p1, t)
    const q1 = lerp(p1, p2, t)
    const r0 = lerp(q0, q1, t)
    return {
      left: { start: p0, control: q0, end: r0 },
      right: { start: r0, control: q1, end: p2 },
    }
  }

  if (t0 === 0) {
    const split = splitAt(P0, P1, P2, t1)
    return split.left
  }

  if (t1 === 1) {
    const split = splitAt(P0, P1, P2, t0)
    return split.right
  }

  const firstSplit = splitAt(P0, P1, P2, t1)
  const leftCurve = firstSplit.left

  const remappedT0 = t0 / t1
  const secondSplit = splitAt(leftCurve.start, leftCurve.control, leftCurve.end, remappedT0)

  return secondSplit.right
}

export const splitRoadAtSegment = (
  road: PlacedObject,
  deleteStartT: number,
  deleteEndT: number,
  generateIdFn: () => string,
): PlacedObject[] => {
  if (!road.startPoint || !road.endPoint) return []

  const results: PlacedObject[] = []
  const MIN_T_THRESHOLD = 0.05

  const startT = Math.min(deleteStartT, deleteEndT)
  const endT = Math.max(deleteStartT, deleteEndT)

  if (road.trackMode === 'curve' && road.controlPoint) {
    if (startT > MIN_T_THRESHOLD) {
      const segment = subdivideBezier(road.startPoint, road.controlPoint, road.endPoint, 0, startT)
      results.push({
        id: generateIdFn(),
        type: 'road',
        position: [
          (segment.start[0] + segment.end[0]) / 2,
          0,
          (segment.start[2] + segment.end[2]) / 2,
        ],
        rotation: 0,
        startPoint: segment.start,
        endPoint: segment.end,
        controlPoint: segment.control,
        trackMode: 'curve',
      })
    }

    if (endT < 1 - MIN_T_THRESHOLD) {
      const segment = subdivideBezier(road.startPoint, road.controlPoint, road.endPoint, endT, 1)
      results.push({
        id: generateIdFn(),
        type: 'road',
        position: [
          (segment.start[0] + segment.end[0]) / 2,
          0,
          (segment.start[2] + segment.end[2]) / 2,
        ],
        rotation: 0,
        startPoint: segment.start,
        endPoint: segment.end,
        controlPoint: segment.control,
        trackMode: 'curve',
      })
    }
  } else {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t

    if (startT > MIN_T_THRESHOLD) {
      const newEnd: [number, number, number] = [
        lerp(road.startPoint[0], road.endPoint[0], startT),
        0,
        lerp(road.startPoint[2], road.endPoint[2], startT),
      ]
      const dx = newEnd[0] - road.startPoint[0]
      const dz = newEnd[2] - road.startPoint[2]
      results.push({
        id: generateIdFn(),
        type: 'road',
        position: [(road.startPoint[0] + newEnd[0]) / 2, 0, (road.startPoint[2] + newEnd[2]) / 2],
        rotation: Math.atan2(dx, dz),
        startPoint: road.startPoint,
        endPoint: newEnd,
        trackMode: 'straight',
      })
    }

    if (endT < 1 - MIN_T_THRESHOLD) {
      const newStart: [number, number, number] = [
        lerp(road.startPoint[0], road.endPoint[0], endT),
        0,
        lerp(road.startPoint[2], road.endPoint[2], endT),
      ]
      const dx = road.endPoint[0] - newStart[0]
      const dz = road.endPoint[2] - newStart[2]
      results.push({
        id: generateIdFn(),
        type: 'road',
        position: [(newStart[0] + road.endPoint[0]) / 2, 0, (newStart[2] + road.endPoint[2]) / 2],
        rotation: Math.atan2(dx, dz),
        startPoint: newStart,
        endPoint: road.endPoint,
        trackMode: 'straight',
      })
    }
  }

  return results
}

export const getElevationAtT = (road: PlacedObject, t: number): number => {
  const startElev = road.startElevation ?? 0
  const endElev = road.endElevation ?? 0
  return startElev + (endElev - startElev) * t
}
