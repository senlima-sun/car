import { useMemo, useCallback } from 'react'
import { Vector3, QuadraticBezierCurve3, BufferGeometry, Float32BufferAttribute } from 'three'
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
import { ROAD_HALF_WIDTH, TRACK_WIDTH, TRACK_COLLISION_GROUPS } from '../../../constants/dimensions'
import { useCurbStore } from '../../../stores/useCurbStore'
import { useSurfaceStore } from '../../../stores/useSurfaceStore'
import { PlacedObject } from '../../../stores/useCustomizationStore'
import { getElevationAtT } from '../../../utils/roadGeometry'
import CurbSurfaceMaterial from './CurbSurfaceMaterial'
import type { CurbType } from '../../../types/trackObjects'

const curbConfig = OBJECT_CONFIGS.curb

interface CurvedCurbSegmentProps {
  curb: PlacedObject
  parentRoad: PlacedObject
  isGhost?: boolean
}

function getProfileHeight(normalizedX: number, curbType: CurbType): number {
  const profile = getProfileForType(curbType)
  const x = normalizedX * CURB_WIDTH

  for (let i = 0; i < profile.length - 1; i++) {
    const p1 = profile[i]
    const p2 = profile[i + 1]

    if (x >= p1.x && x <= p2.x) {
      const t = (x - p1.x) / (p2.x - p1.x)
      return p1.y + t * (p2.y - p1.y)
    }
  }

  return 0
}

function buildCurveArcSamples(
  _curve: QuadraticBezierCurve3,
  tStart: number,
  tEnd: number,
  curveLength: number,
  curbType: CurbType,
): number[] {
  const tRange = tEnd - tStart
  const baseCount = Math.max(8, Math.ceil(curveLength / (STRIPE_WIDTH * 0.5)))
  const tSamples = new Set<number>()

  for (let i = 0; i <= baseCount; i++) {
    tSamples.add(tStart + (i / baseCount) * tRange)
  }

  if (curbType === 'exit') {
    const totalArc = curveLength
    const firstTooth = Math.ceil(0 / TOOTH_SPACING) * TOOTH_SPACING
    for (let toothBase = firstTooth; toothBase < totalArc; toothBase += TOOTH_SPACING) {
      const transitions = [
        toothBase,
        toothBase + TOOTH_RAMP * TOOTH_SPACING,
        toothBase + (TOOTH_RAMP + TOOTH_FLAT) * TOOTH_SPACING,
        toothBase + (TOOTH_RAMP + TOOTH_FLAT + TOOTH_DROP) * TOOTH_SPACING,
      ]
      for (const arcT of transitions) {
        const normalizedArc = arcT / totalArc
        if (normalizedArc >= 0 && normalizedArc <= 1) {
          tSamples.add(tStart + normalizedArc * tRange)
        }
      }
    }
  }

  return Array.from(tSamples).sort((a, b) => a - b)
}

interface UnifiedGeometryResult {
  geometry: BufferGeometry
  collisionVertices: Float32Array
  collisionIndices: Uint32Array
}

function createUnifiedCurvedGeometry(
  curve: QuadraticBezierCurve3,
  tStart: number,
  tEnd: number,
  curveLength: number,
  edgeSign: number,
  curbType: CurbType,
  parentRoad: PlacedObject,
  roadHalfWidth: number = ROAD_HALF_WIDTH,
): UnifiedGeometryResult {
  const profileSubdivisions = 6
  const vertsPerRow = profileSubdivisions + 1
  const isExit = curbType === 'exit'

  const tSamples = buildCurveArcSamples(curve, tStart, tEnd, curveLength, curbType)
  const tRange = tEnd - tStart

  const vertices: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let ri = 0; ri < tSamples.length; ri++) {
    const t = tSamples[ri]
    const pos = curve.getPoint(t)
    const tangent = curve.getTangent(t)
    const perp = new Vector3(-tangent.z, 0, tangent.x).normalize()
    const elevationY = getElevationAtT(parentRoad, t)

    const normalizedArc = (t - tStart) / tRange
    const arcPos = normalizedArc * curveLength
    const sawMod = isExit ? getSawtoothHeight(arcPos) : 1.0

    for (let p = 0; p <= profileSubdivisions; p++) {
      const normalizedWidth = p / profileSubdivisions
      const baseHeight = getProfileHeight(normalizedWidth, curbType)
      const height = isExit ? baseHeight * sawMod : baseHeight

      const innerOffset = roadHalfWidth * edgeSign
      const outerOffset = (roadHalfWidth + CURB_WIDTH) * edgeSign
      const widthOffset = innerOffset + (outerOffset - innerOffset) * normalizedWidth

      vertices.push(pos.x + perp.x * widthOffset, height + elevationY, pos.z + perp.z * widthOffset)

      uvs.push(normalizedWidth, arcPos)
    }
  }

  const rowCount = tSamples.length
  for (let i = 0; i < rowCount - 1; i++) {
    for (let p = 0; p < profileSubdivisions; p++) {
      const a = i * vertsPerRow + p
      const b = i * vertsPerRow + p + 1
      const c = (i + 1) * vertsPerRow + p
      const d = (i + 1) * vertsPerRow + p + 1

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

export default function CurvedCurbSegment({
  curb,
  parentRoad,
  isGhost = false,
}: CurvedCurbSegmentProps) {
  const enterCurb = useCurbStore(state => state.enterCurb)
  const exitCurb = useCurbStore(state => state.exitCurb)
  const enterSurface = useSurfaceStore(s => s.enterSurface)
  const exitSurface = useSurfaceStore(s => s.exitSurface)

  const curbType: CurbType = curb.curbType || 'apex'
  const peakHeight = CURB_PEAK_HEIGHTS[curbType]

  const result = useMemo(() => {
    if (
      !curb.startT ||
      !curb.endT ||
      !curb.edgeSide ||
      !parentRoad.startPoint ||
      !parentRoad.endPoint ||
      !parentRoad.controlPoint
    ) {
      return null
    }

    const start = new Vector3(...parentRoad.startPoint)
    const control = new Vector3(...parentRoad.controlPoint)
    const end = new Vector3(...parentRoad.endPoint)
    const curve = new QuadraticBezierCurve3(start, control, end)

    const tStart = Math.min(curb.startT, curb.endT)
    const tEnd = Math.max(curb.startT, curb.endT)
    const tRange = tEnd - tStart
    const curveLength = curve.getLength() * tRange

    if (curveLength < 0.01) return null

    const edgeSign = curb.edgeSide === 'left' ? 1 : -1
    const parentHalfWidth = (parentRoad.width ?? TRACK_WIDTH) / 2

    const { geometry, collisionVertices, collisionIndices } = createUnifiedCurvedGeometry(
      curve,
      tStart,
      tEnd,
      curveLength,
      edgeSign,
      curbType,
      parentRoad,
      parentHalfWidth,
    )

    const midT = (tStart + tEnd) / 2
    const midPos = curve.getPoint(midT)
    const midTangent = curve.getTangent(midT)
    const midPerp = new Vector3(-midTangent.z, 0, midTangent.x).normalize()
    const sensorOffset = (parentHalfWidth + CURB_WIDTH / 2) * edgeSign
    const sensorElevation = getElevationAtT(parentRoad, midT)

    return {
      geometry,
      collisionVertices,
      collisionIndices,
      sensorData: {
        position: [
          midPos.x + midPerp.x * sensorOffset,
          peakHeight / 2 + sensorElevation,
          midPos.z + midPerp.z * sensorOffset,
        ] as [number, number, number],
        length: curveLength,
      },
    }
  }, [curb, parentRoad, curbType, peakHeight])

  if (!result) return null

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
      <group>
        <mesh geometry={result.geometry} receiveShadow={false}>
          <CurbSurfaceMaterial curbType={curbType} isGhost />
        </mesh>
      </group>
    )
  }

  return (
    <RigidBody
      type='fixed'
      friction={curbConfig.friction}
      restitution={curbConfig.restitution}
      colliders={false}
    >
      {result.sensorData && (
        <CuboidCollider
          position={result.sensorData.position}
          args={[CURB_WIDTH / 2, peakHeight / 2, result.sensorData.length / 2]}
          sensor
          onIntersectionEnter={handleEnter}
          onIntersectionExit={handleExit}
        />
      )}

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
    </RigidBody>
  )
}

interface CurvedCurbPreviewProps {
  parentRoad: PlacedObject
  edge: 'left' | 'right'
  startT: number
  endT: number
  isGhost?: boolean
}

export function CurvedCurbPreview({
  parentRoad,
  edge,
  startT,
  endT,
  isGhost = true,
}: CurvedCurbPreviewProps) {
  const geometry = useMemo(() => {
    if (!parentRoad.startPoint || !parentRoad.endPoint || !parentRoad.controlPoint) {
      return null
    }

    const start = new Vector3(...parentRoad.startPoint)
    const control = new Vector3(...parentRoad.controlPoint)
    const end = new Vector3(...parentRoad.endPoint)
    const curve = new QuadraticBezierCurve3(start, control, end)

    const tStart = Math.min(startT, endT)
    const tEnd = Math.max(startT, endT)
    const tRange = tEnd - tStart

    if (tRange < 0.01) return null

    const curveLength = curve.getLength() * tRange
    const edgeSign = edge === 'left' ? 1 : -1
    const parentHalfWidth = (parentRoad.width ?? TRACK_WIDTH) / 2

    const { geometry: geo } = createUnifiedCurvedGeometry(
      curve,
      tStart,
      tEnd,
      curveLength,
      edgeSign,
      'apex',
      parentRoad,
      parentHalfWidth,
    )

    return geo
  }, [parentRoad, edge, startT, endT])

  if (!geometry) return null

  return (
    <group>
      <mesh geometry={geometry}>
        <CurbSurfaceMaterial curbType='apex' isGhost={isGhost} />
      </mesh>
    </group>
  )
}
