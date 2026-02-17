import type { PlacedObject } from '../types/trackObjects'
import { isCurveMode } from '../types/trackObjects'

function sampleRoadPoints(
  road: PlacedObject,
  samples: number,
): { x: number; z: number; y: number }[] {
  if (!road.startPoint || !road.endPoint) return []

  const points: { x: number; z: number; y: number }[] = []
  const startElev = road.startElevation ?? 0
  const endElev = road.endElevation ?? 0

  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const elev = startElev + (endElev - startElev) * t

    if (isCurveMode(road.trackMode) && road.controlPoint) {
      const t1 = 1 - t
      points.push({
        x:
          t1 * t1 * road.startPoint[0] +
          2 * t1 * t * road.controlPoint[0] +
          t * t * road.endPoint[0],
        z:
          t1 * t1 * road.startPoint[2] +
          2 * t1 * t * road.controlPoint[2] +
          t * t * road.endPoint[2],
        y: elev,
      })
    } else {
      points.push({
        x: road.startPoint[0] + (road.endPoint[0] - road.startPoint[0]) * t,
        z: road.startPoint[2] + (road.endPoint[2] - road.startPoint[2]) * t,
        y: elev,
      })
    }
  }

  return points
}

function boxBlur(data: Float32Array, gridSize: number): void {
  const tmp = new Float32Array(data.length)

  for (let z = 1; z < gridSize - 1; z++) {
    for (let x = 1; x < gridSize - 1; x++) {
      let sum = 0
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          sum += data[(z + dz) * gridSize + (x + dx)]
        }
      }
      tmp[z * gridSize + x] = sum / 9
    }
  }

  for (let i = 0; i < data.length; i++) {
    if (tmp[i] !== 0) data[i] = tmp[i]
  }
}

export function generateTerrainHeights(
  roads: PlacedObject[],
  gridSize: number = 128,
  worldSize: number = 200,
  falloffRadius: number = 15,
): Float32Array {
  const heights = new Float32Array(gridSize * gridSize)
  const cellSize = worldSize / gridSize
  const halfWorld = worldSize / 2
  const invSigmaSq = 1 / (2 * (falloffRadius * 0.4) * (falloffRadius * 0.4))

  const elevatedRoads = roads.filter(
    r => r.type === 'road' && ((r.startElevation ?? 0) > 0.1 || (r.endElevation ?? 0) > 0.1),
  )

  if (elevatedRoads.length === 0) return heights

  for (const road of elevatedRoads) {
    const samples = sampleRoadPoints(road, 20)

    for (const sample of samples) {
      if (sample.y < 0.1) continue

      const gridCenterX = (sample.x + halfWorld) / cellSize
      const gridCenterZ = (sample.z + halfWorld) / cellSize
      const radiusCells = Math.ceil(falloffRadius / cellSize)

      const minGX = Math.max(0, Math.floor(gridCenterX - radiusCells))
      const maxGX = Math.min(gridSize - 1, Math.ceil(gridCenterX + radiusCells))
      const minGZ = Math.max(0, Math.floor(gridCenterZ - radiusCells))
      const maxGZ = Math.min(gridSize - 1, Math.ceil(gridCenterZ + radiusCells))

      for (let gz = minGZ; gz <= maxGZ; gz++) {
        for (let gx = minGX; gx <= maxGX; gx++) {
          const worldX = gx * cellSize - halfWorld
          const worldZ = gz * cellSize - halfWorld
          const dx = worldX - sample.x
          const dz = worldZ - sample.z
          const distSq = dx * dx + dz * dz
          const weight = Math.exp(-distSq * invSigmaSq)
          const h = sample.y * weight
          const idx = gz * gridSize + gx
          if (h > heights[idx]) {
            heights[idx] = h
          }
        }
      }
    }
  }

  for (let pass = 0; pass < 3; pass++) {
    boxBlur(heights, gridSize)
  }

  return heights
}
