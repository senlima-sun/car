import { create } from 'zustand'

interface FPSState {
  fps: number
  updateFPS: (fps: number) => void
}

export const useFPSStore = create<FPSState>(set => ({
  fps: 120,
  updateFPS: (fps: number) => set({ fps: Math.min(999, Math.max(0, Math.round(fps))) }),
}))
