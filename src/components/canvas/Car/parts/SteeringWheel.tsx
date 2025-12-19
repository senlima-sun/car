import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useCarStore } from '@/stores/useCarStore'
import { useErsStore } from '@/stores/useErsStore'
import { useActiveAeroStore } from '@/stores/useActiveAeroStore'
import { useBrakeStore } from '@/stores/useBrakeStore'
import { useLapTimeStore } from '@/stores/useLapTimeStore'

interface SteeringWheelProps {
  steerAngle: number
  showDisplay: boolean
}

// Helper functions
function formatLapTime(ms: number): string {
  if (ms === 0) return '-:--.---'
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = Math.floor(ms % 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
}

function getBatteryColor(charge: number): string {
  if (charge > 50) return '#22c55e'
  if (charge > 20) return '#f59e0b'
  return '#ef4444'
}

function getModeAbbreviation(mode: string): string {
  switch (mode) {
    case 'Attack':
      return 'ATK'
    case 'Balanced':
      return 'BAL'
    case 'Harvest':
      return 'HRV'
    case 'Overtake':
      return 'OVT'
    default:
      return 'BAL'
  }
}

function getModeColor(mode: string): string {
  switch (mode) {
    case 'Attack':
      return '#22c55e'
    case 'Balanced':
      return '#ffffff'
    case 'Harvest':
      return '#3b82f6'
    case 'Overtake':
      return '#f97316'
    default:
      return '#ffffff'
  }
}

function getAeroColor(mode: string): string {
  return mode === 'Corner' ? '#3b82f6' : '#22c55e'
}

function getGearDisplay(gear: number): string {
  if (gear === -1) return 'R'
  if (gear === 0) return 'N'
  return gear.toString()
}

function getGearColor(gear: number): string {
  if (gear === -1) return '#ef4444'
  if (gear === 0) return '#f59e0b'
  return '#ffffff'
}

/**
 * F1-style butterfly steering wheel with telemetry display
 */
export function SteeringWheel({ steerAngle, showDisplay }: SteeringWheelProps) {
  const steeringWheelRef = useRef<THREE.Group>(null)
  const smoothSteeringWheel = useRef(0)

  // Store subscriptions
  const speed = useCarStore(state => state.speed)
  const gear = useCarStore(state => state.gear)
  const ersCharge = useErsStore(state => state.batteryCharge)
  const ersMode = useErsStore(state => state.mode)
  const aeroMode = useActiveAeroStore(state => state.mode)
  const brakeBias = useBrakeStore(state => state.frontBias)
  const currentLapTime = useLapTimeStore(state => state.currentLapTime)

  // Smooth steering wheel transition
  useFrame((_, delta) => {
    const lerpSpeed = 8
    smoothSteeringWheel.current = THREE.MathUtils.lerp(
      smoothSteeringWheel.current,
      steerAngle,
      lerpSpeed * delta,
    )
    if (steeringWheelRef.current) {
      steeringWheelRef.current.rotation.set(Math.PI / 2, 0, smoothSteeringWheel.current * 3)
    }
  })

  return (
    <group position={[0, 0.32, 0.78]} rotation={[2, 0, 0]}>
      {/* Rotating wheel group - smoothed steering input */}
      <group ref={steeringWheelRef} rotation={[Math.PI / 2, 0, 0]}>
        {/* Hub group - tilted to face driver */}
        <group rotation={[0.9, 0, Math.PI]}>
          {/* === F1 BUTTERFLY FRAME === */}

          {/* Top horizontal bar */}
          <mesh castShadow position={[0, 0.06, 0]}>
            <boxGeometry args={[0.32, 0.035, 0.018]} />
            <meshStandardMaterial color='#1a1a1a' metalness={0.7} roughness={0.3} />
          </mesh>

          {/* Display housing */}
          <mesh castShadow position={[0, 0.03, 0.008]}>
            <boxGeometry args={[0.2, 0.055, 0.012]} />
            <meshStandardMaterial color='#000000' />
          </mesh>

          {/* Left arm */}
          <mesh castShadow position={[-0.11, -0.02, 0]} rotation={[0, 0, 0.4]}>
            <boxGeometry args={[0.03, 0.1, 0.018]} />
            <meshStandardMaterial color='#1a1a1a' metalness={0.7} roughness={0.3} />
          </mesh>

          {/* Right arm */}
          <mesh castShadow position={[0.11, -0.02, 0]} rotation={[0, 0, -0.4]}>
            <boxGeometry args={[0.03, 0.1, 0.018]} />
            <meshStandardMaterial color='#1a1a1a' metalness={0.7} roughness={0.3} />
          </mesh>

          {/* Left grip */}
          <mesh castShadow position={[-0.14, -0.07, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 0.05, 16]} />
            <meshStandardMaterial color='#0a0a0a' roughness={0.9} />
          </mesh>

          {/* Right grip */}
          <mesh castShadow position={[0.14, -0.07, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 0.05, 16]} />
            <meshStandardMaterial color='#0a0a0a' roughness={0.9} />
          </mesh>

          {/* Bottom connecting bar */}
          <mesh castShadow position={[0, -0.08, 0]}>
            <boxGeometry args={[0.12, 0.02, 0.018]} />
            <meshStandardMaterial color='#1a1a1a' metalness={0.7} roughness={0.3} />
          </mesh>

          {/* === TELEMETRY DISPLAY === */}
          {showDisplay && (
            <group position={[0, 0.03, 0.015]} rotation={[Math.PI / 2, 0, 0]}>
              {/* Row 1: Speed + Gear */}
              <Text
                position={[-0.04, 0.018, 0]}
                fontSize={0.018}
                color='#00ff88'
                anchorX='center'
                anchorY='middle'
              >
                {Math.round(speed)}
              </Text>
              <Text
                position={[0.04, 0.018, 0]}
                fontSize={0.018}
                color={getGearColor(gear)}
                anchorX='center'
                anchorY='middle'
              >
                {getGearDisplay(gear)}
              </Text>

              {/* Row 2: ERS % | ERS Mode | Aero Mode */}
              <Text
                position={[-0.05, 0.003, 0]}
                fontSize={0.01}
                color={getBatteryColor(ersCharge)}
                anchorX='center'
                anchorY='middle'
              >
                {`${Math.round(ersCharge)}%`}
              </Text>
              <Text
                position={[0, 0.003, 0]}
                fontSize={0.01}
                color={getModeColor(ersMode)}
                anchorX='center'
                anchorY='middle'
              >
                {getModeAbbreviation(ersMode)}
              </Text>
              <Text
                position={[0.05, 0.003, 0]}
                fontSize={0.01}
                color={getAeroColor(aeroMode)}
                anchorX='center'
                anchorY='middle'
              >
                {aeroMode === 'Corner' ? 'CRN' : 'STR'}
              </Text>

              {/* Row 3: Brake Bias */}
              <Text
                position={[0, -0.01, 0]}
                fontSize={0.009}
                color='#ffffff'
                anchorX='center'
                anchorY='middle'
              >
                {`BB ${Math.round(brakeBias)}|${Math.round(100 - brakeBias)}`}
              </Text>

              {/* Row 4: Current Lap Time */}
              <Text
                position={[0, -0.022, 0]}
                fontSize={0.009}
                color='#00ff88'
                anchorX='center'
                anchorY='middle'
              >
                {formatLapTime(currentLapTime)}
              </Text>
            </group>
          )}
        </group>
      </group>
    </group>
  )
}
