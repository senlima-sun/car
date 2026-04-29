import {
  findNearestSnapPoint,
  type SnapPointWithDirection,
} from '@/stores/useCustomizationStore'
import { SnapPointIndicator } from '../indicators/SnapPointIndicator'
import { AngleGuideLines } from '../indicators/AngleGuideLines'
import { TangentIndicator } from '../indicators/TangentIndicator'

type SnapSettings = {
  angleSnap: boolean
  tangentSnap: boolean
  angleIncrements: number[]
}

export function SnapIndicatorsLayer({
  snapPoints,
  previewPosition,
}: {
  snapPoints: SnapPointWithDirection[]
  previewPosition: [number, number, number] | null
}) {
  if (snapPoints.length === 0) return null
  const active = previewPosition ? findNearestSnapPoint(previewPosition, snapPoints) : null
  return (
    <>
      {snapPoints.map((point, idx) => {
        const isActive =
          active &&
          point.position[0] === active.position[0] &&
          point.position[2] === active.position[2]
        return <SnapPointIndicator key={idx} point={point} isActive={!!isActive} />
      })}
    </>
  )
}

export function SnapGuidesLayer({
  dragStartPoint,
  snapSettings,
  snappedAngle,
  connectedTangent,
}: {
  dragStartPoint: [number, number, number] | null
  snapSettings: SnapSettings
  snappedAngle: number | null
  connectedTangent: [number, number, number] | null
}) {
  if (!dragStartPoint || !snapSettings.angleSnap) return null
  return (
    <>
      <AngleGuideLines
        startPoint={dragStartPoint}
        activeAngle={snappedAngle}
        angleIncrements={snapSettings.angleIncrements}
      />
      {connectedTangent && snapSettings.tangentSnap && (
        <TangentIndicator origin={dragStartPoint} direction={connectedTangent} />
      )}
    </>
  )
}

type OverlapResult = {
  hasOverlap: boolean
  regions: Array<{ position: [number, number, number] }>
  overlapPercentage: number
}

export function OverlapWarningLayer({
  overlapResult,
  dragStartPoint,
  previewPosition,
}: {
  overlapResult: OverlapResult | null
  dragStartPoint: [number, number, number] | null
  previewPosition: [number, number, number] | null
}) {
  if (!overlapResult || !overlapResult.hasOverlap) return null
  return (
    <>
      {overlapResult.regions.map((region, idx) => (
        <mesh
          key={`overlap-${idx}`}
          position={[region.position[0], region.position[1] + 0.3, region.position[2]]}
        >
          <sphereGeometry args={[0.6, 8, 8]} />
          <meshStandardMaterial
            color='#ff0000'
            transparent
            opacity={0.7}
            emissive='#ff0000'
            emissiveIntensity={0.3}
          />
        </mesh>
      ))}
      {overlapResult.overlapPercentage > 0.5 && dragStartPoint && previewPosition && (
        <mesh
          position={[
            (dragStartPoint[0] + previewPosition[0]) / 2,
            1.5,
            (dragStartPoint[2] + previewPosition[2]) / 2,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[8, 2]} />
          <meshBasicMaterial color='#ff0000' transparent opacity={0.4} depthWrite={false} side={2} />
        </mesh>
      )}
    </>
  )
}
