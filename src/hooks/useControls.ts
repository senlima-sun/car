import { useKeyboardControls } from '@react-three/drei'
import { useTouchControlsStore } from '../stores/useTouchControlsStore'
import { useRemoteControlStore } from '../stores/useRemoteControlStore'

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
  brakeIncr: boolean
  brakeDecr: boolean
  engineBrake: boolean
  camera: boolean
  heatmap: boolean
  distanceGrid: boolean
  freeCamera: boolean
  lapTimer: boolean
  pitStop: boolean
  steer: number
  throttle: number
  brakeAnalog: number
}

export function useControls(): () => ControlsState {
  const [, getKeyboardKeys] = useKeyboardControls()

  return () => {
    const keyboard = getKeyboardKeys() as unknown as ControlsState
    const touch = useTouchControlsStore.getState()
    const remote = useRemoteControlStore.getState()
    const isRemote = remote.connectionStatus === 'connected'

    const forward = keyboard.forward || touch.forward
    const backward = keyboard.backward || touch.backward
    const left = keyboard.left || touch.left
    const right = keyboard.right || touch.right
    const brake = keyboard.brake || touch.brake

    return {
      forward,
      backward,
      left,
      right,
      brake,
      handbrake: keyboard.handbrake || touch.handbrake || (isRemote && remote.handbrake),
      ersPreset: keyboard.ersPreset || (isRemote && remote.buttons.ers),
      overtake: keyboard.overtake || false,
      aero: keyboard.aero || (isRemote && remote.buttons.aero),
      brakeIncr: keyboard.brakeIncr || false,
      brakeDecr: keyboard.brakeDecr || false,
      engineBrake: keyboard.engineBrake || false,
      camera: keyboard.camera || touch.camera || (isRemote && remote.buttons.camera),
      heatmap: keyboard.heatmap || false,
      distanceGrid: keyboard.distanceGrid || false,
      freeCamera: keyboard.freeCamera || false,
      lapTimer: keyboard.lapTimer || false,
      pitStop: keyboard.pitStop || false,
      steer: isRemote ? remote.steer : left ? -1 : right ? 1 : 0,
      throttle: isRemote ? remote.throttle : forward ? 1 : 0,
      brakeAnalog: isRemote ? remote.brake : brake || backward ? 1 : 0,
    }
  }
}
