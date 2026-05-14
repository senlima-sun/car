import { create } from 'zustand'
import type { TireCompound, TireDisplayConfig } from '../constants/tires'
import { TIRE_CONFIG, DEFAULT_TIRE } from '../constants/tires'
import { setTireWear as setTireWearWasm } from '../wasm/PhysicsBridge'
import type { GripBreakdown, TireMaterialOutput } from '../wasm/PhysicsBridge'

export interface PerWheelWear {
  frontLeft: number
  frontRight: number
  rearLeft: number
  rearRight: number
}

interface TireState {
  currentCompound: TireCompound
  perWheelWear: PerWheelWear
  effectiveGripMultiplier: number
  gripBreakdown: GripBreakdown | null
  tireMaterial: TireMaterialOutput | null
  debugMode: boolean

  setTireCompound: (compound: TireCompound) => void
  syncFromWasm: (wear: PerWheelWear, effectiveGrip: number) => void
  syncGripBreakdown: (breakdown: GripBreakdown) => void
  syncTireMaterial: (material: TireMaterialOutput) => void
  syncAllFromWasm: (
    wear: PerWheelWear,
    effectiveGrip: number,
    breakdown: GripBreakdown | null,
    material: TireMaterialOutput | null,
  ) => void
  resetWear: () => void
  setWearDebug: (wearPercentage: number) => void
  disableDebugMode: () => void
  getTireConfig: () => TireDisplayConfig
  getWorstWheel: () => { position: string; wear: number }
}

const initialPerWheelWear: PerWheelWear = {
  frontLeft: 0,
  frontRight: 0,
  rearLeft: 0,
  rearRight: 0,
}

export const selectAverageWear = (s: { perWheelWear: PerWheelWear }): number =>
  (s.perWheelWear.frontLeft + s.perWheelWear.frontRight + s.perWheelWear.rearLeft + s.perWheelWear.rearRight) / 4

export const useTireStore = create<TireState>((set, get) => ({
  currentCompound: DEFAULT_TIRE,
  perWheelWear: { ...initialPerWheelWear },
  effectiveGripMultiplier: 1.0,
  gripBreakdown: null,
  tireMaterial: null,
  debugMode: false,

  setTireCompound: compound => {
    set({
      currentCompound: compound,
      perWheelWear: { ...initialPerWheelWear },
    })
  },

  syncFromWasm: (wear, effectiveGrip) => {
    if (get().debugMode) return

    set({
      perWheelWear: wear,
      effectiveGripMultiplier: effectiveGrip,
    })
  },

  syncGripBreakdown: breakdown => {
    set({ gripBreakdown: breakdown })
  },

  syncTireMaterial: material => {
    set({ tireMaterial: material })
  },

  syncAllFromWasm: (wear, effectiveGrip, breakdown, material) => {
    const prev = get()
    if (prev.debugMode) return

    const pw = prev.perWheelWear
    const wearChanged =
      Math.abs(wear.frontLeft - pw.frontLeft) > 0.05 ||
      Math.abs(wear.frontRight - pw.frontRight) > 0.05 ||
      Math.abs(wear.rearLeft - pw.rearLeft) > 0.05 ||
      Math.abs(wear.rearRight - pw.rearRight) > 0.05

    const gripChanged = Math.abs(effectiveGrip - prev.effectiveGripMultiplier) > 0.002
    const breakdownChanged = breakdown !== prev.gripBreakdown
    const materialChanged = material !== prev.tireMaterial

    if (!wearChanged && !gripChanged && !breakdownChanged && !materialChanged) return

    set({
      perWheelWear: wearChanged ? wear : prev.perWheelWear,
      effectiveGripMultiplier: gripChanged ? effectiveGrip : prev.effectiveGripMultiplier,
      gripBreakdown: breakdownChanged ? breakdown : prev.gripBreakdown,
      tireMaterial: materialChanged ? material : prev.tireMaterial,
    })
  },

  resetWear: () => {
    set({
      perWheelWear: { ...initialPerWheelWear },
      effectiveGripMultiplier: 1.0,
    })
  },

  setWearDebug: wearPercentage => {
    const clamped = Math.max(0, Math.min(100, wearPercentage))
    const wear: PerWheelWear = {
      frontLeft: clamped,
      frontRight: clamped,
      rearLeft: clamped,
      rearRight: clamped,
    }

    try {
      setTireWearWasm(clamped)
    } catch {
      // WASM may not be initialized yet
    }

    set({
      debugMode: true,
      perWheelWear: wear,
    })
  },

  disableDebugMode: () => {
    set({ debugMode: false })
  },

  getTireConfig: () => {
    return TIRE_CONFIG[get().currentCompound]
  },

  getWorstWheel: () => {
    const { perWheelWear } = get()
    const wheels = [
      { position: 'FL', wear: perWheelWear.frontLeft },
      { position: 'FR', wear: perWheelWear.frontRight },
      { position: 'RL', wear: perWheelWear.rearLeft },
      { position: 'RR', wear: perWheelWear.rearRight },
    ]
    return wheels.reduce((max, w) => (w.wear > max.wear ? w : max), wheels[0])
  },
}))
