import { useCallback, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { RigidBody, TrimeshCollider } from '@react-three/rapier'
import { useSurfaceStore } from '../../../stores/useSurfaceStore'
import { TRACK_LAYER_POLYGON_OFFSETS } from '../../../constants/trackLayers'
import { buildRibbon } from './TrackRibbon'
import type { TrackRibbonPoint } from '../../../types/trackObjects'

interface PaintedAreaProps {
  points: TrackRibbonPoint[]
  closed: boolean
  width: number
  edgeSide?: 'left' | 'right'
  isGhost?: boolean
}

const PAINTED_COLOR = '#a8d89c'

export default function PaintedArea({ points, closed, width, isGhost = false }: PaintedAreaProps) {
  const ribbon = useMemo(() => buildRibbon(points, closed, width), [points, closed, width])

  const enterSurface = useSurfaceStore(s => s.enterSurface)
  const exitSurface = useSurfaceStore(s => s.exitSurface)

  const handleEnter = useCallback(() => {
    if (isGhost) return
    enterSurface('painted_area')
  }, [isGhost, enterSurface])

  const handleExit = useCallback(() => {
    if (isGhost) return
    exitSurface('painted_area')
  }, [isGhost, exitSurface])

  useEffect(() => {
    return () => {
      ribbon?.mainGeometry.dispose()
      ribbon?.pitGeometry?.dispose()
      ribbon?.leftEdgeGeometry?.dispose()
      ribbon?.rightEdgeGeometry?.dispose()
    }
  }, [ribbon])

  if (!ribbon) return null
  if (ribbon.mainSensorIndices.length === 0) return null

  return (
    <group>
      <mesh geometry={ribbon.mainGeometry} receiveShadow>
        <meshStandardMaterial
          color={PAINTED_COLOR}
          roughness={0.7}
          metalness={0.0}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={TRACK_LAYER_POLYGON_OFFSETS.PAINTED_AREA.factor}
          polygonOffsetUnits={TRACK_LAYER_POLYGON_OFFSETS.PAINTED_AREA.units}
        />
      </mesh>
      {!isGhost && (
        <RigidBody type='fixed' colliders={false}>
          <TrimeshCollider
            args={[ribbon.mainSensorVertices, ribbon.mainSensorIndices]}
            sensor
            onIntersectionEnter={handleEnter}
            onIntersectionExit={handleExit}
          />
        </RigidBody>
      )}
    </group>
  )
}
