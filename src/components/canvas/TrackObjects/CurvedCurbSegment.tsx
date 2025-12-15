import { useMemo } from 'react'
import { Vector3, QuadraticBezierCurve3, BufferGeometry, Float32BufferAttribute } from 'three'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { GHOST_OPACITY } from '../../../constants/trackObjects'
import { CURB_PROFILE, CURB_WIDTH, CURB_PEAK_HEIGHT } from '../../../constants/curb'
import { useCurbStore } from '../../../stores/useCurbStore'
import { PlacedObject } from '../../../stores/useCustomizationStore'

interface CurvedCurbSegmentProps {
  curb: PlacedObject
  parentRoad: PlacedObject
  isGhost?: boolean
}

const ROAD_HALF_WIDTH = 8 // Road is 16 units wide

// Helper to get height from curb profile at normalized position (0-1 across width)
function getProfileHeight(normalizedX: number): number {
  const x = normalizedX * CURB_WIDTH

  for (let i = 0; i < CURB_PROFILE.length - 1; i++) {
    const p1 = CURB_PROFILE[i]
    const p2 = CURB_PROFILE[i + 1]

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

  const { stripeGeometries, colliderData } = useMemo(() => {
    if (
      !curb.startT ||
      !curb.endT ||
      !curb.edgeSide ||
      !parentRoad.startPoint ||
      !parentRoad.endPoint ||
      !parentRoad.controlPoint
    ) {
      return { stripeGeometries: [], colliderData: null }
    }

    const start = new Vector3(...parentRoad.startPoint)
    const control = new Vector3(...parentRoad.controlPoint)
    const end = new Vector3(...parentRoad.endPoint)

    const curve = new QuadraticBezierCurve3(start, control, end)

    // Calculate segment of curve to use
    const tStart = Math.min(curb.startT, curb.endT)
    const tEnd = Math.max(curb.startT, curb.endT)
    const tRange = tEnd - tStart

    // Calculate stripe positions along the curve for alternating colors
    const curveLength = curve.getLength() * tRange
    const stripeLength = 2
    const stripeCount = Math.max(2, Math.ceil(curveLength / stripeLength))

    const edgeSign = curb.edgeSide === 'left' ? 1 : -1

    const stripes: { geometry: BufferGeometry; color: string }[] = []

    // Profile subdivisions for 3D shape
    const profileSubdivisions = 6 // Number of points across the curb width

    for (let s = 0; s < stripeCount; s++) {
      const segStart = tStart + (s / stripeCount) * tRange
      const segEnd = tStart + ((s + 1) / stripeCount) * tRange
      const segmentPoints = 8 // Points along the curve segment

      const vertices: number[] = []
      const indices: number[] = []

      // Generate vertices with 3D profile
      for (let i = 0; i <= segmentPoints; i++) {
        const t = segStart + (i / segmentPoints) * (segEnd - segStart)
        const pos = curve.getPoint(t)
        const tangent = curve.getTangent(t)
        const perp = new Vector3(-tangent.z, 0, tangent.x).normalize()

        // Generate points across the curb width with height profile
        for (let p = 0; p <= profileSubdivisions; p++) {
          const normalizedWidth = p / profileSubdivisions
          const height = getProfileHeight(normalizedWidth)

          // Calculate position: inner edge to outer edge
          const innerOffset = ROAD_HALF_WIDTH * edgeSign
          const outerOffset = (ROAD_HALF_WIDTH + CURB_WIDTH) * edgeSign
          const widthOffset = innerOffset + (outerOffset - innerOffset) * normalizedWidth

          vertices.push(pos.x + perp.x * widthOffset, height, pos.z + perp.z * widthOffset)
        }
      }

      // Generate indices for the 3D mesh
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

    // Calculate collider position (center of curb segment)
    const midT = (tStart + tEnd) / 2
    const midPos = curve.getPoint(midT)
    const midTangent = curve.getTangent(midT)
    const midPerp = new Vector3(-midTangent.z, 0, midTangent.x).normalize()
    const colliderOffset = (ROAD_HALF_WIDTH + CURB_WIDTH / 2) * edgeSign

    return {
      stripeGeometries: stripes,
      colliderData: {
        position: [
          midPos.x + midPerp.x * colliderOffset,
          CURB_PEAK_HEIGHT / 2,
          midPos.z + midPerp.z * colliderOffset,
        ] as [number, number, number],
        length: curveLength,
        rotation: Math.atan2(midTangent.x, midTangent.z),
      },
    }
  }, [curb, parentRoad])

  if (stripeGeometries.length === 0) return null

  const handleEnter = () => {
    if (!isGhost && curb.edgeSide) {
      enterCurb(curb.edgeSide)
    }
  }

  const handleExit = () => {
    if (!isGhost) {
      exitCurb()
    }
  }

  // Ghost mode - visual only
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

  // Normal mode - with physics
  return (
    <group>
      {/* Physics collider */}
      {colliderData && (
        <RigidBody type="fixed" colliders={false} position={colliderData.position}>
          <CuboidCollider
            args={[CURB_WIDTH / 2, CURB_PEAK_HEIGHT, colliderData.length / 2]}
            sensor
            onIntersectionEnter={handleEnter}
            onIntersectionExit={handleExit}
          />
        </RigidBody>
      )}

      {/* Visual meshes */}
      {stripeGeometries.map((stripe, i) => (
        <mesh key={i} geometry={stripe.geometry} receiveShadow castShadow>
          <meshStandardMaterial color={stripe.color} side={2} />
        </mesh>
      ))}
    </group>
  )
}

// Preview version for curved curb during drag
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
    const stripeLength = 2
    const stripeCount = Math.max(2, Math.ceil(curveLength / stripeLength))

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

        for (let p = 0; p <= profileSubdivisions; p++) {
          const normalizedWidth = p / profileSubdivisions
          const height = getProfileHeight(normalizedWidth)

          const innerOffset = ROAD_HALF_WIDTH * edgeSign
          const outerOffset = (ROAD_HALF_WIDTH + CURB_WIDTH) * edgeSign
          const widthOffset = innerOffset + (outerOffset - innerOffset) * normalizedWidth

          vertices.push(pos.x + perp.x * widthOffset, height, pos.z + perp.z * widthOffset)
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
