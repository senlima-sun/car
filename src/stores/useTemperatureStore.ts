import { create } from 'zustand'
import type {
  EngineTemperature,
  PerWheelTemperature,
  TemperatureOutput,
} from '../wasm/PhysicsBridge'

// Temperature thresholds for UI colors
export const ENGINE_TEMP_COLD = 0.25 // Below this = cold (blue)
export const ENGINE_TEMP_OPTIMAL = 0.4 // Above this = optimal (green)
export const ENGINE_TEMP_WARNING = 0.75 // Above this = warning (yellow)
export const ENGINE_TEMP_CRITICAL = 0.85 // Above this = critical (red)

export const TIRE_TEMP_COLD = 0.3 // Below this = cold
export const TIRE_TEMP_CRITICAL = 0.9 // Above this = overheated

interface TemperatureState {
  // Engine temperature
  engine: EngineTemperature

  // Per-wheel tire temperatures (inner/outer)
  tires: PerWheelTemperature

  // Per-wheel grip from temperature
  tireGripMultipliers: [number, number, number, number]

  // Per-wheel optimal window status
  tiresInWindow: [boolean, boolean, boolean, boolean]

  // Actions
  syncFromWasm: (output: TemperatureOutput) => void

  // Computed helpers
  getEngineStatus: () => 'cold' | 'optimal' | 'warning' | 'critical'
  getTireStatus: (wheel: number) => 'cold' | 'optimal' | 'hot'
  getWheelAvgTemp: (wheel: number) => number
}

const defaultEngine: EngineTemperature = {
  temperature: 0.3,
  is_overheating: false,
  power_multiplier: 1.0,
}

const defaultTires: PerWheelTemperature = {
  front_left_inner: 0.15,
  front_left_outer: 0.15,
  front_right_inner: 0.15,
  front_right_outer: 0.15,
  rear_left_inner: 0.15,
  rear_left_outer: 0.15,
  rear_right_inner: 0.15,
  rear_right_outer: 0.15,
}

export const useTemperatureStore = create<TemperatureState>((set, get) => ({
  engine: defaultEngine,
  tires: defaultTires,
  tireGripMultipliers: [1, 1, 1, 1],
  tiresInWindow: [false, false, false, false],

  syncFromWasm: output => {
    set({
      engine: output.engine,
      tires: output.tires,
      tireGripMultipliers: output.tire_temp_grip,
      tiresInWindow: output.tire_in_window,
    })
  },

  getEngineStatus: () => {
    const temp = get().engine.temperature
    if (temp >= ENGINE_TEMP_CRITICAL) return 'critical'
    if (temp >= ENGINE_TEMP_WARNING) return 'warning'
    if (temp >= ENGINE_TEMP_OPTIMAL) return 'optimal'
    return 'cold'
  },

  getTireStatus: wheel => {
    const avg = get().getWheelAvgTemp(wheel)
    if (avg >= TIRE_TEMP_CRITICAL) return 'hot'
    if (avg < TIRE_TEMP_COLD) return 'cold'
    return 'optimal'
  },

  getWheelAvgTemp: wheel => {
    const t = get().tires
    switch (wheel) {
      case 0:
        return (t.front_left_inner + t.front_left_outer) / 2
      case 1:
        return (t.front_right_inner + t.front_right_outer) / 2
      case 2:
        return (t.rear_left_inner + t.rear_left_outer) / 2
      case 3:
        return (t.rear_right_inner + t.rear_right_outer) / 2
      default:
        return 0.5
    }
  },
}))
