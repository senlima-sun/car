import { useMemo } from 'react'
import { VEHICLE_CONFIG } from '../../../constants/physics'
import { useCarStore } from '../../../stores/useCarStore'

// Wheel component - cylinder with rim details
function Wheel({
  position,
  steerAngle,
  wheelRotation,
  isLeft,
}: {
  position: [number, number, number]
  steerAngle: number
  wheelRotation: number
  isLeft: boolean
}) {
  const { wheels } = VEHICLE_CONFIG
  const radius = wheels.radius
  const width = wheels.width

  // Spoke angles
  const spokes = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => (i / 5) * Math.PI * 2)
  }, [])

  // Offset for rim details - positive = outward from car
  const rimOffset = isLeft ? -width / 2 : width / 2

  return (
    <group position={position}>
      {/* Steering pivot - Y axis rotation */}
      <group rotation={[0, steerAngle, 0]}>
        {/* Lay wheel flat - rotate 90° around Z so cylinder axis points along X */}
        <group rotation={[0, 0, Math.PI / 2]}>
          {/* Rolling rotation - around Y axis (which is now the wheel's axle after parent Z rotation) */}
          <group rotation={[0, wheelRotation, 0]}>
            {/* Tire - main rubber part */}
            <mesh castShadow>
              <cylinderGeometry args={[radius, radius, width, 32]} />
              <meshStandardMaterial color='#222222' roughness={0.9} />
            </mesh>

            {/* Tire tread */}
            <mesh castShadow>
              <cylinderGeometry args={[radius + 0.01, radius + 0.01, width - 0.06, 32]} />
              <meshStandardMaterial color='#1a1a1a' roughness={0.95} />
            </mesh>

            {/* Outer rim face (visible from outside car) */}
            <mesh position={[0, rimOffset * 0.9, 0]}>
              <cylinderGeometry args={[radius * 0.58, radius * 0.58, 0.04, 32]} />
              <meshStandardMaterial color='#d0d0d0' metalness={0.95} roughness={0.1} />
            </mesh>

            {/* Center hub */}
            <mesh position={[0, rimOffset * 0.95, 0]}>
              <cylinderGeometry args={[radius * 0.15, radius * 0.15, 0.06, 16]} />
              <meshStandardMaterial color='#999999' metalness={0.9} roughness={0.15} />
            </mesh>

            {/* Center cap */}
            <mesh position={[0, rimOffset, 0]}>
              <cylinderGeometry args={[radius * 0.12, radius * 0.1, 0.02, 16]} />
              <meshStandardMaterial color='#444444' metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Rim spokes - in XZ plane at outer Y position */}
            {spokes.map((angle, i) => {
              const spokeLength = radius * 0.4
              const spokeR = radius * 0.35
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
              const nutDist = radius * 0.22
              return (
                <mesh
                  key={`lug-${i}`}
                  position={[
                    Math.cos(angle) * nutDist,
                    rimOffset * 1.02,
                    Math.sin(angle) * nutDist,
                  ]}
                >
                  <cylinderGeometry args={[0.02, 0.02, 0.02, 6]} />
                  <meshStandardMaterial color='#555555' metalness={0.9} roughness={0.2} />
                </mesh>
              )
            })}

            {/* Inner brake disc */}
            <mesh position={[0, -rimOffset * 0.8, 0]}>
              <cylinderGeometry args={[radius * 0.5, radius * 0.5, 0.02, 32]} />
              <meshStandardMaterial color='#555555' metalness={0.8} roughness={0.4} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

export default function CarBody() {
  const { wheels } = VEHICLE_CONFIG
  const steerAngle = useCarStore(state => state.steerAngle)
  const wheelRotations = useCarStore(state => state.wheelRotations)

  const frameColor = '#222222'
  const metalColor = '#444444'

  // Wheel positions for reference
  const frontWheelZ = 1.75
  const rearWheelZ = -1.35

  return (
    <group>
      {/* === F1-STYLE SKELETON === */}
      {/*
        [w]---[   ]----[w]   <- Front wheels + nose
              [   ]          <- Nose extension
            ┌-------┐
            |   D   |        <- Driver cockpit
            |       |
            └-------┘
             [  E  ]         <- Engine bay
        [w]--[     ]--[w]    <- Rear wheels + engine
      */}

      {/* === FRONT NOSE === */}
      <mesh castShadow position={[0, 0.0, frontWheelZ - 0.2]}>
        <boxGeometry args={[0.4, 0.15, 0.5]} />
        <meshStandardMaterial color={frameColor} metalness={0.8} roughness={0.3} />
      </mesh>

      {/* === FRONT WHEEL UPRIGHTS (install points) === */}
      {/* Left front upright */}
      <mesh castShadow position={[-0.9, 0.0, frontWheelZ]}>
        <boxGeometry args={[0.08, 0.25, 0.12]} />
        <meshStandardMaterial color={metalColor} metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Right front upright */}
      <mesh castShadow position={[0.9, 0.0, frontWheelZ]}>
        <boxGeometry args={[0.08, 0.25, 0.12]} />
        <meshStandardMaterial color={metalColor} metalness={0.9} roughness={0.2} />
      </mesh>

      {/* === FRONT SUSPENSION ARMS (to uprights) === */}
      {/* Arms span from nose edge (x=±0.2) to upright (x=±0.86) */}
      {/* Left front - upper arm */}
      <mesh castShadow position={[-0.53, 0.08, frontWheelZ]}>
        <boxGeometry args={[0.74, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Left front - lower arm */}
      <mesh castShadow position={[-0.53, -0.08, frontWheelZ]}>
        <boxGeometry args={[0.74, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Right front - upper arm */}
      <mesh castShadow position={[0.53, 0.08, frontWheelZ]}>
        <boxGeometry args={[0.74, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Right front - lower arm */}
      <mesh castShadow position={[0.53, -0.08, frontWheelZ]}>
        <boxGeometry args={[0.74, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} metalness={0.9} roughness={0.2} />
      </mesh>

      {/* === NOSE TO COCKPIT CONNECTION === */}
      <mesh castShadow position={[0, 0.0, 0.9]}>
        <boxGeometry args={[0.35, 0.12, 0.8]} />
        <meshStandardMaterial color={frameColor} metalness={0.8} roughness={0.3} />
      </mesh>

      {/* === DRIVER COCKPIT (D) === */}
      {/* Cockpit floor */}
      <mesh castShadow position={[0, -0.05, 0.1]}>
        <boxGeometry args={[0.9, 0.1, 1.2]} />
        <meshStandardMaterial color={frameColor} metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Cockpit left wall */}
      <mesh castShadow position={[-0.4, 0.15, 0.1]}>
        <boxGeometry args={[0.1, 0.3, 1.2]} />
        <meshStandardMaterial color={frameColor} metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Cockpit right wall */}
      <mesh castShadow position={[0.4, 0.15, 0.1]}>
        <boxGeometry args={[0.1, 0.3, 1.2]} />
        <meshStandardMaterial color={frameColor} metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Cockpit front wall */}
      <mesh castShadow position={[0, 0.15, 0.65]}>
        <boxGeometry args={[0.9, 0.3, 0.1]} />
        <meshStandardMaterial color={frameColor} metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Cockpit rear wall */}
      <mesh castShadow position={[0, 0.15, -0.45]}>
        <boxGeometry args={[0.9, 0.3, 0.1]} />
        <meshStandardMaterial color={frameColor} metalness={0.8} roughness={0.3} />
      </mesh>

      {/* === ROLL HOOP (behind driver head) === */}
      <mesh castShadow position={[0, 0.45, -0.35]}>
        <boxGeometry args={[0.1, 0.45, 0.1]} />
        <meshStandardMaterial color={frameColor} metalness={0.8} roughness={0.3} />
      </mesh>

      {/* === ENGINE BAY (E) === */}
      <mesh castShadow position={[0, 0.0, -1.0]}>
        <boxGeometry args={[0.6, 0.25, 1.0]} />
        <meshStandardMaterial color={frameColor} metalness={0.8} roughness={0.3} />
      </mesh>

      {/* === REAR WHEEL UPRIGHTS (install points) === */}
      {/* Left rear upright */}
      <mesh castShadow position={[-0.9, 0.0, rearWheelZ]}>
        <boxGeometry args={[0.08, 0.25, 0.12]} />
        <meshStandardMaterial color={metalColor} metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Right rear upright */}
      <mesh castShadow position={[0.9, 0.0, rearWheelZ]}>
        <boxGeometry args={[0.08, 0.25, 0.12]} />
        <meshStandardMaterial color={metalColor} metalness={0.9} roughness={0.2} />
      </mesh>

      {/* === REAR SUSPENSION ARMS (to uprights) === */}
      {/* Arms span from engine bay edge (x=±0.3) to upright (x=±0.86) */}
      {/* Left rear - upper arm */}
      <mesh castShadow position={[-0.58, 0.08, rearWheelZ]}>
        <boxGeometry args={[0.64, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Left rear - lower arm */}
      <mesh castShadow position={[-0.58, -0.08, rearWheelZ]}>
        <boxGeometry args={[0.64, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Right rear - upper arm */}
      <mesh castShadow position={[0.58, 0.08, rearWheelZ]}>
        <boxGeometry args={[0.64, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Right rear - lower arm */}
      <mesh castShadow position={[0.58, -0.08, rearWheelZ]}>
        <boxGeometry args={[0.64, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} metalness={0.9} roughness={0.2} />
      </mesh>

      {/* === WHEELS === */}
      {wheels.positions.map((pos, index) => {
        const isFrontWheel = index < 2
        const isLeftWheel = pos[0] < 0

        return (
          <Wheel
            key={index}
            position={[pos[0], -wheels.radius + 0.08, pos[2]]}
            steerAngle={isFrontWheel ? steerAngle : 0}
            wheelRotation={wheelRotations[index]}
            isLeft={isLeftWheel}
          />
        )
      })}
    </group>
  )
}
