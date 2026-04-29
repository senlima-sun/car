import {
  Barrier,
  CurvedBarrier,
  CurvedPitRoadSegment,
  CurvedRoadSegment,
  PitRoadSegment,
  RoadSegment,
} from '../../../TrackObjects'
import { BarrierBlockedIndicator } from '../indicators/BarrierBlockedIndicator'
import { ControlPointGuideLine } from '../indicators/ControlPointGuideLine'

export function CurveDraggingPreview({
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
  const dx = previewPosition[0] - dragStartPoint[0]
  const dz = previewPosition[2] - dragStartPoint[2]
  const dist = Math.sqrt(dx * dx + dz * dz)

  const previewControlPoint: [number, number, number] =
    dist > 1
      ? [
          (dragStartPoint[0] + previewPosition[0]) / 2 + dz * 0.3,
          0,
          (dragStartPoint[2] + previewPosition[2]) / 2 - dx * 0.3,
        ]
      : previewPosition

  const showArcPreview = dist > 2

  return (
    <>
      <ControlPointGuideLine start={dragStartPoint} end={previewPosition} />
      <mesh position={[previewPosition[0], 0.1, previewPosition[2]]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial color='#ffff00' transparent opacity={0.6} />
      </mesh>
      {showArcPreview ? (
        selectedObjectType === 'barrier' ? (
          <CurvedBarrier
            position={previewPosition}
            startPoint={dragStartPoint}
            controlPoint={previewControlPoint}
            endPoint={previewPosition}
            isGhost
          />
        ) : isPit ? (
          <CurvedPitRoadSegment
            position={previewPosition}
            startPoint={dragStartPoint}
            controlPoint={previewControlPoint}
            endPoint={previewPosition}
            isGhost
          />
        ) : (
          <CurvedRoadSegment
            position={previewPosition}
            startPoint={dragStartPoint}
            controlPoint={previewControlPoint}
            endPoint={previewPosition}
            isGhost
          />
        )
      ) : selectedObjectType === 'barrier' ? (
        <Barrier
          position={previewPosition}
          startPoint={dragStartPoint}
          endPoint={previewPosition}
          isGhost
        />
      ) : isPit ? (
        <PitRoadSegment
          position={previewPosition}
          startPoint={dragStartPoint}
          endPoint={previewPosition}
          isGhost
        />
      ) : (
        <RoadSegment
          position={previewPosition}
          startPoint={dragStartPoint}
          endPoint={previewPosition}
          isGhost
        />
      )}
      {selectedObjectType === 'barrier' && barrierBlocked && (
        <BarrierBlockedIndicator startPoint={dragStartPoint} endPoint={previewPosition} />
      )}
    </>
  )
}
