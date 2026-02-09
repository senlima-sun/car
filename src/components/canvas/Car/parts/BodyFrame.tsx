import { MutableRefObject } from 'react'
import * as THREE from 'three'
import {
  CAR_COLORS,
  WHEEL_POSITIONS,
  getBodyMaterial,
} from '../constants/materials'
import { SuspensionLinkageGroup } from './SuspensionLinkage'
import type { SuspensionOutput } from '../hooks/useRaycastSuspension'

interface BodyFrameProps {
  isRaining: boolean
  isThermalView: boolean
  engineThermalMaterial: THREE.ShaderMaterial
  suspensionRef?: MutableRefObject<SuspensionOutput | null>
}

export function BodyFrame({ isRaining, isThermalView, engineThermalMaterial, suspensionRef }: BodyFrameProps) {
  const frameColor = CAR_COLORS.frame
  const bodyMaterial = getBodyMaterial(isRaining)
  const { frontZ } = WHEEL_POSITIONS

  return (
    <group>
      <mesh castShadow position={[0, 0.0, frontZ + 0.12]}>
        <boxGeometry args={[0.5, 0.15, 1.2]} />
        <meshStandardMaterial color={frameColor} {...bodyMaterial} />
      </mesh>

      <mesh castShadow position={[0, 0.0, 1.14]}>
        <boxGeometry args={[0.45, 0.12, 0.84]} />
        <meshStandardMaterial color={frameColor} {...bodyMaterial} />
      </mesh>

      <mesh castShadow position={[0, 0.0, -1.02]}>
        <boxGeometry args={[0.7, 0.25, 0.84]} />
        {isThermalView ? (
          <primitive object={engineThermalMaterial} attach='material' />
        ) : (
          <meshStandardMaterial color={frameColor} {...bodyMaterial} />
        )}
      </mesh>

      <SuspensionLinkageGroup isRaining={isRaining} suspensionRef={suspensionRef} />
    </group>
  )
}
