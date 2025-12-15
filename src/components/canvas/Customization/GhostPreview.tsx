import { Vector3 } from 'three'
import {
  useCustomizationStore,
  isLinearObject,
  getSnapPoints,
  findNearestSnapPoint,
  getRoadEdgePositionAt,
  getRoadCenterPositionAt,
  RoadEdgeResult,
  RoadEdgeHitResult,
  RoadSurfaceHitResult,
  SnapPointWithDirection,
} from '../../../stores/useCustomizationStore'
import {
  Cone,
  Ramp,
  Checkpoint,
  Barrier,
  RoadSegment,
  CurvedRoadSegment,
  CurvedBarrier,
  CurbPreview,
  CurvedCurbPreview,
} from '../TrackObjects'

// Snap point indicator component
function SnapPointIndicator({
  point,
  isActive,
}: {
  point: SnapPointWithDirection
  isActive: boolean
}) {
  return (
    <mesh position={[point.position[0], 0.15, point.position[2]]}>
      <ringGeometry args={[0.4, 0.6, 16]} />
      <meshBasicMaterial
        color={isActive ? '#00ffff' : '#888888'}
        transparent
        opacity={isActive ? 0.9 : 0.4}
        side={2}
      />
    </mesh>
  )
}

interface GhostPreviewProps {
  checkpointRoadEdge?: RoadEdgeResult | null
  curbEdgeHover?: RoadEdgeHitResult | null
  partialDeleteHover?: RoadSurfaceHitResult | null
}

export default function GhostPreview({
  checkpointRoadEdge,
  curbEdgeHover,
  partialDeleteHover,
}: GhostPreviewProps) {
  const selectedObjectType = useCustomizationStore(s => s.selectedObjectType)
  const previewPosition = useCustomizationStore(s => s.previewPosition)
  const previewRotation = useCustomizationStore(s => s.previewRotation)
  const dragStartPoint = useCustomizationStore(s => s.dragStartPoint)
  const controlPoint = useCustomizationStore(s => s.controlPoint)
  const placementState = useCustomizationStore(s => s.placementState)
  const trackMode = useCustomizationStore(s => s.trackMode)
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const curbDragState = useCustomizationStore(s => s.curbDragState)
  const curbPreviewEndT = useCustomizationStore(s => s.curbPreviewEndT)
  const curbPreviewEndPosition = useCustomizationStore(s => s.curbPreviewEndPosition)
  // Partial delete state
  const partialDeleteMode = useCustomizationStore(s => s.partialDeleteMode)
  const partialDeleteState = useCustomizationStore(s => s.partialDeleteState)
  const partialDeletePreviewT = useCustomizationStore(s => s.partialDeletePreviewT)

  // Get snap points for visual indicators
  const snapPoints = getSnapPoints(placedObjects)
  const activeSnapPointData = previewPosition
    ? findNearestSnapPoint(previewPosition, snapPoints)
    : null

  // Render partial delete preview if in partial delete mode
  if (partialDeleteMode) {
    // After first click - show segment to be deleted
    if (partialDeleteState && partialDeletePreviewT !== null) {
      const road = partialDeleteState.road
      const startT = Math.min(partialDeleteState.startT, partialDeletePreviewT)
      const endT = Math.max(partialDeleteState.startT, partialDeletePreviewT)

      // Calculate positions for the deletion segment preview
      const startPos = getRoadCenterPositionAt(road, startT)
      const endPos = getRoadCenterPositionAt(road, endT)

      // Generate sample points along the deletion zone for visual feedback
      const numSamples = 8
      const deleteZoneMarkers = []
      for (let i = 0; i <= numSamples; i++) {
        const t = startT + (endT - startT) * (i / numSamples)
        const pos = getRoadCenterPositionAt(road, t)
        deleteZoneMarkers.push(
          <mesh key={`delete-marker-${i}`} position={[pos[0], 0.15, pos[2]]}>
            <sphereGeometry args={[0.4, 8, 8]} />
            <meshStandardMaterial color='#ff0000' transparent opacity={0.6} />
          </mesh>,
        )
      }

      return (
        <>
          {/* Start point marker (red) */}
          <mesh
            position={[
              partialDeleteState.startPosition[0],
              0.4,
              partialDeleteState.startPosition[2],
            ]}
          >
            <sphereGeometry args={[0.7, 16, 16]} />
            <meshStandardMaterial
              color='#ff0000'
              transparent
              opacity={0.9}
              emissive='#ff0000'
              emissiveIntensity={0.3}
            />
          </mesh>

          {/* End point marker (lighter red) */}
          <mesh position={[endPos[0], 0.35, endPos[2]]}>
            <sphereGeometry args={[0.6, 16, 16]} />
            <meshStandardMaterial
              color='#ff4444'
              transparent
              opacity={0.8}
              emissive='#ff4444'
              emissiveIntensity={0.2}
            />
          </mesh>

          {/* Deletion zone markers along the road */}
          {deleteZoneMarkers}

          {/* Red overlay plane on the deletion zone */}
          <mesh
            position={[(startPos[0] + endPos[0]) / 2, 0.08, (startPos[2] + endPos[2]) / 2]}
            rotation={[
              -Math.PI / 2,
              0,
              Math.atan2(endPos[0] - startPos[0], endPos[2] - startPos[2]),
            ]}
          >
            <planeGeometry
              args={[
                16,
                Math.sqrt(
                  Math.pow(endPos[0] - startPos[0], 2) + Math.pow(endPos[2] - startPos[2], 2),
                ),
              ]}
            />
            <meshBasicMaterial
              color='#ff0000'
              transparent
              opacity={0.25}
              side={2}
              depthWrite={false}
            />
          </mesh>
        </>
      )
    }

    // Before first click - show hover indicator on road
    if (partialDeleteHover) {
      return (
        <>
          {/* Hover position indicator on road surface */}
          <mesh
            position={[
              partialDeleteHover.centerPosition[0],
              0.25,
              partialDeleteHover.centerPosition[2],
            ]}
          >
            <sphereGeometry args={[0.6, 16, 16]} />
            <meshStandardMaterial
              color='#ff6600'
              transparent
              opacity={0.85}
              emissive='#ff6600'
              emissiveIntensity={0.2}
            />
          </mesh>
          {/* Ring around hover point */}
          <mesh
            position={[
              partialDeleteHover.centerPosition[0],
              0.05,
              partialDeleteHover.centerPosition[2],
            ]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[1.0, 1.3, 16]} />
            <meshBasicMaterial color='#ff6600' transparent opacity={0.6} side={2} />
          </mesh>
        </>
      )
    }

    return null
  }

  // Don't render if no object selected or no position
  if (!selectedObjectType || !previewPosition) return null

  const isLinear = isLinearObject(selectedObjectType)
  const isCurveMode = trackMode === 'curve'

  // Helper to render snap point indicators for linear objects
  const renderSnapIndicators = () => {
    if (!isLinear || snapPoints.length === 0) return null
    return snapPoints.map((point, idx) => {
      const isActive =
        activeSnapPointData &&
        point.position[0] === activeSnapPointData.position[0] &&
        point.position[2] === activeSnapPointData.position[2]
      return <SnapPointIndicator key={idx} point={point} isActive={!!isActive} />
    })
  }

  // For linear objects in 'selecting' state (before first click), show a short preview
  if (isLinear && placementState === 'selecting') {
    const defaultLength = 4
    const direction = new Vector3(0, 0, 1).applyAxisAngle(new Vector3(0, 1, 0), previewRotation)
    const halfLength = direction.multiplyScalar(defaultLength / 2)
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

    return (
      <>
        {renderSnapIndicators()}
        {selectedObjectType === 'barrier' ? (
          <Barrier
            position={previewPosition}
            rotation={previewRotation}
            startPoint={start}
            endPoint={end}
            isGhost
          />
        ) : (
          <RoadSegment
            position={previewPosition}
            rotation={previewRotation}
            startPoint={start}
            endPoint={end}
            isGhost
          />
        )}
      </>
    )
  }

  // Curve mode previews
  if (isLinear && isCurveMode) {
    // State: dragging (after first click, before control point)
    // Show straight line from start to cursor as preview
    if (placementState === 'dragging' && dragStartPoint) {
      return (
        <>
          {renderSnapIndicators()}
          {/* Start point marker */}
          <mesh position={[dragStartPoint[0], 0.1, dragStartPoint[2]]}>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshStandardMaterial color='#00ff00' transparent opacity={0.8} />
          </mesh>
          {/* Line to cursor */}
          {selectedObjectType === 'barrier' ? (
            <Barrier
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
        </>
      )
    }

    // State: placingControlPoint (after control point set, before end point)
    // Show curve preview from start through control to cursor
    if (placementState === 'placingControlPoint' && dragStartPoint && controlPoint) {
      return (
        <>
          {renderSnapIndicators()}
          {/* Start point marker */}
          <mesh position={[dragStartPoint[0], 0.1, dragStartPoint[2]]}>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshStandardMaterial color='#00ff00' transparent opacity={0.8} />
          </mesh>
          {/* Control point marker */}
          <mesh position={[controlPoint[0], 0.1, controlPoint[2]]}>
            <sphereGeometry args={[0.4, 16, 16]} />
            <meshStandardMaterial color='#ffff00' transparent opacity={0.8} />
          </mesh>
          {/* Curve preview */}
          {selectedObjectType === 'barrier' ? (
            <CurvedBarrier
              position={previewPosition}
              startPoint={dragStartPoint}
              controlPoint={controlPoint}
              endPoint={previewPosition}
              isGhost
            />
          ) : (
            <CurvedRoadSegment
              position={previewPosition}
              startPoint={dragStartPoint}
              controlPoint={controlPoint}
              endPoint={previewPosition}
              isGhost
            />
          )}
        </>
      )
    }
  }

  // Straight mode: linear objects while dragging
  if (isLinear && !isCurveMode && placementState === 'dragging' && dragStartPoint) {
    return (
      <>
        {renderSnapIndicators()}
        {/* Start point marker */}
        <mesh position={[dragStartPoint[0], 0.1, dragStartPoint[2]]}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial color='#00ff00' transparent opacity={0.8} />
        </mesh>
        {selectedObjectType === 'barrier' ? (
          <Barrier
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
      </>
    )
  }

  // Point objects
  const commonProps = {
    position: previewPosition,
    rotation: previewRotation,
    isGhost: true as const,
  }

  switch (selectedObjectType) {
    case 'cone':
      return <Cone {...commonProps} />
    case 'ramp':
      return <Ramp {...commonProps} />
    case 'checkpoint':
      // Show checkpoint spanning road edges if on a road
      if (checkpointRoadEdge) {
        return (
          <Checkpoint
            position={checkpointRoadEdge.centerPoint}
            startPoint={checkpointRoadEdge.leftEdge}
            endPoint={checkpointRoadEdge.rightEdge}
            isGhost
          />
        )
      }
      // Show nothing if not on a road (checkpoint requires road)
      return null
    case 'curb':
      // Curb dragging preview
      if (
        placementState === 'curbDragging' &&
        curbDragState &&
        curbPreviewEndT !== null &&
        curbPreviewEndPosition
      ) {
        const parentRoad = curbDragState.road
        const startT = Math.min(curbDragState.startT, curbPreviewEndT)
        const endT = Math.max(curbDragState.startT, curbPreviewEndT)

        // Use curved or straight preview based on parent road type
        if (parentRoad.trackMode === 'curve' && parentRoad.controlPoint) {
          return (
            <CurvedCurbPreview
              parentRoad={parentRoad}
              edge={curbDragState.edge}
              startT={startT}
              endT={endT}
              isGhost
            />
          )
        } else {
          // Straight road curb preview
          const startPos = getRoadEdgePositionAt(parentRoad, curbDragState.edge, startT)
          const endPos = getRoadEdgePositionAt(parentRoad, curbDragState.edge, endT)
          return (
            <CurbPreview
              startPosition={startPos}
              endPosition={endPos}
              edge={curbDragState.edge}
              isGhost
            />
          )
        }
      }

      // Curb edge hover indicator (when selecting, before drag starts)
      if (placementState === 'selecting' && curbEdgeHover) {
        return (
          <>
            {/* Edge position highlight */}
            <mesh position={[curbEdgeHover.worldPosition[0], 0.1, curbEdgeHover.worldPosition[2]]}>
              <sphereGeometry args={[0.5, 16, 16]} />
              <meshStandardMaterial color='#ff6600' transparent opacity={0.8} />
            </mesh>
            {/* Edge indicator line along road edge */}
            <mesh position={[curbEdgeHover.worldPosition[0], 0.05, curbEdgeHover.worldPosition[2]]}>
              <ringGeometry args={[0.8, 1.0, 16]} />
              <meshBasicMaterial color='#ff6600' transparent opacity={0.6} side={2} />
            </mesh>
          </>
        )
      }
      return null
    default:
      return null
  }
}
