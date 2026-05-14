import type { PlacedObject } from '@/types/trackObjects'
import { MINIMAP_SIZE, PADDING } from './constants'

export interface Bounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  rangeX: number
  rangeZ: number
  maxRange: number
}

export function computeBounds(placedObjects: PlacedObject[]): Bounds | null {
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity
  let hasPoint = false

  const addPoint = (x: number, z: number) => {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
    hasPoint = true
  }

  for (const obj of placedObjects) {
    if (obj.type === 'road' && obj.startPoint && obj.endPoint) {
      addPoint(obj.startPoint[0], obj.startPoint[2])
      addPoint(obj.endPoint[0], obj.endPoint[2])
      if (obj.controlPoint) addPoint(obj.controlPoint[0], obj.controlPoint[2])
    } else if (obj.type === 'track_ribbon' && obj.ribbonPoints && obj.ribbonPoints.length > 0) {
      for (const p of obj.ribbonPoints) addPoint(p.x, p.z)
    }
  }

  if (!hasPoint) return null

  const rangeX = maxX - minX || 1
  const rangeZ = maxZ - minZ || 1
  const maxRange = Math.max(rangeX, rangeZ)

  return { minX, maxX, minZ, maxZ, rangeX, rangeZ, maxRange }
}

export interface MinimapTransforms {
  toScreenX: (x: number) => number
  toScreenZ: (z: number) => number
  rotX: (sx: number, sz: number) => number
  rotZ: (sx: number, sz: number) => number
  scale: number
  drawSize: number
  angle: number
}

export function makeTransforms(bounds: Bounds, angle: number): MinimapTransforms {
  const drawSize = MINIMAP_SIZE - PADDING * 2
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerZ = (bounds.minZ + bounds.maxZ) / 2
  const scale = drawSize / bounds.maxRange
  const half = MINIMAP_SIZE / 2

  const toScreenX = (x: number) => PADDING + (x - centerX) * scale + drawSize / 2
  const toScreenZ = (z: number) => PADDING + (z - centerZ) * scale + drawSize / 2

  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  const rotX = (sx: number, sz: number) => {
    const dx = sx - half
    const dz = sz - half
    return half + dx * cos - dz * sin
  }
  const rotZ = (sx: number, sz: number) => {
    const dx = sx - half
    const dz = sz - half
    return half + dx * sin + dz * cos
  }

  return { toScreenX, toScreenZ, rotX, rotZ, scale, drawSize, angle }
}
