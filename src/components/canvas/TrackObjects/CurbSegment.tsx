import { useMemo } from 'react'
import { GHOST_OPACITY } from '../../../constants/trackObjects'
import { PlacedObject, getRoadEdgePositionAt } from '../../../stores/useCustomizationStore'

interface CurbSegmentProps {
  curb: PlacedObject
  parentRoad: PlacedObject
  isGhost?: boolean
}

const CURB_WIDTH = 2 // Width of the curb perpendicular to road
const CURB_HEIGHT = 0.05 // Slight elevation

export default function CurbSegment({ curb, parentRoad, isGhost = false }: CurbSegmentProps) {
  const { stripes, rotation, midpoint, curbLength } = useMemo(() => {
    if (!curb.startT || !curb.endT || !curb.edgeSide) {
      return {
        stripes: [],
        rotation: 0,
        midpoint: [0, 0, 0] as [number, number, number],
        curbLength: 0,
      }
    }

    const startT = curb.startT
    const endT = curb.endT

    // Get edge positions at start and end
    const startPos = getRoadEdgePositionAt(parentRoad, curb.edgeSide, startT)
    const endPos = getRoadEdgePositionAt(parentRoad, curb.edgeSide, endT)

    // Calculate length and direction
    const dx = endPos[0] - startPos[0]
    const dz = endPos[2] - startPos[2]
    const length = Math.sqrt(dx * dx + dz * dz)

    if (length === 0) {
      return {
        stripes: [],
        rotation: 0,
        midpoint: [0, 0, 0] as [number, number, number],
        curbLength: 0,
      }
    }

    // Calculate rotation (direction of curb)
    const rot = Math.atan2(dx, dz)

    // Midpoint for positioning
    const mid: [number, number, number] = [
      (startPos[0] + endPos[0]) / 2,
      CURB_HEIGHT,
      (startPos[2] + endPos[2]) / 2,
    ]

    // Calculate stripes (approximately 2 units per stripe)
    const stripeLength = 2
    const stripeCount = Math.max(2, Math.ceil(length / stripeLength))
    const actualStripeLength = length / stripeCount

    const stripeData: { offset: number; color: string }[] = []
    for (let i = 0; i < stripeCount; i++) {
      stripeData.push({
        offset: -length / 2 + (i + 0.5) * actualStripeLength,
        color: i % 2 === 0 ? '#ff0000' : '#ffffff',
      })
    }

    return { stripes: stripeData, rotation: rot, midpoint: mid, curbLength: length }
  }, [curb, parentRoad])

  if (stripes.length === 0) return null

  // Calculate perpendicular offset direction for curb width positioning
  // The curb should extend outward from the road edge
  const perpOffset = curb.edgeSide === 'left' ? CURB_WIDTH / 2 : -CURB_WIDTH / 2

  return (
    <group position={midpoint} rotation={[0, rotation, 0]}>
      {stripes.map((stripe, i) => (
        <mesh
          key={i}
          position={[perpOffset, 0, stripe.offset]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow={!isGhost}
        >
          <planeGeometry args={[CURB_WIDTH, (curbLength / stripes.length) * 0.98]} />
          <meshStandardMaterial
            color={stripe.color}
            transparent={isGhost}
            opacity={isGhost ? GHOST_OPACITY : 1}
            depthWrite={!isGhost}
          />
        </mesh>
      ))}
    </group>
  )
}

// Simplified version for preview (when dragging)
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
  const { stripes, rotation, midpoint, curbLength } = useMemo(() => {
    const dx = endPosition[0] - startPosition[0]
    const dz = endPosition[2] - startPosition[2]
    const length = Math.sqrt(dx * dx + dz * dz)

    if (length < 0.1) {
      return {
        stripes: [],
        rotation: 0,
        midpoint: [0, 0, 0] as [number, number, number],
        curbLength: 0,
      }
    }

    const rot = Math.atan2(dx, dz)
    const mid: [number, number, number] = [
      (startPosition[0] + endPosition[0]) / 2,
      CURB_HEIGHT,
      (startPosition[2] + endPosition[2]) / 2,
    ]

    const stripeLength = 2
    const stripeCount = Math.max(2, Math.ceil(length / stripeLength))
    const actualStripeLength = length / stripeCount

    const stripeData: { offset: number; color: string }[] = []
    for (let i = 0; i < stripeCount; i++) {
      stripeData.push({
        offset: -length / 2 + (i + 0.5) * actualStripeLength,
        color: i % 2 === 0 ? '#ff0000' : '#ffffff',
      })
    }

    return { stripes: stripeData, rotation: rot, midpoint: mid, curbLength: length }
  }, [startPosition, endPosition])

  if (stripes.length === 0) return null

  const perpOffset = edge === 'left' ? CURB_WIDTH / 2 : -CURB_WIDTH / 2

  return (
    <group position={midpoint} rotation={[0, rotation, 0]}>
      {stripes.map((stripe, i) => (
        <mesh key={i} position={[perpOffset, 0, stripe.offset]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[CURB_WIDTH, (curbLength / stripes.length) * 0.98]} />
          <meshStandardMaterial
            color={stripe.color}
            transparent={isGhost}
            opacity={isGhost ? GHOST_OPACITY : 1}
            depthWrite={!isGhost}
          />
        </mesh>
      ))}
    </group>
  )
}
