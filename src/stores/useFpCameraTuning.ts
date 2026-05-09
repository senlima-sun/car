import { create } from 'zustand'

interface FpCameraTuningState {
  x: number
  y: number
  z: number
  setX: (v: number) => void
  setY: (v: number) => void
  setZ: (v: number) => void
  reset: () => void
}

export const FP_CAMERA_DEFAULT = { x: 0, y: 1.2, z: 3.35 } as const

export const useFpCameraTuning = create<FpCameraTuningState>(set => ({
  ...FP_CAMERA_DEFAULT,
  setX: v => set({ x: v }),
  setY: v => set({ y: v }),
  setZ: v => set({ z: v }),
  reset: () => set({ ...FP_CAMERA_DEFAULT }),
}))
