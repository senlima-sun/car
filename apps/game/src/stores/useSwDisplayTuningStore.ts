import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface SwDisplayTuningState {
  rotationDeg: Vec3
  position: Vec3
  scale: Vec3
  setRotation: (axis: keyof Vec3, deg: number) => void
  setPosition: (axis: keyof Vec3, value: number) => void
  setScale: (axis: keyof Vec3, value: number) => void
  reset: () => void
}

const DEFAULTS = {
  rotationDeg: { x: 0, y: 0, z: 0 },
  position: { x: 0, y: 0.042, z: -0.028 },
  scale: { x: 0.85, y: 1, z: 0.9 },
}

function cloneDefaults() {
  return {
    rotationDeg: { ...DEFAULTS.rotationDeg },
    position: { ...DEFAULTS.position },
    scale: { ...DEFAULTS.scale },
  }
}

export const useSwDisplayTuningStore = create<SwDisplayTuningState>()(
  persist(
    set => ({
      ...cloneDefaults(),
      setRotation: (axis, deg) =>
        set(state => ({ rotationDeg: { ...state.rotationDeg, [axis]: deg } })),
      setPosition: (axis, value) =>
        set(state => ({ position: { ...state.position, [axis]: value } })),
      setScale: (axis, value) =>
        set(state => ({ scale: { ...state.scale, [axis]: value } })),
      reset: () => set(cloneDefaults()),
    }),
    {
      name: 'sw-display-tuning',
      partialize: state => ({
        rotationDeg: state.rotationDeg,
        position: state.position,
        scale: state.scale,
      }),
      merge: (persisted, current) => {
        const state = { ...current, ...(persisted as Partial<SwDisplayTuningState>) }
        return {
          ...state,
          rotationDeg: { ...DEFAULTS.rotationDeg, ...state.rotationDeg },
          position: { ...DEFAULTS.position, ...state.position },
          scale: { ...DEFAULTS.scale, ...state.scale },
        }
      },
    },
  ),
)
