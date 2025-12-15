import { useMemo } from 'react'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { Vector3, QuadraticBezierCurve3, BufferGeometry, Float32BufferAttribute } from 'three'
import { usePitStore, PitLaneData } from '../../../stores/usePitStore'

interface PitLaneProps {
  data: PitLaneData
  isGhost?: boolean
}

const GHOST_OPACITY = 0.5
const PIT_ROAD_WIDTH = 8 // Narrower than main road
const PIT_ROAD_HEIGHT = 0.02
const PIT_BOX_MARKING_WIDTH = 0.3
const CURVE_SEGMENTS = 32

// Build curved road geometry from bezier curve
function buildCurvedRoadGeometry(
  startPoint: [number, number, number],
  controlPoint: [number, number, number],
  endPoint: [number, number, number],
  width: number,
  height: number,
): {
  roadGeometry: BufferGeometry
  leftEdgeGeometry: BufferGeometry
  rightEdgeGeometry: BufferGeometry
} {
  const start = new Vector3(...startPoint)
  const control = new Vector3(...controlPoint)
  const end = new Vector3(...endPoint)

  const curve = new QuadraticBezierCurve3(start, control, end)
  const points = curve.getPoints(CURVE_SEGMENTS)

  const halfWidth = width / 2
  const roadVertices: number[] = []
  const roadIndices: number[] = []
  const leftEdgeVertices: number[] = []
  const leftEdgeIndices: number[] = []
  const rightEdgeVertices: number[] = []
  const rightEdgeIndices: number[] = []

  const edgeWidth = 0.15
  const edgeOffset = halfWidth - edgeWidth / 2

  for (let i = 0; i < points.length; i++) {
    const p = points[i]

    // Calculate tangent for perpendicular
    let tangent: Vector3
    if (i === 0) {
      tangent = new Vector3().subVectors(points[1], points[0]).normalize()
    } else if (i === points.length - 1) {
      tangent = new Vector3().subVectors(points[i], points[i - 1]).normalize()
    } else {
      tangent = new Vector3().subVectors(points[i + 1], points[i - 1]).normalize()
    }

    // Perpendicular in XZ plane
    const perpendicular = new Vector3(-tangent.z, 0, tangent.x)

    // Road surface edges
    const leftPoint = new Vector3().copy(p).addScaledVector(perpendicular, halfWidth)
    const rightPoint = new Vector3().copy(p).addScaledVector(perpendicular, -halfWidth)

    roadVertices.push(leftPoint.x, height, leftPoint.z)
    roadVertices.push(rightPoint.x, height, rightPoint.z)

    if (i > 0) {
      const baseIdx = (i - 1) * 2
      roadIndices.push(baseIdx, baseIdx + 1, baseIdx + 2)
      roadIndices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2)
    }

    // Edge lines
    const leftEdgeOuter = new Vector3()
      .copy(p)
      .addScaledVector(perpendicular, edgeOffset + edgeWidth / 2)
    const leftEdgeInner = new Vector3()
      .copy(p)
      .addScaledVector(perpendicular, edgeOffset - edgeWidth / 2)
    const rightEdgeOuter = new Vector3()
      .copy(p)
      .addScaledVector(perpendicular, -(edgeOffset + edgeWidth / 2))
    const rightEdgeInner = new Vector3()
      .copy(p)
      .addScaledVector(perpendicular, -(edgeOffset - edgeWidth / 2))

    leftEdgeVertices.push(leftEdgeOuter.x, height + 0.005, leftEdgeOuter.z)
    leftEdgeVertices.push(leftEdgeInner.x, height + 0.005, leftEdgeInner.z)

    rightEdgeVertices.push(rightEdgeInner.x, height + 0.005, rightEdgeInner.z)
    rightEdgeVertices.push(rightEdgeOuter.x, height + 0.005, rightEdgeOuter.z)

    if (i > 0) {
      const baseIdx = (i - 1) * 2
      leftEdgeIndices.push(baseIdx, baseIdx + 1, baseIdx + 2)
      leftEdgeIndices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2)
      rightEdgeIndices.push(baseIdx, baseIdx + 1, baseIdx + 2)
      rightEdgeIndices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2)
    }
  }

  // Create geometries
  const roadGeo = new BufferGeometry()
  roadGeo.setAttribute('position', new Float32BufferAttribute(roadVertices, 3))
  roadGeo.setIndex(roadIndices)
  roadGeo.computeVertexNormals()

  const leftGeo = new BufferGeometry()
  leftGeo.setAttribute('position', new Float32BufferAttribute(leftEdgeVertices, 3))
  leftGeo.setIndex(leftEdgeIndices)
  leftGeo.computeVertexNormals()

  const rightGeo = new BufferGeometry()
  rightGeo.setAttribute('position', new Float32BufferAttribute(rightEdgeVertices, 3))
  rightGeo.setIndex(rightEdgeIndices)
  rightGeo.computeVertexNormals()

  return { roadGeometry: roadGeo, leftEdgeGeometry: leftGeo, rightEdgeGeometry: rightGeo }
}

// Build straight road geometry for fallback (when no curved data)
function buildStraightRoadGeometry(
  startPoint: [number, number, number],
  endPoint: [number, number, number],
  _width: number,
  height: number,
): { length: number; rotation: number; midpoint: [number, number, number] } {
  const start = new Vector3(...startPoint)
  const end = new Vector3(...endPoint)
  const direction = end.clone().sub(start)
  const length = direction.length()
  const rotation = Math.atan2(direction.x, direction.z)
  const midpoint: [number, number, number] = [
    (start.x + end.x) / 2,
    height / 2,
    (start.z + end.z) / 2,
  ]
  return { length, rotation, midpoint }
}

export default function PitLane({ data, isGhost = false }: PitLaneProps) {
  const enterPitLane = usePitStore(state => state.enterPitLane)
  const exitPitLane = usePitStore(state => state.exitPitLane)
  const enterPitBox = usePitStore(state => state.enterPitBox)
  const exitPitBox = usePitStore(state => state.exitPitBox)

  // Determine if we have curved connection data
  const hasCurvedEntry = data.entryAttachmentPoint && data.entryControlPoint && data.pitBoxEntry
  const hasCurvedExit = data.exitAttachmentPoint && data.exitControlPoint && data.pitBoxExit

  // Calculate curved entry road geometry
  const curvedEntryRoad = useMemo(() => {
    if (!hasCurvedEntry) return null

    // Entry road curves from road attachment point to pit box entry
    return buildCurvedRoadGeometry(
      data.entryAttachmentPoint!,
      data.entryControlPoint!,
      data.pitBoxEntry!,
      PIT_ROAD_WIDTH,
      PIT_ROAD_HEIGHT,
    )
  }, [hasCurvedEntry, data.entryAttachmentPoint, data.entryControlPoint, data.pitBoxEntry])

  // Calculate curved exit road geometry
  const curvedExitRoad = useMemo(() => {
    if (!hasCurvedExit) return null

    // Exit road curves from pit box exit to road attachment point
    return buildCurvedRoadGeometry(
      data.pitBoxExit!,
      data.exitControlPoint!,
      data.exitAttachmentPoint!,
      PIT_ROAD_WIDTH,
      PIT_ROAD_HEIGHT,
    )
  }, [hasCurvedExit, data.pitBoxExit, data.exitControlPoint, data.exitAttachmentPoint])

  // Fallback: straight entry road geometry
  const straightEntryRoad = useMemo(() => {
    if (hasCurvedEntry) return null
    return buildStraightRoadGeometry(
      data.entryRoadStart,
      data.entryRoadEnd,
      PIT_ROAD_WIDTH,
      PIT_ROAD_HEIGHT,
    )
  }, [hasCurvedEntry, data.entryRoadStart, data.entryRoadEnd])

  // Fallback: straight exit road geometry
  const straightExitRoad = useMemo(() => {
    if (hasCurvedExit) return null
    return buildStraightRoadGeometry(
      data.exitRoadStart,
      data.exitRoadEnd,
      PIT_ROAD_WIDTH,
      PIT_ROAD_HEIGHT,
    )
  }, [hasCurvedExit, data.exitRoadStart, data.exitRoadEnd])

  // Pit box area markings
  const pitBoxMarkings = useMemo(() => {
    const markings: Array<{
      position: [number, number, number]
      size: [number, number]
      color: string
    }> = []

    // Create pit box boundary markings (dashed lines)
    const numDashes = 6
    for (let i = 0; i < numDashes; i++) {
      // Left side
      markings.push({
        position: [
          data.pitBoxCenter[0] - data.pitBoxWidth / 2,
          0.02,
          data.pitBoxCenter[2] -
            data.pitBoxLength / 2 +
            (i + 0.5) * (data.pitBoxLength / numDashes),
        ],
        size: [PIT_BOX_MARKING_WIDTH, (data.pitBoxLength / numDashes) * 0.6],
        color: '#ff6600',
      })
      // Right side
      markings.push({
        position: [
          data.pitBoxCenter[0] + data.pitBoxWidth / 2,
          0.02,
          data.pitBoxCenter[2] -
            data.pitBoxLength / 2 +
            (i + 0.5) * (data.pitBoxLength / numDashes),
        ],
        size: [PIT_BOX_MARKING_WIDTH, (data.pitBoxLength / numDashes) * 0.6],
        color: '#ff6600',
      })
    }

    return markings
  }, [data.pitBoxCenter, data.pitBoxWidth, data.pitBoxLength])

  const handlePitLaneEntry = () => {
    if (!isGhost) enterPitLane()
  }

  const handlePitLaneExit = () => {
    if (!isGhost) exitPitLane()
  }

  const handlePitBoxEntry = () => {
    if (!isGhost) enterPitBox()
  }

  const handlePitBoxExit = () => {
    if (!isGhost) exitPitBox()
  }

  return (
    <group>
      {/* Curved Entry Road (if we have curve data) */}
      {curvedEntryRoad && (
        <group>
          <mesh geometry={curvedEntryRoad.roadGeometry} receiveShadow={!isGhost}>
            <meshStandardMaterial
              color='#2a2a2a'
              transparent={isGhost}
              opacity={isGhost ? GHOST_OPACITY : 1}
              depthWrite={!isGhost}
              side={2}
            />
          </mesh>
          <mesh geometry={curvedEntryRoad.leftEdgeGeometry}>
            <meshStandardMaterial
              color='#ffffff'
              transparent={isGhost}
              opacity={isGhost ? GHOST_OPACITY : 1}
              depthWrite={!isGhost}
              side={2}
            />
          </mesh>
          <mesh geometry={curvedEntryRoad.rightEdgeGeometry}>
            <meshStandardMaterial
              color='#ffffff'
              transparent={isGhost}
              opacity={isGhost ? GHOST_OPACITY : 1}
              depthWrite={!isGhost}
              side={2}
            />
          </mesh>
        </group>
      )}

      {/* Straight Entry Road (fallback) */}
      {straightEntryRoad && (
        <group position={straightEntryRoad.midpoint} rotation={[0, straightEntryRoad.rotation, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow={!isGhost}>
            <planeGeometry args={[PIT_ROAD_WIDTH, straightEntryRoad.length]} />
            <meshStandardMaterial
              color='#2a2a2a'
              transparent={isGhost}
              opacity={isGhost ? GHOST_OPACITY : 1}
              depthWrite={!isGhost}
            />
          </mesh>
          <mesh position={[-PIT_ROAD_WIDTH / 2 + 0.1, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.15, straightEntryRoad.length]} />
            <meshStandardMaterial
              color='#ffffff'
              transparent={isGhost}
              opacity={isGhost ? GHOST_OPACITY : 1}
              depthWrite={!isGhost}
            />
          </mesh>
          <mesh position={[PIT_ROAD_WIDTH / 2 - 0.1, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.15, straightEntryRoad.length]} />
            <meshStandardMaterial
              color='#ffffff'
              transparent={isGhost}
              opacity={isGhost ? GHOST_OPACITY : 1}
              depthWrite={!isGhost}
            />
          </mesh>
        </group>
      )}

      {/* Pit Box Area */}
      <group position={data.pitBoxCenter} rotation={[0, data.rotation, 0]}>
        {/* Pit box surface (slightly different color) */}
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={!isGhost}>
          <planeGeometry args={[data.pitBoxWidth, data.pitBoxLength]} />
          <meshStandardMaterial
            color='#1a1a1a'
            transparent={isGhost}
            opacity={isGhost ? GHOST_OPACITY : 1}
            depthWrite={!isGhost}
          />
        </mesh>

        {/* "PIT" text marker (simple box representation) */}
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3, 1.5]} />
          <meshStandardMaterial
            color='#ff6600'
            emissive='#ff6600'
            emissiveIntensity={0.3}
            transparent={isGhost}
            opacity={isGhost ? GHOST_OPACITY : 1}
            depthWrite={!isGhost}
          />
        </mesh>

        {/* Front boundary line */}
        <mesh position={[0, 0.02, -data.pitBoxLength / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[data.pitBoxWidth, PIT_BOX_MARKING_WIDTH]} />
          <meshStandardMaterial
            color='#ff6600'
            emissive='#ff6600'
            emissiveIntensity={0.2}
            transparent={isGhost}
            opacity={isGhost ? GHOST_OPACITY : 1}
            depthWrite={!isGhost}
          />
        </mesh>

        {/* Back boundary line */}
        <mesh position={[0, 0.02, data.pitBoxLength / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[data.pitBoxWidth, PIT_BOX_MARKING_WIDTH]} />
          <meshStandardMaterial
            color='#ff6600'
            emissive='#ff6600'
            emissiveIntensity={0.2}
            transparent={isGhost}
            opacity={isGhost ? GHOST_OPACITY : 1}
            depthWrite={!isGhost}
          />
        </mesh>
      </group>

      {/* Pit box side markings */}
      {pitBoxMarkings.map((marking, i) => (
        <mesh key={i} position={marking.position} rotation={[-Math.PI / 2, 0, data.rotation]}>
          <planeGeometry args={marking.size} />
          <meshStandardMaterial
            color={marking.color}
            emissive={marking.color}
            emissiveIntensity={0.2}
            transparent={isGhost}
            opacity={isGhost ? GHOST_OPACITY : 1}
            depthWrite={!isGhost}
          />
        </mesh>
      ))}

      {/* Curved Exit Road (if we have curve data) */}
      {curvedExitRoad && (
        <group>
          <mesh geometry={curvedExitRoad.roadGeometry} receiveShadow={!isGhost}>
            <meshStandardMaterial
              color='#2a2a2a'
              transparent={isGhost}
              opacity={isGhost ? GHOST_OPACITY : 1}
              depthWrite={!isGhost}
              side={2}
            />
          </mesh>
          <mesh geometry={curvedExitRoad.leftEdgeGeometry}>
            <meshStandardMaterial
              color='#ffffff'
              transparent={isGhost}
              opacity={isGhost ? GHOST_OPACITY : 1}
              depthWrite={!isGhost}
              side={2}
            />
          </mesh>
          <mesh geometry={curvedExitRoad.rightEdgeGeometry}>
            <meshStandardMaterial
              color='#ffffff'
              transparent={isGhost}
              opacity={isGhost ? GHOST_OPACITY : 1}
              depthWrite={!isGhost}
              side={2}
            />
          </mesh>
        </group>
      )}

      {/* Straight Exit Road (fallback) */}
      {straightExitRoad && (
        <group position={straightExitRoad.midpoint} rotation={[0, straightExitRoad.rotation, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow={!isGhost}>
            <planeGeometry args={[PIT_ROAD_WIDTH, straightExitRoad.length]} />
            <meshStandardMaterial
              color='#2a2a2a'
              transparent={isGhost}
              opacity={isGhost ? GHOST_OPACITY : 1}
              depthWrite={!isGhost}
            />
          </mesh>
          <mesh position={[-PIT_ROAD_WIDTH / 2 + 0.1, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.15, straightExitRoad.length]} />
            <meshStandardMaterial
              color='#ffffff'
              transparent={isGhost}
              opacity={isGhost ? GHOST_OPACITY : 1}
              depthWrite={!isGhost}
            />
          </mesh>
          <mesh position={[PIT_ROAD_WIDTH / 2 - 0.1, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.15, straightExitRoad.length]} />
            <meshStandardMaterial
              color='#ffffff'
              transparent={isGhost}
              opacity={isGhost ? GHOST_OPACITY : 1}
              depthWrite={!isGhost}
            />
          </mesh>
        </group>
      )}

      {/* Sensor zones (only when not ghost) */}
      {!isGhost && (
        <>
          {/* Pit lane entry sensor */}
          <RigidBody type='fixed' position={data.entryPoint} sensor>
            <CuboidCollider
              args={[PIT_ROAD_WIDTH / 2, 2, 2]}
              sensor
              onIntersectionEnter={handlePitLaneEntry}
            />
          </RigidBody>

          {/* Pit box sensor */}
          <RigidBody
            type='fixed'
            position={data.pitBoxCenter}
            rotation={[0, data.rotation, 0]}
            sensor
          >
            <CuboidCollider
              args={[data.pitBoxWidth / 2, 2, data.pitBoxLength / 2]}
              sensor
              onIntersectionEnter={handlePitBoxEntry}
              onIntersectionExit={handlePitBoxExit}
            />
          </RigidBody>

          {/* Pit lane exit sensor */}
          <RigidBody type='fixed' position={data.exitPoint} sensor>
            <CuboidCollider
              args={[PIT_ROAD_WIDTH / 2, 2, 2]}
              sensor
              onIntersectionExit={handlePitLaneExit}
            />
          </RigidBody>
        </>
      )}
    </group>
  )
}
