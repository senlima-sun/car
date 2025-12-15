import { useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { GHOST_OPACITY } from '../../../constants/trackObjects'
import { CURB_PROFILE, CURB_WIDTH, CURB_PEAK_HEIGHT } from '../../../constants/curb'
import { useCurbStore } from '../../../stores/useCurbStore'
import { PlacedObject, getRoadEdgePositionAt } from '../../../stores/useCustomizationStore'

interface CurbSegmentProps {
  curb: PlacedObject
  parentRoad: PlacedObject
  isGhost?: boolean
}

// Generate 3D curb geometry with rounded slope profile
function createCurbGeometry(length: number, stripeCount: number): BufferGeometry {
  const vertices: number[] = []
  const indices: number[] = []
  const colors: number[] = []

  const profilePoints = CURB_PROFILE.length
  const lengthSegments = Math.max(2, Math.ceil(length / 2)) // Segment every ~2 units

  // Generate vertices along the length with profile cross-section
  for (let i = 0; i <= lengthSegments; i++) {
    const z = (i / lengthSegments - 0.5) * length

    for (let j = 0; j < profilePoints; j++) {
      const profile = CURB_PROFILE[j]
      vertices.push(profile.x - CURB_WIDTH / 2, profile.y, z)

      // Determine stripe color based on position along length
      const stripeIndex = Math.floor((i / lengthSegments) * stripeCount)
      const isRed = stripeIndex % 2 === 0
      colors.push(isRed ? 1 : 1, isRed ? 0 : 1, isRed ? 0 : 1) // Red or white
    }
  }

  // Generate indices for triangles
  for (let i = 0; i < lengthSegments; i++) {
    for (let j = 0; j < profilePoints - 1; j++) {
      const a = i * profilePoints + j
      const b = i * profilePoints + j + 1
      const c = (i + 1) * profilePoints + j
      const d = (i + 1) * profilePoints + j + 1

      // Two triangles per quad
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

    // Get edge positions at start and end
    const startPos = getRoadEdgePositionAt(parentRoad, curb.edgeSide, startT)
    const endPos = getRoadEdgePositionAt(parentRoad, curb.edgeSide, endT)

    // Calculate length and direction
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

    // Calculate rotation (direction of curb)
    const rot = Math.atan2(dx, dz)

    // Midpoint for positioning
    const mid: [number, number, number] = [
      (startPos[0] + endPos[0]) / 2,
      0, // Geometry handles height
      (startPos[2] + endPos[2]) / 2,
    ]

    // Calculate stripe count (approximately 2 units per stripe)
    const stripes = Math.max(2, Math.ceil(length / 2))

    // Create 3D geometry
    const geo = createCurbGeometry(length, stripes)

    return { geometry: geo, rotation: rot, midpoint: mid, curbLength: length }
  }, [curb, parentRoad])

  if (!geometry || curbLength === 0) return null

  // Calculate perpendicular offset direction for curb width positioning
  // The curb should extend outward from the road edge
  const perpOffset = curb.edgeSide === 'left' ? CURB_WIDTH / 2 : -CURB_WIDTH / 2

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

  // Ghost mode - visual only, no physics
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

  // Normal mode - with physics
  return (
    <group position={midpoint} rotation={[0, rotation, 0]}>
      <RigidBody type="fixed" colliders={false} position={[perpOffset, 0, 0]}>
        {/* Sensor collider for detecting car */}
        <CuboidCollider
          args={[CURB_WIDTH / 2, CURB_PEAK_HEIGHT, curbLength / 2]}
          sensor
          onIntersectionEnter={handleEnter}
          onIntersectionExit={handleExit}
        />

        {/* Visual mesh with 3D profile */}
        <mesh geometry={geometry} receiveShadow castShadow>
          <meshStandardMaterial vertexColors />
        </mesh>
      </RigidBody>
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
      0,
      (startPosition[2] + endPosition[2]) / 2,
    ]

    const stripeCount = Math.max(2, Math.ceil(length / 2))
    const geo = createCurbGeometry(length, stripeCount)

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
