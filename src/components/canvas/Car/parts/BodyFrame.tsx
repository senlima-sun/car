import { MutableRefObject, useMemo } from 'react'
import * as THREE from 'three'
import { SuspensionLinkageGroup } from './SuspensionLinkage'
import type { SuspensionOutput } from '../hooks/useRaycastSuspension'
import {
  createMonocoqueTubTubes,
  createSurvivalCellSurface,
  createSurvivalCellSides,
  createSurvivalCellBottom,
  createNoseBodyGeometry,
  createNoseTipCapGeometry,
} from '@/utils/f1Geometry'
import { LIVERY, MATTE_BODY, CARBON_FIBER } from '@/constants/f1Livery'

interface BodyFrameProps {
  isRaining: boolean
  isThermalView: boolean
  engineThermalMaterial: THREE.ShaderMaterial
  suspensionRef?: MutableRefObject<SuspensionOutput | null>
}

export function BodyFrame({ isRaining, suspensionRef }: BodyFrameProps) {
  const tubeGeos = useMemo(() => createMonocoqueTubTubes(), [])
  const survivalCellTop = useMemo(() => createSurvivalCellSurface(), [])
  const survivalCellSides = useMemo(() => createSurvivalCellSides(), [])
  const survivalCellBottom = useMemo(() => createSurvivalCellBottom(), [])
  const noseBody = useMemo(() => createNoseBodyGeometry(), [])
  const noseTipCap = useMemo(() => createNoseTipCapGeometry(), [])

  const bodyMat = isRaining
    ? { roughness: 0.15, metalness: 0.7, envMapIntensity: 2.5 }
    : MATTE_BODY

  return (
    <group>
      {tubeGeos.map((geo, i) => (
        <mesh key={i} castShadow receiveShadow geometry={geo}>
          <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
        </mesh>
      ))}

      <mesh castShadow receiveShadow geometry={survivalCellTop}>
        <meshStandardMaterial color={LIVERY.PRIMARY} {...bodyMat} side={THREE.DoubleSide} />
      </mesh>

      <mesh castShadow receiveShadow geometry={survivalCellSides}>
        <meshStandardMaterial color={LIVERY.PRIMARY} {...bodyMat} side={THREE.DoubleSide} />
      </mesh>

      <mesh receiveShadow geometry={survivalCellBottom}>
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} side={THREE.DoubleSide} />
      </mesh>

      <mesh castShadow receiveShadow geometry={noseBody}>
        <meshStandardMaterial color={LIVERY.PRIMARY} {...bodyMat} side={THREE.DoubleSide} />
      </mesh>

      <mesh castShadow receiveShadow geometry={noseTipCap}>
        <meshStandardMaterial color={LIVERY.PRIMARY} {...bodyMat} />
      </mesh>

      <SuspensionLinkageGroup isRaining={isRaining} suspensionRef={suspensionRef} />
    </group>
  )
}
