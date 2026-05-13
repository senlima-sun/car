import { useMemo } from 'react'
import TrackObjectWrapper from '../components/canvas/TrackObjects/TrackObjectWrapper'
import { getLayerGroup } from '../utils/trackLayerGroup'
import { useLayerToggleStore } from './useLayerToggleStore'
import type { PresetTrack } from '../constants/tracks'

interface TrackPreviewSceneProps {
  track: PresetTrack
}

export default function TrackPreviewScene({ track }: TrackPreviewSceneProps) {
  const visible = useLayerToggleStore(s => s.visible)

  const visibleObjects = useMemo(
    () =>
      track.objects.filter(obj => {
        const group = getLayerGroup(obj)
        return group === null || visible[group]
      }),
    [track, visible],
  )

  return (
    <group>
      {visibleObjects.map(obj => (
        <TrackObjectWrapper key={obj.id} object={obj} enablePhysics={false} isGhost />
      ))}
    </group>
  )
}
