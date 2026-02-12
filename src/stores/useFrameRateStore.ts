import { create } from 'zustand'

export const TARGET_FPS = 120
export const FIXED_TIME_STEP = 1 / TARGET_FPS

interface FrameRateState {
  targetFps: number
  currentFps: number
  averageFps: number
  frameTime: number
  updateCurrentFps: (fps: number) => void
  updateAverageFps: (fps: number) => void
  updateFrameTime: (ms: number) => void
}

export const useFrameRateStore = create<FrameRateState>(set => ({
  targetFps: TARGET_FPS,
  currentFps: 0,
  averageFps: 0,
  frameTime: 0,
  updateCurrentFps: (fps: number) => set({ currentFps: fps }),
  updateAverageFps: (fps: number) => set({ averageFps: fps }),
  updateFrameTime: (ms: number) => set({ frameTime: ms }),
}))
