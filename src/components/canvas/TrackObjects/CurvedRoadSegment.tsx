import { useMemo } from 'react'
import { Vector3, QuadraticBezierCurve3, BufferGeometry, Float32BufferAttribute } from 'three'
import { RigidBody, CuboidCollider, TrimeshCollider } from '@react-three/rapier'
import { OBJECT_CONFIGS } from '../../../constants/trackObjects'
import RoadSurfaceMaterial from './RoadSurfaceMaterial'
import { TRACK_COLLISION_GROUPS } from '../../../constants/dimensions'
import { smootherstep } from '../../../utils/roadGeometry'
import { useRoadSurfaces } from './hooks/useRoadSurfaces'
import { useTemperatureRegistration } from './hooks/useTemperatureRegistration'
import { EdgeLines } from './components/EdgeLines'
import { RoadSelectionHighlight } from './components/RoadSelectionHighlight'

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

  const startVec = useMemo(() => new Vector3(...startPoint), [startPoint])
  const endVec = useMemo(() => new Vector3(...endPoint), [endPoint])
  const curveLength = useMemo(() => startVec.distanceTo(endVec), [startVec, endVec])

  const { handleEnterRoad, handleExitRoad } = useRoadSurfaces({
    startElevation: startElevation ?? 0,
    endElevation: endElevation ?? 0,
    length: curveLength,
    banking,
  })

  const {
    roadGeometry,
    leftEdgeGeometry,
    rightEdgeGeometry,
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
    const segmentCount = Math.max(
      MIN_CURVE_SEGMENTS,
      Math.min(MAX_CURVE_SEGMENTS, Math.ceil(curveLen / METERS_PER_SEGMENT)),
    )
    const points = curve.getPoints(segmentCount)

    const hasStartSnap = !!(startLeftEdge && startRightEdge)
    const hasEndSnap = !!(endLeftEdge && endRightEdge)

    let startLeftOffset: Vector3 | null = null
    let startRightOffset: Vector3 | null = null
    let endLeftOffset: Vector3 | null = null
    let endRightOffset: Vector3 | null = null

    if (hasStartSnap) {
      const startTangent = new Vector3().subVectors(control, start).normalize()
      const startPerp = new Vector3(-startTangent.z, 0, startTangent.x)
      const naturalLeftAtStart = new Vector3().copy(points[0]).addScaledVector(startPerp, halfWidth)
      const naturalRightAtStart = new Vector3().copy(points[0]).addScaledVector(startPerp, -halfWidth)
      startLeftOffset = new Vector3(startLeftEdge![0], 0, startLeftEdge![2]).sub(naturalLeftAtStart)
      startRightOffset = new Vector3(startRightEdge![0], 0, startRightEdge![2]).sub(naturalRightAtStart)
    }
    if (hasEndSnap) {
      const endTangent = new Vector3().subVectors(end, control).normalize()
      const endPerp = new Vector3(-endTangent.z, 0, endTangent.x)
      const naturalLeftAtEnd = new Vector3().copy(points[points.length - 1]).addScaledVector(endPerp, halfWidth)
      const naturalRightAtEnd = new Vector3().copy(points[points.length - 1]).addScaledVector(endPerp, -halfWidth)
      endLeftOffset = new Vector3(endLeftEdge![0], 0, endLeftEdge![2]).sub(naturalLeftAtEnd)
      endRightOffset = new Vector3(endRightEdge![0], 0, endRightEdge![2]).sub(naturalRightAtEnd)
    }

    const computeEdgePoints = (i: number, p: Vector3, t: number) => {
      const elevationY = startElev + (endElev - startElev) * t + 0.01

      const bankingAngle = bankingDeg * Math.sin(t * Math.PI)
      const bankRadians = bankingAngle * DEG2RAD

      let tangent: Vector3
      if (i === 0) {
        tangent = new Vector3().subVectors(control, start).normalize()
      } else if (i === points.length - 1) {
        tangent = new Vector3().subVectors(end, control).normalize()
      } else {
        tangent = new Vector3().subVectors(points[i + 1], points[i - 1]).normalize()
      }
      const perpendicular = new Vector3(-tangent.z, 0, tangent.x)

      const naturalLeft = new Vector3().copy(p).addScaledVector(perpendicular, halfWidth)
      const naturalRight = new Vector3().copy(p).addScaledVector(perpendicular, -halfWidth)

      let leftPoint: Vector3
      let rightPoint: Vector3

      if (i === 0 && hasStartSnap) {
        leftPoint = new Vector3(startLeftEdge![0], naturalLeft.y, startLeftEdge![2])
        rightPoint = new Vector3(startRightEdge![0], naturalRight.y, startRightEdge![2])
      } else if (i === points.length - 1 && hasEndSnap) {
        leftPoint = new Vector3(endLeftEdge![0], naturalLeft.y, endLeftEdge![2])
        rightPoint = new Vector3(endRightEdge![0], naturalRight.y, endRightEdge![2])
      } else {
        const startInfluence = hasStartSnap ? smootherstep(1 - t) : 0
        const endInfluence = hasEndSnap ? smootherstep(t) : 0

        const leftOffX =
          (startLeftOffset ? startLeftOffset.x * startInfluence : 0) +
          (endLeftOffset ? endLeftOffset.x * endInfluence : 0)
        const leftOffZ =
          (startLeftOffset ? startLeftOffset.z * startInfluence : 0) +
          (endLeftOffset ? endLeftOffset.z * endInfluence : 0)
        const rightOffX =
          (startRightOffset ? startRightOffset.x * startInfluence : 0) +
          (endRightOffset ? endRightOffset.x * endInfluence : 0)
        const rightOffZ =
          (startRightOffset ? startRightOffset.z * startInfluence : 0) +
          (endRightOffset ? endRightOffset.z * endInfluence : 0)

        leftPoint = new Vector3(naturalLeft.x + leftOffX, naturalLeft.y, naturalLeft.z + leftOffZ)
        rightPoint = new Vector3(
          naturalRight.x + rightOffX,
          naturalRight.y,
          naturalRight.z + rightOffZ,
        )
      }

      const bankingOffset = Math.sin(bankRadians) * halfWidth
      const leftY = elevationY + bankingOffset
      const rightY = elevationY - bankingOffset

      return { leftPoint, rightPoint, leftY, rightY, tangent, perpendicular, elevationY }
    }

    const CROSS_SEGS = 8
    const roadVertices: number[] = []
    const roadIndices: number[] = []
    const roadUvs: number[] = []

    const leftEdgeVertices: number[] = []
    const leftEdgeIndices: number[] = []
    const rightEdgeVertices: number[] = []
    const rightEdgeIndices: number[] = []

    const edgeWidth = 0.2

    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      const t = i / (points.length - 1)

      const { leftPoint, rightPoint, leftY, rightY, perpendicular } = computeEdgePoints(
        i,
        p,
        t,
      )

      for (let k = 0; k <= CROSS_SEGS; k++) {
        const tW = k / CROSS_SEGS
        roadVertices.push(
          leftPoint.x + (rightPoint.x - leftPoint.x) * tW,
          leftY + (rightY - leftY) * tW,
          leftPoint.z + (rightPoint.z - leftPoint.z) * tW,
        )
        roadUvs.push(tW, t)
      }

      if (i > 0) {
        const row = i * (CROSS_SEGS + 1)
        const prevRow = (i - 1) * (CROSS_SEGS + 1)
        for (let k = 0; k < CROSS_SEGS; k++) {
          const a = prevRow + k
          const b = a + 1
          const c = row + k
          const d = c + 1
          roadIndices.push(a, b, c, b, d, c)
        }
      }

      const edgeDir = new Vector3().subVectors(leftPoint, rightPoint)
      const edgeDirLen = edgeDir.length()
      if (edgeDirLen > 0) edgeDir.divideScalar(edgeDirLen)
      else edgeDir.copy(perpendicular)
      const inset = edgeWidth / 2

      const leftEdgeY = leftY + 0.002
      const rightEdgeY = rightY + 0.002
      leftEdgeVertices.push(
        leftPoint.x + edgeDir.x * inset,
        leftEdgeY,
        leftPoint.z + edgeDir.z * inset,
      )
      leftEdgeVertices.push(
        leftPoint.x - edgeDir.x * inset,
        leftEdgeY,
        leftPoint.z - edgeDir.z * inset,
      )

      if (i > 0) {
        const baseIdx = (i - 1) * 2
        leftEdgeIndices.push(baseIdx, baseIdx + 1, baseIdx + 2)
        leftEdgeIndices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2)
      }

      rightEdgeVertices.push(
        rightPoint.x + edgeDir.x * inset,
        rightEdgeY,
        rightPoint.z + edgeDir.z * inset,
      )
      rightEdgeVertices.push(
        rightPoint.x - edgeDir.x * inset,
        rightEdgeY,
        rightPoint.z - edgeDir.z * inset,
      )

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

    const selectionVertices: number[] = []
    const selectionIndices: number[] = []
    const selectionExpand = 0.5

    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      const t = i / (points.length - 1)
      const selectionY = startElev + (endElev - startElev) * t + 0.04

      let tangent: Vector3
      if (i === 0) {
        tangent = new Vector3().subVectors(control, start).normalize()
      } else if (i === points.length - 1) {
        tangent = new Vector3().subVectors(end, control).normalize()
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
    const curveLength = curve.getLength()
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

      const {
        leftPoint: lp,
        rightPoint: rp,
        leftY: topLeftY,
        rightY: topRightY,
      } = computeEdgePoints(idx, p, t)

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

      const {
        leftPoint: lp,
        rightPoint: rp,
        leftY: topLeftY,
        rightY: topRightY,
      } = computeEdgePoints(idx, p, t)

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

  useTemperatureRegistration(isGhost, roadBounds)

  // Visual elements
  const roadVisuals = (
    <>
      {/* Road surface */}
      <mesh geometry={roadGeometry} receiveShadow={!isGhost}>
        <RoadSurfaceMaterial isGhost={isGhost} variant='road' side={2} />
      </mesh>

      <EdgeLines
        leftGeometry={leftEdgeGeometry}
        rightGeometry={rightEdgeGeometry}
        isGhost={isGhost}
      />

      <RoadSelectionHighlight isSelected={isSelectedForCurb} geometry={selectionGeometry} />
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
