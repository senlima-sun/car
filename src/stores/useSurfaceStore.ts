import { create } from 'zustand'

// Surface state tracking for WASM physics integration
// Physics calculations are handled by the Rust/WASM engine

export type SurfaceType = 'grass' | 'road' | 'curb' | 'pitroad'

interface SurfaceState {
  // Current surface the car is on
  currentSurface: SurfaceType

  // Number of road segments currently in contact (for overlapping roads)
  roadContactCount: number

  // Number of curb segments currently in contact
  curbContactCount: number

  // Number of pitroad segments currently in contact
  pitroadContactCount: number

  // Actions
  enterSurface: (type: SurfaceType) => void
  exitSurface: (type: SurfaceType) => void
  reset: () => void
}

export const useSurfaceStore = create<SurfaceState>((set, get) => ({
  currentSurface: 'grass',
  roadContactCount: 0,
  curbContactCount: 0,
  pitroadContactCount: 0,

  enterSurface: type => {
    const state = get()

    if (type === 'road') {
      const newCount = state.roadContactCount + 1
      const currentSurface =
        state.curbContactCount > 0 ? 'curb' : state.pitroadContactCount > 0 ? 'pitroad' : 'road'
      set({ roadContactCount: newCount, currentSurface })
    } else if (type === 'curb') {
      const newCount = state.curbContactCount + 1
      set({ curbContactCount: newCount, currentSurface: 'curb' })
    } else if (type === 'pitroad') {
      const newCount = state.pitroadContactCount + 1
      const currentSurface = state.curbContactCount > 0 ? 'curb' : 'pitroad'
      set({ pitroadContactCount: newCount, currentSurface })
    }
  },

  exitSurface: type => {
    const state = get()

    if (type === 'road') {
      const newCount = Math.max(0, state.roadContactCount - 1)
      const currentSurface =
        state.curbContactCount > 0
          ? 'curb'
          : state.pitroadContactCount > 0
            ? 'pitroad'
            : newCount > 0
              ? 'road'
              : 'grass'
      set({ roadContactCount: newCount, currentSurface })
    } else if (type === 'curb') {
      const newCount = Math.max(0, state.curbContactCount - 1)
      const currentSurface =
        newCount > 0
          ? 'curb'
          : state.pitroadContactCount > 0
            ? 'pitroad'
            : state.roadContactCount > 0
              ? 'road'
              : 'grass'
      set({ curbContactCount: newCount, currentSurface })
    } else if (type === 'pitroad') {
      const newCount = Math.max(0, state.pitroadContactCount - 1)
      const currentSurface =
        state.curbContactCount > 0
          ? 'curb'
          : newCount > 0
            ? 'pitroad'
            : state.roadContactCount > 0
              ? 'road'
              : 'grass'
      set({ pitroadContactCount: newCount, currentSurface })
    }
  },

  reset: () => {
    set({
      currentSurface: 'grass',
      roadContactCount: 0,
      curbContactCount: 0,
      pitroadContactCount: 0,
    })
  },
}))
