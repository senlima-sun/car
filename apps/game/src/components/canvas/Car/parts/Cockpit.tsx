import { useCarStore } from '../../../../stores/useCarStore'
import { useGameStore } from '../../../../stores/useGameStore'
import { getWheelAngleRad, isLockActive } from '../../../../input/mouseSteeringState'
import { SteeringWheel } from './SteeringWheel'

interface CockpitProps {
  steerAngle: number
  showDisplay: boolean
}

const KEYBOARD_TIRE_ANGLE_RAD = 0.3
const TIRE_TO_WHEEL_RATIO = Math.PI / KEYBOARD_TIRE_ANGLE_RAD

function readWheelAngle(): number {
  const mouseEnabled = useGameStore.getState().mouseSteeringEnabled
  if (mouseEnabled && isLockActive()) {
    return getWheelAngleRad()
  }
  const tireAngle = useCarStore.getState().steerAngle
  return -tireAngle * TIRE_TO_WHEEL_RATIO
}

export function Cockpit({ showDisplay }: CockpitProps) {
  return (
    <group>
      <SteeringWheel getSteerAngle={readWheelAngle} showDisplay={showDisplay} />
      {showDisplay && (
        <>
          <pointLight
            position={[0, 0.55, 3.2]}
            intensity={8}
            distance={3}
            color='#e8e0f0'
            decay={2}
          />
          <pointLight
            position={[0, 0.25, 2.39]}
            intensity={4}
            distance={1.5}
            color='#ffffff'
            decay={2}
          />
        </>
      )}
    </group>
  )
}
