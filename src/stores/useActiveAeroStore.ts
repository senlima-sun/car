import { create } from 'zustand'
import type { AeroMode, ActiveAeroState } from '../wasm/PhysicsBridge'

interface ActiveAeroStoreState {
  mode: AeroMode
  frontWingAngle: number // 0.0-1.0
  rearWingAngle: number // 0.0-1.0
  dragMultiplier: number
  downforceMultiplier: number

  // Actions
  toggleMode: () => void
  syncFromPhysics: (state: ActiveAeroState) => void
}

export const useActiveAeroStore = create<ActiveAeroStoreState>((set, get) => ({
  mode: 'Corner',
  frontWingAngle: 1.0, // Default: Corner mode (high downforce)
  rearWingAngle: 1.0,
  dragMultiplier: 1.0,
  downforceMultiplier: 1.0,

  toggleMode: () => {
    const currentMode = get().mode
    const newMode: AeroMode = currentMode === 'Corner' ? 'Straight' : 'Corner'
    set({ mode: newMode })
  },

  syncFromPhysics: (state: ActiveAeroState) => {
    set({
      mode: state.mode,
      frontWingAngle: state.front_wing_angle,
      rearWingAngle: state.rear_wing_angle,
      dragMultiplier: state.drag_multiplier,
      downforceMultiplier: state.downforce_multiplier,
    })
  },
}))
