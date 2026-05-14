import { useMemo } from 'react'
import { RigidBody } from '@react-three/rapier'
import { Shape, ExtrudeGeometry } from 'three'
import { OBJECT_CONFIGS, GHOST_OPACITY } from '../../../constants/trackObjects'

interface RampProps {
  position: [number, number, number]
  rotation?: number
  isGhost?: boolean
}

const config = OBJECT_CONFIGS.ramp

export default function Ramp({ position, rotation = 0, isGhost = false }: RampProps) {
  const { width, height, depth } = config.defaultSize

  // Create wedge shape for extrusion
  const geometry = useMemo(() => {
    const shape = new Shape()
    shape.moveTo(0, 0)
    shape.lineTo(depth, 0)
    shape.lineTo(depth, height)
    shape.lineTo(0, 0)

    return new ExtrudeGeometry(shape, {
      depth: width,
      bevelEnabled: false,
    })
  }, [])

  const mesh = (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh
        geometry={geometry}
        rotation={[0, Math.PI / 2, 0]}
        position={[-width / 2, 0, -depth / 2]}
        castShadow={!isGhost}
        receiveShadow={!isGhost}
      >
        <meshStandardMaterial
          color={config.color}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>
      {/* Yellow caution stripes on sides */}
      <mesh
        position={[width / 2 + 0.01, height / 3, 0]}
        rotation={[Math.atan2(height, depth), 0, 0]}
      >
        <planeGeometry args={[0.5, depth / Math.cos(Math.atan2(height, depth))]} />
        <meshStandardMaterial
          color='#ffcc00'
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>
      <mesh
        position={[-width / 2 - 0.01, height / 3, 0]}
        rotation={[Math.atan2(height, depth), Math.PI, 0]}
      >
        <planeGeometry args={[0.5, depth / Math.cos(Math.atan2(height, depth))]} />
        <meshStandardMaterial
          color='#ffcc00'
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>
    </group>
  )

  if (isGhost) {
    return mesh
  }

  return (
    <RigidBody
      type='fixed'
      position={[0, 0, 0]}
      colliders='trimesh'
      friction={config.friction}
      restitution={config.restitution}
    >
      {mesh}
    </RigidBody>
  )
}
