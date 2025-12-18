import * as THREE from 'three'
import {
  CAR_COLORS,
  WHEEL_POSITIONS,
  getBodyMaterial,
  getMetalMaterial,
} from '../constants/materials'

interface BodyFrameProps {
  isRaining: boolean
  isThermalView: boolean
  engineThermalMaterial: THREE.ShaderMaterial
}

/**
 * F1-style skeleton frame structure
 * Includes nose, uprights, suspension arms, engine bay, and roll hoop
 */
export function BodyFrame({ isRaining, isThermalView, engineThermalMaterial }: BodyFrameProps) {
  const frameColor = CAR_COLORS.frame
  const metalColor = CAR_COLORS.metal
  const bodyMaterial = getBodyMaterial(isRaining)
  const metalMaterial = getMetalMaterial(isRaining)
  const { frontZ, rearZ } = WHEEL_POSITIONS

  return (
    <group>
      {/* === FRONT NOSE === */}
      <mesh castShadow position={[0, 0.0, frontZ + 0.1]}>
        <boxGeometry args={[0.5, 0.15, 0.6]} />
        <meshStandardMaterial color={frameColor} {...bodyMaterial} />
      </mesh>

      {/* === FRONT WHEEL UPRIGHTS === */}
      <mesh castShadow position={[-0.85, 0.0, frontZ]}>
        <boxGeometry args={[0.08, 0.25, 0.12]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>
      <mesh castShadow position={[0.85, 0.0, frontZ]}>
        <boxGeometry args={[0.08, 0.25, 0.12]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>

      {/* === FRONT SUSPENSION ARMS === */}
      {/* Left front - upper arm */}
      <mesh castShadow position={[-0.55, 0.08, frontZ]}>
        <boxGeometry args={[0.68, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>
      {/* Left front - lower arm */}
      <mesh castShadow position={[-0.55, -0.08, frontZ]}>
        <boxGeometry args={[0.68, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>
      {/* Right front - upper arm */}
      <mesh castShadow position={[0.55, 0.08, frontZ]}>
        <boxGeometry args={[0.68, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>
      {/* Right front - lower arm */}
      <mesh castShadow position={[0.55, -0.08, frontZ]}>
        <boxGeometry args={[0.68, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>

      {/* === NOSE TO COCKPIT CONNECTION === */}
      <mesh castShadow position={[0, 0.0, 0.95]}>
        <boxGeometry args={[0.45, 0.12, 0.7]} />
        <meshStandardMaterial color={frameColor} {...bodyMaterial} />
      </mesh>

      {/* === ENGINE BAY === */}
      <mesh castShadow position={[0, 0.0, -0.85]}>
        <boxGeometry args={[0.7, 0.25, 0.7]} />
        {isThermalView ? (
          <primitive object={engineThermalMaterial} attach='material' />
        ) : (
          <meshStandardMaterial color={frameColor} {...bodyMaterial} />
        )}
      </mesh>

      {/* === REAR WHEEL UPRIGHTS === */}
      <mesh castShadow position={[-0.85, 0.0, rearZ]}>
        <boxGeometry args={[0.08, 0.25, 0.12]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>
      <mesh castShadow position={[0.85, 0.0, rearZ]}>
        <boxGeometry args={[0.08, 0.25, 0.12]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>

      {/* === REAR SUSPENSION ARMS === */}
      {/* Left rear - upper arm */}
      <mesh castShadow position={[-0.55, 0.08, rearZ]}>
        <boxGeometry args={[0.68, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>
      {/* Left rear - lower arm */}
      <mesh castShadow position={[-0.55, -0.08, rearZ]}>
        <boxGeometry args={[0.68, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>
      {/* Right rear - upper arm */}
      <mesh castShadow position={[0.55, 0.08, rearZ]}>
        <boxGeometry args={[0.68, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>
      {/* Right rear - lower arm */}
      <mesh castShadow position={[0.55, -0.08, rearZ]}>
        <boxGeometry args={[0.68, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>
    </group>
  )
}
