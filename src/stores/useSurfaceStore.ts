import { create } from 'zustand'

// Surface state tracking for WASM physics integration
// Physics calculations are handled by the Rust/WASM engine

export type SurfaceType = 'grass' | 'road' | 'curb'

interface SurfaceState {
  // Current surface the car is on
  currentSurface: SurfaceType

  // Number of road segments currently in contact (for overlapping roads)
  roadContactCount: number

  // Number of curb segments currently in contact
  curbContactCount: number

  // Actions
  enterSurface: (type: SurfaceType) => void
  exitSurface: (type: SurfaceType) => void
  reset: () => void
}

export const useSurfaceStore = create<SurfaceState>((set, get) => ({
  currentSurface: 'grass',
  roadContactCount: 0,
  curbContactCount: 0,

  enterSurface: type => {
    const state = get()

    if (type === 'road') {
      const newCount = state.roadContactCount + 1
      set({
        roadContactCount: newCount,
        // Road takes priority over grass
        currentSurface: 'road',
      })
    } else if (type === 'curb') {
      const newCount = state.curbContactCount + 1
      set({
        curbContactCount: newCount,
        // Curb takes priority over road and grass
        currentSurface: 'curb',
      })
    }
  },

  exitSurface: type => {
    const state = get()

    if (type === 'road') {
      const newCount = Math.max(0, state.roadContactCount - 1)
      set({
        roadContactCount: newCount,
        // If no roads and no curbs, fall back to grass
        currentSurface: state.curbContactCount > 0 ? 'curb' : newCount > 0 ? 'road' : 'grass',
      })
    } else if (type === 'curb') {
      const newCount = Math.max(0, state.curbContactCount - 1)
      set({
        curbContactCount: newCount,
        // If no curbs, check roads, then grass
        currentSurface: newCount > 0 ? 'curb' : state.roadContactCount > 0 ? 'road' : 'grass',
      })
    }
  },

  reset: () => {
    set({
      currentSurface: 'grass',
      roadContactCount: 0,
      curbContactCount: 0,
    })
  },
}))
