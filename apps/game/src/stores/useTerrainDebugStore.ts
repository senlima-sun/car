import { create } from 'zustand'

const WHEEL_COUNT = 4
const RAY_STRIDE = 7
export const RAY_DATA_LENGTH = WHEEL_COUNT * RAY_STRIDE
export const RAY_HIT_MISS_SENTINEL = -1

export type TerrainDebugLayer = 'wireframe' | 'cutFill' | 'suspensionRays' | 'oob'

interface TerrainDebugState {
  enabled: boolean
  showWireframe: boolean
  showCutFill: boolean
  showSuspensionRays: boolean
  showOOBBand: boolean
  oobActive: boolean
  rayData: Float32Array
  rayFrame: number
  publishRays: (data: Float32Array) => void
  setLayer: (key: TerrainDebugLayer, on: boolean) => void
  setEnabled: (on: boolean) => void
  setOOBActive: (on: boolean) => void
}

function readEnabledFromUrl(): boolean {
  if (import.meta.env.PROD) return false
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('debug') === 'terrain'
  } catch {
    return false
  }
}

export const useTerrainDebugStore = create<TerrainDebugState>((set, get) => {
  const rayData = new Float32Array(RAY_DATA_LENGTH)
  for (let i = 0; i < WHEEL_COUNT; i++) {
    rayData[i * RAY_STRIDE + 6] = RAY_HIT_MISS_SENTINEL
  }
  return {
    enabled: readEnabledFromUrl(),
    showWireframe: true,
    showCutFill: true,
    showSuspensionRays: true,
    showOOBBand: true,
    oobActive: false,
    rayData,
    rayFrame: 0,

    publishRays: data => {
      const target = get().rayData
      const len = Math.min(data.length, target.length)
      for (let i = 0; i < len; i++) target[i] = data[i]!
      set(state => ({ rayFrame: state.rayFrame + 1 }))
    },

    setLayer: (key, on) => {
      switch (key) {
        case 'wireframe':
          set({ showWireframe: on })
          break
        case 'cutFill':
          set({ showCutFill: on })
          break
        case 'suspensionRays':
          set({ showSuspensionRays: on })
          break
        case 'oob':
          set({ showOOBBand: on })
          break
      }
    },

    setEnabled: on => set({ enabled: on }),
    setOOBActive: on => {
      if (get().oobActive !== on) set({ oobActive: on })
    },
  }
})
