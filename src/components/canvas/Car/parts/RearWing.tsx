import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useActiveAeroStore } from '../../../../stores/useActiveAeroStore'

/**
 * Rear wing with DRS (Drag Reduction System)
 * Position: rear of car, elevated [0, 0.6, -1.5]
 */
export function RearWing() {
  const rearWingAngle = useActiveAeroStore(state => state.rearWingAngle)

  // Refs for animated elements
  const mainFlapRef = useRef<THREE.Group>(null)
  const drsFlapRef = useRef<THREE.Group>(null)

  // Smooth animation refs
  const smoothMainFlap = useRef(0)
  const smoothDrsFlap = useRef(0)

  // Animate wing flaps with smooth lerp
  useFrame((_, delta) => {
    const lerpSpeed = 5

    // Target angles based on wing angle (0.0-1.0)
    // When closed (angle=0.1): minimal angles (DRS open)
    // When open (angle=1.0): maximum angles (DRS closed)
    const targetMainFlap = -rearWingAngle * 0.35 // 0° to -20°
    const targetDrsFlap = -rearWingAngle * 1.13 // 0° to -65° (large DRS opening)

    // Smooth transitions
    smoothMainFlap.current = THREE.MathUtils.lerp(
      smoothMainFlap.current,
      targetMainFlap,
      lerpSpeed * delta,
    )
    smoothDrsFlap.current = THREE.MathUtils.lerp(
      smoothDrsFlap.current,
      targetDrsFlap,
      lerpSpeed * delta,
    )

    // Apply rotations
    if (mainFlapRef.current) {
      mainFlapRef.current.rotation.x = smoothMainFlap.current
    }
    if (drsFlapRef.current) {
      drsFlapRef.current.rotation.x = smoothDrsFlap.current
    }
  })

  return (
    <group position={[0, 0.45, -1.5]}>
      {/* Support pylons */}
      <mesh castShadow position={[-0.35, -0.25, 0]}>
        <boxGeometry args={[0.03, 0.5, 0.08]} />
        <meshStandardMaterial color='#1a1a1a' metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh castShadow position={[0.35, -0.25, 0]}>
        <boxGeometry args={[0.03, 0.5, 0.08]} />
        <meshStandardMaterial color='#1a1a1a' metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Main wing plane (fixed) */}
      <mesh castShadow>
        <boxGeometry args={[0.9, 0.02, 0.3]} />
        <meshStandardMaterial color='#2a2a2a' metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Main flap (middle element) */}
      <group ref={mainFlapRef} position={[0, 0.04, 0]}>
        <mesh castShadow position={[0, 0.015, 0]}>
          <boxGeometry args={[0.85, 0.02, 0.28]} />
          <meshStandardMaterial color='#3a3a3a' metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      {/* DRS flap (top element - RED for visibility) */}
      <group ref={drsFlapRef} position={[0, 0.08, 0]}>
        <mesh castShadow position={[0, 0.015, 0]}>
          <boxGeometry args={[0.8, 0.02, 0.26]} />
          <meshStandardMaterial color='#ffffff' metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* Left end plate */}
      <mesh castShadow position={[-0.45, 0.04, 0]}>
        <boxGeometry args={[0.015, 0.18, 0.4]} />
        <meshStandardMaterial color='#111111' metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Right end plate */}
      <mesh castShadow position={[0.45, 0.04, 0]}>
        <boxGeometry args={[0.015, 0.18, 0.4]} />
        <meshStandardMaterial color='#111111' metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  )
}
