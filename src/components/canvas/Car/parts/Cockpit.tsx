import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCarStore } from '../../../../stores/useCarStore'
import { useGameStore } from '../../../../stores/useGameStore'
import { getWheelAngleRad, isLockActive } from '../../../../input/mouseSteeringState'
import { SteeringWheel } from './SteeringWheel'

interface CockpitProps {
  steerAngle: number
  showDisplay: boolean
}

const SW_ANGLE_GAIN = 1.5

export function Cockpit({ showDisplay }: CockpitProps) {
  const steerRef = useRef(0)

  useFrame(() => {
    const mouseEnabled = useGameStore.getState().mouseSteeringEnabled
    if (mouseEnabled && isLockActive()) {
      steerRef.current = getWheelAngleRad() / SW_ANGLE_GAIN
    } else {
      steerRef.current = useCarStore.getState().steerAngle
    }
  })

  return (
    <group>
      <SteeringWheel steerAngle={steerRef.current} showDisplay={showDisplay} />
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
