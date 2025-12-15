import { useMemo } from 'react'
import { Vector3, QuadraticBezierCurve3, BufferGeometry, Float32BufferAttribute } from 'three'
import { OBJECT_CONFIGS, GHOST_OPACITY } from '../../../constants/trackObjects'

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

  // Generate the road surface geometry as a continuous mesh
  const { roadGeometry, leftEdgeGeometry, rightEdgeGeometry, centerLineDashes, selectionGeometry } =
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

      roadVertices.push(leftPoint.x, 0.02, leftPoint.z)
      roadVertices.push(rightPoint.x, 0.02, rightPoint.z)

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

      leftEdgeVertices.push(leftEdgeOuter.x, 0.025, leftEdgeOuter.z)
      leftEdgeVertices.push(leftEdgeInner.x, 0.025, leftEdgeInner.z)

      if (i > 0) {
        const baseIdx = (i - 1) * 2
        leftEdgeIndices.push(baseIdx, baseIdx + 1, baseIdx + 2)
        leftEdgeIndices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2)
      }

      rightEdgeVertices.push(rightEdgeInner.x, 0.025, rightEdgeInner.z)
      rightEdgeVertices.push(rightEdgeOuter.x, 0.025, rightEdgeOuter.z)

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

      selectionVertices.push(leftPoint.x, 0.05, leftPoint.z)
      selectionVertices.push(rightPoint.x, 0.05, rightPoint.z)

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

    return {
      roadGeometry: roadGeo,
      leftEdgeGeometry: leftGeo,
      rightEdgeGeometry: rightGeo,
      centerLineDashes: dashes,
      selectionGeometry: selectionGeo,
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

  return (
    <group>
      {/* Road surface */}
      <mesh geometry={roadGeometry} receiveShadow={!isGhost}>
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
          position={[dash.position.x, 0.03, dash.position.z]}
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
    </group>
  )
}
