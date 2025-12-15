import { useKeyboardControls } from '@react-three/drei'
import { useTouchControlsStore } from '../stores/useTouchControlsStore'

interface ControlsState {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  brake: boolean
  handbrake: boolean
  drs: boolean
  camera: boolean
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
      drs: keyboard.drs || touch.drs,
      camera: keyboard.camera || touch.camera,
    }
  }
}
