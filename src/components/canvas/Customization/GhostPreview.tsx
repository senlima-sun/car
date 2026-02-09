import { useMemo } from 'react'
import { Vector3 } from 'three'
import { Text } from '@react-three/drei'
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
import { useEditorStore } from '../../../stores/useEditorStore'
import { isCurveMode as isCurveModeCheck, isPitRoad } from '../../../types/trackObjects'
import {
  Cone,
  Ramp,
  Checkpoint,
  Barrier,
  RoadSegment,
  CurvedRoadSegment,
  PitRoadSegment,
  CurvedPitRoadSegment,
  CurvedBarrier,
  CurbPreview,
  CurvedCurbPreview,
  PitBox,
} from '../TrackObjects'
import { PIT_ROAD_WIDTH, PIT_BOX_WIDTH } from '../../../constants/trackObjects'
import { getSnapAngles } from '../../../utils/roadSnapping'

// Snap point indicator component
function SnapPointIndicator({
  point,
  isActive,
}: {
  point: SnapPointWithDirection
  isActive: boolean
}) {
  return (
    <mesh position={[point.position[0], point.position[1] + 0.15, point.position[2]]}>
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

// Angle guide line component
function AngleGuideLine({
  startPoint,
  angle,
  length,
  isActive,
}: {
  startPoint: [number, number, number]
  angle: number
  length: number
  isActive: boolean
}) {
  // Calculate end point based on angle
  const endX = startPoint[0] + Math.sin(angle) * length
  const endZ = startPoint[2] + Math.cos(angle) * length

  // Calculate midpoint and length for the line mesh
  const midX = (startPoint[0] + endX) / 2
  const midZ = (startPoint[2] + endZ) / 2
  const midY = startPoint[1] ?? 0

  return (
    <mesh position={[midX, midY + 0.02, midZ]} rotation={[-Math.PI / 2, 0, -angle]}>
      <planeGeometry args={[0.08, length]} />
      <meshBasicMaterial
        color={isActive ? '#00ffff' : '#666666'}
        transparent
        opacity={isActive ? 0.8 : 0.25}
        depthWrite={false}
      />
    </mesh>
  )
}

// Angle guide lines radiating from start point
function AngleGuideLines({
  startPoint,
  activeAngle,
  angleIncrements,
}: {
  startPoint: [number, number, number]
  activeAngle: number | null
  angleIncrements: number[]
}) {
  const angles = useMemo(() => getSnapAngles(angleIncrements), [angleIncrements])
  const guideLength = 30 // Length of guide lines

  // Tolerance for determining if an angle is active
  const angleTolerance = 0.01

  return (
    <>
      {angles.map((angle, idx) => {
        const isActive = activeAngle !== null && Math.abs(angle - activeAngle) < angleTolerance
        return (
          <AngleGuideLine
            key={idx}
            startPoint={startPoint}
            angle={angle}
            length={guideLength}
            isActive={isActive}
          />
        )
      })}
    </>
  )
}

// Tangent direction indicator
function TangentIndicator({
  origin,
  direction,
}: {
  origin: [number, number, number]
  direction: [number, number, number]
}) {
  const arrowLength = 8
  const arrowHeadLength = 1.5

  // Calculate end point
  const endX = origin[0] + direction[0] * arrowLength
  const endZ = origin[2] + direction[2] * arrowLength

  // Calculate arrow shaft midpoint
  const shaftLength = arrowLength - arrowHeadLength
  const shaftMidX = origin[0] + direction[0] * (shaftLength / 2)
  const shaftMidZ = origin[2] + direction[2] * (shaftLength / 2)

  // Calculate angle for rotation
  const angle = Math.atan2(direction[0], direction[2])
  const originY = origin[1] ?? 0

  return (
    <group>
      {/* Arrow shaft */}
      <mesh position={[shaftMidX, originY + 0.1, shaftMidZ]} rotation={[-Math.PI / 2, 0, -angle]}>
        <planeGeometry args={[0.2, shaftLength]} />
        <meshBasicMaterial color='#ffaa00' transparent opacity={0.7} depthWrite={false} />
      </mesh>

      {/* Arrow head (triangle) */}
      <mesh position={[endX, originY + 0.1, endZ]} rotation={[-Math.PI / 2, 0, -angle]}>
        <coneGeometry args={[0.5, arrowHeadLength, 3]} />
        <meshBasicMaterial color='#ffaa00' transparent opacity={0.8} />
      </mesh>
    </group>
  )
}

function computeCurvatureRadius(
  start: [number, number, number],
  control: [number, number, number],
  end: [number, number, number],
): { radius: number; center: [number, number, number] } {
  const p0x = start[0], p0z = start[2]
  const p1x = control[0], p1z = control[2]
  const p2x = end[0], p2z = end[2]

  const t = 0.5
  const dtx = 2 * (1 - t) * (p1x - p0x) + 2 * t * (p2x - p1x)
  const dtz = 2 * (1 - t) * (p1z - p0z) + 2 * t * (p2z - p1z)
  const ddtx = 2 * (p2x - 2 * p1x + p0x)
  const ddtz = 2 * (p2z - 2 * p1z + p0z)

  const speedSq = dtx * dtx + dtz * dtz
  const speed = Math.sqrt(speedSq)
  const cross = Math.abs(dtx * ddtz - dtz * ddtx)

  if (cross < 0.001) return { radius: Infinity, center: [0, 0, 0] }

  const radius = (speed * speedSq) / cross

  const mx = (1 - t) * (1 - t) * p0x + 2 * (1 - t) * t * p1x + t * t * p2x
  const mz = (1 - t) * (1 - t) * p0z + 2 * (1 - t) * t * p1z + t * t * p2z

  const nx = -dtz / speed
  const nz = dtx / speed

  const signedCross = dtx * ddtz - dtz * ddtx
  const sign = signedCross > 0 ? 1 : -1

  const cx = mx + sign * radius * nx
  const cz = mz + sign * radius * nz

  return { radius, center: [cx, 0, cz] }
}

function CurvatureIndicator({
  start,
  control,
  end,
}: {
  start: [number, number, number]
  control: [number, number, number]
  end: [number, number, number]
}) {
  const { radius, center } = useMemo(
    () => computeCurvatureRadius(start, control, end),
    [start, control, end],
  )

  if (radius === Infinity || radius > 500) return null

  const displayRadius = Math.min(radius, 80)
  const ringSegments = 64

  const mx = (start[0] + end[0]) / 2
  const mz = (start[2] + end[2]) / 2
  const baseElev = (start[1] + end[1]) / 2
  const midY = 0.2

  return (
    <group>
      <mesh position={[center[0], baseElev + 0.05, center[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[displayRadius - 0.15, displayRadius + 0.15, ringSegments]} />
        <meshBasicMaterial
          color="#ff8800"
          transparent
          opacity={0.2}
          depthWrite={false}
          side={2}
        />
      </mesh>

      <mesh position={[center[0], baseElev + 0.06, center[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.6, 12]} />
        <meshBasicMaterial
          color="#ff8800"
          transparent
          opacity={0.5}
          side={2}
        />
      </mesh>

      <Text
        position={[mx, baseElev + midY + 1.5, mz]}
        fontSize={1.2}
        color="#ff8800"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.08}
        outlineColor="#000000"
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {`R ${radius.toFixed(1)}m`}
      </Text>
    </group>
  )
}

function ControlPointGuideLine({
  start,
  end,
}: {
  start: [number, number, number]
  end: [number, number, number]
}) {
  const midX = (start[0] + end[0]) / 2
  const midZ = (start[2] + end[2]) / 2
  const midY = (start[1] + end[1]) / 2
  const dx = end[0] - start[0]
  const dz = end[2] - start[2]
  const length = Math.sqrt(dx * dx + dz * dz)
  const angle = Math.atan2(dx, dz)

  if (length < 0.1) return null

  return (
    <mesh position={[midX, midY + 0.04, midZ]} rotation={[-Math.PI / 2, 0, -angle]}>
      <planeGeometry args={[0.1, length]} />
      <meshBasicMaterial
        color="#ffff00"
        transparent
        opacity={0.4}
        depthWrite={false}
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
  const selectedObjectType = useEditorStore(s => s.selectedObjectType)
  const previewPosition = useEditorStore(s => s.previewPosition)
  const previewRotation = useEditorStore(s => s.previewRotation)
  const dragStartPoint = useEditorStore(s => s.dragStartPoint)
  const controlPoint = useEditorStore(s => s.controlPoint)
  const placementState = useEditorStore(s => s.placementState)
  const trackMode = useEditorStore(s => s.trackMode)
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const curbDragState = useEditorStore(s => s.curbDragState)
  const curbPreviewEndT = useEditorStore(s => s.curbPreviewEndT)
  const curbPreviewEndPosition = useEditorStore(s => s.curbPreviewEndPosition)
  const partialDeleteMode = useEditorStore(s => s.partialDeleteMode)
  const partialDeleteState = useEditorStore(s => s.partialDeleteState)
  const partialDeletePreviewT = useEditorStore(s => s.partialDeletePreviewT)
  const snapSettings = useEditorStore(s => s.snapSettings)
  const connectedTangent = useEditorStore(s => s.connectedTangent)
  const snappedAngle = useEditorStore(s => s.snappedAngle)
  const symmetricCurve = useEditorStore(s => s.symmetricCurve)

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
          <mesh key={`delete-marker-${i}`} position={[pos[0], pos[1] + 0.15, pos[2]]}>
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
              partialDeleteState.startPosition[1] + 0.4,
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
          <mesh position={[endPos[0], endPos[1] + 0.35, endPos[2]]}>
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
            position={[(startPos[0] + endPos[0]) / 2, (startPos[1] + endPos[1]) / 2 + 0.08, (startPos[2] + endPos[2]) / 2]}
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
              partialDeleteHover.centerPosition[1] + 0.25,
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
              partialDeleteHover.centerPosition[1] + 0.05,
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
  const isCurveMode = isCurveModeCheck(trackMode)
  const isPit = isPitRoad(trackMode)

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

  // Helper to render snap guides (angle lines + tangent indicator)
  const renderSnapGuides = () => {
    if (!dragStartPoint || !snapSettings.angleSnap) return null

    return (
      <>
        {/* Angle guide lines */}
        <AngleGuideLines
          startPoint={dragStartPoint}
          activeAngle={snappedAngle}
          angleIncrements={snapSettings.angleIncrements}
        />
        {/* Tangent continuation indicator (when connected to an existing road) */}
        {connectedTangent && snapSettings.tangentSnap && (
          <TangentIndicator origin={dragStartPoint} direction={connectedTangent} />
        )}
      </>
    )
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
        ) : isPit ? (
          <PitRoadSegment
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
    if (placementState === 'dragging' && dragStartPoint) {
      const dx = previewPosition[0] - dragStartPoint[0]
      const dz = previewPosition[2] - dragStartPoint[2]
      const dist = Math.sqrt(dx * dx + dz * dz)

      const previewControlPoint: [number, number, number] = dist > 1
        ? [
            (dragStartPoint[0] + previewPosition[0]) / 2 + dz * 0.3,
            0,
            (dragStartPoint[2] + previewPosition[2]) / 2 - dx * 0.3,
          ]
        : previewPosition

      const previewEndPoint: [number, number, number] = previewPosition

      const showArcPreview = dist > 2

      return (
        <>
          {renderSnapIndicators()}
          {renderSnapGuides()}
          <mesh position={[dragStartPoint[0], 0.1, dragStartPoint[2]]}>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshStandardMaterial color='#00ff00' transparent opacity={0.8} />
          </mesh>
          <ControlPointGuideLine start={dragStartPoint} end={previewPosition} />
          <mesh position={[previewPosition[0], 0.1, previewPosition[2]]}>
            <sphereGeometry args={[0.4, 16, 16]} />
            <meshStandardMaterial color='#ffff00' transparent opacity={0.6} />
          </mesh>
          {showArcPreview && (
            selectedObjectType === 'barrier' ? (
              <CurvedBarrier
                position={previewPosition}
                startPoint={dragStartPoint}
                controlPoint={previewControlPoint}
                endPoint={previewEndPoint}
                isGhost
              />
            ) : isPit ? (
              <CurvedPitRoadSegment
                position={previewPosition}
                startPoint={dragStartPoint}
                controlPoint={previewControlPoint}
                endPoint={previewEndPoint}
                isGhost
              />
            ) : (
              <CurvedRoadSegment
                position={previewPosition}
                startPoint={dragStartPoint}
                controlPoint={previewControlPoint}
                endPoint={previewEndPoint}
                isGhost
              />
            )
          )}
          {!showArcPreview && (
            selectedObjectType === 'barrier' ? (
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
            )
          )}
        </>
      )
    }

    if (placementState === 'placingControlPoint' && dragStartPoint && controlPoint) {
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
          {renderSnapIndicators()}
          {renderSnapGuides()}
          <mesh position={[dragStartPoint[0], 0.1, dragStartPoint[2]]}>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshStandardMaterial color='#00ff00' transparent opacity={0.8} />
          </mesh>
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
        </>
      )
    }
  }

  // Straight mode: linear objects while dragging
  if (isLinear && !isCurveMode && placementState === 'dragging' && dragStartPoint) {
    return (
      <>
        {renderSnapIndicators()}
        {renderSnapGuides()}
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
            <mesh position={[curbEdgeHover.worldPosition[0], curbEdgeHover.worldPosition[1] + 0.1, curbEdgeHover.worldPosition[2]]}>
              <sphereGeometry args={[0.5, 16, 16]} />
              <meshStandardMaterial color='#ff6600' transparent opacity={0.8} />
            </mesh>
            {/* Edge indicator line along road edge */}
            <mesh position={[curbEdgeHover.worldPosition[0], curbEdgeHover.worldPosition[1] + 0.05, curbEdgeHover.worldPosition[2]]}>
              <ringGeometry args={[0.8, 1.0, 16]} />
              <meshBasicMaterial color='#ff6600' transparent opacity={0.6} side={2} />
            </mesh>
          </>
        )
      }
      return null
    case 'pitbox':
      if (
        placementState === 'curbDragging' &&
        curbDragState &&
        curbPreviewEndT !== null &&
        curbPreviewEndPosition
      ) {
        const parentRoad = curbDragState.road
        if (!parentRoad.startPoint || !parentRoad.endPoint) return null

        const startT = Math.min(curbDragState.startT, curbPreviewEndT)
        const endT = Math.max(curbDragState.startT, curbPreviewEndT)
        const midT = (startT + endT) / 2

        const centerPos = getRoadCenterPositionAt(parentRoad, midT)

        const dx = parentRoad.endPoint[0] - parentRoad.startPoint[0]
        const dz = parentRoad.endPoint[2] - parentRoad.startPoint[2]
        const length = Math.sqrt(dx * dx + dz * dz)
        if (length === 0) return null

        const dirX = dx / length
        const dirZ = dz / length
        const perpX = -dirZ
        const perpZ = dirX

        const halfRoadWidth = PIT_ROAD_WIDTH / 2
        const pitBoxHalfWidth = PIT_BOX_WIDTH / 2
        const edgeSign = curbDragState.edge === 'left' ? 1 : -1
        const offsetDist = halfRoadWidth + pitBoxHalfWidth

        const pitBoxPos: [number, number, number] = [
          centerPos[0] + perpX * edgeSign * offsetDist,
          centerPos[1],
          centerPos[2] + perpZ * edgeSign * offsetDist,
        ]

        const roadRotation = Math.atan2(dx, dz)

        return (
          <PitBox
            position={pitBoxPos}
            rotation={roadRotation}
            isGhost
          />
        )
      }

      if (placementState === 'selecting' && curbEdgeHover) {
        return (
          <>
            <mesh position={[curbEdgeHover.worldPosition[0], curbEdgeHover.worldPosition[1] + 0.1, curbEdgeHover.worldPosition[2]]}>
              <sphereGeometry args={[0.5, 16, 16]} />
              <meshStandardMaterial color='#ff6600' transparent opacity={0.8} />
            </mesh>
            <mesh position={[curbEdgeHover.worldPosition[0], curbEdgeHover.worldPosition[1] + 0.05, curbEdgeHover.worldPosition[2]]}>
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
