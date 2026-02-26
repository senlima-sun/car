import { useMemo, useCallback, useEffect } from 'react'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { Vector3, Quaternion } from 'three'
import { OBJECT_CONFIGS, GHOST_OPACITY } from '../../../constants/trackObjects'
import { useLapTimeStore } from '../../../stores/useLapTimeStore'
import { useCustomizationStore } from '@/stores/useCustomizationStore'
import { useCarStore } from '../../../stores/useCarStore'
import { useTrackGraphStore } from '../../../stores/useTrackGraphStore'
import type { CheckpointType } from '../../../types/trackObjects'

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
const SURFACE_Y_OFFSET = 0.02
const STRIPE_WIDTH = 1.2

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
  const isSector = checkpointType === 'sector'

  const crossStartFinish = useLapTimeStore(state => state.crossStartFinish)
  const crossSector = useLapTimeStore(state => state.crossSector)
  const setActive = useLapTimeStore(state => state.setActive)

  const sectorCheckpointCount = useCustomizationStore(
    state =>
      state.placedObjects.filter(
        obj => obj.type === 'checkpoint' && obj.checkpointType === 'sector',
      ).length,
  )

  useEffect(() => {
    if (!isGhost) {
      setActive(true, sectorCheckpointCount)
    }
  }, [isGhost, setActive, sectorCheckpointCount])

  const { length, calculatedRotation, midpoint } = useMemo(() => {
    if (startPoint && endPoint) {
      const start = new Vector3(...startPoint)
      const end = new Vector3(...endPoint)
      const direction = end.clone().sub(start)
      const len = direction.length()
      const rot = Math.atan2(direction.x, direction.z)
      const elev = (start.y + end.y) / 2
      const mid: [number, number, number] = [
        (start.x + end.x) / 2,
        SURFACE_Y_OFFSET + elev,
        (start.z + end.z) / 2,
      ]
      return { length: len, calculatedRotation: rot, midpoint: mid }
    }
    return {
      length: config.defaultSize.width,
      calculatedRotation: rotation,
      midpoint: [position[0], SURFACE_Y_OFFSET, position[2]] as [number, number, number],
    }
  }, [startPoint, endPoint, rotation, position])

  const finalRotation = startPoint && endPoint ? calculatedRotation : rotation
  const finalPosition = midpoint

  const travelDirection = useMemo(() => {
    const objects = useCustomizationStore.getState().placedObjects
    const sf = objects.find(o => o.type === 'checkpoint' && o.checkpointType !== 'sector')
    const sectors = objects
      .filter(o => o.type === 'checkpoint' && o.checkpointType === 'sector')
      .sort((a, b) => (a.checkpointOrder ?? Infinity) - (b.checkpointOrder ?? Infinity))

    if (sf && sectors.length > 0) {
      const dx = sectors[0].position[0] - sf.position[0]
      const dz = sectors[0].position[2] - sf.position[2]
      const len = Math.sqrt(dx * dx + dz * dz)
      if (len > 0) return { x: dx / len, z: dz / len }
    }
    return null
  }, [])

  const detectWrongWay = useCallback((): boolean => {
    if (!travelDirection && !useTrackGraphStore.getState().hasFlow) return false

    const carRotation = useCarStore.getState().rotation
    const carSpeed = useCarStore.getState().speed
    if (Math.abs(carSpeed) < 1) return false

    const quat = new Quaternion(carRotation[0], carRotation[1], carRotation[2], carRotation[3])
    const carForward = new Vector3(0, 0, 1).applyQuaternion(quat)

    if (travelDirection) {
      return carForward.x * travelDirection.x + carForward.z * travelDirection.z < 0
    }

    const normalX = Math.sin(finalRotation)
    const normalZ = Math.cos(finalRotation)
    return carForward.x * normalX + carForward.z * normalZ < 0
  }, [travelDirection, finalRotation])

  const handleCrossing = useCallback(() => {
    if (isGhost) return

    const isWrongWay = detectWrongWay()

    if (isSector) {
      crossSector(checkpointOrder, isWrongWay)
    } else {
      crossStartFinish(isWrongWay)
    }
  }, [isGhost, isSector, checkpointOrder, crossStartFinish, crossSector, detectWrongWay])

  const mesh = (
    <group position={finalPosition} rotation={[0, finalRotation, 0]}>
      {isSector ? (
        <SectorLine length={length} isGhost={isGhost} />
      ) : (
        <CheckeredStripe length={length} isGhost={isGhost} />
      )}
    </group>
  )

  if (isGhost) {
    return mesh
  }

  return (
    <group>
      <RigidBody
        type='fixed'
        position={[finalPosition[0], finalPosition[1] + 0.75, finalPosition[2]]}
        rotation={[0, finalRotation, 0]}
        sensor
      >
        <CuboidCollider args={[4, 2, length / 2 + 1]} sensor onIntersectionEnter={handleCrossing} />
      </RigidBody>
      {mesh}
    </group>
  )
}

function CheckeredStripe({ length, isGhost }: { length: number; isGhost: boolean }) {
  const cellSize = STRIPE_WIDTH / 2
  const cols = 2
  const rows = Math.max(2, Math.round(length / cellSize))
  const actualCellDepth = length / rows

  return (
    <group>
      {Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: cols }).map((_, col) => {
          const isWhite = (row + col) % 2 === 0
          const x = -STRIPE_WIDTH / 2 + cellSize * col + cellSize / 2
          const z = -length / 2 + actualCellDepth * row + actualCellDepth / 2
          return (
            <mesh
              key={`${row}-${col}`}
              position={[x, 0, z]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[cellSize, actualCellDepth]} />
              <meshStandardMaterial
                color={isWhite ? '#ffffff' : '#111111'}
                transparent={isGhost}
                opacity={isGhost ? GHOST_OPACITY : 1}
                depthWrite={!isGhost}
                polygonOffset
                polygonOffsetFactor={-1}
                polygonOffsetUnits={-1}
              />
            </mesh>
          )
        }),
      )}
    </group>
  )
}

function SectorLine({ length, isGhost }: { length: number; isGhost: boolean }) {
  const lineWidth = 0.6
  const cellSize = lineWidth / 2
  const cols = 2
  const rows = Math.max(2, Math.round(length / cellSize))
  const actualCellDepth = length / rows

  return (
    <group>
      {Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: cols }).map((_, col) => {
          const isWhite = (row + col) % 2 === 0
          const x = -lineWidth / 2 + cellSize * col + cellSize / 2
          const z = -length / 2 + actualCellDepth * row + actualCellDepth / 2
          return (
            <mesh
              key={`${row}-${col}`}
              position={[x, 0, z]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[cellSize, actualCellDepth]} />
              <meshStandardMaterial
                color={isWhite ? '#ffffff' : '#111111'}
                transparent={isGhost}
                opacity={isGhost ? GHOST_OPACITY : 1}
                depthWrite={!isGhost}
                polygonOffset
                polygonOffsetFactor={-1}
                polygonOffsetUnits={-1}
              />
            </mesh>
          )
        }),
      )}
    </group>
  )
}
