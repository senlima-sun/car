import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CAR_COLORS } from '../constants/materials'
import { useCarStore } from '../../../../stores/useCarStore'
import { SteeringWheel } from './SteeringWheel'

interface CockpitProps {
  steerAngle: number
  showDisplay: boolean
}

export function Cockpit({ showDisplay }: CockpitProps) {
  const cockpitColor = CAR_COLORS.cockpit
  const steerRef = useRef(0)

  useFrame(() => {
    steerRef.current = useCarStore.getState().steerAngle
  })

  return (
    <group>
      <mesh castShadow position={[0, -0.05, 0.18]}>
        <boxGeometry args={[0.65, 0.1, 1.56]} />
        <meshStandardMaterial color={cockpitColor} metalness={0.5} roughness={0.5} />
      </mesh>
      <SteeringWheel steerAngle={steerRef.current} showDisplay={showDisplay} />
    </group>
  )
}
