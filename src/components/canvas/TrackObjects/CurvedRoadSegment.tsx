import { useMemo, useCallback, useEffect } from 'react'
import { Vector3, QuadraticBezierCurve3, BufferGeometry, Float32BufferAttribute } from 'three'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { OBJECT_CONFIGS, GHOST_OPACITY } from '../../../constants/trackObjects'
import { useSurfaceStore } from '../../../stores/useSurfaceStore'
import { useTrackTemperatureStore } from '../../../stores/useTrackTemperatureStore'
import { usePhysicsOptional } from '../../../wasm'

interface CurvedRoadSegmentProps {
  position: [number, number, number]
  startPoint: [number, number, number]
  controlPoint: [number, number, number]
  endPoint: [number, number, number]
  isGhost?: boolean
  isSelectedForCurb?: boolean
  // Edge positions of connected road at start/end for seamless alignment
  startLeftEdge?: [number, number, number]
  startRightEdge?: [number, number, number]
  endLeftEdge?: [number, number, number]
  endRightEdge?: [number, number, number]
}

const config = OBJECT_CONFIGS.road
const CURVE_SEGMENTS = 48
const ROAD_THICKNESS = 0.02 // 2cm - visible but car drives on ground

export default function CurvedRoadSegment({
  startPoint,
  controlPoint,
  endPoint,
  isGhost = false,
  isSelectedForCurb = false,
  startLeftEdge,
  startRightEdge,
  endLeftEdge,
  endRightEdge,
}: CurvedRoadSegmentProps) {
  const { width } = config.defaultSize
  const halfWidth = width / 2
  const enterSurface = useSurfaceStore(s => s.enterSurface)
  const exitSurface = useSurfaceStore(s => s.exitSurface)
  const physics = usePhysicsOptional()
  const setRoadRegionTS = useTrackTemperatureStore(s => s.setRoadRegion)

  // Surface detection callbacks
  const handleEnterRoad = useCallback(() => {
    enterSurface('road')
  }, [enterSurface])

  const handleExitRoad = useCallback(() => {
    exitSurface('road')
  }, [exitSurface])

  // Generate the road surface geometry as a continuous mesh
  const { roadGeometry, leftEdgeGeometry, rightEdgeGeometry, centerLineDashes, selectionGeometry, sensorColliders, roadBounds } =
    useMemo(() => {
    const start = new Vector3(...startPoint)
    const control = new Vector3(...controlPoint)
    const end = new Vector3(...endPoint)

    const curve = new QuadraticBezierCurve3(start, control, end)
    const points = curve.getPoints(CURVE_SEGMENTS)

    // Build road surface vertices
    const roadVertices: number[] = []
    const roadIndices: number[] = []
    const roadUvs: number[] = []

    // Build edge line vertices
    const leftEdgeVertices: number[] = []
    const leftEdgeIndices: number[] = []
    const rightEdgeVertices: number[] = []
    const rightEdgeIndices: number[] = []

    const edgeWidth = 0.2
    const edgeOffset = halfWidth - edgeWidth / 2

    for (let i = 0; i < points.length; i++) {
      const p = points[i]

      let leftPoint: Vector3
      let rightPoint: Vector3

      // Always calculate perpendicular for edge lines
      let tangent: Vector3
      if (i === 0) {
        tangent = new Vector3().subVectors(points[1], points[0]).normalize()
      } else if (i === points.length - 1) {
        tangent = new Vector3().subVectors(points[i], points[i - 1]).normalize()
      } else {
        tangent = new Vector3().subVectors(points[i + 1], points[i - 1]).normalize()
      }
      // Perpendicular in XZ plane (rotate 90 degrees)
      const perpendicular = new Vector3(-tangent.z, 0, tangent.x)

      // At endpoints, use exact edge positions from connected road if available
      if (i === 0 && startLeftEdge && startRightEdge) {
        // Use the connected road's edge positions directly
        leftPoint = new Vector3(...startLeftEdge)
        rightPoint = new Vector3(...startRightEdge)
      } else if (i === points.length - 1 && endLeftEdge && endRightEdge) {
        // Use the connected road's edge positions directly
        leftPoint = new Vector3(...endLeftEdge)
        rightPoint = new Vector3(...endRightEdge)
      } else {
        // Road surface - left and right edges
        leftPoint = new Vector3().copy(p).addScaledVector(perpendicular, halfWidth)
        rightPoint = new Vector3().copy(p).addScaledVector(perpendicular, -halfWidth)
      }

      // Road surface with thickness - top surface
      roadVertices.push(leftPoint.x, ROAD_THICKNESS, leftPoint.z)
      roadVertices.push(rightPoint.x, ROAD_THICKNESS, rightPoint.z)

      const t = i / (points.length - 1)
      roadUvs.push(0, t)
      roadUvs.push(1, t)

      // Create triangles (except for first point)
      if (i > 0) {
        const baseIdx = (i - 1) * 2
        // First triangle
        roadIndices.push(baseIdx, baseIdx + 1, baseIdx + 2)
        // Second triangle
        roadIndices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2)
      }

      // For edge lines at snapped endpoints, calculate positions based on the actual road edges
      let leftEdgeOuter: Vector3
      let leftEdgeInner: Vector3
      let rightEdgeOuter: Vector3
      let rightEdgeInner: Vector3

      if (
        (i === 0 && startLeftEdge && startRightEdge) ||
        (i === points.length - 1 && endLeftEdge && endRightEdge)
      ) {
        // Calculate edge line positions based on the snapped road edges
        // Edge lines are inset from the road edges
        const edgeInset = edgeWidth / 2
        const roadEdgeInset = halfWidth - edgeOffset

        // Direction from right to left edge
        const edgeDir = new Vector3().subVectors(leftPoint, rightPoint).normalize()

        // Left edge line (near left road edge)
        leftEdgeOuter = new Vector3()
          .copy(leftPoint)
          .addScaledVector(edgeDir, -roadEdgeInset + edgeInset)
        leftEdgeInner = new Vector3()
          .copy(leftPoint)
          .addScaledVector(edgeDir, -roadEdgeInset - edgeInset)

        // Right edge line (near right road edge)
        rightEdgeInner = new Vector3()
          .copy(rightPoint)
          .addScaledVector(edgeDir, roadEdgeInset + edgeInset)
        rightEdgeOuter = new Vector3()
          .copy(rightPoint)
          .addScaledVector(edgeDir, roadEdgeInset - edgeInset)
      } else {
        // Use perpendicular-based calculation for non-snapped points
        leftEdgeOuter = new Vector3()
          .copy(p)
          .addScaledVector(perpendicular, edgeOffset + edgeWidth / 2)
        leftEdgeInner = new Vector3()
          .copy(p)
          .addScaledVector(perpendicular, edgeOffset - edgeWidth / 2)
        rightEdgeOuter = new Vector3()
          .copy(p)
          .addScaledVector(perpendicular, -(edgeOffset + edgeWidth / 2))
        rightEdgeInner = new Vector3()
          .copy(p)
          .addScaledVector(perpendicular, -(edgeOffset - edgeWidth / 2))
      }

      leftEdgeVertices.push(leftEdgeOuter.x, ROAD_THICKNESS + 0.005, leftEdgeOuter.z)
      leftEdgeVertices.push(leftEdgeInner.x, ROAD_THICKNESS + 0.005, leftEdgeInner.z)

      if (i > 0) {
        const baseIdx = (i - 1) * 2
        leftEdgeIndices.push(baseIdx, baseIdx + 1, baseIdx + 2)
        leftEdgeIndices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2)
      }

      rightEdgeVertices.push(rightEdgeInner.x, ROAD_THICKNESS + 0.005, rightEdgeInner.z)
      rightEdgeVertices.push(rightEdgeOuter.x, ROAD_THICKNESS + 0.005, rightEdgeOuter.z)

      if (i > 0) {
        const baseIdx = (i - 1) * 2
        rightEdgeIndices.push(baseIdx, baseIdx + 1, baseIdx + 2)
        rightEdgeIndices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2)
      }
    }

    // Create road geometry
    const roadGeo = new BufferGeometry()
    roadGeo.setAttribute('position', new Float32BufferAttribute(roadVertices, 3))
    roadGeo.setAttribute('uv', new Float32BufferAttribute(roadUvs, 2))
    roadGeo.setIndex(roadIndices)
    roadGeo.computeVertexNormals()

    // Create edge geometries
    const leftGeo = new BufferGeometry()
    leftGeo.setAttribute('position', new Float32BufferAttribute(leftEdgeVertices, 3))
    leftGeo.setIndex(leftEdgeIndices)
    leftGeo.computeVertexNormals()

    const rightGeo = new BufferGeometry()
    rightGeo.setAttribute('position', new Float32BufferAttribute(rightEdgeVertices, 3))
    rightGeo.setIndex(rightEdgeIndices)
    rightGeo.computeVertexNormals()

    // Calculate dash positions along the curve
    const dashes: { position: Vector3; rotation: number }[] = []
    const curveLength = curve.getLength()
    const dashSpacing = 3
    const dashCount = Math.max(1, Math.floor(curveLength / dashSpacing))

    for (let i = 0; i < dashCount; i++) {
      const t = (i + 0.5) / dashCount
      const pos = curve.getPoint(t)
      const tangent = curve.getTangent(t)
      const rotation = Math.atan2(tangent.x, tangent.z)
      dashes.push({ position: pos, rotation })
    }

    // Create selection highlight geometry (slightly larger than road)
    const selectionVertices: number[] = []
    const selectionIndices: number[] = []
    const selectionExpand = 0.5 // How much bigger than road

    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      let tangent: Vector3
      if (i === 0) {
        tangent = new Vector3().subVectors(points[1], points[0]).normalize()
      } else if (i === points.length - 1) {
        tangent = new Vector3().subVectors(points[i], points[i - 1]).normalize()
      } else {
        tangent = new Vector3().subVectors(points[i + 1], points[i - 1]).normalize()
      }
      const perpendicular = new Vector3(-tangent.z, 0, tangent.x)
      const leftPoint = new Vector3()
        .copy(p)
        .addScaledVector(perpendicular, halfWidth + selectionExpand)
      const rightPoint = new Vector3()
        .copy(p)
        .addScaledVector(perpendicular, -(halfWidth + selectionExpand))

      selectionVertices.push(leftPoint.x, ROAD_THICKNESS + 0.03, leftPoint.z)
      selectionVertices.push(rightPoint.x, ROAD_THICKNESS + 0.03, rightPoint.z)

      if (i > 0) {
        const baseIdx = (i - 1) * 2
        selectionIndices.push(baseIdx, baseIdx + 1, baseIdx + 2)
        selectionIndices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2)
      }
    }

    const selectionGeo = new BufferGeometry()
    selectionGeo.setAttribute('position', new Float32BufferAttribute(selectionVertices, 3))
    selectionGeo.setIndex(selectionIndices)
    selectionGeo.computeVertexNormals()

    // Generate sensor collider positions along the curve (approximated with box colliders)
    const sensorData: { position: [number, number, number]; rotation: number; length: number }[] = []
    const numSensors = Math.max(4, Math.ceil(curveLength / 8)) // One sensor every ~8 units
    for (let i = 0; i < numSensors; i++) {
      const t1 = i / numSensors
      const t2 = (i + 1) / numSensors
      const p1 = curve.getPoint(t1)
      const p2 = curve.getPoint(t2)
      const midpoint = new Vector3().lerpVectors(p1, p2, 0.5)
      const segmentLength = p1.distanceTo(p2) + 0.5 // Slight overlap
      const dir = new Vector3().subVectors(p2, p1).normalize()
      const rotation = Math.atan2(dir.x, dir.z)
      sensorData.push({
        position: [midpoint.x, 0.5, midpoint.z],
        rotation,
        length: segmentLength,
      })
    }

    // Calculate bounding box for road temperature registration
    const allXs = roadVertices.filter((_, i) => i % 3 === 0)
    const allZs = roadVertices.filter((_, i) => i % 3 === 2)
    const roadBounds = {
      minX: Math.min(...allXs),
      maxX: Math.max(...allXs),
      minZ: Math.min(...allZs),
      maxZ: Math.max(...allZs),
    }

    return {
      roadGeometry: roadGeo,
      leftEdgeGeometry: leftGeo,
      rightEdgeGeometry: rightGeo,
      centerLineDashes: dashes,
      selectionGeometry: selectionGeo,
      sensorColliders: sensorData,
      roadBounds,
    }
  }, [
    startPoint,
    controlPoint,
    endPoint,
    halfWidth,
    startLeftEdge,
    startRightEdge,
    endLeftEdge,
    endRightEdge,
  ])

  // Register road cells for temperature tracking
  // Roads retain heat better than non-road surfaces
  useEffect(() => {
    if (isGhost || !roadBounds) return

    const { minX, minZ, maxX, maxZ } = roadBounds

    // Register as road region in WASM physics engine
    if (physics) {
      physics.setRoadRegion(minX, minZ, maxX, maxZ, true)
    }

    // Register as road region in TypeScript temperature store (for visualization)
    setRoadRegionTS(minX, minZ, maxX, maxZ, true)

    // Cleanup: unregister on unmount
    return () => {
      if (physics) {
        physics.setRoadRegion(minX, minZ, maxX, maxZ, false)
      }
      setRoadRegionTS(minX, minZ, maxX, maxZ, false)
    }
  }, [isGhost, physics, setRoadRegionTS, roadBounds])

  // Visual elements
  const roadVisuals = (
    <>
      {/* Road surface */}
      <mesh geometry={roadGeometry} receiveShadow={!isGhost} castShadow={!isGhost}>
        <meshStandardMaterial
          color={config.color}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
          side={2} // DoubleSide
        />
      </mesh>

      {/* Left edge line */}
      <mesh geometry={leftEdgeGeometry}>
        <meshStandardMaterial
          color='#ffffff'
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
          side={2}
        />
      </mesh>

      {/* Right edge line */}
      <mesh geometry={rightEdgeGeometry}>
        <meshStandardMaterial
          color='#ffffff'
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
          side={2}
        />
      </mesh>

      {/* Center line dashes - yellow */}
      {centerLineDashes.map((dash, i) => (
        <mesh
          key={`dash-${i}`}
          position={[dash.position.x, ROAD_THICKNESS + 0.005, dash.position.z]}
          rotation={[-Math.PI / 2, 0, dash.rotation]}
        >
          <planeGeometry args={[0.15, 1.2]} />
          <meshStandardMaterial
            color='#ffcc00'
            transparent={isGhost}
            opacity={isGhost ? GHOST_OPACITY : 1}
            depthWrite={!isGhost}
          />
        </mesh>
      ))}

      {/* Selection highlight for auto curb mode */}
      {isSelectedForCurb && (
        <mesh geometry={selectionGeometry}>
          <meshBasicMaterial color='#22c55e' transparent opacity={0.3} depthWrite={false} side={2} />
        </mesh>
      )}
    </>
  )

  // Ghost mode - no physics
  if (isGhost) {
    return <group position={[0, 0.02, 0]}>{roadVisuals}</group>
  }

  // Normal mode - with physics (ground provides collision, road only has sensors)
  return (
    <RigidBody
      type='fixed'
      position={[0, 0.01, 0]}
      colliders={false}
    >
      {roadVisuals}

      {/* Surface detection sensors along the curve */}
      {sensorColliders.map((sensor, i) => (
        <CuboidCollider
          key={`sensor-${i}`}
          args={[halfWidth, 0.5, sensor.length / 2]}
          position={sensor.position}
          rotation={[0, sensor.rotation, 0]}
          sensor
          onIntersectionEnter={handleEnterRoad}
          onIntersectionExit={handleExitRoad}
        />
      ))}
    </RigidBody>
  )
}
