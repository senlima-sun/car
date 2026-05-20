import { useMemo, useCallback, useEffect } from 'react'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { Vector3, Quaternion } from 'three'
import { Billboard, Text } from '@react-three/drei'
import { OBJECT_CONFIGS, GHOST_OPACITY, getSectorColor } from '../../../constants/trackObjects'
import { useLapTimeStore } from '../../../stores/useLapTimeStore'
import { useCustomizationStore } from '@/stores/useCustomizationStore'
import { useCarStore } from '../../../stores/useCarStore'
import { useTrackGraphStore } from '../../../stores/useTrackGraphStore'
import { useTerrainStore } from '../../../stores/useTerrainStore'
import type { CheckpointType } from '../../../types/trackObjects'
import StartLightsGantry from './StartLightsGantry'

interface CheckpointProps {
  position: [number, number, number]
  rotation?: number
  startPoint?: [number, number, number]
  endPoint?: [number, number, number]
  isGhost?: boolean
  checkpointId?: string
  checkpointType?: CheckpointType
  checkpointOrder?: number
  flowDirection?: 'forward' | 'backward' | null
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
  flowDirection = null,
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
  // sample the stamped terrain so the visual + sensor sit
  // ON the ribbon, not at world y=0. Preset checkpoints arrive with y=0
  // from editorTrackSource; without this, sensor extends [y-1, y+1.75]
  // around 0 while the car drives at stamped y∈[20, 80] → no triggers.
  const terrainY = useTerrainStore(s => s.getHeightAt(midpoint[0], midpoint[2]))
  const finalPosition: [number, number, number] = [midpoint[0], midpoint[1] + terrainY, midpoint[2]]

  const travelDirection = useMemo(() => {
    if (startPoint && endPoint && flowDirection) {
      const dx = endPoint[0] - startPoint[0]
      const dz = endPoint[2] - startPoint[2]
      const perpX = -dz
      const perpZ = dx
      const len = Math.sqrt(perpX * perpX + perpZ * perpZ)
      if (len === 0) return null
      const sign = flowDirection === 'forward' ? 1 : -1
      return { x: (perpX / len) * sign, z: (perpZ / len) * sign }
    }

    const objects = useCustomizationStore.getState().placedObjects
    const sf = objects.find(o => o.type === 'checkpoint' && o.checkpointType !== 'sector')
    const sectors = objects
      .filter(o => o.type === 'checkpoint' && o.checkpointType === 'sector')
      .sort((a, b) => (a.checkpointOrder ?? Infinity) - (b.checkpointOrder ?? Infinity))

    if (!sf?.startPoint || !sf?.endPoint || sectors.length === 0) return null

    const dx = sf.endPoint[0] - sf.startPoint[0]
    const dz = sf.endPoint[2] - sf.startPoint[2]
    const perpX = -dz
    const perpZ = dx
    const len = Math.sqrt(perpX * perpX + perpZ * perpZ)
    if (len === 0) return null

    const normX = perpX / len
    const normZ = perpZ / len
    const toSectorX = sectors[0].position[0] - sf.position[0]
    const toSectorZ = sectors[0].position[2] - sf.position[2]
    const dot = normX * toSectorX + normZ * toSectorZ
    const sign = dot >= 0 ? 1 : -1
    return { x: normX * sign, z: normZ * sign }
  }, [startPoint, endPoint, flowDirection])

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
        <>
          <SectorLine length={length} order={checkpointOrder} isGhost={isGhost} />
          <SectorMarkers length={length} order={checkpointOrder} isGhost={isGhost} />
        </>
      ) : (
        <>
          <CheckeredStripe length={length} isGhost={isGhost} />
          <StartFinishPylons length={length} isGhost={isGhost} />
          {flowDirection && <RaceDirectionMarker flowDirection={flowDirection} isGhost={isGhost} />}
          {!isGhost && <StartLightsGantry length={length} />}
        </>
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
            <mesh key={`${row}-${col}`} position={[x, 0, z]} rotation={[-Math.PI / 2, 0, 0]}>
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

function RaceDirectionMarker({
  flowDirection,
  isGhost,
}: {
  flowDirection: 'forward' | 'backward'
  isGhost: boolean
}) {
  const color = '#ffe55c'
  const sign = flowDirection === 'forward' ? 1 : -1
  const lineLength = 30
  const lineWidth = 0.4
  const headSize = 1.6

  return (
    <group position={[0, 0.04, 0]}>
      <mesh position={[0, 0, (sign * lineLength) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[lineWidth, lineLength]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isGhost ? GHOST_OPACITY * 0.6 : 0.78}
          depthWrite={false}
        />
      </mesh>
      <mesh
        position={[0, 0.01, sign * lineLength]}
        rotation={[-Math.PI / 2, 0, sign > 0 ? 0 : Math.PI]}
      >
        <coneGeometry args={[headSize * 0.55, headSize, 3]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isGhost ? GHOST_OPACITY * 0.7 : 0.92}
          depthWrite={false}
        />
      </mesh>
      <Billboard position={[0, 3.0, sign * (lineLength * 0.55)]}>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[4.6, 1.6]} />
          <meshBasicMaterial
            color='#0a0a12'
            transparent
            opacity={isGhost ? GHOST_OPACITY * 0.7 : 0.88}
          />
        </mesh>
        <Text
          fontSize={1.0}
          color={color}
          anchorX='center'
          anchorY='middle'
          outlineWidth={0.06}
          outlineColor='#000000'
        >
          {flowDirection === 'forward' ? 'RACE →' : '← RACE'}
        </Text>
      </Billboard>
    </group>
  )
}

function StartFinishPylons({ length, isGhost }: { length: number; isGhost: boolean }) {
  const pylonHeight = 4.2
  const pylonRadius = 0.16
  const halfLen = length / 2 + 0.6
  const color = '#ffffff'

  return (
    <group>
      {[halfLen, -halfLen].map(z => (
        <group key={z} position={[0, 0, z]}>
          <mesh position={[0, pylonHeight / 2, 0]} castShadow={!isGhost}>
            <cylinderGeometry args={[pylonRadius, pylonRadius * 1.3, pylonHeight, 10]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.3}
              transparent={isGhost}
              opacity={isGhost ? GHOST_OPACITY : 1}
            />
          </mesh>
          <mesh position={[0, pylonHeight + 0.25, 0]}>
            <sphereGeometry args={[0.28, 14, 10]} />
            <meshStandardMaterial
              color='#ff2233'
              emissive='#ff2233'
              emissiveIntensity={1.6}
              transparent={isGhost}
              opacity={isGhost ? GHOST_OPACITY : 1}
            />
          </mesh>
        </group>
      ))}
      <Billboard position={[0, pylonHeight + 1.8, 0]}>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[5.2, 2.0]} />
          <meshBasicMaterial
            color='#0a0a12'
            transparent
            opacity={isGhost ? GHOST_OPACITY * 0.7 : 0.92}
          />
        </mesh>
        <Text
          fontSize={1.35}
          color='#ffffff'
          anchorX='center'
          anchorY='middle'
          outlineWidth={0.08}
          outlineColor='#000000'
        >
          START / FINISH
        </Text>
      </Billboard>
    </group>
  )
}

function SectorMarkers({
  length,
  order,
  isGhost,
}: {
  length: number
  order: number
  isGhost: boolean
}) {
  const color = getSectorColor(order)
  const postHeight = 1.5
  const postRadius = 0.06
  const halfLen = length / 2 + 0.3
  const label = `S${order || ''}`

  return (
    <group>
      {[halfLen, -halfLen].map(z => (
        <mesh key={z} position={[0, postHeight / 2, z]} castShadow={!isGhost}>
          <cylinderGeometry args={[postRadius, postRadius, postHeight, 6]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.5}
            transparent={isGhost}
            opacity={isGhost ? GHOST_OPACITY * 0.9 : 0.9}
          />
        </mesh>
      ))}
      <mesh position={[0, postHeight + 0.05, halfLen]}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.0}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
        />
      </mesh>
      <Billboard position={[0, postHeight + 1.1, halfLen]}>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[2.8, 1.5]} />
          <meshBasicMaterial
            color='#0a0a12'
            transparent
            opacity={isGhost ? GHOST_OPACITY * 0.7 : 0.88}
          />
        </mesh>
        <Text
          fontSize={1.0}
          color={color}
          anchorX='center'
          anchorY='middle'
          outlineWidth={0.06}
          outlineColor='#000000'
        >
          {label}
        </Text>
      </Billboard>
    </group>
  )
}

function SectorLine({
  length,
  order,
  isGhost,
}: {
  length: number
  order: number
  isGhost: boolean
}) {
  const color = getSectorColor(order)
  const lineWidth = 0.35
  const dashLen = 1.2
  const gapLen = 0.8
  const stride = dashLen + gapLen
  const dashCount = Math.max(1, Math.floor(length / stride))
  const totalDashSpan = dashCount * stride - gapLen
  const startZ = -totalDashSpan / 2

  return (
    <group>
      {Array.from({ length: dashCount }).map((_, i) => {
        const z = startZ + i * stride + dashLen / 2
        return (
          <mesh key={i} position={[0, 0, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[lineWidth, dashLen]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.4}
              transparent
              opacity={isGhost ? GHOST_OPACITY * 0.8 : 0.85}
              depthWrite={!isGhost}
              polygonOffset
              polygonOffsetFactor={-1}
              polygonOffsetUnits={-1}
            />
          </mesh>
        )
      })}
    </group>
  )
}
