import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { LIVERY, CARBON_FIBER } from '../../../../constants/f1Livery'
import { useCarStore } from '../../../../stores/useCarStore'
import { SteeringWheel } from './SteeringWheel'

interface CockpitProps {
  steerAngle: number
  showDisplay: boolean
}

export function Cockpit({ showDisplay }: CockpitProps) {
  const steerRef = useRef(0)

  useFrame(() => {
    steerRef.current = useCarStore.getState().steerAngle
  })

  return (
    <group>
      {/* Cockpit tub floor */}
      <mesh castShadow position={[0, -0.08, 0.25]}>
        <boxGeometry args={[0.6, 0.06, 1.2]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      {/* Left cockpit wall */}
      <mesh castShadow position={[0.28, 0.08, 0.25]}>
        <boxGeometry args={[0.04, 0.28, 0.9]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      {/* Right cockpit wall */}
      <mesh castShadow position={[-0.28, 0.08, 0.25]}>
        <boxGeometry args={[0.04, 0.28, 0.9]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      {/* Headrest */}
      <mesh castShadow position={[0, 0.22, -0.08]}>
        <boxGeometry args={[0.22, 0.18, 0.15]} />
        <meshStandardMaterial color={LIVERY.PRIMARY} roughness={0.85} metalness={0.1} />
      </mesh>

      {/* Headrest top pad */}
      <mesh castShadow position={[0, 0.32, -0.06]}>
        <boxGeometry args={[0.18, 0.04, 0.12]} />
        <meshStandardMaterial color={LIVERY.ACCENT_RED} roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Cockpit rim padding - front */}
      <mesh castShadow position={[0, 0.18, 0.68]}>
        <boxGeometry args={[0.5, 0.06, 0.06]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      <SteeringWheel steerAngle={steerRef.current} showDisplay={showDisplay} />
    </group>
  )
}
