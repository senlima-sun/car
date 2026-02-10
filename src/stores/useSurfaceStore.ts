import { create } from 'zustand'

export type SurfaceType = 'grass' | 'road' | 'curb' | 'pitroad' | 'gravel'

interface SurfaceState {
  currentSurface: SurfaceType
  roadContactCount: number
  curbContactCount: number
  pitroadContactCount: number
  gravelContactCount: number

  enterSurface: (type: SurfaceType) => void
  exitSurface: (type: SurfaceType) => void
  reset: () => void
}

function resolveSurface(state: {
  curbContactCount: number
  gravelContactCount: number
  pitroadContactCount: number
  roadContactCount: number
}): SurfaceType {
  if (state.curbContactCount > 0) return 'curb'
  if (state.gravelContactCount > 0) return 'gravel'
  if (state.pitroadContactCount > 0) return 'pitroad'
  if (state.roadContactCount > 0) return 'road'
  return 'grass'
}

export const useSurfaceStore = create<SurfaceState>((set, get) => ({
  currentSurface: 'grass',
  roadContactCount: 0,
  curbContactCount: 0,
  pitroadContactCount: 0,
  gravelContactCount: 0,

  enterSurface: type => {
    const state = get()

    if (type === 'road') {
      const newCount = state.roadContactCount + 1
      set({ roadContactCount: newCount, currentSurface: resolveSurface({ ...state, roadContactCount: newCount }) })
    } else if (type === 'curb') {
      const newCount = state.curbContactCount + 1
      set({ curbContactCount: newCount, currentSurface: 'curb' })
    } else if (type === 'pitroad') {
      const newCount = state.pitroadContactCount + 1
      set({ pitroadContactCount: newCount, currentSurface: resolveSurface({ ...state, pitroadContactCount: newCount }) })
    } else if (type === 'gravel') {
      const newCount = state.gravelContactCount + 1
      set({ gravelContactCount: newCount, currentSurface: resolveSurface({ ...state, gravelContactCount: newCount }) })
    } else if (type === 'grass') {
      set({ currentSurface: resolveSurface(state) })
    }
  },

  exitSurface: type => {
    const state = get()

    if (type === 'road') {
      const newCount = Math.max(0, state.roadContactCount - 1)
      set({ roadContactCount: newCount, currentSurface: resolveSurface({ ...state, roadContactCount: newCount }) })
    } else if (type === 'curb') {
      const newCount = Math.max(0, state.curbContactCount - 1)
      set({ curbContactCount: newCount, currentSurface: resolveSurface({ ...state, curbContactCount: newCount }) })
    } else if (type === 'pitroad') {
      const newCount = Math.max(0, state.pitroadContactCount - 1)
      set({ pitroadContactCount: newCount, currentSurface: resolveSurface({ ...state, pitroadContactCount: newCount }) })
    } else if (type === 'gravel') {
      const newCount = Math.max(0, state.gravelContactCount - 1)
      set({ gravelContactCount: newCount, currentSurface: resolveSurface({ ...state, gravelContactCount: newCount }) })
    } else if (type === 'grass') {
      set({ currentSurface: resolveSurface(state) })
    }
  },

  reset: () => {
    set({
      currentSurface: 'grass',
      roadContactCount: 0,
      curbContactCount: 0,
      pitroadContactCount: 0,
      gravelContactCount: 0,
    })
  },
}))
