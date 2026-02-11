import { useMemo, useCallback, useEffect } from 'react'
import { Vector3, QuadraticBezierCurve3, BufferGeometry, Float32BufferAttribute } from 'three'
import { RigidBody, CuboidCollider, TrimeshCollider } from '@react-three/rapier'
import { OBJECT_CONFIGS, GHOST_OPACITY } from '../../../constants/trackObjects'
import RoadSurfaceMaterial from './RoadSurfaceMaterial'
import { TRACK_COLLISION_GROUPS } from '../../../constants/dimensions'
import { useSurfaceStore } from '../../../stores/useSurfaceStore'
import { useTrackTemperatureStore } from '../../../stores/useTrackTemperatureStore'
import { useElevationStore } from '../../../stores/useElevationStore'
import { usePhysicsOptional } from '../../../wasm'

interface CurvedRoadSegmentProps {
  position: [number, number, number]
  startPoint: [number, number, number]
  controlPoint: [number, number, number]
  endPoint: [number, number, number]
  isGhost?: boolean
  isSelectedForCurb?: boolean
  width?: number
  startLeftEdge?: [number, number, number]
  startRightEdge?: [number, number, number]
  endLeftEdge?: [number, number, number]
  endRightEdge?: [number, number, number]
  startElevation?: number
  endElevation?: number
  banking?: number
}

const config = OBJECT_CONFIGS.road
const MAX_CURVE_SEGMENTS = 48
const MIN_CURVE_SEGMENTS = 8
const METERS_PER_SEGMENT = 3

export default function CurvedRoadSegment({
  startPoint,
  controlPoint,
  endPoint,
  isGhost = false,
  isSelectedForCurb = false,
  width: widthProp,
  startLeftEdge,
  startRightEdge,
  endLeftEdge,
  endRightEdge,
  startElevation,
  endElevation,
  banking,
}: CurvedRoadSegmentProps) {
  const width = widthProp ?? config.defaultSize.width
  const halfWidth = width / 2
  const enterSurface = useSurfaceStore(s => s.enterSurface)
  const exitSurface = useSurfaceStore(s => s.exitSurface)
  const enterElevation = useElevationStore(s => s.enterRoad)
  const exitElevation = useElevationStore(s => s.exitRoad)
  const physics = usePhysicsOptional()
  const setRoadRegionTS = useTrackTemperatureStore(s => s.setRoadRegion)

  // Surface detection callbacks
  const handleEnterRoad = useCallback(() => {
    enterSurface('road')
    const midElev = ((startElevation ?? 0) + (endElevation ?? 0)) / 2
    const startVec = new Vector3(...startPoint)
    const endVec = new Vector3(...endPoint)
    const curveLength = startVec.distanceTo(endVec)
    const slopeAngle = Math.atan2((endElevation ?? 0) - (startElevation ?? 0), curveLength)
    const bankingRad = ((banking ?? 0) * Math.PI) / 180
    enterElevation(midElev, slopeAngle, bankingRad)
  }, [enterSurface, startElevation, endElevation, startPoint, endPoint, banking, enterElevation])

  const handleExitRoad = useCallback(() => {
    exitSurface('road')
    exitElevation()
  }, [exitSurface, exitElevation])

  const {
    roadGeometry,
    leftEdgeGeometry,
    rightEdgeGeometry,
    centerLineDashes,
    selectionGeometry,
    sensorColliders,
    collisionData,
    roadBounds,
  } = useMemo(() => {
    const startElev = startElevation ?? 0
    const endElev = endElevation ?? 0
    const bankingDeg = banking ?? 0
    const DEG2RAD = Math.PI / 180

    const start = new Vector3(...startPoint)
    const control = new Vector3(...controlPoint)
    const end = new Vector3(...endPoint)

    const curve = new QuadraticBezierCurve3(start, control, end)
    const curveLen = curve.getLength()
    const segmentCount = Math.max(MIN_CURVE_SEGMENTS, Math.min(MAX_CURVE_SEGMENTS, Math.ceil(curveLen / METERS_PER_SEGMENT)))
    const points = curve.getPoints(segmentCount)

    const BLEND_SEGMENTS = 3

    const computeEdgePoints = (i: number, p: Vector3, t: number) => {
      const elevationY = startElev + (endElev - startElev) * t + 0.01

      const bankingAngle = bankingDeg * Math.sin(t * Math.PI)
      const bankRadians = bankingAngle * DEG2RAD

      let tangent: Vector3
      if (i === 0) {
        tangent = new Vector3().subVectors(points[1], points[0]).normalize()
      } else if (i === points.length - 1) {
        tangent = new Vector3().subVectors(points[i], points[i - 1]).normalize()
      } else {
        tangent = new Vector3().subVectors(points[i + 1], points[i - 1]).normalize()
      }
      const perpendicular = new Vector3(-tangent.z, 0, tangent.x)

      const naturalLeft = new Vector3().copy(p).addScaledVector(perpendicular, halfWidth)
      const naturalRight = new Vector3().copy(p).addScaledVector(perpendicular, -halfWidth)

      let leftPoint: Vector3
      let rightPoint: Vector3

      const hasStartSnap = !!(startLeftEdge && startRightEdge)
      const hasEndSnap = !!(endLeftEdge && endRightEdge)

      if (i === 0 && hasStartSnap) {
        leftPoint = new Vector3(startLeftEdge![0], 0, startLeftEdge![2])
        rightPoint = new Vector3(startRightEdge![0], 0, startRightEdge![2])
      } else if (i === points.length - 1 && hasEndSnap) {
        leftPoint = new Vector3(endLeftEdge![0], 0, endLeftEdge![2])
        rightPoint = new Vector3(endRightEdge![0], 0, endRightEdge![2])
      } else if (i > 0 && i <= BLEND_SEGMENTS && hasStartSnap) {
        const blend = i / (BLEND_SEGMENTS + 1)
        const snapLeft = new Vector3(startLeftEdge![0], 0, startLeftEdge![2])
        const snapRight = new Vector3(startRightEdge![0], 0, startRightEdge![2])
        leftPoint = new Vector3().lerpVectors(snapLeft, naturalLeft, blend)
        rightPoint = new Vector3().lerpVectors(snapRight, naturalRight, blend)
      } else if (i < points.length - 1 && i >= points.length - 1 - BLEND_SEGMENTS && hasEndSnap) {
        const blend = (points.length - 1 - i) / (BLEND_SEGMENTS + 1)
        const snapLeft = new Vector3(endLeftEdge![0], 0, endLeftEdge![2])
        const snapRight = new Vector3(endRightEdge![0], 0, endRightEdge![2])
        leftPoint = new Vector3().lerpVectors(snapLeft, naturalLeft, blend)
        rightPoint = new Vector3().lerpVectors(snapRight, naturalRight, blend)
      } else {
        leftPoint = naturalLeft
        rightPoint = naturalRight
      }

      const bankingOffset = Math.sin(bankRadians) * halfWidth
      const leftY = elevationY + bankingOffset
      const rightY = elevationY - bankingOffset

      return { leftPoint, rightPoint, leftY, rightY, tangent, perpendicular, elevationY }
    }

    const roadVertices: number[] = []
    const roadIndices: number[] = []
    const roadUvs: number[] = []

    const leftEdgeVertices: number[] = []
    const leftEdgeIndices: number[] = []
    const rightEdgeVertices: number[] = []
    const rightEdgeIndices: number[] = []

    const edgeWidth = 0.2
    const edgeOffset = halfWidth - edgeWidth / 2

    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      const t = i / (points.length - 1)

      const { leftPoint, rightPoint, leftY, rightY, perpendicular, elevationY } = computeEdgePoints(i, p, t)

      roadVertices.push(leftPoint.x, leftY, leftPoint.z)
      roadVertices.push(rightPoint.x, rightY, rightPoint.z)

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

      let leftEdgeOuter: Vector3
      let leftEdgeInner: Vector3
      let rightEdgeOuter: Vector3
      let rightEdgeInner: Vector3

      if (
        (i === 0 && startLeftEdge && startRightEdge) ||
        (i === points.length - 1 && endLeftEdge && endRightEdge)
      ) {
        const edgeInset = edgeWidth / 2
        const roadEdgeInset = halfWidth - edgeOffset

        const edgeDir = new Vector3().subVectors(leftPoint, rightPoint).normalize()

        leftEdgeOuter = new Vector3()
          .copy(leftPoint)
          .addScaledVector(edgeDir, -roadEdgeInset + edgeInset)
        leftEdgeInner = new Vector3()
          .copy(leftPoint)
          .addScaledVector(edgeDir, -roadEdgeInset - edgeInset)

        rightEdgeInner = new Vector3()
          .copy(rightPoint)
          .addScaledVector(edgeDir, roadEdgeInset + edgeInset)
        rightEdgeOuter = new Vector3()
          .copy(rightPoint)
          .addScaledVector(edgeDir, roadEdgeInset - edgeInset)
      } else {
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

      const edgeY = elevationY + 0.002
      leftEdgeVertices.push(leftEdgeOuter.x, edgeY, leftEdgeOuter.z)
      leftEdgeVertices.push(leftEdgeInner.x, edgeY, leftEdgeInner.z)

      if (i > 0) {
        const baseIdx = (i - 1) * 2
        leftEdgeIndices.push(baseIdx, baseIdx + 1, baseIdx + 2)
        leftEdgeIndices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2)
      }

      rightEdgeVertices.push(rightEdgeInner.x, edgeY, rightEdgeInner.z)
      rightEdgeVertices.push(rightEdgeOuter.x, edgeY, rightEdgeOuter.z)

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

    const curveLength = curve.getLength()
    const dashSpacing = 3
    const dashCount = Math.max(1, Math.floor(curveLength / dashSpacing))
    const dashW = 0.15 / 2
    const dashL = 1.2 / 2

    const dashVertices: number[] = []
    const dashIndices: number[] = []

    for (let i = 0; i < dashCount; i++) {
      const t = (i + 0.5) / dashCount
      const pos = curve.getPoint(t)
      const tan = curve.getTangent(t)
      const dashElevY = startElev + (endElev - startElev) * t + 0.015
      const perp = new Vector3(-tan.z, 0, tan.x)
      const base = i * 4

      const fwd = new Vector3(tan.x, 0, tan.z).multiplyScalar(dashL)
      const side = perp.clone().multiplyScalar(dashW)

      dashVertices.push(pos.x - side.x - fwd.x, dashElevY, pos.z - side.z - fwd.z)
      dashVertices.push(pos.x + side.x - fwd.x, dashElevY, pos.z + side.z - fwd.z)
      dashVertices.push(pos.x - side.x + fwd.x, dashElevY, pos.z - side.z + fwd.z)
      dashVertices.push(pos.x + side.x + fwd.x, dashElevY, pos.z + side.z + fwd.z)

      dashIndices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3)
    }

    const dashGeo = new BufferGeometry()
    dashGeo.setAttribute('position', new Float32BufferAttribute(dashVertices, 3))
    dashGeo.setIndex(dashIndices)
    dashGeo.computeVertexNormals()

    const selectionVertices: number[] = []
    const selectionIndices: number[] = []
    const selectionExpand = 0.5

    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      const t = i / (points.length - 1)
      const selectionY = startElev + (endElev - startElev) * t + 0.04

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

      selectionVertices.push(leftPoint.x, selectionY, leftPoint.z)
      selectionVertices.push(rightPoint.x, selectionY, rightPoint.z)

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

    const sensorData: { position: [number, number, number]; rotation: number; length: number }[] =
      []
    const numSensors = Math.max(4, Math.ceil(curveLength / 8))
    for (let i = 0; i < numSensors; i++) {
      const t1 = i / numSensors
      const t2 = (i + 1) / numSensors
      const p1 = curve.getPoint(t1)
      const p2 = curve.getPoint(t2)
      const midpoint = new Vector3().lerpVectors(p1, p2, 0.5)
      const segmentLength = p1.distanceTo(p2) + 0.5
      const dir = new Vector3().subVectors(p2, p1).normalize()
      const rotation = Math.atan2(dir.x, dir.z)
      const tMid = (t1 + t2) / 2
      const sensorY = startElev + (endElev - startElev) * tMid + 0.5
      sensorData.push({
        position: [midpoint.x, sensorY, midpoint.z],
        rotation,
        length: segmentLength,
      })
    }

    // Generate solid collision mesh (reduced resolution for performance)
    const collisionStep = 2
    const collisionVertices: number[] = []
    const collisionIndices: number[] = []
    let collVtxCount = 0
    for (let i = 0; i < points.length; i += collisionStep) {
      const idx = Math.min(i, points.length - 1)
      const p = points[idx]
      const t = idx / (points.length - 1)

      const { leftPoint: lp, rightPoint: rp, leftY: topLeftY, rightY: topRightY } = computeEdgePoints(idx, p, t)

      const botLeftY = topLeftY - 0.15
      const botRightY = topRightY - 0.15

      collisionVertices.push(lp.x, topLeftY, lp.z)
      collisionVertices.push(rp.x, topRightY, rp.z)
      collisionVertices.push(lp.x, botLeftY, lp.z)
      collisionVertices.push(rp.x, botRightY, rp.z)

      if (collVtxCount > 0) {
        const base = (collVtxCount - 1) * 4
        collisionIndices.push(base, base + 1, base + 4)
        collisionIndices.push(base + 1, base + 5, base + 4)
        collisionIndices.push(base + 2, base + 6, base + 3)
        collisionIndices.push(base + 3, base + 6, base + 7)
        collisionIndices.push(base, base + 4, base + 2)
        collisionIndices.push(base + 2, base + 4, base + 6)
        collisionIndices.push(base + 1, base + 3, base + 5)
        collisionIndices.push(base + 3, base + 7, base + 5)
      }
      collVtxCount++
    }

    if ((points.length - 1) % collisionStep !== 0) {
      const idx = points.length - 1
      const p = points[idx]
      const t = 1.0

      const { leftPoint: lp, rightPoint: rp, leftY: topLeftY, rightY: topRightY } = computeEdgePoints(idx, p, t)

      const botLeftY = topLeftY - 0.15
      const botRightY = topRightY - 0.15

      collisionVertices.push(lp.x, topLeftY, lp.z)
      collisionVertices.push(rp.x, topRightY, rp.z)
      collisionVertices.push(lp.x, botLeftY, lp.z)
      collisionVertices.push(rp.x, botRightY, rp.z)

      const base = (collVtxCount - 1) * 4
      collisionIndices.push(base, base + 1, base + 4)
      collisionIndices.push(base + 1, base + 5, base + 4)
      collisionIndices.push(base + 2, base + 6, base + 3)
      collisionIndices.push(base + 3, base + 6, base + 7)
      collisionIndices.push(base, base + 4, base + 2)
      collisionIndices.push(base + 2, base + 4, base + 6)
      collisionIndices.push(base + 1, base + 3, base + 5)
      collisionIndices.push(base + 3, base + 7, base + 5)
    }

    const collisionData = {
      vertices: new Float32Array(collisionVertices),
      indices: new Uint32Array(collisionIndices),
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
      centerLineDashes: dashGeo,
      selectionGeometry: selectionGeo,
      sensorColliders: sensorData,
      collisionData,
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
    startElevation,
    endElevation,
    banking,
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
      <mesh geometry={roadGeometry} receiveShadow={!isGhost}>
        <RoadSurfaceMaterial
          isGhost={isGhost}
          variant='road'
          side={2}
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

      <mesh geometry={centerLineDashes}>
        <meshStandardMaterial
          color='#ffcc00'
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>

      {/* Selection highlight for auto curb mode */}
      {isSelectedForCurb && (
        <mesh geometry={selectionGeometry}>
          <meshBasicMaterial
            color='#22c55e'
            transparent
            opacity={0.3}
            depthWrite={false}
            side={2}
          />
        </mesh>
      )}
    </>
  )

  if (isGhost) {
    return <group>{roadVisuals}</group>
  }

  return (
    <RigidBody type='fixed' colliders={false}>
      {roadVisuals}

      <TrimeshCollider
        args={[collisionData.vertices, collisionData.indices]}
        friction={config.friction}
        collisionGroups={TRACK_COLLISION_GROUPS}
      />

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
