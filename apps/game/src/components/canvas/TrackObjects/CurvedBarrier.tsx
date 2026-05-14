import { useMemo } from 'react'
import { Vector3, QuadraticBezierCurve3, BufferGeometry, Float32BufferAttribute } from 'three'
import { RigidBody } from '@react-three/rapier'
import { OBJECT_CONFIGS, GHOST_OPACITY } from '../../../constants/trackObjects'

interface CurvedBarrierProps {
  position: [number, number, number]
  startPoint: [number, number, number]
  controlPoint: [number, number, number]
  endPoint: [number, number, number]
  isGhost?: boolean
  // Edge positions of connected barrier at start/end for seamless alignment
  startLeftEdge?: [number, number, number]
  startRightEdge?: [number, number, number]
  endLeftEdge?: [number, number, number]
  endRightEdge?: [number, number, number]
}

const config = OBJECT_CONFIGS.barrier
const CURVE_SEGMENTS = 32

export default function CurvedBarrier({
  startPoint,
  controlPoint,
  endPoint,
  isGhost = false,
  startLeftEdge,
  startRightEdge,
  endLeftEdge,
  endRightEdge,
}: CurvedBarrierProps) {
  const { width, height } = config.defaultSize
  const halfWidth = width / 2

  // Generate the barrier geometry as continuous meshes
  const { topGeometry, frontGeometry, backGeometry, topCapGeometry, points } = useMemo(() => {
    const start = new Vector3(...startPoint)
    const control = new Vector3(...controlPoint)
    const end = new Vector3(...endPoint)

    const curve = new QuadraticBezierCurve3(start, control, end)
    const pts = curve.getPoints(CURVE_SEGMENTS)

    // Build vertices for top surface
    const topVertices: number[] = []
    const topIndices: number[] = []

    // Build vertices for front/back faces (vertical walls)
    const frontVertices: number[] = []
    const frontIndices: number[] = []
    const backVertices: number[] = []
    const backIndices: number[] = []

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]

      let topLeft: Vector3
      let topRight: Vector3

      // Always calculate perpendicular for non-snapped points
      let tangent: Vector3
      if (i === 0) {
        tangent = new Vector3().subVectors(pts[1], pts[0]).normalize()
      } else if (i === pts.length - 1) {
        tangent = new Vector3().subVectors(pts[i], pts[i - 1]).normalize()
      } else {
        tangent = new Vector3().subVectors(pts[i + 1], pts[i - 1]).normalize()
      }
      const perpendicular = new Vector3(-tangent.z, 0, tangent.x)

      // At endpoints, use exact edge positions from connected barrier if available
      if (i === 0 && startLeftEdge && startRightEdge) {
        topLeft = new Vector3(startLeftEdge[0], height, startLeftEdge[2])
        topRight = new Vector3(startRightEdge[0], height, startRightEdge[2])
      } else if (i === pts.length - 1 && endLeftEdge && endRightEdge) {
        topLeft = new Vector3(endLeftEdge[0], height, endLeftEdge[2])
        topRight = new Vector3(endRightEdge[0], height, endRightEdge[2])
      } else {
        // Top surface vertices (at height)
        topLeft = new Vector3().copy(p).addScaledVector(perpendicular, halfWidth)
        topLeft.y = height
        topRight = new Vector3().copy(p).addScaledVector(perpendicular, -halfWidth)
        topRight.y = height
      }

      topVertices.push(topLeft.x, height, topLeft.z)
      topVertices.push(topRight.x, height, topRight.z)

      if (i > 0) {
        const baseIdx = (i - 1) * 2
        topIndices.push(baseIdx, baseIdx + 2, baseIdx + 1)
        topIndices.push(baseIdx + 1, baseIdx + 2, baseIdx + 3)
      }

      // Front face (outer edge) - from ground to top
      frontVertices.push(topLeft.x, 0, topLeft.z)
      frontVertices.push(topLeft.x, height, topLeft.z)

      if (i > 0) {
        const baseIdx = (i - 1) * 2
        frontIndices.push(baseIdx, baseIdx + 1, baseIdx + 2)
        frontIndices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2)
      }

      // Back face (inner edge) - from ground to top
      backVertices.push(topRight.x, 0, topRight.z)
      backVertices.push(topRight.x, height, topRight.z)

      if (i > 0) {
        const baseIdx = (i - 1) * 2
        backIndices.push(baseIdx, baseIdx + 2, baseIdx + 1)
        backIndices.push(baseIdx + 1, baseIdx + 2, baseIdx + 3)
      }
    }

    // Create geometries
    const topGeo = new BufferGeometry()
    topGeo.setAttribute('position', new Float32BufferAttribute(topVertices, 3))
    topGeo.setIndex(topIndices)
    topGeo.computeVertexNormals()

    const frontGeo = new BufferGeometry()
    frontGeo.setAttribute('position', new Float32BufferAttribute(frontVertices, 3))
    frontGeo.setIndex(frontIndices)
    frontGeo.computeVertexNormals()

    const backGeo = new BufferGeometry()
    backGeo.setAttribute('position', new Float32BufferAttribute(backVertices, 3))
    backGeo.setIndex(backIndices)
    backGeo.computeVertexNormals()

    // Top cap (darker edge strip)
    const topCapVertices: number[] = []
    const topCapIndices: number[] = []
    const capHeight = 0.1

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]

      let capLeft: Vector3
      let capRight: Vector3

      // Calculate perpendicular for non-snapped points
      let tangent: Vector3
      if (i === 0) {
        tangent = new Vector3().subVectors(pts[1], pts[0]).normalize()
      } else if (i === pts.length - 1) {
        tangent = new Vector3().subVectors(pts[i], pts[i - 1]).normalize()
      } else {
        tangent = new Vector3().subVectors(pts[i + 1], pts[i - 1]).normalize()
      }
      const perpendicular = new Vector3(-tangent.z, 0, tangent.x)

      // At endpoints, use edge positions for cap alignment
      if (i === 0 && startLeftEdge && startRightEdge) {
        capLeft = new Vector3(startLeftEdge[0], height - capHeight / 2, startLeftEdge[2])
        capRight = new Vector3(startRightEdge[0], height - capHeight / 2, startRightEdge[2])
      } else if (i === pts.length - 1 && endLeftEdge && endRightEdge) {
        capLeft = new Vector3(endLeftEdge[0], height - capHeight / 2, endLeftEdge[2])
        capRight = new Vector3(endRightEdge[0], height - capHeight / 2, endRightEdge[2])
      } else {
        capLeft = new Vector3().copy(p).addScaledVector(perpendicular, halfWidth + 0.01)
        capRight = new Vector3().copy(p).addScaledVector(perpendicular, -(halfWidth + 0.01))
      }

      topCapVertices.push(capLeft.x, height - capHeight / 2, capLeft.z)
      topCapVertices.push(capRight.x, height - capHeight / 2, capRight.z)

      if (i > 0) {
        const baseIdx = (i - 1) * 2
        topCapIndices.push(baseIdx, baseIdx + 2, baseIdx + 1)
        topCapIndices.push(baseIdx + 1, baseIdx + 2, baseIdx + 3)
      }
    }

    const topCapGeo = new BufferGeometry()
    topCapGeo.setAttribute('position', new Float32BufferAttribute(topCapVertices, 3))
    topCapGeo.setIndex(topCapIndices)
    topCapGeo.computeVertexNormals()

    return {
      topGeometry: topGeo,
      frontGeometry: frontGeo,
      backGeometry: backGeo,
      topCapGeometry: topCapGeo,
      points: pts,
    }
  }, [
    startPoint,
    controlPoint,
    endPoint,
    halfWidth,
    height,
    startLeftEdge,
    startRightEdge,
    endLeftEdge,
    endRightEdge,
  ])

  const mesh = (
    <group>
      {/* Top surface */}
      <mesh geometry={topGeometry} castShadow={!isGhost} receiveShadow={!isGhost}>
        <meshStandardMaterial
          color={config.color}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
          side={2}
        />
      </mesh>

      {/* Front face */}
      <mesh geometry={frontGeometry} castShadow={!isGhost} receiveShadow={!isGhost}>
        <meshStandardMaterial
          color={config.color}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
          side={2}
        />
      </mesh>

      {/* Back face */}
      <mesh geometry={backGeometry} castShadow={!isGhost} receiveShadow={!isGhost}>
        <meshStandardMaterial
          color={config.color}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
          side={2}
        />
      </mesh>

      {/* Top cap/edge */}
      <mesh geometry={topCapGeometry}>
        <meshStandardMaterial
          color='#666666'
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
          side={2}
        />
      </mesh>
    </group>
  )

  if (isGhost) {
    return mesh
  }

  // For physics, create box colliders along the curve
  return (
    <group>
      {points.slice(0, -1).map((p1, i) => {
        const p2 = points[i + 1]
        const dx = p2.x - p1.x
        const dz = p2.z - p1.z
        const length = Math.sqrt(dx * dx + dz * dz)
        const rotation = Math.atan2(dx, dz)
        const midX = (p1.x + p2.x) / 2
        const midZ = (p1.z + p2.z) / 2

        return (
          <RigidBody
            key={`rb-${i}`}
            type='fixed'
            position={[midX, height / 2, midZ]}
            rotation={[0, rotation, 0]}
            colliders='cuboid'
            friction={config.friction}
            restitution={config.restitution}
          >
            <mesh visible={false}>
              <boxGeometry args={[width, height, length]} />
            </mesh>
          </RigidBody>
        )
      })}
      {mesh}
    </group>
  )
}
