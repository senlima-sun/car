import { useMemo } from 'react'
import { Vector3 } from 'three'
import { OBJECT_CONFIGS, GHOST_OPACITY } from '../../../constants/trackObjects'

interface RoadSegmentProps {
  position: [number, number, number]
  rotation?: number
  startPoint?: [number, number, number]
  endPoint?: [number, number, number]
  isGhost?: boolean
  isSelectedForCurb?: boolean
}

const config = OBJECT_CONFIGS.road

export default function RoadSegment({
  position,
  rotation = 0,
  startPoint,
  endPoint,
  isGhost = false,
  isSelectedForCurb = false,
}: RoadSegmentProps) {
  const { width, height } = config.defaultSize

  // Calculate length and rotation from start/end points if provided
  const { length, calculatedRotation, midpoint } = useMemo(() => {
    if (startPoint && endPoint) {
      const start = new Vector3(...startPoint)
      const end = new Vector3(...endPoint)
      const direction = end.clone().sub(start)
      const len = direction.length()
      const rot = Math.atan2(direction.x, direction.z)
      const mid: [number, number, number] = [(start.x + end.x) / 2, 0, (start.z + end.z) / 2]
      return { length: len, calculatedRotation: rot, midpoint: mid }
    }
    return { length: 10, calculatedRotation: rotation, midpoint: position }
  }, [startPoint, endPoint, rotation, position])

  const finalRotation = startPoint && endPoint ? calculatedRotation : rotation
  const finalPosition = startPoint && endPoint ? midpoint : position

  // Number of center line dashes
  const dashCount = Math.max(1, Math.floor(length / 3))

  return (
    <group position={finalPosition} rotation={[0, finalRotation, 0]}>
      {/* Main road surface */}
      <mesh position={[0, height / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={!isGhost}>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial
          color={config.color}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>

      {/* Road edges - white lines */}
      <mesh position={[-width / 2 + 0.15, height / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.2, length]} />
        <meshStandardMaterial
          color='#ffffff'
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>
      <mesh position={[width / 2 - 0.15, height / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.2, length]} />
        <meshStandardMaterial
          color='#ffffff'
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>

      {/* Center line dashes - yellow */}
      {Array.from({ length: dashCount }).map((_, i) => (
        <mesh
          key={i}
          position={[0, height / 2 + 0.001, -length / 2 + (i + 0.5) * (length / dashCount)]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.15, (length / dashCount) * 0.6]} />
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
        <mesh position={[0, height / 2 + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width + 0.5, length + 0.5]} />
          <meshBasicMaterial color='#22c55e' transparent opacity={0.3} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}
