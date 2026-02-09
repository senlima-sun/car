import { create } from 'zustand'
import type { AeroMode, ActiveAeroState } from '../wasm/PhysicsBridge'

interface ActiveAeroStoreState {
  mode: AeroMode
  autoMode: boolean
  frontWingAngle: number // 0.0-1.0
  rearWingAngle: number // 0.0-1.0
  dragMultiplier: number
  downforceMultiplier: number

  // Actions
  toggleMode: () => void
  toggleAuto: () => void
  syncFromPhysics: (state: ActiveAeroState) => void
}

export const useActiveAeroStore = create<ActiveAeroStoreState>((set, get) => ({
  mode: 'Corner',
  autoMode: true,
  frontWingAngle: 1.0,
  rearWingAngle: 1.0,
  dragMultiplier: 1.0,
  downforceMultiplier: 1.0,

  toggleMode: () => {
    const currentMode = get().mode
    const newMode: AeroMode = currentMode === 'Corner' ? 'Straight' : 'Corner'
    set({ mode: newMode })
  },

  toggleAuto: () => {
    set(state => ({ autoMode: !state.autoMode }))
  },

  syncFromPhysics: (state: ActiveAeroState) => {
    set({
      mode: state.mode,
      autoMode: state.auto_mode,
      frontWingAngle: state.front_wing_angle,
      rearWingAngle: state.rear_wing_angle,
      dragMultiplier: state.drag_multiplier,
      downforceMultiplier: state.downforce_multiplier,
    })
  },
}))
