import { useMemo } from 'react'
import PreviewTrackObject from './PreviewTrackObject'
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
        if (group === null) return false
        return visible[group]
      }),
    [track, visible],
  )

  return (
    <group>
      {visibleObjects.map(obj => (
        <PreviewTrackObject key={obj.id} object={obj} />
      ))}
    </group>
  )
}
