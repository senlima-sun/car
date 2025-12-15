import { create } from 'zustand'

// Curb state tracking for WASM physics integration
// Physics calculations are handled by the Rust/WASM engine

interface CurbState {
  // Is car currently on any curb
  isOnCurb: boolean

  // Which side of the track (for in/out turn determination)
  curbSide: 'left' | 'right' | null

  // Number of curbs currently in contact (for overlapping curbs)
  contactCount: number

  // Actions
  enterCurb: (side: 'left' | 'right') => void
  exitCurb: () => void
  reset: () => void
}

export const useCurbStore = create<CurbState>((set, get) => ({
  isOnCurb: false,
  curbSide: null,
  contactCount: 0,

  enterCurb: side => {
    const state = get()
    const newContactCount = state.contactCount + 1

    set({
      isOnCurb: true,
      curbSide: side,
      contactCount: newContactCount,
    })
  },

  exitCurb: () => {
    const state = get()
    const newContactCount = Math.max(0, state.contactCount - 1)

    if (newContactCount === 0) {
      set({
        isOnCurb: false,
        curbSide: null,
        contactCount: 0,
      })
    } else {
      set({
        contactCount: newContactCount,
      })
    }
  },

  reset: () => {
    set({
      isOnCurb: false,
      curbSide: null,
      contactCount: 0,
    })
  },
}))
