import { useCarStore } from '../../../../stores/useCarStore'
import { useGameStore } from '../../../../stores/useGameStore'
import { getWheelAngleRad, isLockActive } from '../../../../input/mouseSteeringState'

const KEYBOARD_TIRE_ANGLE_RAD = 0.3
const TIRE_TO_WHEEL_RATIO = Math.PI / KEYBOARD_TIRE_ANGLE_RAD

export function readSteeringWheelAngle(): number {
  const mouseEnabled = useGameStore.getState().mouseSteeringEnabled
  if (mouseEnabled && isLockActive()) {
    return getWheelAngleRad()
  }
  const tireAngle = useCarStore.getState().steerAngle
  return -tireAngle * TIRE_TO_WHEEL_RATIO
}
