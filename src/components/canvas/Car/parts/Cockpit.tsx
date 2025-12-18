import { CAR_COLORS } from '../constants/materials'
import { SteeringWheel } from './SteeringWheel'

interface CockpitProps {
  steerAngle: number
  speed: number
  showSpeedDisplay: boolean
}

/**
 * Driver cockpit with floor, walls, and steering wheel
 */
export function Cockpit({ steerAngle, speed, showSpeedDisplay }: CockpitProps) {
  const cockpitColor = CAR_COLORS.cockpit

  return (
    <group>
      {/* Cockpit floor */}
      <mesh castShadow position={[0, -0.05, 0.15]}>
        <boxGeometry args={[0.65, 0.1, 1.3]} />
        <meshStandardMaterial color={cockpitColor} metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Steering wheel */}
      <SteeringWheel steerAngle={steerAngle} speed={speed} showSpeedDisplay={showSpeedDisplay} />
    </group>
  )
}
