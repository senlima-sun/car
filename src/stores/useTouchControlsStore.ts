import { create } from 'zustand'

interface TouchControlsState {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  brake: boolean
  handbrake: boolean
  drs: boolean
  camera: boolean

  // Actions
  setForward: (value: boolean) => void
  setBackward: (value: boolean) => void
  setLeft: (value: boolean) => void
  setRight: (value: boolean) => void
  setBrake: (value: boolean) => void
  setHandbrake: (value: boolean) => void
  setDrs: (value: boolean) => void
  setCamera: (value: boolean) => void

  // Compound actions for D-pad diagonal movement
  setForwardLeft: (value: boolean) => void
  setForwardRight: (value: boolean) => void

  // Reset all controls
  resetAll: () => void
}

const initialState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  brake: false,
  handbrake: false,
  drs: false,
  camera: false,
}

export const useTouchControlsStore = create<TouchControlsState>(set => ({
  ...initialState,

  setForward: value => set({ forward: value }),
  setBackward: value => set({ backward: value }),
  setLeft: value => set({ left: value, right: value ? false : undefined }),
  setRight: value => set({ right: value, left: value ? false : undefined }),
  setBrake: value => set({ brake: value }),
  setHandbrake: value => set({ handbrake: value }),
  setDrs: value => set({ drs: value }),
  setCamera: value => set({ camera: value }),

  // Diagonal movements
  setForwardLeft: value =>
    set({
      forward: value,
      left: value,
      right: false,
    }),
  setForwardRight: value =>
    set({
      forward: value,
      right: value,
      left: false,
    }),

  resetAll: () => set(initialState),
}))
