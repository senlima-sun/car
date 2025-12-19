import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useActiveAeroStore } from '../../../../stores/useActiveAeroStore'

/**
 * Multi-element front wing with animated flaps
 * Position: front of car [0, 0.05, 1.9]
 */
export function FrontWing() {
  const frontWingAngle = useActiveAeroStore(state => state.frontWingAngle)

  // Refs for each flap element
  const flap1Ref = useRef<THREE.Group>(null)
  const flap2Ref = useRef<THREE.Group>(null)
  const flap3Ref = useRef<THREE.Group>(null)

  // Smooth animation refs
  const smoothFlap1 = useRef(0)
  const smoothFlap2 = useRef(0)
  const smoothFlap3 = useRef(0)

  // Animate wing flaps with smooth lerp
  useFrame((_, delta) => {
    const lerpSpeed = 4

    // Target angles based on wing angle (0.0-1.0)
    // When closed (angle=0.2): minimal angles
    // When open (angle=1.0): maximum angles
    const targetFlap1 = -frontWingAngle * 0.26 // 0° to -15°
    const targetFlap2 = -frontWingAngle * 0.44 // 0° to -25°
    const targetFlap3 = -frontWingAngle * 0.61 // 0° to -35°

    // Smooth transitions
    smoothFlap1.current = THREE.MathUtils.lerp(smoothFlap1.current, targetFlap1, lerpSpeed * delta)
    smoothFlap2.current = THREE.MathUtils.lerp(smoothFlap2.current, targetFlap2, lerpSpeed * delta)
    smoothFlap3.current = THREE.MathUtils.lerp(smoothFlap3.current, targetFlap3, lerpSpeed * delta)

    // Apply rotations
    if (flap1Ref.current) {
      flap1Ref.current.rotation.x = smoothFlap1.current
    }
    if (flap2Ref.current) {
      flap2Ref.current.rotation.x = smoothFlap2.current
    }
    if (flap3Ref.current) {
      flap3Ref.current.rotation.x = smoothFlap3.current
    }
  })

  return (
    <group position={[0, -0.25, 2.5]}>
      {/* Main wing plane (fixed) */}
      <mesh castShadow>
        <boxGeometry args={[2.2, 0.02, 0.25]} />
        <meshStandardMaterial color='#1a1a1a' metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Flap 1 - Main flap (bottom) */}
      <group ref={flap1Ref} position={[0, 0.03, 0]}>
        <mesh castShadow position={[0, 0.015, 0]}>
          <boxGeometry args={[2.2, 0.02, 0.22]} />
          <meshStandardMaterial color='#2a2a2a' metalness={0.7} roughness={0.4} />
        </mesh>
      </group>

      {/* Flap 2 - Middle flap */}
      <group ref={flap2Ref} position={[0, 0.06, 0]}>
        <mesh castShadow position={[0, 0.015, 0]}>
          <boxGeometry args={[2.2, 0.02, 0.18]} />
          <meshStandardMaterial color='#3a3a3a' metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      {/* Flap 3 - Top/Gurney flap */}
      <group ref={flap3Ref} position={[0, 0.09, 0]}>
        <mesh castShadow position={[0, 0.015, 0]}>
          <boxGeometry args={[2.2, 0.02, 0.14]} />
          <meshStandardMaterial color='#4a4a4a' metalness={0.5} roughness={0.5} />
        </mesh>
      </group>

      {/* Left end plate */}
      <mesh castShadow position={[-1.1, 0.075, 0]}>
        <boxGeometry args={[0.02, 0.15, 0.35]} />
        <meshStandardMaterial color='#111111' metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Right end plate */}
      <mesh castShadow position={[1.1, 0.075, 0]}>
        <boxGeometry args={[0.02, 0.15, 0.35]} />
        <meshStandardMaterial color='#111111' metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  )
}
