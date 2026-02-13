import { useMemo, useCallback } from 'react'
import { Vector3, QuadraticBezierCurve3, BufferGeometry, Float32BufferAttribute } from 'three'
import { RigidBody, CuboidCollider, TrimeshCollider } from '@react-three/rapier'
import { GHOST_OPACITY, OBJECT_CONFIGS } from '../../../constants/trackObjects'
import { CURB_WIDTH, CURB_PEAK_HEIGHTS, STRIPE_WIDTH, getProfileForType, TOOTH_SPACING } from '../../../constants/curb'
import { ROAD_HALF_WIDTH, TRACK_COLLISION_GROUPS } from '../../../constants/dimensions'
import { useCurbStore } from '../../../stores/useCurbStore'
import { useSurfaceStore } from '../../../stores/useSurfaceStore'
import { PlacedObject } from '../../../stores/useCustomizationStore'
import { getElevationAtT } from '../../../utils/roadGeometry'
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

  const { stripeGeometries, collisionData, sensorData } = useMemo(() => {
    if (
      !curb.startT ||
      !curb.endT ||
      !curb.edgeSide ||
      !parentRoad.startPoint ||
      !parentRoad.endPoint ||
      !parentRoad.controlPoint
    ) {
      return { stripeGeometries: [], collisionData: { vertices: new Float32Array(0), indices: new Uint32Array(0) }, sensorData: null }
    }

    const start = new Vector3(...parentRoad.startPoint)
    const control = new Vector3(...parentRoad.controlPoint)
    const end = new Vector3(...parentRoad.endPoint)

    const curve = new QuadraticBezierCurve3(start, control, end)

    const tStart = Math.min(curb.startT, curb.endT)
    const tEnd = Math.max(curb.startT, curb.endT)
    const tRange = tEnd - tStart

    const curveLength = curve.getLength() * tRange
    const stripeCount = Math.max(2, Math.ceil(curveLength / STRIPE_WIDTH))

    const edgeSign = curb.edgeSide === 'left' ? 1 : -1

    const stripes: { geometry: BufferGeometry; color: string }[] = []

    const profileSubdivisions = 6

    let cumulativeArcLength = 0

    for (let s = 0; s < stripeCount; s++) {
      const segStart = tStart + (s / stripeCount) * tRange
      const segEnd = tStart + ((s + 1) / stripeCount) * tRange
      const segmentPoints = 8

      const vertices: number[] = []
      const indices: number[] = []

      for (let i = 0; i <= segmentPoints; i++) {
        const t = segStart + (i / segmentPoints) * (segEnd - segStart)
        const pos = curve.getPoint(t)
        const tangent = curve.getTangent(t)
        const perp = new Vector3(-tangent.z, 0, tangent.x).normalize()

        const arcPos = cumulativeArcLength + (i / segmentPoints) * (curveLength / stripeCount)
        const sawtoothMod = curbType === 'exit'
          ? Math.abs(((arcPos / TOOTH_SPACING) % 1) * 2 - 1)
          : 1.0

        for (let p = 0; p <= profileSubdivisions; p++) {
          const normalizedWidth = p / profileSubdivisions
          const baseHeight = getProfileHeight(normalizedWidth, curbType)
          const height = curbType === 'exit' ? baseHeight * sawtoothMod : baseHeight

          const innerOffset = ROAD_HALF_WIDTH * edgeSign
          const outerOffset = (ROAD_HALF_WIDTH + CURB_WIDTH) * edgeSign
          const widthOffset = innerOffset + (outerOffset - innerOffset) * normalizedWidth

          vertices.push(pos.x + perp.x * widthOffset, height, pos.z + perp.z * widthOffset)
        }
      }

      cumulativeArcLength += curveLength / stripeCount

      const vertsPerRow = profileSubdivisions + 1
      for (let i = 0; i < segmentPoints; i++) {
        for (let p = 0; p < profileSubdivisions; p++) {
          const a = i * vertsPerRow + p
          const b = i * vertsPerRow + p + 1
          const c = (i + 1) * vertsPerRow + p
          const d = (i + 1) * vertsPerRow + p + 1

          indices.push(a, c, b)
          indices.push(b, c, d)
        }
      }

      const geo = new BufferGeometry()
      geo.setAttribute('position', new Float32BufferAttribute(vertices, 3))
      geo.setIndex(indices)
      geo.computeVertexNormals()

      stripes.push({
        geometry: geo,
        color: s % 2 === 0 ? '#ff0000' : '#ffffff',
      })
    }

    const allCollisionVerts: number[] = []
    const allCollisionIndices: number[] = []
    let vertexOffset = 0

    for (const stripe of stripes) {
      const posAttr = stripe.geometry.getAttribute('position')
      const idx = stripe.geometry.getIndex()
      if (!posAttr || !idx) continue

      for (let i = 0; i < posAttr.count; i++) {
        allCollisionVerts.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i))
      }
      for (let i = 0; i < idx.count; i++) {
        allCollisionIndices.push(idx.getX(i) + vertexOffset)
      }
      vertexOffset += posAttr.count
    }

    const collisionData = {
      vertices: new Float32Array(allCollisionVerts),
      indices: new Uint32Array(allCollisionIndices),
    }

    const midT = (tStart + tEnd) / 2
    const midPos = curve.getPoint(midT)
    const midTangent = curve.getTangent(midT)
    const midPerp = new Vector3(-midTangent.z, 0, midTangent.x).normalize()
    const sensorOffset = (ROAD_HALF_WIDTH + CURB_WIDTH / 2) * edgeSign
    const sensorElevation = getElevationAtT(parentRoad, midT)

    return {
      stripeGeometries: stripes,
      collisionData,
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

  if (stripeGeometries.length === 0) return null

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
        {stripeGeometries.map((stripe, i) => (
          <mesh key={i} geometry={stripe.geometry} receiveShadow={false}>
            <meshStandardMaterial
              color={stripe.color}
              transparent
              opacity={GHOST_OPACITY}
              depthWrite={false}
              side={2}
            />
          </mesh>
        ))}
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
      {sensorData && (
        <CuboidCollider
          position={sensorData.position}
          args={[CURB_WIDTH / 2, peakHeight / 2, sensorData.length / 2]}
          sensor
          onIntersectionEnter={handleEnter}
          onIntersectionExit={handleExit}
        />
      )}

      {collisionData.vertices.length > 0 && (
        <TrimeshCollider
          args={[collisionData.vertices, collisionData.indices]}
          friction={curbConfig.friction}
          collisionGroups={TRACK_COLLISION_GROUPS}
        />
      )}
      {stripeGeometries.map((stripe, i) => (
        <mesh key={i} geometry={stripe.geometry} receiveShadow castShadow>
          <meshStandardMaterial color={stripe.color} side={2} />
        </mesh>
      ))}
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
  const stripeGeometries = useMemo(() => {
    if (!parentRoad.startPoint || !parentRoad.endPoint || !parentRoad.controlPoint) {
      return []
    }

    const start = new Vector3(...parentRoad.startPoint)
    const control = new Vector3(...parentRoad.controlPoint)
    const end = new Vector3(...parentRoad.endPoint)
    const curve = new QuadraticBezierCurve3(start, control, end)

    const tStart = Math.min(startT, endT)
    const tEnd = Math.max(startT, endT)
    const tRange = tEnd - tStart

    if (tRange < 0.01) return []

    const curveLength = curve.getLength() * tRange
    const stripeCount = Math.max(2, Math.ceil(curveLength / STRIPE_WIDTH))

    const edgeSign = edge === 'left' ? 1 : -1
    const profileSubdivisions = 6

    const stripes: { geometry: BufferGeometry; color: string }[] = []

    for (let s = 0; s < stripeCount; s++) {
      const segStart = tStart + (s / stripeCount) * tRange
      const segEnd = tStart + ((s + 1) / stripeCount) * tRange
      const segmentPoints = 8

      const vertices: number[] = []
      const indices: number[] = []

      for (let i = 0; i <= segmentPoints; i++) {
        const t = segStart + (i / segmentPoints) * (segEnd - segStart)
        const pos = curve.getPoint(t)
        const tangent = curve.getTangent(t)
        const perp = new Vector3(-tangent.z, 0, tangent.x).normalize()
        const elevationY = getElevationAtT(parentRoad, t)

        for (let p = 0; p <= profileSubdivisions; p++) {
          const normalizedWidth = p / profileSubdivisions
          const height = getProfileHeight(normalizedWidth, 'apex')

          const innerOffset = ROAD_HALF_WIDTH * edgeSign
          const outerOffset = (ROAD_HALF_WIDTH + CURB_WIDTH) * edgeSign
          const widthOffset = innerOffset + (outerOffset - innerOffset) * normalizedWidth

          vertices.push(pos.x + perp.x * widthOffset, height + elevationY, pos.z + perp.z * widthOffset)
        }
      }

      const vertsPerRow = profileSubdivisions + 1
      for (let i = 0; i < segmentPoints; i++) {
        for (let p = 0; p < profileSubdivisions; p++) {
          const a = i * vertsPerRow + p
          const b = i * vertsPerRow + p + 1
          const c = (i + 1) * vertsPerRow + p
          const d = (i + 1) * vertsPerRow + p + 1

          indices.push(a, c, b)
          indices.push(b, c, d)
        }
      }

      const geo = new BufferGeometry()
      geo.setAttribute('position', new Float32BufferAttribute(vertices, 3))
      geo.setIndex(indices)
      geo.computeVertexNormals()

      stripes.push({
        geometry: geo,
        color: s % 2 === 0 ? '#ff0000' : '#ffffff',
      })
    }

    return stripes
  }, [parentRoad, edge, startT, endT])

  if (stripeGeometries.length === 0) return null

  return (
    <group>
      {stripeGeometries.map((stripe, i) => (
        <mesh key={i} geometry={stripe.geometry}>
          <meshStandardMaterial
            color={stripe.color}
            transparent={isGhost}
            opacity={isGhost ? GHOST_OPACITY : 1}
            depthWrite={!isGhost}
            side={2}
          />
        </mesh>
      ))}
    </group>
  )
}
