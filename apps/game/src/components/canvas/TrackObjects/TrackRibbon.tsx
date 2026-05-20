import { useCallback, useMemo } from 'react'
import { RigidBody, TrimeshCollider } from '@react-three/rapier'
import { useSurfaceStore } from '../../../stores/useSurfaceStore'
import { useTerrainStore } from '../../../stores/useTerrainStore'
import RoadSurfaceMaterial from './RoadSurfaceMaterial'
import { buildRibbonLayers } from './geometry/ribbonGeometry'
import type { TrackRibbonPoint } from '../../../types/trackObjects'

interface TrackRibbonProps {
  points: TrackRibbonPoint[]
  closed: boolean
  width: number
  isGhost?: boolean
}

export default function TrackRibbon({ points, closed, width, isGhost = false }: TrackRibbonProps) {
  const terrainGeneration = useTerrainStore(s => s.terrainGeneration)
  const ribbon = useMemo(
    () => buildRibbonLayers(points, closed, width),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, closed, width, terrainGeneration],
  )
  const enterSurface = useSurfaceStore(s => s.enterSurface)
  const exitSurface = useSurfaceStore(s => s.exitSurface)

  const enterRoad = useCallback(() => enterSurface('road'), [enterSurface])
  const exitRoad = useCallback(() => exitSurface('road'), [exitSurface])
  const enterPit = useCallback(() => enterSurface('pitroad'), [enterSurface])
  const exitPit = useCallback(() => exitSurface('pitroad'), [exitSurface])

  if (!ribbon) return null
  if (ribbon.collisionIndices.length === 0) return null

  return (
    <group>
      {!isGhost && (
        <RigidBody type='fixed' colliders={false}>
          {ribbon.mainSensorIndices.length > 0 && (
            <TrimeshCollider
              args={[ribbon.mainSensorVertices, ribbon.mainSensorIndices]}
              sensor
              onIntersectionEnter={enterRoad}
              onIntersectionExit={exitRoad}
            />
          )}
          {ribbon.pitSensorIndices && ribbon.pitSensorVertices && (
            <TrimeshCollider
              args={[ribbon.pitSensorVertices, ribbon.pitSensorIndices]}
              sensor
              onIntersectionEnter={enterPit}
              onIntersectionExit={exitPit}
            />
          )}
        </RigidBody>
      )}
      <mesh geometry={ribbon.mainGeometry} receiveShadow>
        <RoadSurfaceMaterial isGhost={isGhost} variant='road' />
      </mesh>
      {ribbon.pitGeometry && (
        <mesh geometry={ribbon.pitGeometry} receiveShadow>
          <RoadSurfaceMaterial isGhost={isGhost} variant='pitroad' />
        </mesh>
      )}
    </group>
  )
}
