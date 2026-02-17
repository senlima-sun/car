import type { PlacedObject } from '../types/trackObjects'
import { isCurveMode } from '../types/trackObjects'
import { TRACK_WIDTH } from '../constants/dimensions'

const ROAD_WIDTH = TRACK_WIDTH
const SNAP_THRESHOLD = 5

export interface OverlapRegion {
  t: number
  position: [number, number, number]
}

export interface OverlapResult {
  hasOverlap: boolean
  overlapPercentage: number
  regions: OverlapRegion[]
  affectedRoadIds: string[]
}

export function sampleCenterline(
  startPoint: [number, number, number],
  endPoint: [number, number, number],
  controlPoint: [number, number, number] | undefined,
  sampleCount: number,
): Array<{ t: number; x: number; z: number }> {
  const samples: Array<{ t: number; x: number; z: number }> = []

  for (let i = 0; i <= sampleCount; i++) {
    const t = i / sampleCount
    let x: number, z: number

    if (controlPoint) {
      const t1 = 1 - t
      x = t1 * t1 * startPoint[0] + 2 * t1 * t * controlPoint[0] + t * t * endPoint[0]
      z = t1 * t1 * startPoint[2] + 2 * t1 * t * controlPoint[2] + t * t * endPoint[2]
    } else {
      x = startPoint[0] + (endPoint[0] - startPoint[0]) * t
      z = startPoint[2] + (endPoint[2] - startPoint[2]) * t
    }

    samples.push({ t, x, z })
  }

  return samples
}

export function pointOnRoad(px: number, pz: number, road: PlacedObject, halfWidth: number): boolean {
  if (!road.startPoint || !road.endPoint) return false

  if (isCurveMode(road.trackMode) && road.controlPoint) {
    const SAMPLES = 16
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES
      const t1 = 1 - t
      const cx =
        t1 * t1 * road.startPoint[0] + 2 * t1 * t * road.controlPoint[0] + t * t * road.endPoint[0]
      const cz =
        t1 * t1 * road.startPoint[2] + 2 * t1 * t * road.controlPoint[2] + t * t * road.endPoint[2]

      const dist = Math.sqrt((px - cx) ** 2 + (pz - cz) ** 2)
      if (dist < halfWidth) return true
    }
    return false
  }

  const dx = road.endPoint[0] - road.startPoint[0]
  const dz = road.endPoint[2] - road.startPoint[2]
  const len = Math.sqrt(dx * dx + dz * dz)
  if (len === 0) return false

  const dirX = dx / len
  const dirZ = dz / len
  const toX = px - road.startPoint[0]
  const toZ = pz - road.startPoint[2]
  const proj = toX * dirX + toZ * dirZ

  if (proj < 0 || proj > len) return false

  const closestX = road.startPoint[0] + dirX * proj
  const closestZ = road.startPoint[2] + dirZ * proj
  const perpDist = Math.sqrt((px - closestX) ** 2 + (pz - closestZ) ** 2)

  return perpDist < halfWidth
}

function isConnectedEndpoint(road: PlacedObject, point: [number, number, number]): boolean {
  if (!road.startPoint || !road.endPoint) return false
  const threshold = SNAP_THRESHOLD

  const dxStart = road.startPoint[0] - point[0]
  const dzStart = road.startPoint[2] - point[2]
  if (Math.sqrt(dxStart * dxStart + dzStart * dzStart) < threshold) return true

  const dxEnd = road.endPoint[0] - point[0]
  const dzEnd = road.endPoint[2] - point[2]
  if (Math.sqrt(dxEnd * dxEnd + dzEnd * dzEnd) < threshold) return true

  return false
}

export function checkOverlap(
  newRoad: {
    startPoint: [number, number, number]
    endPoint: [number, number, number]
    controlPoint?: [number, number, number]
  },
  existingRoads: PlacedObject[],
  halfWidth: number = ROAD_WIDTH / 2,
  connectedRoadIds: Set<string> = new Set(),
): OverlapResult {
  const SAMPLE_COUNT = 12
  const samples = sampleCenterline(
    newRoad.startPoint,
    newRoad.endPoint,
    newRoad.controlPoint,
    SAMPLE_COUNT,
  )

  const regions: OverlapRegion[] = []
  const affectedRoadIds = new Set<string>()
  let overlapCount = 0

  const candidateRoads = existingRoads.filter(
    r => r.type === 'road' && r.startPoint && r.endPoint && !connectedRoadIds.has(r.id),
  )

  for (const sample of samples) {
    for (const road of candidateRoads) {
      if (isConnectedEndpoint(road, newRoad.startPoint)) continue
      if (isConnectedEndpoint(road, newRoad.endPoint)) continue

      if (pointOnRoad(sample.x, sample.z, road, halfWidth * 0.8)) {
        overlapCount++
        regions.push({ t: sample.t, position: [sample.x, 0, sample.z] })
        affectedRoadIds.add(road.id)
        break
      }
    }
  }

  const overlapPercentage = overlapCount / (SAMPLE_COUNT + 1)

  return {
    hasOverlap: overlapCount > 0,
    overlapPercentage,
    regions,
    affectedRoadIds: Array.from(affectedRoadIds),
  }
}

export function autoTrimOverlap(
  newRoad: PlacedObject,
  overlapResult: OverlapResult,
): PlacedObject | null {
  if (!overlapResult.hasOverlap || !newRoad.startPoint || !newRoad.endPoint) {
    return newRoad
  }

  if (overlapResult.overlapPercentage > 0.5) {
    return null
  }

  const sortedRegions = [...overlapResult.regions].sort((a, b) => a.t - b.t)
  if (sortedRegions.length === 0) return newRoad

  const firstOverlapT = sortedRegions[0].t
  const lastOverlapT = sortedRegions[sortedRegions.length - 1].t

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t

  if (firstOverlapT < 0.2 && lastOverlapT < 0.5) {
    const cutT = lastOverlapT + 0.05
    const newStart: [number, number, number] = [
      lerp(newRoad.startPoint[0], newRoad.endPoint[0], cutT),
      0,
      lerp(newRoad.startPoint[2], newRoad.endPoint[2], cutT),
    ]
    const startElev = newRoad.startElevation ?? 0
    const endElev = newRoad.endElevation ?? 0
    return {
      ...newRoad,
      startPoint: newStart,
      startElevation: lerp(startElev, endElev, cutT),
      startLeftEdge: undefined,
      startRightEdge: undefined,
      position: [
        (newStart[0] + newRoad.endPoint[0]) / 2,
        0,
        (newStart[2] + newRoad.endPoint[2]) / 2,
      ],
    }
  }

  if (lastOverlapT > 0.8 && firstOverlapT > 0.5) {
    const cutT = firstOverlapT - 0.05
    const newEnd: [number, number, number] = [
      lerp(newRoad.startPoint[0], newRoad.endPoint[0], cutT),
      0,
      lerp(newRoad.startPoint[2], newRoad.endPoint[2], cutT),
    ]
    const startElev = newRoad.startElevation ?? 0
    const endElev = newRoad.endElevation ?? 0
    return {
      ...newRoad,
      endPoint: newEnd,
      endElevation: lerp(startElev, endElev, cutT),
      endLeftEdge: undefined,
      endRightEdge: undefined,
      position: [
        (newRoad.startPoint[0] + newEnd[0]) / 2,
        0,
        (newRoad.startPoint[2] + newEnd[2]) / 2,
      ],
    }
  }

  return newRoad
}

export class RoadSpatialIndex {
  private cellSize: number
  private cells: Map<string, string[]> = new Map()
  private roadBounds: Map<string, { minX: number; minZ: number; maxX: number; maxZ: number }> =
    new Map()

  constructor(cellSize: number = ROAD_WIDTH * 2) {
    this.cellSize = cellSize
  }

  private cellKey(cx: number, cz: number): string {
    return `${cx},${cz}`
  }

  rebuild(roads: PlacedObject[]) {
    this.cells.clear()
    this.roadBounds.clear()

    for (const road of roads) {
      if (road.type !== 'road' || !road.startPoint || !road.endPoint) continue
      this.insert(road)
    }
  }

  private insert(road: PlacedObject) {
    if (!road.startPoint || !road.endPoint) return

    const points = [road.startPoint, road.endPoint]
    if (road.controlPoint) points.push(road.controlPoint)

    const xs = points.map(p => p[0])
    const zs = points.map(p => p[2])
    const hw = ROAD_WIDTH / 2 + 1

    const bounds = {
      minX: Math.min(...xs) - hw,
      maxX: Math.max(...xs) + hw,
      minZ: Math.min(...zs) - hw,
      maxZ: Math.max(...zs) + hw,
    }

    this.roadBounds.set(road.id, bounds)

    const startCX = Math.floor(bounds.minX / this.cellSize)
    const endCX = Math.floor(bounds.maxX / this.cellSize)
    const startCZ = Math.floor(bounds.minZ / this.cellSize)
    const endCZ = Math.floor(bounds.maxZ / this.cellSize)

    for (let cx = startCX; cx <= endCX; cx++) {
      for (let cz = startCZ; cz <= endCZ; cz++) {
        const key = this.cellKey(cx, cz)
        if (!this.cells.has(key)) this.cells.set(key, [])
        this.cells.get(key)!.push(road.id)
      }
    }
  }

  query(minX: number, minZ: number, maxX: number, maxZ: number): string[] {
    const result = new Set<string>()
    const startCX = Math.floor(minX / this.cellSize)
    const endCX = Math.floor(maxX / this.cellSize)
    const startCZ = Math.floor(minZ / this.cellSize)
    const endCZ = Math.floor(maxZ / this.cellSize)

    for (let cx = startCX; cx <= endCX; cx++) {
      for (let cz = startCZ; cz <= endCZ; cz++) {
        const key = this.cellKey(cx, cz)
        const ids = this.cells.get(key)
        if (ids) {
          for (const id of ids) result.add(id)
        }
      }
    }

    return Array.from(result)
  }
}
