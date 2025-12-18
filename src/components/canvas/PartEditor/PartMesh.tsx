import { useRef, useMemo } from 'react'
import { Outlines, RoundedBox } from '@react-three/drei'
import { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { EditorPart } from '@/types/partEditor'

interface PartMeshProps {
  part: EditorPart
  isSelected: boolean
  onClick: (id: string) => void
}

// Create a path from points with optional rounded corners
function createPathFromPoints(
  path: THREE.Shape | THREE.Path,
  points: [number, number][],
  bevelRadius: number
): void {
  if (points.length < 3) {
    path.moveTo(0, 0)
    path.lineTo(1, 0)
    path.lineTo(0.5, 1)
    path.closePath()
    return
  }

  if (bevelRadius > 0) {
    const cornerRadius = bevelRadius

    for (let i = 0; i < points.length; i++) {
      const curr = points[i]
      const next = points[(i + 1) % points.length]
      const prev = points[(i - 1 + points.length) % points.length]

      const toPrev = [prev[0] - curr[0], prev[1] - curr[1]]
      const toNext = [next[0] - curr[0], next[1] - curr[1]]

      const lenPrev = Math.sqrt(toPrev[0] ** 2 + toPrev[1] ** 2)
      const lenNext = Math.sqrt(toNext[0] ** 2 + toNext[1] ** 2)

      if (lenPrev === 0 || lenNext === 0) continue

      const dirPrev = [toPrev[0] / lenPrev, toPrev[1] / lenPrev]
      const dirNext = [toNext[0] / lenNext, toNext[1] / lenNext]

      const r = Math.min(cornerRadius, lenPrev / 2, lenNext / 2)
      const startX = curr[0] + dirPrev[0] * r
      const startY = curr[1] + dirPrev[1] * r
      const endX = curr[0] + dirNext[0] * r
      const endY = curr[1] + dirNext[1] * r

      if (i === 0) {
        path.moveTo(startX, startY)
      } else {
        path.lineTo(startX, startY)
      }

      path.quadraticCurveTo(curr[0], curr[1], endX, endY)
    }
    path.closePath()
  } else {
    path.moveTo(points[0][0], points[0][1])
    for (let i = 1; i < points.length; i++) {
      path.lineTo(points[i][0], points[i][1])
    }
    path.closePath()
  }
}

// Create ExtrudeGeometry from points with optional rounded corners and holes
function createExtrudeGeometry(
  points: [number, number][],
  depth: number,
  bevelRadius: number,
  holes?: [number, number][][]
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()
  createPathFromPoints(shape, points, bevelRadius)

  // Add holes if provided
  if (holes && holes.length > 0) {
    for (const holePoints of holes) {
      if (holePoints.length >= 3) {
        const holePath = new THREE.Path()
        createPathFromPoints(holePath, holePoints, bevelRadius)
        shape.holes.push(holePath)
      }
    }
  }

  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
  })
}

// Interpolate depth from profile at normalized position t (0-1)
function getDepthAtPosition(
  profile: [number, number][],
  t: number,
  smooth: boolean
): number {
  if (profile.length === 0) return 1
  if (profile.length === 1) return profile[0][1]

  // Sort profile by position
  const sorted = [...profile].sort((a, b) => a[0] - b[0])

  // Handle edge cases
  if (t <= sorted[0][0]) return sorted[0][1]
  if (t >= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1]

  // Find surrounding points
  let leftIdx = 0
  let rightIdx = 1

  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i][0] <= t && sorted[i + 1][0] >= t) {
      leftIdx = i
      rightIdx = i + 1
      break
    }
  }

  const left = sorted[leftIdx]
  const right = sorted[rightIdx]

  if (smooth) {
    // Linear interpolation
    const localT = (t - left[0]) / (right[0] - left[0])
    return left[1] + localT * (right[1] - left[1])
  } else {
    // Stepped - use left value until we reach right
    return left[1]
  }
}

// Get bounding box of points
function getBounds(points: THREE.Vector2[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  return { minX, maxX, minY, maxY }
}

// Create variable-depth extrude geometry
// The 2D shape stays constant, but Z-depth varies based on X position
function createVariableExtrudeGeometry(
  points: [number, number][],
  depth: number,
  bevelRadius: number,
  heightProfile: [number, number][],
  smooth: boolean,
  holes?: [number, number][][]
): THREE.BufferGeometry {
  if (points.length < 3) {
    return createExtrudeGeometry(points, depth, bevelRadius, holes)
  }

  const vertices: number[] = []
  const indices: number[] = []

  // Get outline points (apply bevel if needed)
  const shape = new THREE.Shape()
  createPathFromPoints(shape, points, bevelRadius)

  // Add holes to shape
  if (holes && holes.length > 0) {
    for (const holePoints of holes) {
      if (holePoints.length >= 3) {
        const holePath = new THREE.Path()
        createPathFromPoints(holePath, holePoints, bevelRadius)
        shape.holes.push(holePath)
      }
    }
  }

  const outlinePoints = shape.getPoints(12)
  const bounds = getBounds(outlinePoints)
  const xRange = bounds.maxX - bounds.minX

  // Helper: get normalized X position (0-1) for depth lookup
  const getNormalizedX = (x: number) => {
    if (xRange === 0) return 0.5
    return (x - bounds.minX) / xRange
  }

  // Helper: get Z depth for a point based on its X position
  const getZDepth = (x: number) => {
    const normalizedX = getNormalizedX(x)
    return depth * getDepthAtPosition(heightProfile, normalizedX, smooth)
  }

  // Triangulate the shape for front and back faces
  const shapeGeom = new THREE.ShapeGeometry(shape)
  const shapePositions = shapeGeom.getAttribute('position')
  const shapeIndex = shapeGeom.getIndex()

  // === FRONT FACE (Z = 0) ===
  const frontBaseIdx = vertices.length / 3
  for (let i = 0; i < shapePositions.count; i++) {
    const x = shapePositions.getX(i)
    const y = shapePositions.getY(i)
    vertices.push(x, y, 0)
  }

  // Add front face triangles (reversed winding for correct normals)
  if (shapeIndex) {
    for (let i = 0; i < shapeIndex.count; i += 3) {
      indices.push(
        frontBaseIdx + shapeIndex.getX(i),
        frontBaseIdx + shapeIndex.getX(i + 2),
        frontBaseIdx + shapeIndex.getX(i + 1)
      )
    }
  }

  // === BACK FACE (Z = variable depth) ===
  const backBaseIdx = vertices.length / 3
  for (let i = 0; i < shapePositions.count; i++) {
    const x = shapePositions.getX(i)
    const y = shapePositions.getY(i)
    const z = getZDepth(x)
    vertices.push(x, y, z)
  }

  // Add back face triangles
  if (shapeIndex) {
    for (let i = 0; i < shapeIndex.count; i += 3) {
      indices.push(
        backBaseIdx + shapeIndex.getX(i),
        backBaseIdx + shapeIndex.getX(i + 1),
        backBaseIdx + shapeIndex.getX(i + 2)
      )
    }
  }

  // === SIDE WALLS (outer outline) ===
  const numOutlinePoints = outlinePoints.length
  for (let i = 0; i < numOutlinePoints; i++) {
    const nextI = (i + 1) % numOutlinePoints
    const p1 = outlinePoints[i]
    const p2 = outlinePoints[nextI]

    const z1 = getZDepth(p1.x)
    const z2 = getZDepth(p2.x)

    const baseIdx = vertices.length / 3

    // Four corners of the side quad
    // Front edge: z = 0
    // Back edge: z = variable
    vertices.push(p1.x, p1.y, 0)      // 0: front-left
    vertices.push(p2.x, p2.y, 0)      // 1: front-right
    vertices.push(p2.x, p2.y, z2)     // 2: back-right
    vertices.push(p1.x, p1.y, z1)     // 3: back-left

    // Two triangles for the quad
    indices.push(baseIdx, baseIdx + 1, baseIdx + 2)
    indices.push(baseIdx, baseIdx + 2, baseIdx + 3)
  }

  // === HOLE WALLS (inner outlines) ===
  if (holes && holes.length > 0) {
    for (const holePoints of holes) {
      if (holePoints.length < 3) continue

      const holePath = new THREE.Path()
      createPathFromPoints(holePath, holePoints, bevelRadius)
      const holeOutline = holePath.getPoints(12)
      const numHolePoints = holeOutline.length

      for (let i = 0; i < numHolePoints; i++) {
        const nextI = (i + 1) % numHolePoints
        const p1 = holeOutline[i]
        const p2 = holeOutline[nextI]

        const z1 = getZDepth(p1.x)
        const z2 = getZDepth(p2.x)

        const baseIdx = vertices.length / 3

        // Hole walls face inward (reversed winding)
        vertices.push(p1.x, p1.y, 0)
        vertices.push(p2.x, p2.y, 0)
        vertices.push(p2.x, p2.y, z2)
        vertices.push(p1.x, p1.y, z1)

        // Reversed winding for inward-facing normals
        indices.push(baseIdx, baseIdx + 2, baseIdx + 1)
        indices.push(baseIdx, baseIdx + 3, baseIdx + 2)
      }
    }
  }

  // Clean up temporary geometry
  shapeGeom.dispose()

  // Create BufferGeometry
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  return geometry
}

// Check if height profile has variation (not uniform)
function hasProfileVariation(profile: [number, number][]): boolean {
  if (!profile || profile.length < 2) return false
  const firstHeight = profile[0][1]
  return profile.some(([_, h]) => Math.abs(h - firstHeight) > 0.01)
}

export default function PartMesh({ part, isSelected, onClick }: PartMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  // Create geometry based on type
  const customGeometry = useMemo(() => {
    if (part.geometryType === 'extrude' && part.points) {
      const [depth, bevelRadius] = part.args
      const heightProfile = part.heightProfile || [[0, 1], [1, 1]]
      const smooth = part.heightProfileSmooth ?? true

      // Use variable extrusion if profile has variation
      if (hasProfileVariation(heightProfile)) {
        return createVariableExtrudeGeometry(
          part.points,
          depth || 0.5,
          bevelRadius || 0,
          heightProfile,
          smooth,
          part.holes
        )
      }

      return createExtrudeGeometry(part.points, depth || 0.5, bevelRadius || 0, part.holes)
    }
    return null
  }, [part.geometryType, part.args, part.points, part.holes, part.heightProfile, part.heightProfileSmooth])

  const geometry = useMemo(() => {
    switch (part.geometryType) {
      case 'box':
        return <boxGeometry args={part.args as [number, number, number]} />
      case 'cylinder':
        return <cylinderGeometry args={part.args as [number, number, number, number]} />
      case 'sphere':
        return <sphereGeometry args={part.args as [number, number, number]} />
      case 'torus':
        return <torusGeometry args={part.args as [number, number, number, number]} />
      case 'cone':
        return <coneGeometry args={part.args as [number, number, number]} />
      case 'capsule':
        return <capsuleGeometry args={part.args as [number, number, number, number]} />
      case 'roundedbox':
      case 'extrude':
        return null // Handled separately
      default:
        return <boxGeometry args={[1, 1, 1]} />
    }
  }, [part.geometryType, part.args])

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onClick(part.id)
  }

  // Render RoundedBox using drei component
  if (part.geometryType === 'roundedbox') {
    const [width, height, depth, segments, radius] = part.args
    return (
      <RoundedBox
        ref={meshRef}
        args={[width || 1, height || 1, depth || 1]}
        radius={radius || 0.1}
        smoothness={segments || 4}
        position={part.position}
        rotation={part.rotation}
        scale={part.scale}
        onClick={handleClick}
        castShadow
        receiveShadow
        userData={{ partId: part.id }}
      >
        <meshStandardMaterial
          color={part.color}
          metalness={part.metalness}
          roughness={part.roughness}
        />
        {isSelected && (
          <Outlines thickness={0.03} color="#00ff00" />
        )}
      </RoundedBox>
    )
  }

  // Render Extrude using custom geometry
  if (part.geometryType === 'extrude' && customGeometry) {
    return (
      <mesh
        ref={meshRef}
        geometry={customGeometry}
        position={part.position}
        rotation={part.rotation}
        scale={part.scale}
        onClick={handleClick}
        castShadow
        receiveShadow
        userData={{ partId: part.id }}
      >
        <meshStandardMaterial
          color={part.color}
          metalness={part.metalness}
          roughness={part.roughness}
        />
        {isSelected && (
          <Outlines thickness={0.03} color="#00ff00" />
        )}
      </mesh>
    )
  }

  return (
    <mesh
      ref={meshRef}
      position={part.position}
      rotation={part.rotation}
      scale={part.scale}
      onClick={handleClick}
      castShadow
      receiveShadow
      userData={{ partId: part.id }}
    >
      {geometry}
      <meshStandardMaterial
        color={part.color}
        metalness={part.metalness}
        roughness={part.roughness}
      />
      {isSelected && (
        <Outlines thickness={0.03} color="#00ff00" />
      )}
    </mesh>
  )
}
