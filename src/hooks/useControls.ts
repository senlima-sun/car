import { useKeyboardControls } from '@react-three/drei'
import { useTouchControlsStore } from '../stores/useTouchControlsStore'

interface ControlsState {
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

const STEER_SMOOTHING = 8.0
const STEER_CENTER_SMOOTHING = 12.0

let smoothedSteer = 0
let lastSteerTime = 0

export function useControls(): () => ControlsState {
  const [, getKeyboardKeys] = useKeyboardControls()

  return () => {
    const keyboard = getKeyboardKeys() as unknown as ControlsState
    const touch = useTouchControlsStore.getState()

    const now = performance.now()
    const dt = lastSteerTime === 0 ? 1 / 60 : Math.min((now - lastSteerTime) / 1000, 0.05)
    lastSteerTime = now

    const handbrake = keyboard.handbrake || touch.handbrake

    const forward = keyboard.forward || touch.forward
    const backward = keyboard.backward || touch.backward
    const left = keyboard.left || touch.left
    const right = keyboard.right || touch.right

    const rawSteer = left ? -1 : right ? 1 : 0
    const rate = rawSteer === 0 ? STEER_CENTER_SMOOTHING : STEER_SMOOTHING
    smoothedSteer += (rawSteer - smoothedSteer) * Math.min(dt * rate, 1)
    if (Math.abs(smoothedSteer) < 0.001) smoothedSteer = 0

    const steer = smoothedSteer
    const throttle = forward ? 1 : 0
    const brakeAnalog = backward ? 1 : 0

    return {
      forward,
      backward,
      left,
      right,
      brake: backward,
      handbrake,
      ersPreset: keyboard.ersPreset,
      overtake: keyboard.overtake || false,
      aero: keyboard.aero,
      aeroAuto: keyboard.aeroAuto || false,
      brakeIncr: keyboard.brakeIncr || false,
      brakeDecr: keyboard.brakeDecr || false,
      engineBrake: keyboard.engineBrake || false,
      camera: keyboard.camera || touch.camera,
      windView: keyboard.windView || false,
      freeCamera: keyboard.freeCamera || false,
      lapTimer: keyboard.lapTimer || false,
      pitStop: keyboard.pitStop || false,
      steer,
      throttle,
      brakeAnalog,
    }
  }
}
