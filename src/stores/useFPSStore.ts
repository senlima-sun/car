import { create } from 'zustand'

const HISTORY_SIZE = 60

interface FPSState {
  fps: number
  history: number[]
  updateFPS: (fps: number) => void
}

export const useFPSStore = create<FPSState>(set => ({
  fps: 120,
  history: Array(HISTORY_SIZE).fill(120),
  updateFPS: (fps: number) => {
    const clamped = Math.min(999, Math.max(0, Math.round(fps)))
    set(state => {
      const next = state.history.slice(1)
      next.push(clamped)
      return { fps: clamped, history: next }
    })
  },
}))

export const FPS_HISTORY_SIZE = HISTORY_SIZE
