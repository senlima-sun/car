import { create } from 'zustand'
import type { CurbType } from '../types/trackObjects'

interface CurbState {
  isOnCurb: boolean
  curbSide: 'left' | 'right' | null
  curbType: CurbType | null
  contactCount: number

  enterCurb: (side: 'left' | 'right', curbType?: CurbType) => void
  exitCurb: () => void
  reset: () => void
}

export const useCurbStore = create<CurbState>((set, get) => ({
  isOnCurb: false,
  curbSide: null,
  curbType: null,
  contactCount: 0,

  enterCurb: (side, curbType) => {
    const state = get()
    const newContactCount = state.contactCount + 1

    set({
      isOnCurb: true,
      curbSide: side,
      curbType: curbType ?? 'apex',
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
        curbType: null,
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
      curbType: null,
      contactCount: 0,
    })
  },
}))
