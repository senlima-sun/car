import { useMemo } from 'react'
import { RigidBody } from '@react-three/rapier'
import { Vector3 } from 'three'
import { OBJECT_CONFIGS, GHOST_OPACITY } from '../../../constants/trackObjects'

interface BarrierProps {
  position: [number, number, number]
  rotation?: number
  startPoint?: [number, number, number]
  endPoint?: [number, number, number]
  isGhost?: boolean
}

const config = OBJECT_CONFIGS.barrier

export default function Barrier({
  position,
  rotation = 0,
  startPoint,
  endPoint,
  isGhost = false,
}: BarrierProps) {
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
    return { length: 4, calculatedRotation: rotation, midpoint: position }
  }, [startPoint, endPoint, rotation, position])

  const finalRotation = startPoint && endPoint ? calculatedRotation : rotation
  const finalPosition = startPoint && endPoint ? midpoint : position

  const mesh = (
    <group position={finalPosition} rotation={[0, finalRotation, 0]}>
      {/* Main barrier body */}
      <mesh position={[0, height / 2, 0]} castShadow={!isGhost} receiveShadow={!isGhost}>
        <boxGeometry args={[width, height, length]} />
        <meshStandardMaterial
          color={config.color}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>
      {/* Top edge - slightly darker */}
      <mesh position={[0, height - 0.05, 0]} castShadow={!isGhost}>
        <boxGeometry args={[width + 0.02, 0.1, length]} />
        <meshStandardMaterial
          color='#666666'
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>
      {/* Red/white warning stripes */}
      {Array.from({ length: Math.max(1, Math.floor(length / 2)) }).map((_, i) => (
        <mesh
          key={i}
          position={[width / 2 + 0.01, height / 2, -length / 2 + i * 2 + 1]}
          rotation={[0, Math.PI / 2, 0]}
          castShadow={!isGhost}
        >
          <planeGeometry args={[1.8, height * 0.8]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? '#ff0000' : '#ffffff'}
            transparent={isGhost}
            opacity={isGhost ? GHOST_OPACITY : 1}
            depthWrite={!isGhost}
          />
        </mesh>
      ))}
    </group>
  )

  if (isGhost) {
    return mesh
  }

  return (
    <RigidBody
      type='fixed'
      position={[0, 0, 0]}
      colliders='cuboid'
      friction={config.friction}
      restitution={config.restitution}
    >
      {mesh}
    </RigidBody>
  )
}
