import { useMemo } from 'react'
import * as THREE from 'three'
import { Vector3 } from 'three'
import { Line } from '@react-three/drei'
import { OBJECT_CONFIGS } from '@/constants/trackObjects'

export function PolygonDrawingPreview({
  points,
  cursorPos,
  surfaceType,
}: {
  points: Array<[number, number, number]>
  cursorPos: [number, number, number] | null
  surfaceType: string
}) {
  const color = OBJECT_CONFIGS[surfaceType as keyof typeof OBJECT_CONFIGS]?.color ?? '#888888'

  const linePoints = useMemo(() => {
    const pts = points.map(p => new Vector3(p[0], 0.1, p[2]))
    if (cursorPos) pts.push(new Vector3(cursorPos[0], 0.1, cursorPos[2]))
    return pts
  }, [points, cursorPos])

  const isNearFirst = useMemo(() => {
    if (!cursorPos || points.length < 3) return false
    const first = points[0]
    const dx = cursorPos[0] - first[0]
    const dz = cursorPos[2] - first[2]
    return Math.sqrt(dx * dx + dz * dz) < 1.5
  }, [points, cursorPos])

  const filledShape = useMemo(() => {
    if (points.length < 3) return null
    const shape = new THREE.Shape()
    shape.moveTo(points[0][0], points[0][2])
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i][0], points[i][2])
    }
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [points])

  return (
    <group>
      {linePoints.length >= 2 && (
        <Line points={linePoints} color={color} lineWidth={2} opacity={0.8} transparent />
      )}

      {filledShape && (
        <mesh geometry={filledShape} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.25}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {points.map((p, i) => (
        <mesh key={i} position={[p[0], 0.15, p[2]]}>
          <sphereGeometry args={[i === 0 && isNearFirst ? 0.6 : 0.3, 12, 12]} />
          <meshStandardMaterial
            color={i === 0 ? (isNearFirst ? '#00ff00' : '#ffaa00') : color}
            transparent
            opacity={0.9}
            emissive={i === 0 && isNearFirst ? '#00ff00' : undefined}
            emissiveIntensity={i === 0 && isNearFirst ? 0.5 : 0}
          />
        </mesh>
      ))}
    </group>
  )
}
