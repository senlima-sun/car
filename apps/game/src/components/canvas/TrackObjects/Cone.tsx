import { RigidBody } from '@react-three/rapier'
import { OBJECT_CONFIGS, GHOST_OPACITY } from '../../../constants/trackObjects'

interface ConeProps {
  position: [number, number, number]
  rotation?: number
  isGhost?: boolean
}

const config = OBJECT_CONFIGS.cone

export default function Cone({ position, rotation = 0, isGhost = false }: ConeProps) {
  const { width, height } = config.defaultSize

  const mesh = (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Main cone body */}
      <mesh position={[0, height / 2, 0]} castShadow={!isGhost}>
        <coneGeometry args={[width / 2, height * 0.85, 16]} />
        <meshStandardMaterial
          color={config.color}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.02, 0]} castShadow={!isGhost}>
        <cylinderGeometry args={[width / 2 + 0.1, width / 2 + 0.15, 0.04, 16]} />
        <meshStandardMaterial
          color='#222222'
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>
      {/* White stripes */}
      <mesh position={[0, height * 0.3, 0]} castShadow={!isGhost}>
        <cylinderGeometry args={[(width / 2) * 0.7, (width / 2) * 0.8, height * 0.15, 16]} />
        <meshStandardMaterial
          color='#ffffff'
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>
      <mesh position={[0, height * 0.55, 0]} castShadow={!isGhost}>
        <cylinderGeometry args={[(width / 2) * 0.45, (width / 2) * 0.55, height * 0.15, 16]} />
        <meshStandardMaterial
          color='#ffffff'
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
      type='dynamic'
      position={[0, 0, 0]}
      colliders='hull'
      mass={2}
      friction={config.friction}
      restitution={config.restitution}
    >
      {mesh}
    </RigidBody>
  )
}
