import { create } from 'zustand'
import type { CarPartId } from './useCarPaintStore'

export type ShowroomCameraView = 'orbit' | 'cockpit'

interface ShowroomState {
  floorColor: string
  ringColor: string
  ringOpacity: number
  ambientIntensity: number
  keyLightColor: string
  keyLightIntensity: number
  fillLightColor: string
  fillLightIntensity: number
  rimLightColor: string
  rimLightIntensity: number
  topLightColor: string
  topLightIntensity: number
  hemiSkyColor: string
  hemiGroundColor: string
  hemiIntensity: number
  cameraView: ShowroomCameraView
  hoveredPart: CarPartId | null
  setField: <
    K extends keyof Omit<ShowroomState, 'setField' | 'setHoveredPart' | 'setCameraView' | 'reset'>,
  >(
    key: K,
    value: ShowroomState[K],
  ) => void
  setHoveredPart: (part: CarPartId | null) => void
  setCameraView: (view: ShowroomCameraView) => void
  reset: () => void
}

const DEFAULTS = {
  floorColor: '#070708',
  ringColor: '#c92c2c',
  ringOpacity: 0.22,
  ambientIntensity: 0.45,
  keyLightColor: '#ffffff',
  keyLightIntensity: 2.4,
  fillLightColor: '#8fb4ff',
  fillLightIntensity: 0.9,
  rimLightColor: '#ffd8c2',
  rimLightIntensity: 0.6,
  topLightColor: '#ffe6d0',
  topLightIntensity: 1.5,
  hemiSkyColor: '#9cb8d8',
  hemiGroundColor: '#0a0a0a',
  hemiIntensity: 0.7,
  cameraView: 'orbit' as ShowroomCameraView,
  hoveredPart: null as CarPartId | null,
}

export const useShowroomStore = create<ShowroomState>(set => ({
  ...DEFAULTS,
  setField: (key, value) => set(state => ({ ...state, [key]: value })),
  setHoveredPart: hoveredPart => set({ hoveredPart }),
  setCameraView: cameraView => set({ cameraView }),
  reset: () => set(DEFAULTS),
}))
