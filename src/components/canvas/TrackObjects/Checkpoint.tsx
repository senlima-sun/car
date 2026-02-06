import { useMemo, useCallback, useEffect } from 'react'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { Vector3, Quaternion } from 'three'
import { Text } from '@react-three/drei'
import { OBJECT_CONFIGS, GHOST_OPACITY } from '../../../constants/trackObjects'
import { useLapTimeStore } from '../../../stores/useLapTimeStore'
import { useCarStore } from '../../../stores/useCarStore'
import { useTrackGraphStore } from '../../../stores/useTrackGraphStore'
import type { CheckpointType } from '../../../types/trackObjects'
import TracksideBoard from './TracksideBoard'

interface CheckpointProps {
  position: [number, number, number]
  rotation?: number
  startPoint?: [number, number, number]
  endPoint?: [number, number, number]
  isGhost?: boolean
  checkpointId?: string
  checkpointType?: CheckpointType
  checkpointOrder?: number
}

const config = OBJECT_CONFIGS.checkpoint
const CHECKPOINT_Y_OFFSET = 0.25

export default function Checkpoint({
  position,
  rotation = 0,
  startPoint,
  endPoint,
  isGhost = false,
  checkpointId: _checkpointId,
  checkpointType = 'start-finish',
  checkpointOrder = 0,
}: CheckpointProps) {
  const strokeWidth = 0.8
  const strokeHeight = 0.15
  const isSector = checkpointType === 'sector'

  const crossStartFinish = useLapTimeStore(state => state.crossStartFinish)
  const crossSector = useLapTimeStore(state => state.crossSector)
  const setActive = useLapTimeStore(state => state.setActive)

  useEffect(() => {
    if (!isGhost) {
      setActive(true)
    }
  }, [isGhost, setActive])

  const { length, calculatedRotation, midpoint } = useMemo(() => {
    if (startPoint && endPoint) {
      const start = new Vector3(...startPoint)
      const end = new Vector3(...endPoint)
      const direction = end.clone().sub(start)
      const len = direction.length()
      const rot = Math.atan2(direction.x, direction.z)
      const mid: [number, number, number] = [
        (start.x + end.x) / 2,
        CHECKPOINT_Y_OFFSET,
        (start.z + end.z) / 2,
      ]
      return { length: len, calculatedRotation: rot, midpoint: mid }
    }
    return {
      length: config.defaultSize.width,
      calculatedRotation: rotation,
      midpoint: [position[0], CHECKPOINT_Y_OFFSET, position[2]] as [number, number, number],
    }
  }, [startPoint, endPoint, rotation, position])

  const finalRotation = startPoint && endPoint ? calculatedRotation : rotation
  const finalPosition = midpoint

  const detectWrongWay = useCallback((): boolean => {
    const hasFlow = useTrackGraphStore.getState().hasFlow
    if (!hasFlow) return false

    const carRotation = useCarStore.getState().rotation
    const carSpeed = useCarStore.getState().speed
    if (Math.abs(carSpeed) < 1) return false

    const quat = new Quaternion(carRotation[0], carRotation[1], carRotation[2], carRotation[3])
    const carForward = new Vector3(0, 0, 1).applyQuaternion(quat)

    const normalX = Math.sin(finalRotation)
    const normalZ = Math.cos(finalRotation)
    const dot = carForward.x * normalX + carForward.z * normalZ

    return dot < 0
  }, [finalRotation])

  const handleCrossing = useCallback(() => {
    if (isGhost) return

    const isWrongWay = detectWrongWay()

    if (isSector) {
      crossSector(checkpointOrder, isWrongWay)
    } else {
      crossStartFinish(isWrongWay)
    }
  }, [isGhost, isSector, checkpointOrder, crossStartFinish, crossSector, detectWrongWay])

  const numSegments = Math.max(4, Math.floor(length / 2))
  const segmentWidth = length / numSegments

  const edgeColor = isSector ? '#3b82f6' : config.color

  const mesh = (
    <group position={finalPosition} rotation={[0, finalRotation, 0]}>
      <mesh position={[0, strokeHeight / 2, 0]} castShadow={!isGhost} receiveShadow={!isGhost}>
        <boxGeometry args={[strokeWidth, strokeHeight, length]} />
        <meshStandardMaterial
          color={isSector ? '#1e3a5f' : '#222222'}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>

      {Array.from({ length: numSegments }).map((_, i) => {
        const color1 = isSector ? '#3b82f6' : '#ffffff'
        const color2 = isSector ? '#ffffff' : '#000000'
        return (
          <mesh
            key={i}
            position={[0, strokeHeight + 0.01, -length / 2 + segmentWidth * i + segmentWidth / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
            castShadow={!isGhost}
          >
            <planeGeometry args={[strokeWidth - 0.05, segmentWidth - 0.02]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? color1 : color2}
              emissive={i % 2 === 0 ? color1 : color2}
              emissiveIntensity={isGhost ? 0.1 : 0.3}
              transparent={isGhost}
              opacity={isGhost ? GHOST_OPACITY : 1}
              depthWrite={!isGhost}
            />
          </mesh>
        )
      })}

      <mesh position={[0, strokeHeight / 2 + 0.2, -length / 2]} castShadow={!isGhost}>
        <boxGeometry args={[strokeWidth + 0.1, 0.4, 0.1]} />
        <meshStandardMaterial
          color={edgeColor}
          emissive={edgeColor}
          emissiveIntensity={isGhost ? 0.2 : 0.5}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>
      <mesh position={[0, strokeHeight / 2 + 0.2, length / 2]} castShadow={!isGhost}>
        <boxGeometry args={[strokeWidth + 0.1, 0.4, 0.1]} />
        <meshStandardMaterial
          color={edgeColor}
          emissive={edgeColor}
          emissiveIntensity={isGhost ? 0.2 : 0.5}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>

      {isSector && !isGhost && (
        <Text
          position={[0, 1.2, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.8}
          color='#3b82f6'
          anchorX='center'
          anchorY='middle'
          outlineWidth={0.05}
          outlineColor='#000000'
        >
          {`S${checkpointOrder}`}
        </Text>
      )}

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
