import { create } from 'zustand'
import type {
  EngineTemperature,
  PerWheelTemperature,
  TemperatureOutput,
} from '../wasm/PhysicsBridge'

// Temperature thresholds for UI colors (normalized scale 0-1 = 20-160C engine, 20-180C tire)
export const ENGINE_TEMP_COLD = 0.286 // ~60C — below this = cold (blue)
export const ENGINE_TEMP_OPTIMAL = 0.5 // ~90C — above this = optimal (green)
export const ENGINE_TEMP_WARNING = 0.679 // ~115C — lift-and-coast
export const ENGINE_TEMP_CRITICAL = 0.75 // ~125C — ECU derate

export const TIRE_TEMP_COLD = 0.313 // ~70C
export const TIRE_TEMP_CRITICAL = 0.75 // ~140C — blistering zone

interface TemperatureState {
  // Engine temperature
  engine: EngineTemperature

  // Per-wheel tire temperatures (inner/outer)
  tires: PerWheelTemperature

  // Per-wheel grip from temperature
  tireGripMultipliers: [number, number, number, number]

  // Per-wheel optimal window status
  tiresInWindow: [boolean, boolean, boolean, boolean]

  // Per-wheel blowout risk (0.0 = safe, 1.0 = burst)
  tireBlowoutRisk: [number, number, number, number]

  // Per-wheel "tire has blown" latched state
  tireBlown: [boolean, boolean, boolean, boolean]

  // Engine seize risk + latched seize state
  engineSeizeRisk: number
  engineSeized: boolean

  // Actions
  syncFromWasm: (output: TemperatureOutput) => void

  // Computed helpers
  getEngineStatus: () => 'cold' | 'optimal' | 'warning' | 'critical'
  getTireStatus: (wheel: number) => 'cold' | 'optimal' | 'hot'
  getWheelAvgTemp: (wheel: number) => number
}

const defaultEngine: EngineTemperature = {
  temperature: 0.429,
  is_overheating: false,
  power_multiplier: 1.0,
}

const defaultTires: PerWheelTemperature = {
  front_left_inner: 0.125,
  front_left_outer: 0.125,
  front_right_inner: 0.125,
  front_right_outer: 0.125,
  rear_left_inner: 0.125,
  rear_left_outer: 0.125,
  rear_right_inner: 0.125,
  rear_right_outer: 0.125,
}

export const useTemperatureStore = create<TemperatureState>((set, get) => ({
  engine: defaultEngine,
  tires: defaultTires,
  tireGripMultipliers: [1, 1, 1, 1],
  tiresInWindow: [false, false, false, false],
  tireBlowoutRisk: [0, 0, 0, 0],
  tireBlown: [false, false, false, false],
  engineSeizeRisk: 0,
  engineSeized: false,

  syncFromWasm: output => {
    const prev = get()
    const nextEngine = output.engine
    const nextTires = output.tires
    const nextGrip = output.tire_temp_grip
    const nextWindow = output.tire_in_window
    const nextBlowoutRisk = output.tire_blowout_risk
    const nextBlown = output.tire_blown
    const nextSeizeRisk = output.engine_seize_risk
    const nextSeized = output.engine_seized

    const engineChanged =
      Math.abs(nextEngine.temperature - prev.engine.temperature) > 0.001 ||
      nextEngine.is_overheating !== prev.engine.is_overheating ||
      Math.abs(nextEngine.power_multiplier - prev.engine.power_multiplier) > 0.001

    const t = prev.tires
    const tiresChanged =
      Math.abs(nextTires.front_left_inner - t.front_left_inner) > 0.002 ||
      Math.abs(nextTires.front_left_outer - t.front_left_outer) > 0.002 ||
      Math.abs(nextTires.front_right_inner - t.front_right_inner) > 0.002 ||
      Math.abs(nextTires.front_right_outer - t.front_right_outer) > 0.002 ||
      Math.abs(nextTires.rear_left_inner - t.rear_left_inner) > 0.002 ||
      Math.abs(nextTires.rear_left_outer - t.rear_left_outer) > 0.002 ||
      Math.abs(nextTires.rear_right_inner - t.rear_right_inner) > 0.002 ||
      Math.abs(nextTires.rear_right_outer - t.rear_right_outer) > 0.002

    const g = prev.tireGripMultipliers
    const gripChanged =
      Math.abs(nextGrip[0] - g[0]) > 0.002 ||
      Math.abs(nextGrip[1] - g[1]) > 0.002 ||
      Math.abs(nextGrip[2] - g[2]) > 0.002 ||
      Math.abs(nextGrip[3] - g[3]) > 0.002

    const w = prev.tiresInWindow
    const windowChanged =
      nextWindow[0] !== w[0] ||
      nextWindow[1] !== w[1] ||
      nextWindow[2] !== w[2] ||
      nextWindow[3] !== w[3]

    const r = prev.tireBlowoutRisk
    const riskChanged =
      Math.abs(nextBlowoutRisk[0] - r[0]) > 0.005 ||
      Math.abs(nextBlowoutRisk[1] - r[1]) > 0.005 ||
      Math.abs(nextBlowoutRisk[2] - r[2]) > 0.005 ||
      Math.abs(nextBlowoutRisk[3] - r[3]) > 0.005

    const b = prev.tireBlown
    const blownChanged =
      nextBlown[0] !== b[0] ||
      nextBlown[1] !== b[1] ||
      nextBlown[2] !== b[2] ||
      nextBlown[3] !== b[3]

    const seizeChanged =
      Math.abs(nextSeizeRisk - prev.engineSeizeRisk) > 0.005 ||
      nextSeized !== prev.engineSeized

    if (
      !engineChanged &&
      !tiresChanged &&
      !gripChanged &&
      !windowChanged &&
      !riskChanged &&
      !blownChanged &&
      !seizeChanged
    )
      return

    set({
      engine: engineChanged ? nextEngine : prev.engine,
      tires: tiresChanged ? nextTires : prev.tires,
      tireGripMultipliers: gripChanged ? nextGrip : prev.tireGripMultipliers,
      tiresInWindow: windowChanged ? nextWindow : prev.tiresInWindow,
      tireBlowoutRisk: riskChanged ? nextBlowoutRisk : prev.tireBlowoutRisk,
      tireBlown: blownChanged ? nextBlown : prev.tireBlown,
      engineSeizeRisk: seizeChanged ? nextSeizeRisk : prev.engineSeizeRisk,
      engineSeized: seizeChanged ? nextSeized : prev.engineSeized,
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
