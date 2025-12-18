import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'

interface SteeringWheelProps {
  steerAngle: number
  speed: number
  showSpeedDisplay: boolean
}

/**
 * Animated steering wheel with optional speed display
 */
export function SteeringWheel({ steerAngle, speed, showSpeedDisplay }: SteeringWheelProps) {
  const steeringWheelRef = useRef<THREE.Group>(null)
  const smoothSteeringWheel = useRef(0)

  // Smooth steering wheel transition
  useFrame((_, delta) => {
    const lerpSpeed = 8
    smoothSteeringWheel.current = THREE.MathUtils.lerp(
      smoothSteeringWheel.current,
      steerAngle,
      lerpSpeed * delta,
    )
    if (steeringWheelRef.current) {
      steeringWheelRef.current.rotation.set(Math.PI / 2, 0, -smoothSteeringWheel.current * 3)
    }
  })

  return (
    <group position={[0, 0.32, 0.78]} rotation={[-0.4, 0, 0]}>
      {/* Rotating wheel group - smoothed steering input */}
      <group ref={steeringWheelRef} rotation={[Math.PI / 2, 0, 0]}>
        {/* Wheel rim - torus */}
        <mesh castShadow>
          <torusGeometry args={[0.18, 0.02, 16, 32]} />
          <meshStandardMaterial color='#111111' roughness={0.6} />
        </mesh>

        {/* Center hub + spokes group - tilted to face driver */}
        <group rotation={[0.9, 0, 0]}>
          {/* Center hub */}
          <mesh castShadow>
            <cylinderGeometry args={[0.06, 0.06, 0.025, 12]} />
            <meshStandardMaterial color='#333333' metalness={0.8} roughness={0.3} />
          </mesh>

          {/* Speed display on hub - facing driver (only in cockpit view) */}
          {showSpeedDisplay && (
            <Text
              position={[0, -0.02, 0]}
              rotation={[Math.PI / 2, 0, Math.PI]}
              fontSize={0.045}
              color='#00ff88'
              anchorX='center'
              anchorY='middle'
            >
              {Math.round(speed)}
            </Text>
          )}

          {/* Left spoke - connects hub to rim */}
          <mesh castShadow position={[-0.11, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <boxGeometry args={[0.1, 0.018, 0.025]} />
            <meshStandardMaterial color='#222222' metalness={0.7} roughness={0.4} />
          </mesh>

          {/* Right spoke - connects hub to rim */}
          <mesh castShadow position={[0.11, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <boxGeometry args={[0.1, 0.018, 0.025]} />
            <meshStandardMaterial color='#222222' metalness={0.7} roughness={0.4} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
