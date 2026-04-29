import { useGameStore } from '../../../../stores/useGameStore'
import { useSessionStore } from '../../../../stores/useSessionStore'
import { useWindViewStore } from '../../../../stores/useWindViewStore'
import { useErsStore } from '../../../../stores/useErsStore'
import { useActiveAeroStore } from '../../../../stores/useActiveAeroStore'
import { useLapTimeStore } from '../../../../stores/useLapTimeStore'
import { usePitStore } from '../../../../stores/usePitStore'
import { getLogger } from '../../../../debug/ActionLogger'
import { IS_DEV } from '../../../../utils/isDev'
import { useToggleInput } from './useToggleInput'

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
  windView: boolean
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
  const cameraToggle = useToggleInput()
  const freeCameraToggle = useToggleInput()
  const windViewToggle = useToggleInput()
  const ersPresetToggle = useToggleInput()
  const overtakeToggle = useToggleInput()
  const aeroModeToggle = useToggleInput()
  const aeroAutoToggle = useToggleInput()
  const brakeIncrToggle = useToggleInput()
  const brakeDecrToggle = useToggleInput()
  const engineBrakeToggle = useToggleInput()
  const lapTimerToggle = useToggleInput()
  const pitStopToggle = useToggleInput()

  const handleInputs = (elapsedTime: number, keys: Keys) => {
    const logger = IS_DEV ? getLogger() : null
    const isTestingMode = useSessionStore.getState().config?.testingMode ?? false

    cameraToggle(elapsedTime, {
      pressed: keys.camera,
      handler: () => useGameStore.getState().toggleCameraMode(),
      log: () =>
        logger?.log(
          'input',
          'input.key.camera',
          'useCarInputControl',
          { key: 'C' },
          { action: 'toggleCameraMode' },
        ),
    })

    windViewToggle(elapsedTime, {
      pressed: keys.windView,
      predicate: isTestingMode,
      handler: () => useWindViewStore.getState().toggle(),
      log: () =>
        logger?.log(
          'input',
          'input.key.windView',
          'useCarInputControl',
          { key: 'H' },
          { action: 'toggleWindView' },
        ),
    })

    freeCameraToggle(elapsedTime, {
      pressed: keys.freeCamera,
      predicate: isTestingMode,
      handler: () => useGameStore.getState().toggleFreeCamera(),
      log: () =>
        logger?.log(
          'input',
          'input.key.freeCamera',
          'useCarInputControl',
          { key: 'F' },
          { action: 'toggleFreeCamera' },
        ),
    })

    ersPresetToggle(elapsedTime, {
      pressed: keys.ersPreset,
      handler: () => {
        useErsStore.getState().cycleSemiAutoPreset()
        physics.setErsSemiAutoPreset(useErsStore.getState().semiAutoConfig.preset)
      },
      log: () =>
        logger?.log(
          'input',
          'input.key.ersPreset',
          'useCarInputControl',
          { key: 'G' },
          { preset: useErsStore.getState().semiAutoConfig.preset },
        ),
    })

    overtakeToggle(elapsedTime, {
      pressed: keys.overtake,
      predicate: isTestingMode,
      handler: () => useErsStore.getState().activateOvertake(),
      log: () =>
        logger?.log(
          'input',
          'input.key.overtake',
          'useCarInputControl',
          { key: 'O' },
          { action: 'activateOvertake' },
        ),
    })

    aeroModeToggle(elapsedTime, {
      pressed: keys.aero,
      handler: () => useActiveAeroStore.getState().toggleMode(),
      log: () =>
        logger?.log(
          'input',
          'input.key.aero',
          'useCarInputControl',
          { key: 'K' },
          { action: 'toggleAeroMode' },
        ),
    })

    aeroAutoToggle(elapsedTime, {
      pressed: keys.aeroAuto,
      handler: () => physics.toggleAeroAuto(),
      log: () =>
        logger?.log(
          'input',
          'input.key.aeroAuto',
          'useCarInputControl',
          { key: 'E' },
          { action: 'toggleAeroAuto' },
        ),
    })

    brakeIncrToggle(elapsedTime, {
      pressed: keys.brakeIncr,
      predicate: isTestingMode,
      handler: () => physics.increaseBrakeBias(),
      log: () =>
        logger?.log(
          'input',
          'input.key.brakeIncr',
          'useCarInputControl',
          { key: ']' },
          { action: 'increaseBrakeBias' },
        ),
    })

    brakeDecrToggle(elapsedTime, {
      pressed: keys.brakeDecr,
      predicate: isTestingMode,
      handler: () => physics.decreaseBrakeBias(),
      log: () =>
        logger?.log(
          'input',
          'input.key.brakeDecr',
          'useCarInputControl',
          { key: '[' },
          { action: 'decreaseBrakeBias' },
        ),
    })

    engineBrakeToggle(elapsedTime, {
      pressed: keys.engineBrake,
      handler: () => physics.cycleEngineBrakingLevel(),
      log: () =>
        logger?.log(
          'input',
          'input.key.engineBrake',
          'useCarInputControl',
          { key: 'N' },
          { action: 'cycleEngineBrakingLevel' },
        ),
    })

    lapTimerToggle(elapsedTime, {
      pressed: keys.lapTimer,
      handler: () => {
        useLapTimeStore.getState().toggleRecording()
        useLapTimeStore.getState().toggleRacingLine()
      },
      log: () =>
        logger?.log(
          'input',
          'input.key.lapTimer',
          'useCarInputControl',
          { key: 'L' },
          { action: 'toggleLapRecording' },
        ),
    })

    pitStopToggle(elapsedTime, {
      pressed: keys.pitStop,
      handler: () => usePitStore.getState().startPitStop(),
      log: () =>
        logger?.log(
          'input',
          'input.key.pitStop',
          'useCarInputControl',
          { key: 'P' },
          { action: 'startPitStop' },
        ),
    })
  }

  return { handleInputs }
}
