import {
  CurvedBarrier,
  CurvedPitRoadSegment,
  CurvedRoadSegment,
} from '@/components/canvas/TrackObjects'
import type { ObjectType } from '@/types/trackObjects'
import { BarrierBlockedIndicator } from '../indicators/BarrierBlockedIndicator'
import { ControlPointGuideLine } from '../indicators/ControlPointGuideLine'
import { CurvatureIndicator } from '../indicators/CurvatureIndicator'

export function CurvePlacingControlPointPreview({
  selectedObjectType,
  previewPosition,
  dragStartPoint,
  controlPoint,
  symmetricCurve,
  isPit,
  barrierBlocked,
}: {
  selectedObjectType: ObjectType
  previewPosition: [number, number, number]
  dragStartPoint: [number, number, number]
  controlPoint: [number, number, number]
  symmetricCurve: boolean
  isPit: boolean
  barrierBlocked: boolean
}) {
  const effectiveControlPoint: [number, number, number] = symmetricCurve
    ? (() => {
        const mx = (dragStartPoint[0] + previewPosition[0]) / 2
        const mz = (dragStartPoint[2] + previewPosition[2]) / 2
        const dx = previewPosition[0] - dragStartPoint[0]
        const dz = previewPosition[2] - dragStartPoint[2]
        const len = Math.sqrt(dx * dx + dz * dz)
        if (len < 0.01) return controlPoint
        const nx = -dz / len
        const nz = dx / len
        const vx = controlPoint[0] - mx
        const vz = controlPoint[2] - mz
        const proj = vx * nx + vz * nz
        return [mx + proj * nx, 0, mz + proj * nz]
      })()
    : controlPoint

  return (
    <>
      <mesh position={[effectiveControlPoint[0], 0.1, effectiveControlPoint[2]]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial color='#ffff00' transparent opacity={0.8} />
      </mesh>
      <ControlPointGuideLine start={dragStartPoint} end={effectiveControlPoint} />
      <ControlPointGuideLine start={effectiveControlPoint} end={previewPosition} />
      {selectedObjectType === 'barrier' ? (
        <CurvedBarrier
          position={previewPosition}
          startPoint={dragStartPoint}
          controlPoint={effectiveControlPoint}
          endPoint={previewPosition}
          isGhost
        />
      ) : isPit ? (
        <CurvedPitRoadSegment
          position={previewPosition}
          startPoint={dragStartPoint}
          controlPoint={effectiveControlPoint}
          endPoint={previewPosition}
          isGhost
        />
      ) : (
        <CurvedRoadSegment
          position={previewPosition}
          startPoint={dragStartPoint}
          controlPoint={effectiveControlPoint}
          endPoint={previewPosition}
          isGhost
        />
      )}
      <CurvatureIndicator
        start={dragStartPoint}
        control={effectiveControlPoint}
        end={previewPosition}
      />
      {selectedObjectType === 'barrier' && barrierBlocked && (
        <BarrierBlockedIndicator startPoint={dragStartPoint} endPoint={previewPosition} />
      )}
    </>
  )
}
