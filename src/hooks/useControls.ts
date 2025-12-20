import { useKeyboardControls } from '@react-three/drei'
import { useTouchControlsStore } from '../stores/useTouchControlsStore'

interface ControlsState {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  brake: boolean
  handbrake: boolean
  ers: boolean
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
}

// Unified controls hook that merges keyboard and touch inputs
export function useControls(): () => ControlsState {
  const [, getKeyboardKeys] = useKeyboardControls()

  // Return a getter function that merges both input sources
  return () => {
    const keyboard = getKeyboardKeys() as unknown as ControlsState
    const touch = useTouchControlsStore.getState()

    // Merge: if either source says true, result is true
    return {
      forward: keyboard.forward || touch.forward,
      backward: keyboard.backward || touch.backward,
      left: keyboard.left || touch.left,
      right: keyboard.right || touch.right,
      brake: keyboard.brake || touch.brake,
      handbrake: keyboard.handbrake || touch.handbrake,
      ers: keyboard.ers || false,
      ersPreset: keyboard.ersPreset || false,
      overtake: keyboard.overtake || false,
      aero: keyboard.aero || false,
      brakeIncr: keyboard.brakeIncr || false,
      brakeDecr: keyboard.brakeDecr || false,
      engineBrake: keyboard.engineBrake || false,
      camera: keyboard.camera || touch.camera,
      heatmap: keyboard.heatmap || false,
      distanceGrid: keyboard.distanceGrid || false,
      freeCamera: keyboard.freeCamera || false,
    }
  }
}
