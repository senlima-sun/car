import { create } from 'zustand'
import type { EngineBrakingLevel, BrakeState } from '../wasm/PhysicsBridge'

interface BrakeStoreState {
  frontBias: number // 50-70 (percentage)
  engineBraking: EngineBrakingLevel
  frontBrakeForce: number // N
  rearBrakeForce: number // N

  // Actions
  increaseBias: () => void
  decreaseBias: () => void
  cycleEngineBraking: () => void
  syncFromPhysics: (state: BrakeState) => void
}

const ENGINE_BRAKING_CYCLE: EngineBrakingLevel[] = ['Low', 'Medium', 'High']

export const useBrakeStore = create<BrakeStoreState>((set, get) => ({
  frontBias: 60, // Default 60% front, 40% rear
  engineBraking: 'Medium',
  frontBrakeForce: 0,
  rearBrakeForce: 0,

  increaseBias: () => {
    const currentBias = get().frontBias
    const newBias = Math.min(currentBias + 2, 70) // Max 70%
    set({ frontBias: newBias })
  },

  decreaseBias: () => {
    const currentBias = get().frontBias
    const newBias = Math.max(currentBias - 2, 50) // Min 50%
    set({ frontBias: newBias })
  },

  cycleEngineBraking: () => {
    const currentLevel = get().engineBraking
    const currentIndex = ENGINE_BRAKING_CYCLE.indexOf(currentLevel)
    const nextIndex = (currentIndex + 1) % ENGINE_BRAKING_CYCLE.length
    const nextLevel = ENGINE_BRAKING_CYCLE[nextIndex]
    set({ engineBraking: nextLevel })
  },

  syncFromPhysics: (state: BrakeState) => {
    set({
      frontBias: state.front_bias * 100, // Convert 0.50-0.70 to 50-70
      engineBraking: state.engine_braking,
      frontBrakeForce: state.front_brake_force,
      rearBrakeForce: state.rear_brake_force,
    })
  },
}))
