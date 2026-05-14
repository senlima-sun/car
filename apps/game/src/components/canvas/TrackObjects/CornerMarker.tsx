import { Billboard, Text } from '@react-three/drei'
import { GHOST_OPACITY } from '../../../constants/trackObjects'

interface CornerMarkerProps {
  position: [number, number, number]
  rotation?: number
  cornerNumber?: number
  isGhost?: boolean
}

const MARKER_COLOR = '#ffcc33'
const POST_HEIGHT = 2.6
const POST_RADIUS = 0.09

export default function CornerMarker({
  position,
  cornerNumber = 1,
  isGhost = false,
}: CornerMarkerProps) {
  const label = `T${cornerNumber}`

  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh position={[0, POST_HEIGHT / 2, 0]} castShadow={!isGhost}>
        <cylinderGeometry args={[POST_RADIUS, POST_RADIUS, POST_HEIGHT, 10]} />
        <meshStandardMaterial
          color={MARKER_COLOR}
          emissive={MARKER_COLOR}
          emissiveIntensity={0.7}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
        />
      </mesh>
      <mesh position={[0, POST_HEIGHT + 0.18, 0]}>
        <sphereGeometry args={[0.22, 14, 10]} />
        <meshStandardMaterial
          color='#ffffff'
          emissive={MARKER_COLOR}
          emissiveIntensity={1.4}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
        />
      </mesh>
      <Billboard position={[0, POST_HEIGHT + 1.05, 0]}>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[1.8, 0.95]} />
          <meshBasicMaterial
            color='#0a0a12'
            transparent
            opacity={isGhost ? GHOST_OPACITY * 0.7 : 0.88}
          />
        </mesh>
        <Text
          fontSize={0.65}
          color={MARKER_COLOR}
          anchorX='center'
          anchorY='middle'
          outlineWidth={0.045}
          outlineColor='#000000'
        >
          {label}
        </Text>
      </Billboard>
    </group>
  )
}
