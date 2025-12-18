import { useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import type { EditorPart, CarPartConfig } from '@/components/part-editor/types'
import { PART_EDITOR_STORAGE_KEY } from '@/components/part-editor/constants'

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

interface DynamicPartProps {
  part: EditorPart
}

function DynamicPart({ part }: DynamicPartProps) {
  // Custom geometry for extrude type
  const customGeometry = useMemo(() => {
    if (part.geometryType === 'extrude' && part.points) {
      const [depth, bevelRadius] = part.args
      return createExtrudeGeometry(part.points, depth || 0.5, bevelRadius || 0, part.holes)
    }
    return null
  }, [part.geometryType, part.args, part.points, part.holes])

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

  // Render RoundedBox using drei component
  if (part.geometryType === 'roundedbox') {
    const [width, height, depth, segments, radius] = part.args
    return (
      <RoundedBox
        args={[width || 1, height || 1, depth || 1]}
        radius={radius || 0.1}
        smoothness={segments || 4}
        position={part.position}
        rotation={part.rotation}
        scale={part.scale}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={part.color}
          metalness={part.metalness}
          roughness={part.roughness}
        />
      </RoundedBox>
    )
  }

  // Render Extrude using custom geometry
  if (part.geometryType === 'extrude' && customGeometry) {
    return (
      <mesh
        geometry={customGeometry}
        position={part.position}
        rotation={part.rotation}
        scale={part.scale}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={part.color}
          metalness={part.metalness}
          roughness={part.roughness}
        />
      </mesh>
    )
  }

  return (
    <mesh
      position={part.position}
      rotation={part.rotation}
      scale={part.scale}
      castShadow
      receiveShadow
    >
      {geometry}
      <meshStandardMaterial
        color={part.color}
        metalness={part.metalness}
        roughness={part.roughness}
      />
    </mesh>
  )
}

interface DynamicPartsProps {
  config?: CarPartConfig | null
  loadFromStorage?: boolean
}

/**
 * Renders parts from a CarPartConfig JSON.
 *
 * Usage in CarBody.tsx:
 * ```tsx
 * import DynamicParts from './DynamicParts'
 * import myPartConfig from '@/assets/parts/custom-wing.json'
 *
 * // Option 1: Load from imported JSON
 * <DynamicParts config={myPartConfig} />
 *
 * // Option 2: Load from localStorage (Part Editor saves here)
 * <DynamicParts loadFromStorage />
 * ```
 *
 * Note: This component should be placed inside the CarBody's scaled group
 * so it inherits CAR_SCALE automatically.
 */
export default function DynamicParts({ config, loadFromStorage = false }: DynamicPartsProps) {
  const parts = useMemo(() => {
    // Priority: explicit config > localStorage
    if (config) {
      return config.parts
    }

    if (loadFromStorage) {
      try {
        const data = localStorage.getItem(PART_EDITOR_STORAGE_KEY)
        if (data) {
          const parsed = JSON.parse(data) as CarPartConfig
          return parsed.parts
        }
      } catch (e) {
        console.error('Failed to load parts from localStorage:', e)
      }
    }

    return []
  }, [config, loadFromStorage])

  if (parts.length === 0) return null

  return (
    <group name="dynamic-parts">
      {parts.map((part) => (
        <DynamicPart key={part.id} part={part} />
      ))}
    </group>
  )
}
