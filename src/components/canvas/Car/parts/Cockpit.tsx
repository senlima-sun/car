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
        <boxGeometry args={[0.56, 0.06, 1.2]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      {/* Left cockpit wall */}
      <mesh castShadow position={[0.30, 0.08, 0.25]}>
        <boxGeometry args={[0.04, 0.28, 0.90]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      {/* Right cockpit wall */}
      <mesh castShadow position={[-0.30, 0.08, 0.25]}>
        <boxGeometry args={[0.04, 0.28, 0.90]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      {/* Headrest */}
      <mesh castShadow position={[0, 0.22, -0.08]}>
        <boxGeometry args={[0.22, 0.18, 0.16]} />
        <meshStandardMaterial color={LIVERY.PRIMARY} roughness={0.85} metalness={0.1} />
      </mesh>

      {/* Headrest top pad */}
      <mesh castShadow position={[0, 0.32, -0.06]}>
        <boxGeometry args={[0.18, 0.04, 0.12]} />
        <meshStandardMaterial color={LIVERY.ACCENT_RED} roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Headrest side pads (ear protection) */}
      <mesh castShadow position={[0.13, 0.26, -0.06]}>
        <boxGeometry args={[0.04, 0.10, 0.10]} />
        <meshStandardMaterial color={LIVERY.PRIMARY} roughness={0.85} metalness={0.1} />
      </mesh>
      <mesh castShadow position={[-0.13, 0.26, -0.06]}>
        <boxGeometry args={[0.04, 0.10, 0.10]} />
        <meshStandardMaterial color={LIVERY.PRIMARY} roughness={0.85} metalness={0.1} />
      </mesh>

      {/* Cockpit rim padding - front */}
      <mesh castShadow position={[0, 0.18, 0.70]}>
        <boxGeometry args={[0.50, 0.06, 0.06]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      {/* Cockpit rim padding - side tapers */}
      <mesh castShadow position={[0.28, 0.18, 0.50]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.04, 0.06, 0.30]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>
      <mesh castShadow position={[-0.28, 0.18, 0.50]} rotation={[0, -0.3, 0]}>
        <boxGeometry args={[0.04, 0.06, 0.30]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      <SteeringWheel steerAngle={steerRef.current} showDisplay={showDisplay} />
    </group>
  )
}
