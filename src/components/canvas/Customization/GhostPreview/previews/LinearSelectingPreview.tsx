import { Vector3 } from 'three'
import {
  Barrier,
  PitRoadSegment,
  RoadSegment,
  Wall,
  WallFence,
} from '../../../TrackObjects'

const DEFAULT_LENGTH = 4

export function LinearSelectingPreview({
  selectedObjectType,
  previewPosition,
  previewRotation,
  isPit,
}: {
  selectedObjectType: string
  previewPosition: [number, number, number]
  previewRotation: number
  isPit: boolean
}) {
  const direction = new Vector3(0, 0, 1).applyAxisAngle(new Vector3(0, 1, 0), previewRotation)
  const halfLength = direction.multiplyScalar(DEFAULT_LENGTH / 2)
  const start: [number, number, number] = [
    previewPosition[0] - halfLength.x,
    0,
    previewPosition[2] - halfLength.z,
  ]
  const end: [number, number, number] = [
    previewPosition[0] + halfLength.x,
    0,
    previewPosition[2] + halfLength.z,
  ]

  if (selectedObjectType === 'barrier') {
    return (
      <Barrier
        position={previewPosition}
        rotation={previewRotation}
        startPoint={start}
        endPoint={end}
        isGhost
      />
    )
  }
  if (selectedObjectType === 'wall') {
    return (
      <Wall
        position={previewPosition}
        rotation={previewRotation}
        startPoint={start}
        endPoint={end}
        isGhost
      />
    )
  }
  if (selectedObjectType === 'wall_fence') {
    return (
      <WallFence
        position={previewPosition}
        rotation={previewRotation}
        startPoint={start}
        endPoint={end}
        isGhost
      />
    )
  }
  if (isPit) {
    return (
      <PitRoadSegment
        position={previewPosition}
        rotation={previewRotation}
        startPoint={start}
        endPoint={end}
        isGhost
      />
    )
  }
  return (
    <RoadSegment
      position={previewPosition}
      rotation={previewRotation}
      startPoint={start}
      endPoint={end}
      isGhost
    />
  )
}
