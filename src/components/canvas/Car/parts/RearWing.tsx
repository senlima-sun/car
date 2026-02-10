import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useActiveAeroStore } from '../../../../stores/useActiveAeroStore'
import { LIVERY, CARBON_FIBER, GLOSSY_ACCENT } from '../../../../constants/f1Livery'

export function RearWing() {
  const rearWingAngle = useActiveAeroStore(state => state.rearWingAngle)

  const mainFlapRef = useRef<THREE.Group>(null)
  const topFlapRef = useRef<THREE.Group>(null)

  const smoothMainFlap = useRef(0)
  const smoothTopFlap = useRef(0)

  useFrame((_, delta) => {
    const lerpSpeed = 5

    const targetMainFlap = -rearWingAngle * 0.35
    const targetTopFlap = -rearWingAngle * 1.05

    smoothMainFlap.current = THREE.MathUtils.lerp(smoothMainFlap.current, targetMainFlap, lerpSpeed * delta)
    smoothTopFlap.current = THREE.MathUtils.lerp(smoothTopFlap.current, targetTopFlap, lerpSpeed * delta)

    if (mainFlapRef.current) mainFlapRef.current.rotation.x = smoothMainFlap.current
    if (topFlapRef.current) topFlapRef.current.rotation.x = smoothTopFlap.current
  })

  return (
    <group position={[0, 0.45, -2.0]}>
      {/* Left support pylon (cylindrical) */}
      <mesh castShadow position={[-0.3, -0.28, 0]}>
        <cylinderGeometry args={[0.018, 0.022, 0.52, 8]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      {/* Right support pylon */}
      <mesh castShadow position={[0.3, -0.28, 0]}>
        <cylinderGeometry args={[0.018, 0.022, 0.52, 8]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      {/* Bottom wing plane (fixed) */}
      <mesh castShadow>
        <boxGeometry args={[0.85, 0.018, 0.28]} />
        <meshStandardMaterial color={LIVERY.PRIMARY} roughness={0.5} metalness={0.3} />
      </mesh>

      {/* Main flap (middle element - adjustable) */}
      <group ref={mainFlapRef} position={[0, 0.035, 0]}>
        <mesh castShadow position={[0, 0.012, 0]}>
          <boxGeometry args={[0.84, 0.018, 0.24]} />
          <meshStandardMaterial color={LIVERY.PRIMARY_LIGHT} roughness={0.55} metalness={0.3} />
        </mesh>
      </group>

      {/* Top flap (DRS adjustable) */}
      <group ref={topFlapRef} position={[0, 0.07, 0]}>
        <mesh castShadow position={[0, 0.012, 0]}>
          <boxGeometry args={[0.82, 0.018, 0.2]} />
          <meshStandardMaterial color={LIVERY.WHITE} roughness={0.4} metalness={0.5} />
        </mesh>
      </group>

      {/* Left end plate (flat, 2026 style) */}
      <mesh castShadow position={[-0.43, 0.035, 0]}>
        <boxGeometry args={[0.012, 0.16, 0.36]} />
        <meshStandardMaterial color={LIVERY.ACCENT_YELLOW} {...GLOSSY_ACCENT} />
      </mesh>

      {/* Right end plate (flat) */}
      <mesh castShadow position={[0.43, 0.035, 0]}>
        <boxGeometry args={[0.012, 0.16, 0.36]} />
        <meshStandardMaterial color={LIVERY.ACCENT_YELLOW} {...GLOSSY_ACCENT} />
      </mesh>

      {/* Red accent on trailing edge */}
      <mesh position={[0, 0.0, -0.14]}>
        <boxGeometry args={[0.7, 0.006, 0.015]} />
        <meshStandardMaterial color={LIVERY.ACCENT_RED} {...GLOSSY_ACCENT} />
      </mesh>

      {/* Number plate / branding area */}
      <mesh position={[0, 0.035, 0.185]}>
        <boxGeometry args={[0.4, 0.08, 0.005]} />
        <meshStandardMaterial color={LIVERY.PRIMARY} roughness={0.7} metalness={0.2} />
      </mesh>
    </group>
  )
}
