import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type WheelVisualKey = 'fl' | 'fr' | 'rl' | 'rr'

export interface WheelVisualOffset {
  x: number
  y: number
  z: number
}

export interface WheelVisualWheelTuning {
  camberDeg: number
  spinAxis: WheelVisualOffset
  spinSign: number
  offset: WheelVisualOffset
}

export interface WheelVisualTuningState {
  wheels: Record<WheelVisualKey, WheelVisualWheelTuning>
  setWheelSpinAxis: (wheel: WheelVisualKey, axis: keyof WheelVisualOffset, value: number) => void
  setWheelCamber: (wheel: WheelVisualKey, camberDeg: number) => void
  setWheelSpinSign: (wheel: WheelVisualKey, spinSign: number) => void
  setWheelOffset: (wheel: WheelVisualKey, axis: keyof WheelVisualOffset, value: number) => void
  reset: () => void
}

const DEFAULT_WHEEL_TUNING: Record<WheelVisualKey, WheelVisualWheelTuning> = {
  fl: { camberDeg: 3.5, spinAxis: { x: 1, y: 0.07, z: 0 }, spinSign: 1, offset: { x: 0, y: 0, z: 0 } },
  fr: { camberDeg: -3.5, spinAxis: { x: 1, y: -0.07, z: 0 }, spinSign: 1, offset: { x: 0, y: 0, z: 0 } },
  rl: { camberDeg: 0, spinAxis: { x: 1, y: 0.02, z: 0 }, spinSign: 1, offset: { x: 0, y: 0, z: 0 } },
  rr: { camberDeg: 0, spinAxis: { x: 1, y: -0.02, z: 0 }, spinSign: 1, offset: { x: 0, y: 0, z: 0 } },
}

export const DEFAULT_WHEEL_VISUAL_TUNING = {
  wheels: DEFAULT_WHEEL_TUNING,
}

function cloneDefaults() {
  return {
    wheels: {
      fl: {
        ...DEFAULT_WHEEL_TUNING.fl,
        spinAxis: { ...DEFAULT_WHEEL_TUNING.fl.spinAxis },
        offset: { ...DEFAULT_WHEEL_TUNING.fl.offset },
      },
      fr: {
        ...DEFAULT_WHEEL_TUNING.fr,
        spinAxis: { ...DEFAULT_WHEEL_TUNING.fr.spinAxis },
        offset: { ...DEFAULT_WHEEL_TUNING.fr.offset },
      },
      rl: {
        ...DEFAULT_WHEEL_TUNING.rl,
        spinAxis: { ...DEFAULT_WHEEL_TUNING.rl.spinAxis },
        offset: { ...DEFAULT_WHEEL_TUNING.rl.offset },
      },
      rr: {
        ...DEFAULT_WHEEL_TUNING.rr,
        spinAxis: { ...DEFAULT_WHEEL_TUNING.rr.spinAxis },
        offset: { ...DEFAULT_WHEEL_TUNING.rr.offset },
      },
    },
  }
}

export const useWheelVisualTuningStore = create<WheelVisualTuningState>()(
  persist(
    set => ({
      ...cloneDefaults(),
      setWheelSpinAxis: (wheel, axis, value) =>
        set(state => ({
          wheels: {
            ...state.wheels,
            [wheel]: {
              ...state.wheels[wheel],
              spinAxis: { ...state.wheels[wheel].spinAxis, [axis]: value },
            },
          },
        })),
      setWheelCamber: (wheel, camberDeg) =>
        set(state => ({
          wheels: {
            ...state.wheels,
            [wheel]: { ...state.wheels[wheel], camberDeg },
          },
        })),
      setWheelSpinSign: (wheel, spinSign) =>
        set(state => ({
          wheels: {
            ...state.wheels,
            [wheel]: { ...state.wheels[wheel], spinSign },
          },
        })),
      setWheelOffset: (wheel, axis, value) =>
        set(state => ({
          wheels: {
            ...state.wheels,
            [wheel]: {
              ...state.wheels[wheel],
              offset: { ...state.wheels[wheel].offset, [axis]: value },
            },
          },
        })),
      reset: () => set(cloneDefaults()),
    }),
    {
      name: 'wheel-visual-tuning',
      partialize: state => ({
        wheels: state.wheels,
      }),
      merge: (persisted, current) => {
        const state = { ...current, ...(persisted as Partial<WheelVisualTuningState>) }
        return {
          ...state,
          wheels: {
            fl: {
              ...DEFAULT_WHEEL_TUNING.fl,
              ...state.wheels?.fl,
              spinAxis: {
                ...DEFAULT_WHEEL_TUNING.fl.spinAxis,
                ...state.wheels?.fl?.spinAxis,
              },
              offset: { ...DEFAULT_WHEEL_TUNING.fl.offset, ...state.wheels?.fl?.offset },
            },
            fr: {
              ...DEFAULT_WHEEL_TUNING.fr,
              ...state.wheels?.fr,
              spinAxis: {
                ...DEFAULT_WHEEL_TUNING.fr.spinAxis,
                ...state.wheels?.fr?.spinAxis,
              },
              offset: { ...DEFAULT_WHEEL_TUNING.fr.offset, ...state.wheels?.fr?.offset },
            },
            rl: {
              ...DEFAULT_WHEEL_TUNING.rl,
              ...state.wheels?.rl,
              spinAxis: {
                ...DEFAULT_WHEEL_TUNING.rl.spinAxis,
                ...state.wheels?.rl?.spinAxis,
              },
              offset: { ...DEFAULT_WHEEL_TUNING.rl.offset, ...state.wheels?.rl?.offset },
            },
            rr: {
              ...DEFAULT_WHEEL_TUNING.rr,
              ...state.wheels?.rr,
              spinAxis: {
                ...DEFAULT_WHEEL_TUNING.rr.spinAxis,
                ...state.wheels?.rr?.spinAxis,
              },
              offset: { ...DEFAULT_WHEEL_TUNING.rr.offset, ...state.wheels?.rr?.offset },
            },
          },
        }
      },
    },
  ),
)
