import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { VEHICLE_CONFIG } from '../../../../constants/physics'
import { useThermalTireMaterial } from '../../../../hooks/useThermalTireMaterial'

// Wheel component - solid tire with rounded edges and rim details
export function Wheel({
  position,
  steerAngle,
  wheelRotation,
  isLeft,
  innerTemp = 0.15,
  outerTemp = 0.15,
  isThermalView = false,
  compoundColor = '#eab308',
}: {
  position: [number, number, number]
  steerAngle: number
  wheelRotation: number
  isLeft: boolean
  innerTemp?: number
  outerTemp?: number
  isThermalView?: boolean
  compoundColor?: string
}) {
  const { wheels } = VEHICLE_CONFIG
  // Make wheels bigger for better visibility
  const radius = wheels.radius * 1.15
  const width = wheels.width * 1.2

  // Thermal material uses average of inner/outer temperatures
  const thermalMaterial = useThermalTireMaterial((innerTemp + outerTemp) / 2)

  // Edge rounding radius for tire corners
  const edgeRadius = width * 0.15

  // Smooth steering transition
  const steerRef = useRef<THREE.Group>(null)
  const smoothSteer = useRef(0)

  useFrame((_, delta) => {
    const lerpSpeed = 8
    smoothSteer.current = THREE.MathUtils.lerp(smoothSteer.current, steerAngle, lerpSpeed * delta)
    if (steerRef.current) {
      steerRef.current.rotation.y = smoothSteer.current
    }
  })

  // Spoke angles
  const spokes = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => (i / 5) * Math.PI * 2)
  }, [])

  // Offset for rim details - rim sits inside tire, facing outward from car
  const rimOffset = isLeft ? width * 0.45 : -width * 0.45

  return (
    <group position={position}>
      {/* Steering pivot - Y axis rotation (smoothed) */}
      <group ref={steerRef}>
        {/* Lay wheel flat - rotate 90° around Z so cylinder axis points along X */}
        <group rotation={[0, 0, Math.PI / 2]}>
          {/* Rolling rotation - around Y axis (which is now the wheel's axle after parent Z rotation) */}
          <group rotation={[0, wheelRotation, 0]}>
            {/* Main tire body - solid cylinder (shortened for rounded edges) */}
            <mesh castShadow>
              <cylinderGeometry
                args={[radius - edgeRadius, radius - edgeRadius, width - edgeRadius * 2, 32]}
              />
              {isThermalView ? (
                <primitive object={thermalMaterial} attach='material' />
              ) : (
                <meshStandardMaterial color='#1a1a1a' roughness={0.9} />
              )}
            </mesh>

            {/* Tread surface - outer cylinder at full radius */}
            <mesh castShadow>
              <cylinderGeometry args={[radius, radius, width - edgeRadius * 2, 32]} />
              {isThermalView ? (
                <primitive object={thermalMaterial} attach='material' />
              ) : (
                <meshStandardMaterial color='#1a1a1a' roughness={0.9} />
              )}
            </mesh>

            {/* Rounded edge - outer side */}
            <mesh
              castShadow
              position={[
                0,
                isLeft ? (width - edgeRadius * 2) / 2 : -(width - edgeRadius * 2) / 2,
                0,
              ]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <torusGeometry args={[radius - edgeRadius, edgeRadius, 12, 32]} />
              {isThermalView ? (
                <primitive object={thermalMaterial} attach='material' />
              ) : (
                <meshStandardMaterial color='#1a1a1a' roughness={0.9} />
              )}
            </mesh>

            {/* Rounded edge - inner side */}
            <mesh
              castShadow
              position={[
                0,
                isLeft ? -(width - edgeRadius * 2) / 2 : (width - edgeRadius * 2) / 2,
                0,
              ]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <torusGeometry args={[radius - edgeRadius, edgeRadius, 12, 32]} />
              {isThermalView ? (
                <primitive object={thermalMaterial} attach='material' />
              ) : (
                <meshStandardMaterial color='#1a1a1a' roughness={0.9} />
              )}
            </mesh>

            {/* Tire compound colored sidewall band - outer side */}
            <mesh
              position={[0, isLeft ? width / 2 - 0.02 : -width / 2 + 0.02, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <ringGeometry args={[radius * 0.55, radius * 0.88, 32]} />
              <meshStandardMaterial
                color={compoundColor}
                roughness={0.6}
                emissive={compoundColor}
                emissiveIntensity={0.3}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Tire compound colored sidewall band - inner side */}
            <mesh
              position={[0, isLeft ? -width / 2 + 0.02 : width / 2 - 0.02, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <ringGeometry args={[radius * 0.55, radius * 0.88, 32]} />
              <meshStandardMaterial
                color={compoundColor}
                roughness={0.6}
                emissive={compoundColor}
                emissiveIntensity={0.3}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Outer rim face (visible from outside car) */}
            <mesh position={[0, rimOffset * 0.9, 0]}>
              <cylinderGeometry args={[radius * 0.5, radius * 0.5, 0.04, 32]} />
              <meshStandardMaterial color='#d0d0d0' metalness={0.95} roughness={0.1} />
            </mesh>

            {/* Center hub */}
            <mesh position={[0, rimOffset * 0.95, 0]}>
              <cylinderGeometry args={[radius * 0.13, radius * 0.13, 0.06, 16]} />
              <meshStandardMaterial color='#999999' metalness={0.9} roughness={0.15} />
            </mesh>

            {/* Center cap */}
            <mesh position={[0, rimOffset, 0]}>
              <cylinderGeometry args={[radius * 0.1, radius * 0.09, 0.02, 16]} />
              <meshStandardMaterial color='#444444' metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Rim spokes - in XZ plane at outer Y position */}
            {spokes.map((angle, i) => {
              const spokeLength = radius * 0.35
              const spokeR = radius * 0.3
              return (
                <mesh
                  key={`spoke-${i}`}
                  position={[Math.cos(angle) * spokeR, rimOffset * 0.85, Math.sin(angle) * spokeR]}
                  rotation={[0, -angle, 0]}
                >
                  <boxGeometry args={[0.04, 0.05, spokeLength]} />
                  <meshStandardMaterial color='#c0c0c0' metalness={0.95} roughness={0.1} />
                </mesh>
              )
            })}

            {/* Lug nuts */}
            {Array.from({ length: 5 }).map((_, i) => {
              const angle = (i / 5) * Math.PI * 2
              const nutDist = radius * 0.19
              return (
                <mesh
                  key={`lug-${i}`}
                  position={[Math.cos(angle) * nutDist, rimOffset * 1.1, Math.sin(angle) * nutDist]}
                >
                  <cylinderGeometry args={[0.02, 0.02, 0.02, 6]} />
                  <meshStandardMaterial color='#555555' metalness={0.9} roughness={0.2} />
                </mesh>
              )
            })}

            {/* Inner brake disc */}
            <mesh position={[0, -rimOffset * 0.8, 0]}>
              <cylinderGeometry args={[radius * 0.43, radius * 0.43, 0.02, 32]} />
              <meshStandardMaterial color='#555555' metalness={0.8} roughness={0.4} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}
