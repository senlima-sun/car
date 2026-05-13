import { useCallback, useMemo } from 'react'
import { RigidBody, TrimeshCollider } from '@react-three/rapier'
import { TRACK_COLLISION_GROUPS } from '../../../constants/dimensions'
import { useSurfaceStore } from '../../../stores/useSurfaceStore'
import RoadSurfaceMaterial from './RoadSurfaceMaterial'
import { EdgeLines } from './components/EdgeLines'
import { buildRibbonLayers } from './geometry/ribbonGeometry'
import type { TrackRibbonPoint } from '../../../types/trackObjects'

interface TrackRibbonProps {
  points: TrackRibbonPoint[]
  closed: boolean
  width: number
  isGhost?: boolean
}

/** @deprecated Use buildRibbonLayers from ./geometry/ribbonGeometry directly. Will be removed at end of Wave 3. */
export const buildRibbon = buildRibbonLayers

export default function TrackRibbon({ points, closed, width, isGhost = false }: TrackRibbonProps) {
  const ribbon = useMemo(() => buildRibbonLayers(points, closed, width), [points, closed, width])
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
      <RigidBody type='fixed' colliders={false} friction={1.0}>
        <TrimeshCollider
          args={[ribbon.collisionVertices, ribbon.collisionIndices]}
          collisionGroups={TRACK_COLLISION_GROUPS}
        />
      </RigidBody>
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
      <EdgeLines
        leftGeometry={ribbon.leftEdgeGeometry}
        rightGeometry={ribbon.rightEdgeGeometry}
        isGhost={isGhost}
      />
      {ribbon.pitGeometry && (
        <mesh geometry={ribbon.pitGeometry} receiveShadow>
          <RoadSurfaceMaterial isGhost={isGhost} variant='pitroad' />
        </mesh>
      )}
    </group>
  )
}
