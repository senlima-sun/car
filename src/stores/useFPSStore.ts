import { create } from 'zustand'

interface FPSState {
  fps: number
  updateFPS: (fps: number) => void
}

export const useFPSStore = create<FPSState>(set => ({
  fps: 60,
  updateFPS: (fps: number) => set({ fps }),
}))
