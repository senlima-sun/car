import {
  Barrier,
  PitRoadSegment,
  RoadSegment,
  Wall,
  WallFence,
} from '../../../TrackObjects'
import { BarrierBlockedIndicator } from '../indicators/BarrierBlockedIndicator'

export function LinearDraggingPreview({
  selectedObjectType,
  previewPosition,
  dragStartPoint,
  isPit,
  barrierBlocked,
}: {
  selectedObjectType: string
  previewPosition: [number, number, number]
  dragStartPoint: [number, number, number]
  isPit: boolean
  barrierBlocked: boolean
}) {
  if (selectedObjectType === 'barrier') {
    return (
      <>
        <Barrier
          position={previewPosition}
          startPoint={dragStartPoint}
          endPoint={previewPosition}
          isGhost
        />
        {barrierBlocked && (
          <BarrierBlockedIndicator startPoint={dragStartPoint} endPoint={previewPosition} />
        )}
      </>
    )
  }
  if (selectedObjectType === 'wall') {
    return (
      <>
        <Wall
          position={previewPosition}
          startPoint={dragStartPoint}
          endPoint={previewPosition}
          isGhost
        />
        {barrierBlocked && (
          <BarrierBlockedIndicator startPoint={dragStartPoint} endPoint={previewPosition} />
        )}
      </>
    )
  }
  if (selectedObjectType === 'wall_fence') {
    return (
      <>
        <WallFence
          position={previewPosition}
          startPoint={dragStartPoint}
          endPoint={previewPosition}
          isGhost
        />
        {barrierBlocked && (
          <BarrierBlockedIndicator startPoint={dragStartPoint} endPoint={previewPosition} />
        )}
      </>
    )
  }
  if (isPit) {
    return (
      <PitRoadSegment
        position={previewPosition}
        startPoint={dragStartPoint}
        endPoint={previewPosition}
        isGhost
      />
    )
  }
  return (
    <RoadSegment
      position={previewPosition}
      startPoint={dragStartPoint}
      endPoint={previewPosition}
      isGhost
    />
  )
}
