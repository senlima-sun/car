import { useMemo, useCallback } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { RigidBody, CuboidCollider, TrimeshCollider } from '@react-three/rapier'
import { OBJECT_CONFIGS } from '../../../constants/trackObjects'
import {
  CURB_WIDTH,
  CURB_PEAK_HEIGHTS,
  STRIPE_WIDTH,
  TOOTH_SPACING,
  TOOTH_RAMP,
  TOOTH_FLAT,
  TOOTH_DROP,
  getProfileForType,
  getSawtoothHeight,
} from '../../../constants/curb'
import { TRACK_COLLISION_GROUPS } from '../../../constants/dimensions'
import { useCurbStore } from '../../../stores/useCurbStore'
import { useSurfaceStore } from '../../../stores/useSurfaceStore'
import { PlacedObject, getRoadEdgePositionAt } from '../../../stores/useCustomizationStore'
import CurbSurfaceMaterial from './CurbSurfaceMaterial'
import type { CurbType } from '../../../types/trackObjects'

const curbConfig = OBJECT_CONFIGS.curb

interface CurbSegmentProps {
  curb: PlacedObject
  parentRoad: PlacedObject
  isGhost?: boolean
}

function buildToothZPositions(halfLength: number, length: number): number[] {
  const zPositions = new Set<number>()

  zPositions.add(-halfLength)
  zPositions.add(halfLength)

  const baseSegments = Math.max(2, Math.ceil(length / STRIPE_WIDTH))
  for (let i = 0; i <= baseSegments; i++) {
    zPositions.add((i / baseSegments - 0.5) * length)
  }

  const startZ = -halfLength
  const endZ = halfLength
  const firstToothStart = Math.ceil(startZ / TOOTH_SPACING) * TOOTH_SPACING

  for (let toothBase = firstToothStart; toothBase < endZ; toothBase += TOOTH_SPACING) {
    const transitions = [
      toothBase,
      toothBase + TOOTH_RAMP * TOOTH_SPACING,
      toothBase + (TOOTH_RAMP + TOOTH_FLAT) * TOOTH_SPACING,
      toothBase + (TOOTH_RAMP + TOOTH_FLAT + TOOTH_DROP) * TOOTH_SPACING,
    ]
    for (const tz of transitions) {
      if (tz >= startZ && tz <= endZ) {
        zPositions.add(tz)
      }
    }
  }

  return Array.from(zPositions).sort((a, b) => a - b)
}

interface CurbGeometryResult {
  geometry: BufferGeometry
  collisionVertices: Float32Array
  collisionIndices: Uint32Array
}

function createCurbGeometry(
  length: number,
  curbType: CurbType,
  sampleYOffset?: (zLocal: number, rowIndex: number) => number,
): CurbGeometryResult {
  const vertices: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  const profile = getProfileForType(curbType)
  const profilePoints = profile.length
  const halfLength = length / 2

  const isExit = curbType === 'exit'
  const zRows = isExit
    ? buildToothZPositions(halfLength, length)
    : (() => {
        const segs = Math.max(2, Math.ceil(length / STRIPE_WIDTH))
        const arr: number[] = []
        for (let i = 0; i <= segs; i++) arr.push((i / segs - 0.5) * length)
        return arr
      })()

  for (let r = 0; r < zRows.length; r++) {
    const z = zRows[r]
    const sawMod = isExit ? getSawtoothHeight(z) : 1.0
    const vCoord = z + halfLength
    const yOffset = sampleYOffset ? sampleYOffset(z, r) : 0

    for (let j = 0; j < profilePoints; j++) {
      const p = profile[j]
      const h = isExit ? p.y * sawMod : p.y
      vertices.push(p.x - CURB_WIDTH / 2, h + yOffset, z)
      uvs.push(p.x / CURB_WIDTH, vCoord)
    }
  }

  const rowCount = zRows.length
  for (let i = 0; i < rowCount - 1; i++) {
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
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  return {
    geometry,
    collisionVertices: new Float32Array(vertices),
    collisionIndices: new Uint32Array(indices),
  }
}

export default function CurbSegment({ curb, parentRoad, isGhost = false }: CurbSegmentProps) {
  const enterCurb = useCurbStore(state => state.enterCurb)
  const exitCurb = useCurbStore(state => state.exitCurb)
  const enterSurface = useSurfaceStore(s => s.enterSurface)
  const exitSurface = useSurfaceStore(s => s.exitSurface)

  const curbType: CurbType = curb.curbType || 'apex'
  const peakHeight = CURB_PEAK_HEIGHTS[curbType]

  const result = useMemo(() => {
    if (!curb.startT || !curb.endT || !curb.edgeSide) {
      return null
    }

    const startPos = getRoadEdgePositionAt(parentRoad, curb.edgeSide, curb.startT)
    const endPos = getRoadEdgePositionAt(parentRoad, curb.edgeSide, curb.endT)

    const dx = endPos[0] - startPos[0]
    const dz = endPos[2] - startPos[2]
    const length = Math.sqrt(dx * dx + dz * dz)

    if (length === 0) return null

    const rot = Math.atan2(dx, dz)
    const midY = (startPos[1] + endPos[1]) / 2
    const mid: [number, number, number] = [
      (startPos[0] + endPos[0]) / 2,
      midY,
      (startPos[2] + endPos[2]) / 2,
    ]

    const startT = curb.startT
    const endT = curb.endT
    const edgeSide = curb.edgeSide
    const sampleYOffset = (zLocal: number) => {
      const u = (zLocal + length / 2) / length
      const globalT = startT + (endT - startT) * u
      const edgePos = getRoadEdgePositionAt(parentRoad, edgeSide, globalT)
      return edgePos[1] - midY
    }

    const { geometry, collisionVertices, collisionIndices } = createCurbGeometry(
      length,
      curbType,
      sampleYOffset,
    )

    return { geometry, collisionVertices, collisionIndices, rotation: rot, midpoint: mid, curbLength: length }
  }, [curb, parentRoad, curbType])

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

  if (!result) return null

  const perpOffset = curb.edgeSide === 'left' ? CURB_WIDTH / 2 : -CURB_WIDTH / 2

  if (isGhost) {
    return (
      <group position={result.midpoint} rotation={[0, result.rotation, 0]}>
        <mesh position={[perpOffset, 0, 0]} geometry={result.geometry} receiveShadow={false}>
          <CurbSurfaceMaterial curbType={curbType} isGhost />
        </mesh>
      </group>
    )
  }

  return (
    <RigidBody
      type='fixed'
      position={result.midpoint}
      rotation={[0, result.rotation, 0]}
      friction={curbConfig.friction}
      restitution={curbConfig.restitution}
      colliders={false}
    >
      <group position={[perpOffset, 0, 0]}>
        <CuboidCollider
          args={[CURB_WIDTH / 2, peakHeight / 2, result.curbLength / 2]}
          position={[0, peakHeight / 2, 0]}
          sensor
          onIntersectionEnter={handleEnter}
          onIntersectionExit={handleExit}
        />

        {result.collisionVertices.length > 0 && (
          <TrimeshCollider
            args={[result.collisionVertices, result.collisionIndices]}
            friction={curbConfig.friction}
            collisionGroups={TRACK_COLLISION_GROUPS}
          />
        )}

        <mesh geometry={result.geometry} receiveShadow castShadow>
          <CurbSurfaceMaterial curbType={curbType} />
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
  const previewResult = useMemo(() => {
    const dx = endPosition[0] - startPosition[0]
    const dz = endPosition[2] - startPosition[2]
    const length = Math.sqrt(dx * dx + dz * dz)

    if (length < 0.1) return null

    const rot = Math.atan2(dx, dz)
    const mid: [number, number, number] = [
      (startPosition[0] + endPosition[0]) / 2,
      (startPosition[1] + endPosition[1]) / 2,
      (startPosition[2] + endPosition[2]) / 2,
    ]

    const { geometry } = createCurbGeometry(length, 'apex')

    return { geometry, rotation: rot, midpoint: mid }
  }, [startPosition, endPosition])

  if (!previewResult) return null

  const perpOffset = edge === 'left' ? CURB_WIDTH / 2 : -CURB_WIDTH / 2

  return (
    <group position={previewResult.midpoint} rotation={[0, previewResult.rotation, 0]}>
      <mesh position={[perpOffset, 0, 0]} geometry={previewResult.geometry}>
        <CurbSurfaceMaterial curbType='apex' isGhost={isGhost} />
      </mesh>
    </group>
  )
}
