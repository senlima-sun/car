import { useRef } from 'react'
import { useGameStore } from '../../../../stores/useGameStore'
import { useSessionStore } from '../../../../stores/useSessionStore'
import { useThermalViewStore } from '../../../../stores/useThermalViewStore'
import { useHeatmapStore } from '../../../../stores/useHeatmapStore'
import { useWindViewStore } from '../../../../stores/useWindViewStore'
import { useErsStore } from '../../../../stores/useErsStore'
import { useActiveAeroStore } from '../../../../stores/useActiveAeroStore'
import { useLapTimeStore } from '../../../../stores/useLapTimeStore'
import { usePitStore } from '../../../../stores/usePitStore'
import { getLogger } from '../../../../debug/ActionLogger'
import { IS_DEV } from '../../../../utils/isDev'

type PhysicsContext = ReturnType<typeof import('../../../../wasm').usePhysics>

interface Keys {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  brake: boolean
  handbrake: boolean
  ersPreset: boolean
  overtake: boolean
  aero: boolean
  aeroAuto: boolean
  brakeIncr: boolean
  brakeDecr: boolean
  engineBrake: boolean
  camera: boolean
  heatmap: boolean
  freeCamera: boolean
  lapTimer: boolean
  pitStop: boolean
  steer: number
  throttle: number
  brakeAnalog: number
}

interface CarInputOptions {
  physics: PhysicsContext
}

export function useCarInputControl({ physics }: CarInputOptions) {
  const toggleCameraMode = useGameStore(state => state.toggleCameraMode)
  const toggleFreeCamera = useGameStore(state => state.toggleFreeCamera)
  const isTestingMode = useSessionStore(state => state.config?.testingMode ?? false)

  const toggleThermalView = useThermalViewStore(state => state.toggle)
  const toggleHeatmap = useHeatmapStore(state => state.toggleHeatmap)
  const toggleWindView = useWindViewStore(state => state.toggle)

  const activateOvertake = useErsStore(state => state.activateOvertake)
  const cycleSemiAutoPreset = useErsStore(state => state.cycleSemiAutoPreset)

  const toggleAeroMode = useActiveAeroStore(state => state.toggleMode)

  const toggleLapRecording = useLapTimeStore(state => state.toggleRecording)
  const toggleRacingLine = useLapTimeStore(state => state.toggleRacingLine)

  const startPitStop = usePitStore(state => state.startPitStop)

  const lastCameraToggle = useRef(0)
  const lastFreeCamToggle = useRef(0)
  const lastHeatmapToggle = useRef(0)
  const lastErsPresetToggle = useRef(0)
  const lastOvertakeToggle = useRef(0)
  const lastAeroModeToggle = useRef(0)
  const lastAeroAutoToggle = useRef(0)
  const lastBrakeIncrToggle = useRef(0)
  const lastBrakeDecrToggle = useRef(0)
  const lastEngineBrakeToggle = useRef(0)
  const lastLapTimerToggle = useRef(0)
  const lastPitStopToggle = useRef(0)

  const handleInputs = (elapsedTime: number, keys: Keys) => {
    const logger = IS_DEV ? getLogger() : null

    if (keys.camera && elapsedTime - lastCameraToggle.current > 0.3) {
      toggleCameraMode()
      lastCameraToggle.current = elapsedTime
      logger?.log(
        'input',
        'input.key.camera',
        'useCarInputControl',
        { key: 'C' },
        { action: 'toggleCameraMode' },
      )
    }

    if (isTestingMode && keys.heatmap && elapsedTime - lastHeatmapToggle.current > 0.3) {
      toggleHeatmap()
      toggleThermalView()
      toggleWindView()
      lastHeatmapToggle.current = elapsedTime
      logger?.log(
        'input',
        'input.key.heatmap',
        'useCarInputControl',
        { key: 'H' },
        { action: 'toggleHeatmap' },
      )
    }

    if (isTestingMode && keys.freeCamera && elapsedTime - lastFreeCamToggle.current > 0.3) {
      toggleFreeCamera()
      lastFreeCamToggle.current = elapsedTime
      logger?.log(
        'input',
        'input.key.freeCamera',
        'useCarInputControl',
        { key: 'F' },
        { action: 'toggleFreeCamera' },
      )
    }

    if (keys.ersPreset && elapsedTime - lastErsPresetToggle.current > 0.3) {
      cycleSemiAutoPreset()
      const freshPreset = useErsStore.getState().semiAutoConfig.preset
      physics.setErsSemiAutoPreset(freshPreset)
      lastErsPresetToggle.current = elapsedTime
      logger?.log(
        'input',
        'input.key.ersPreset',
        'useCarInputControl',
        { key: 'G' },
        { preset: freshPreset },
      )
    }

    if (isTestingMode && keys.overtake && elapsedTime - lastOvertakeToggle.current > 0.3) {
      activateOvertake()
      lastOvertakeToggle.current = elapsedTime
      logger?.log(
        'input',
        'input.key.overtake',
        'useCarInputControl',
        { key: 'O' },
        { action: 'activateOvertake' },
      )
    }

    if (keys.aero && elapsedTime - lastAeroModeToggle.current > 0.3) {
      toggleAeroMode()
      lastAeroModeToggle.current = elapsedTime
      logger?.log(
        'input',
        'input.key.aero',
        'useCarInputControl',
        { key: 'K' },
        { action: 'toggleAeroMode' },
      )
    }

    if (keys.aeroAuto && elapsedTime - lastAeroAutoToggle.current > 0.3) {
      physics.toggleAeroAuto()
      lastAeroAutoToggle.current = elapsedTime
      logger?.log(
        'input',
        'input.key.aeroAuto',
        'useCarInputControl',
        { key: 'E' },
        { action: 'toggleAeroAuto' },
      )
    }

    if (isTestingMode && keys.brakeIncr && elapsedTime - lastBrakeIncrToggle.current > 0.3) {
      physics.increaseBrakeBias()
      lastBrakeIncrToggle.current = elapsedTime
      logger?.log(
        'input',
        'input.key.brakeIncr',
        'useCarInputControl',
        { key: ']' },
        { action: 'increaseBrakeBias' },
      )
    }

    if (isTestingMode && keys.brakeDecr && elapsedTime - lastBrakeDecrToggle.current > 0.3) {
      physics.decreaseBrakeBias()
      lastBrakeDecrToggle.current = elapsedTime
      logger?.log(
        'input',
        'input.key.brakeDecr',
        'useCarInputControl',
        { key: '[' },
        { action: 'decreaseBrakeBias' },
      )
    }

    if (keys.engineBrake && elapsedTime - lastEngineBrakeToggle.current > 0.3) {
      physics.cycleEngineBrakingLevel()
      lastEngineBrakeToggle.current = elapsedTime
      logger?.log(
        'input',
        'input.key.engineBrake',
        'useCarInputControl',
        { key: 'N' },
        { action: 'cycleEngineBrakingLevel' },
      )
    }

    if (keys.lapTimer && elapsedTime - lastLapTimerToggle.current > 0.3) {
      toggleLapRecording()
      toggleRacingLine()
      lastLapTimerToggle.current = elapsedTime
      logger?.log(
        'input',
        'input.key.lapTimer',
        'useCarInputControl',
        { key: 'L' },
        { action: 'toggleLapRecording' },
      )
    }

    if (keys.pitStop && elapsedTime - lastPitStopToggle.current > 0.3) {
      startPitStop()
      lastPitStopToggle.current = elapsedTime
      logger?.log(
        'input',
        'input.key.pitStop',
        'useCarInputControl',
        { key: 'P' },
        { action: 'startPitStop' },
      )
    }
  }

  return { handleInputs }
}
