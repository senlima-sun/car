import { useMemo } from 'react'
import { Vector3, QuadraticBezierCurve3, BufferGeometry, Float32BufferAttribute } from 'three'
import { GHOST_OPACITY } from '../../../constants/trackObjects'
import { PlacedObject } from '../../../stores/useCustomizationStore'

interface CurvedCurbSegmentProps {
  curb: PlacedObject
  parentRoad: PlacedObject
  isGhost?: boolean
}

const CURB_WIDTH = 2
const CURB_HEIGHT = 0.05
const ROAD_HALF_WIDTH = 8 // Road is 16 units wide

export default function CurvedCurbSegment({
  curb,
  parentRoad,
  isGhost = false,
}: CurvedCurbSegmentProps) {
  const stripePositions = useMemo(() => {
    if (
      !curb.startT ||
      !curb.endT ||
      !curb.edgeSide ||
      !parentRoad.startPoint ||
      !parentRoad.endPoint ||
      !parentRoad.controlPoint
    ) {
      return []
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

    const stripes: { startT: number; endT: number; color: string }[] = []
    for (let i = 0; i < stripeCount; i++) {
      const segStart = tStart + (i / stripeCount) * tRange
      const segEnd = tStart + ((i + 1) / stripeCount) * tRange
      stripes.push({
        startT: segStart,
        endT: segEnd,
        color: i % 2 === 0 ? '#ff0000' : '#ffffff',
      })
    }

    return stripes
  }, [curb, parentRoad])

  // Generate individual stripe geometries
  const stripeGeometries = useMemo(() => {
    if (
      !curb.startT ||
      !curb.endT ||
      !curb.edgeSide ||
      !parentRoad.startPoint ||
      !parentRoad.endPoint ||
      !parentRoad.controlPoint ||
      stripePositions.length === 0
    ) {
      return []
    }

    const start = new Vector3(...parentRoad.startPoint)
    const control = new Vector3(...parentRoad.controlPoint)
    const end = new Vector3(...parentRoad.endPoint)
    const curve = new QuadraticBezierCurve3(start, control, end)

    const edgeSign = curb.edgeSide === 'left' ? 1 : -1

    return stripePositions.map(stripe => {
      const segmentPoints = 8 // Points per stripe segment
      const vertices: number[] = []
      const indices: number[] = []

      for (let i = 0; i <= segmentPoints; i++) {
        const t = stripe.startT + (i / segmentPoints) * (stripe.endT - stripe.startT)
        const pos = curve.getPoint(t)
        const tangent = curve.getTangent(t)
        const perp = new Vector3(-tangent.z, 0, tangent.x).normalize()

        const innerOffset = ROAD_HALF_WIDTH * edgeSign
        const outerOffset = (ROAD_HALF_WIDTH + CURB_WIDTH) * edgeSign

        vertices.push(pos.x + perp.x * innerOffset, CURB_HEIGHT, pos.z + perp.z * innerOffset)
        vertices.push(pos.x + perp.x * outerOffset, CURB_HEIGHT, pos.z + perp.z * outerOffset)

        if (i > 0) {
          const baseIdx = (i - 1) * 2
          indices.push(baseIdx, baseIdx + 1, baseIdx + 2)
          indices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2)
        }
      }

      const geo = new BufferGeometry()
      geo.setAttribute('position', new Float32BufferAttribute(vertices, 3))
      geo.setIndex(indices)
      geo.computeVertexNormals()

      return { geometry: geo, color: stripe.color }
    })
  }, [curb, parentRoad, stripePositions])

  if (stripeGeometries.length === 0) return null

  return (
    <group>
      {stripeGeometries.map((stripe, i) => (
        <mesh key={i} geometry={stripe.geometry} receiveShadow={!isGhost}>
          <meshStandardMaterial
            color={stripe.color}
            transparent={isGhost}
            opacity={isGhost ? GHOST_OPACITY : 1}
            depthWrite={!isGhost}
            side={2} // DoubleSide
          />
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

        const innerOffset = ROAD_HALF_WIDTH * edgeSign
        const outerOffset = (ROAD_HALF_WIDTH + CURB_WIDTH) * edgeSign

        vertices.push(pos.x + perp.x * innerOffset, CURB_HEIGHT, pos.z + perp.z * innerOffset)
        vertices.push(pos.x + perp.x * outerOffset, CURB_HEIGHT, pos.z + perp.z * outerOffset)

        if (i > 0) {
          const baseIdx = (i - 1) * 2
          indices.push(baseIdx, baseIdx + 1, baseIdx + 2)
          indices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2)
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
