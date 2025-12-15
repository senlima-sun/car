import { useMemo, useCallback } from 'react'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { Vector3 } from 'three'
import { OBJECT_CONFIGS, GHOST_OPACITY } from '../../../constants/trackObjects'
import { useLapTimeStore } from '../../../stores/useLapTimeStore'
import TracksideBoard from './TracksideBoard'

interface CheckpointProps {
  position: [number, number, number]
  rotation?: number
  startPoint?: [number, number, number]
  endPoint?: [number, number, number]
  isGhost?: boolean
  checkpointId?: string
}

const config = OBJECT_CONFIGS.checkpoint

export default function Checkpoint({
  position,
  rotation = 0,
  startPoint,
  endPoint,
  isGhost = false,
  checkpointId: _checkpointId,
}: CheckpointProps) {
  const strokeWidth = 0.8 // Width of the checkpoint stroke
  const strokeHeight = 0.15 // Height above ground

  // Lap timing
  const crossCheckpoint = useLapTimeStore(state => state.crossCheckpoint)

  const handleCrossing = useCallback(() => {
    if (!isGhost) {
      console.log('Checkpoint crossed!')
      crossCheckpoint()
    }
  }, [isGhost, crossCheckpoint])

  // Calculate stroke geometry from start/end points
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
    // Fallback for legacy/preview without start/end points
    return { length: config.defaultSize.width, calculatedRotation: rotation, midpoint: position }
  }, [startPoint, endPoint, rotation, position])

  const finalRotation = startPoint && endPoint ? calculatedRotation : rotation
  const finalPosition = startPoint && endPoint ? midpoint : position

  // Number of checkered segments
  const numSegments = Math.max(4, Math.floor(length / 2))
  const segmentWidth = length / numSegments

  const mesh = (
    <group position={finalPosition} rotation={[0, finalRotation, 0]}>
      {/* Main stroke base */}
      <mesh position={[0, strokeHeight / 2, 0]} castShadow={!isGhost} receiveShadow={!isGhost}>
        <boxGeometry args={[strokeWidth, strokeHeight, length]} />
        <meshStandardMaterial
          color='#222222'
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>

      {/* Checkered pattern on top */}
      {Array.from({ length: numSegments }).map((_, i) => (
        <mesh
          key={i}
          position={[0, strokeHeight + 0.01, -length / 2 + segmentWidth * i + segmentWidth / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          castShadow={!isGhost}
        >
          <planeGeometry args={[strokeWidth - 0.05, segmentWidth - 0.02]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? '#ffffff' : '#000000'}
            emissive={i % 2 === 0 ? '#ffffff' : '#000000'}
            emissiveIntensity={isGhost ? 0.1 : 0.3}
            transparent={isGhost}
            opacity={isGhost ? GHOST_OPACITY : 1}
            depthWrite={!isGhost}
          />
        </mesh>
      ))}

      {/* Edge markers at start and end */}
      <mesh position={[0, strokeHeight / 2 + 0.2, -length / 2]} castShadow={!isGhost}>
        <boxGeometry args={[strokeWidth + 0.1, 0.4, 0.1]} />
        <meshStandardMaterial
          color={config.color}
          emissive={config.color}
          emissiveIntensity={isGhost ? 0.2 : 0.5}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>
      <mesh position={[0, strokeHeight / 2 + 0.2, length / 2]} castShadow={!isGhost}>
        <boxGeometry args={[strokeWidth + 0.1, 0.4, 0.1]} />
        <meshStandardMaterial
          color={config.color}
          emissive={config.color}
          emissiveIntensity={isGhost ? 0.2 : 0.5}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>

      {/* Trackside boards at checkpoint edges */}
      <TracksideBoard
        position={[0, 0, -length / 2 - 1.5]}
        rotation={Math.PI / 2}
        isGhost={isGhost}
      />
      <TracksideBoard
        position={[0, 0, length / 2 + 1.5]}
        rotation={-Math.PI / 2}
        isGhost={isGhost}
      />
    </group>
  )

  if (isGhost) {
    return mesh
  }

  return (
    <group>
      {/* Sensor for lap timing - positioned at checkpoint center */}
      <RigidBody
        type='fixed'
        position={[finalPosition[0], 1, finalPosition[2]]}
        rotation={[0, finalRotation, 0]}
        sensor
      >
        <CuboidCollider args={[2, 2, length / 2]} sensor onIntersectionEnter={handleCrossing} />
      </RigidBody>
      {mesh}
    </group>
  )
}
