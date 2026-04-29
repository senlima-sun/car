import { create } from 'zustand'

const DEFAULT_RESOLUTION = 256
const DEFAULT_WORLD_SIZE = 4000
const EDGE_MARGIN = 10

interface TerrainState {
  heightmap: Float32Array
  resolution: number
  worldSize: number
  version: number
  physicsVersion: number

  getHeightAt: (worldX: number, worldZ: number) => number
  setHeightAt: (gridX: number, gridZ: number, height: number) => void
  applyBrushStroke: (changes: Map<number, number>, opts?: { deferVersion?: boolean }) => void
  flushVisualVersion: () => void
  commitPhysics: () => void
  loadHeightmap: (data: number[]) => void
  getHeightsArray: () => number[]
  resetHeightmap: () => void
}

function clampEdge(heightmap: Float32Array, resolution: number) {
  for (let gz = 0; gz < resolution; gz++) {
    for (let gx = 0; gx < resolution; gx++) {
      const edgeDist = Math.min(gx, gz, resolution - 1 - gx, resolution - 1 - gz)
      if (edgeDist < EDGE_MARGIN) {
        const t = edgeDist / EDGE_MARGIN
        const fade = t * t
        heightmap[gz * resolution + gx] *= fade
      }
    }
  }
}

export const useTerrainStore = create<TerrainState>((set, get) => ({
  heightmap: new Float32Array(DEFAULT_RESOLUTION * DEFAULT_RESOLUTION),
  resolution: DEFAULT_RESOLUTION,
  worldSize: DEFAULT_WORLD_SIZE,
  version: 0,
  physicsVersion: 0,

  getHeightAt: (worldX: number, worldZ: number) => {
    const { heightmap, resolution, worldSize } = get()
    const halfSize = worldSize / 2
    const cellSize = worldSize / (resolution - 1)

    const fx = (worldX + halfSize) / cellSize
    const fz = (worldZ + halfSize) / cellSize

    if (fx < 0 || fx >= resolution - 1 || fz < 0 || fz >= resolution - 1) return 0

    const gx = Math.floor(fx)
    const gz = Math.floor(fz)
    const tx = fx - gx
    const tz = fz - gz

    const h00 = heightmap[gz * resolution + gx]
    const h10 = heightmap[gz * resolution + gx + 1]
    const h01 = heightmap[(gz + 1) * resolution + gx]
    const h11 = heightmap[(gz + 1) * resolution + gx + 1]

    const h0 = h00 + (h10 - h00) * tx
    const h1 = h01 + (h11 - h01) * tx
    return h0 + (h1 - h0) * tz
  },

  setHeightAt: (gridX: number, gridZ: number, height: number) => {
    const { heightmap, resolution } = get()
    if (gridX < 0 || gridX >= resolution || gridZ < 0 || gridZ >= resolution) return
    heightmap[gridZ * resolution + gridX] = height
    clampEdge(heightmap, resolution)
    set({ version: get().version + 1 })
  },

  applyBrushStroke: (changes: Map<number, number>, opts?: { deferVersion?: boolean }) => {
    const { heightmap, resolution } = get()
    for (const [index, height] of changes) {
      if (index >= 0 && index < heightmap.length) {
        heightmap[index] = height
      }
    }
    clampEdge(heightmap, resolution)
    if (!opts?.deferVersion) {
      set({ version: get().version + 1 })
    }
  },

  flushVisualVersion: () => {
    set({ version: get().version + 1 })
  },

  commitPhysics: () => {
    set({ physicsVersion: get().physicsVersion + 1 })
  },

  loadHeightmap: (data: number[]) => {
    const { resolution } = get()
    const heightmap = new Float32Array(resolution * resolution)
    const len = Math.min(data.length, heightmap.length)
    for (let i = 0; i < len; i++) {
      heightmap[i] = data[i]
    }
    const v = get().version + 1
    set({ heightmap, version: v, physicsVersion: v })
  },

  getHeightsArray: () => {
    const { heightmap } = get()
    return Array.from(heightmap)
  },

  resetHeightmap: () => {
    const { resolution } = get()
    const v = get().version + 1
    set({
      heightmap: new Float32Array(resolution * resolution),
      version: v,
      physicsVersion: v,
    })
  },
}))
