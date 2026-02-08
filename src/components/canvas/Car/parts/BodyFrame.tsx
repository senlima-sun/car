import { useRef, MutableRefObject } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import {
  CAR_COLORS,
  WHEEL_POSITIONS,
  getBodyMaterial,
  getMetalMaterial,
} from '../constants/materials'
import type { SuspensionOutput } from '../hooks/useRaycastSuspension'

interface BodyFrameProps {
  isRaining: boolean
  isThermalView: boolean
  engineThermalMaterial: THREE.ShaderMaterial
  suspensionRef?: MutableRefObject<SuspensionOutput | null>
}

export function BodyFrame({ isRaining, isThermalView, engineThermalMaterial, suspensionRef }: BodyFrameProps) {
  const frameColor = CAR_COLORS.frame
  const metalColor = CAR_COLORS.metal
  const bodyMaterial = getBodyMaterial(isRaining)
  const metalMaterial = getMetalMaterial(isRaining)
  const { frontZ, rearZ } = WHEEL_POSITIONS

  const flUprightRef = useRef<THREE.Mesh>(null)
  const frUprightRef = useRef<THREE.Mesh>(null)
  const rlUprightRef = useRef<THREE.Mesh>(null)
  const rrUprightRef = useRef<THREE.Mesh>(null)

  const flLowerArmRef = useRef<THREE.Mesh>(null)
  const frLowerArmRef = useRef<THREE.Mesh>(null)
  const rlLowerArmRef = useRef<THREE.Mesh>(null)
  const rrLowerArmRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (!suspensionRef?.current) return
    const wheels = suspensionRef.current.wheels

    const applyDeflection = (
      upright: MutableRefObject<THREE.Mesh | null>,
      lower: MutableRefObject<THREE.Mesh | null>,
      deflection: number,
    ) => {
      if (upright.current) upright.current.position.y = deflection
      if (lower.current) lower.current.position.y = -0.08 + deflection
    }

    applyDeflection(flUprightRef, flLowerArmRef, wheels[0].deflection)
    applyDeflection(frUprightRef, frLowerArmRef, wheels[1].deflection)
    applyDeflection(rlUprightRef, rlLowerArmRef, wheels[2].deflection)
    applyDeflection(rrUprightRef, rrLowerArmRef, wheels[3].deflection)
  })

  return (
    <group>
      <mesh castShadow position={[0, 0.0, frontZ + 0.1]}>
        <boxGeometry args={[0.5, 0.15, 1]} />
        <meshStandardMaterial color={frameColor} {...bodyMaterial} />
      </mesh>

      <mesh ref={flUprightRef} castShadow position={[-0.85, 0.0, frontZ]}>
        <boxGeometry args={[0.08, 0.25, 0.12]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>
      <mesh ref={frUprightRef} castShadow position={[0.85, 0.0, frontZ]}>
        <boxGeometry args={[0.08, 0.25, 0.12]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>

      <mesh castShadow position={[-0.55, 0.08, frontZ]}>
        <boxGeometry args={[0.68, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>
      <mesh ref={flLowerArmRef} castShadow position={[-0.55, -0.08, frontZ]}>
        <boxGeometry args={[0.68, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>
      <mesh castShadow position={[0.55, 0.08, frontZ]}>
        <boxGeometry args={[0.68, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>
      <mesh ref={frLowerArmRef} castShadow position={[0.55, -0.08, frontZ]}>
        <boxGeometry args={[0.68, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>

      <mesh castShadow position={[0, 0.0, 0.95]}>
        <boxGeometry args={[0.45, 0.12, 0.7]} />
        <meshStandardMaterial color={frameColor} {...bodyMaterial} />
      </mesh>

      <mesh castShadow position={[0, 0.0, -0.85]}>
        <boxGeometry args={[0.7, 0.25, 0.7]} />
        {isThermalView ? (
          <primitive object={engineThermalMaterial} attach='material' />
        ) : (
          <meshStandardMaterial color={frameColor} {...bodyMaterial} />
        )}
      </mesh>

      <mesh ref={rlUprightRef} castShadow position={[-0.85, 0.0, rearZ]}>
        <boxGeometry args={[0.08, 0.25, 0.12]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>
      <mesh ref={rrUprightRef} castShadow position={[0.85, 0.0, rearZ]}>
        <boxGeometry args={[0.08, 0.25, 0.12]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>

      <mesh castShadow position={[-0.55, 0.08, rearZ]}>
        <boxGeometry args={[0.68, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>
      <mesh ref={rlLowerArmRef} castShadow position={[-0.55, -0.08, rearZ]}>
        <boxGeometry args={[0.68, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>
      <mesh castShadow position={[0.55, 0.08, rearZ]}>
        <boxGeometry args={[0.68, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>
      <mesh ref={rrLowerArmRef} castShadow position={[0.55, -0.08, rearZ]}>
        <boxGeometry args={[0.68, 0.04, 0.04]} />
        <meshStandardMaterial color={metalColor} {...metalMaterial} />
      </mesh>
    </group>
  )
}
