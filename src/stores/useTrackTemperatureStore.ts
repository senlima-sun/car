import { create } from 'zustand'
import * as THREE from 'three'
import type { PlacedObject } from '../types/trackObjects'

const GRID_SIZE = 2
const TEXTURE_SIZE = 512
const BOUNDS_PADDING = 50

interface WorldBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

interface TrackTemperatureState {
  dataTexture: THREE.DataTexture | null
  worldBounds: WorldBounds
  gridSize: number
  textureSize: number
  initializeTexture: () => void
  setWorldBounds: (bounds: WorldBounds) => void
}

export function computeTrackBounds(placedObjects: PlacedObject[]): WorldBounds {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity

  const roadTypes = new Set(['road', 'pitbox'])
  const roadModes = new Set(['straight', 'curve', 'pitroad', 'pitroad-curve'])

  for (const obj of placedObjects) {
    const isRoad = roadTypes.has(obj.type) || (obj.trackMode && roadModes.has(obj.trackMode))
    if (!isRoad) continue

    if (obj.startPoint) {
      minX = Math.min(minX, obj.startPoint[0])
      maxX = Math.max(maxX, obj.startPoint[0])
      minZ = Math.min(minZ, obj.startPoint[2])
      maxZ = Math.max(maxZ, obj.startPoint[2])
    }
    if (obj.endPoint) {
      minX = Math.min(minX, obj.endPoint[0])
      maxX = Math.max(maxX, obj.endPoint[0])
      minZ = Math.min(minZ, obj.endPoint[2])
      maxZ = Math.max(maxZ, obj.endPoint[2])
    }
    if (obj.controlPoint) {
      minX = Math.min(minX, obj.controlPoint[0])
      maxX = Math.max(maxX, obj.controlPoint[0])
      minZ = Math.min(minZ, obj.controlPoint[2])
      maxZ = Math.max(maxZ, obj.controlPoint[2])
    }
    if (obj.position) {
      minX = Math.min(minX, obj.position[0])
      maxX = Math.max(maxX, obj.position[0])
      minZ = Math.min(minZ, obj.position[2])
      maxZ = Math.max(maxZ, obj.position[2])
    }
  }

  if (!isFinite(minX)) {
    return { minX: -250, maxX: 250, minZ: -250, maxZ: 250 }
  }

  return {
    minX: minX - BOUNDS_PADDING,
    maxX: maxX + BOUNDS_PADDING,
    minZ: minZ - BOUNDS_PADDING,
    maxZ: maxZ + BOUNDS_PADDING,
  }
}

export const useTrackTemperatureStore = create<TrackTemperatureState>((set) => ({
  dataTexture: null,
  worldBounds: { minX: -250, maxX: 250, minZ: -250, maxZ: 250 },
  gridSize: GRID_SIZE,
  textureSize: TEXTURE_SIZE,

  initializeTexture: () => {
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4)

    for (let i = 0; i < TEXTURE_SIZE * TEXTURE_SIZE; i++) {
      data[i * 4 + 3] = 255
    }

    const texture = new THREE.DataTexture(data, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat)
    texture.needsUpdate = true
    texture.magFilter = THREE.LinearFilter
    texture.minFilter = THREE.LinearFilter
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping

    set({ dataTexture: texture })
  },

  setWorldBounds: (bounds: WorldBounds) => {
    set({ worldBounds: bounds })
  },
}))
