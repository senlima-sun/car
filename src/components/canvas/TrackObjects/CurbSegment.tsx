import { useMemo, useCallback } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { GHOST_OPACITY, OBJECT_CONFIGS } from '../../../constants/trackObjects'
import { CURB_WIDTH, CURB_PEAK_HEIGHTS, STRIPE_WIDTH, getProfileForType, TOOTH_SPACING } from '../../../constants/curb'
import { useCurbStore } from '../../../stores/useCurbStore'
import { useSurfaceStore } from '../../../stores/useSurfaceStore'
import { PlacedObject, getRoadEdgePositionAt } from '../../../stores/useCustomizationStore'
import type { CurbType } from '../../../types/trackObjects'

const curbConfig = OBJECT_CONFIGS.curb

interface CurbSegmentProps {
  curb: PlacedObject
  parentRoad: PlacedObject
  isGhost?: boolean
}

function createCurbGeometry(length: number, stripeCount: number, curbType: CurbType): BufferGeometry {
  const vertices: number[] = []
  const indices: number[] = []
  const colors: number[] = []

  const profile = getProfileForType(curbType)
  const profilePoints = profile.length
  const lengthSegments = Math.max(2, Math.ceil(length / STRIPE_WIDTH))

  for (let i = 0; i <= lengthSegments; i++) {
    const z = (i / lengthSegments - 0.5) * length

    const sawtoothMod = curbType === 'exit'
      ? Math.abs(((z / TOOTH_SPACING) % 1) * 2 - 1)
      : 1.0

    for (let j = 0; j < profilePoints; j++) {
      const p = profile[j]
      const h = curbType === 'exit' ? p.y * sawtoothMod : p.y
      vertices.push(p.x - CURB_WIDTH / 2, h, z)

      const stripeIndex = Math.floor((i / lengthSegments) * stripeCount)
      const isRed = stripeIndex % 2 === 0
      colors.push(isRed ? 1 : 1, isRed ? 0 : 1, isRed ? 0 : 1)
    }
  }

  for (let i = 0; i < lengthSegments; i++) {
    for (let j = 0; j < profilePoints - 1; j++) {
      const a = i * profilePoints + j
      const b = i * profilePoints + j + 1
      const c = (i + 1) * profilePoints + j
      const d = (i + 1) * profilePoints + j + 1

      indices.push(a, c, b)
      indices.push(b, c, d)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  return geometry
}

export default function CurbSegment({ curb, parentRoad, isGhost = false }: CurbSegmentProps) {
  const enterCurb = useCurbStore(state => state.enterCurb)
  const exitCurb = useCurbStore(state => state.exitCurb)
  const enterSurface = useSurfaceStore(s => s.enterSurface)
  const exitSurface = useSurfaceStore(s => s.exitSurface)

  const curbType: CurbType = curb.curbType || 'apex'
  const peakHeight = CURB_PEAK_HEIGHTS[curbType]

  const { geometry, rotation, midpoint, curbLength } = useMemo(() => {
    if (!curb.startT || !curb.endT || !curb.edgeSide) {
      return {
        geometry: null,
        rotation: 0,
        midpoint: [0, 0, 0] as [number, number, number],
        curbLength: 0,
      }
    }

    const startT = curb.startT
    const endT = curb.endT

    const startPos = getRoadEdgePositionAt(parentRoad, curb.edgeSide, startT)
    const endPos = getRoadEdgePositionAt(parentRoad, curb.edgeSide, endT)

    const dx = endPos[0] - startPos[0]
    const dz = endPos[2] - startPos[2]
    const length = Math.sqrt(dx * dx + dz * dz)

    if (length === 0) {
      return {
        geometry: null,
        rotation: 0,
        midpoint: [0, 0, 0] as [number, number, number],
        curbLength: 0,
      }
    }

    const rot = Math.atan2(dx, dz)

    const mid: [number, number, number] = [
      (startPos[0] + endPos[0]) / 2,
      (startPos[1] + endPos[1]) / 2,
      (startPos[2] + endPos[2]) / 2,
    ]

    const stripes = Math.max(2, Math.ceil(length / STRIPE_WIDTH))
    const geo = createCurbGeometry(length, stripes, curbType)

    return { geometry: geo, rotation: rot, midpoint: mid, curbLength: length }
  }, [curb, parentRoad, curbType])

  if (!geometry || curbLength === 0) return null

  const perpOffset = curb.edgeSide === 'left' ? CURB_WIDTH / 2 : -CURB_WIDTH / 2

  const handleEnter = useCallback(() => {
    if (!isGhost && curb.edgeSide) {
      enterCurb(curb.edgeSide, curbType)
      enterSurface('curb')
    }
  }, [isGhost, curb.edgeSide, curbType, enterCurb, enterSurface])

  const handleExit = useCallback(() => {
    if (!isGhost) {
      exitCurb()
      exitSurface('curb')
    }
  }, [isGhost, exitCurb, exitSurface])

  if (isGhost) {
    return (
      <group position={midpoint} rotation={[0, rotation, 0]}>
        <mesh position={[perpOffset, 0, 0]} geometry={geometry} receiveShadow={false}>
          <meshStandardMaterial
            vertexColors
            transparent
            opacity={GHOST_OPACITY}
            depthWrite={false}
          />
        </mesh>
      </group>
    )
  }

  return (
    <RigidBody
      type='fixed'
      position={midpoint}
      rotation={[0, rotation, 0]}
      friction={curbConfig.friction}
      restitution={curbConfig.restitution}
      colliders={false}
    >
      <group position={[perpOffset, 0, 0]}>
        <CuboidCollider
          args={[CURB_WIDTH / 2, peakHeight / 2, curbLength / 2]}
          position={[0, peakHeight / 2, 0]}
          sensor
          onIntersectionEnter={handleEnter}
          onIntersectionExit={handleExit}
        />

        <mesh geometry={geometry} receiveShadow castShadow>
          <meshStandardMaterial vertexColors />
        </mesh>
      </group>
    </RigidBody>
  )
}

interface CurbPreviewProps {
  startPosition: [number, number, number]
  endPosition: [number, number, number]
  edge: 'left' | 'right'
  isGhost?: boolean
}

export function CurbPreview({
  startPosition,
  endPosition,
  edge,
  isGhost = true,
}: CurbPreviewProps) {
  const { geometry, rotation, midpoint, curbLength } = useMemo(() => {
    const dx = endPosition[0] - startPosition[0]
    const dz = endPosition[2] - startPosition[2]
    const length = Math.sqrt(dx * dx + dz * dz)

    if (length < 0.1) {
      return {
        geometry: null,
        rotation: 0,
        midpoint: [0, 0, 0] as [number, number, number],
        curbLength: 0,
      }
    }

    const rot = Math.atan2(dx, dz)
    const mid: [number, number, number] = [
      (startPosition[0] + endPosition[0]) / 2,
      (startPosition[1] + endPosition[1]) / 2,
      (startPosition[2] + endPosition[2]) / 2,
    ]

    const stripeCount = Math.max(2, Math.ceil(length / STRIPE_WIDTH))
    const geo = createCurbGeometry(length, stripeCount, 'apex')

    return { geometry: geo, rotation: rot, midpoint: mid, curbLength: length }
  }, [startPosition, endPosition])

  if (!geometry || curbLength === 0) return null

  const perpOffset = edge === 'left' ? CURB_WIDTH / 2 : -CURB_WIDTH / 2

  return (
    <group position={midpoint} rotation={[0, rotation, 0]}>
      <mesh position={[perpOffset, 0, 0]} geometry={geometry}>
        <meshStandardMaterial
          vertexColors
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>
    </group>
  )
}
