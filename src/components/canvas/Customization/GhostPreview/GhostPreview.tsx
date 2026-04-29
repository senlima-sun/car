import {
  getSnapPoints,
  useCustomizationStore,
  isLinearObject,
  type RoadEdgeHitResult,
  type RoadEdgeResult,
  type RoadSurfaceHitResult,
} from '@/stores/useCustomizationStore'
import { useEditorStore } from '@/stores/useEditorStore'
import {
  isCurveMode as isCurveModeCheck,
  isPitRoad,
  isPolygonObject,
  isWallType,
} from '@/types/trackObjects'
import { PolygonDrawingPreview } from './previews/PolygonDrawingPreview'
import { PartialDeletePreview } from './previews/PartialDeletePreview'
import { LinearSelectingPreview } from './previews/LinearSelectingPreview'
import { LinearDraggingPreview } from './previews/LinearDraggingPreview'
import { CurveDraggingPreview } from './previews/CurveDraggingPreview'
import { CurvePlacingControlPointPreview } from './previews/CurvePlacingControlPointPreview'
import { PointObjectPreview } from './previews/PointObjectPreview'
import {
  OverlapWarningLayer,
  SnapGuidesLayer,
  SnapIndicatorsLayer,
} from './previews/SharedIndicators'

interface GhostPreviewProps {
  checkpointRoadEdge?: RoadEdgeResult | null
  curbEdgeHover?: RoadEdgeHitResult | null
  partialDeleteHover?: RoadSurfaceHitResult | null
  barrierBlocked?: boolean
}

export default function GhostPreview({
  checkpointRoadEdge,
  curbEdgeHover,
  partialDeleteHover,
  barrierBlocked = false,
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
  const partialDeleteMode = useEditorStore(s => s.editorMode === 'partialDelete')
  const partialDeleteState = useEditorStore(s => s.partialDeleteState)
  const partialDeletePreviewT = useEditorStore(s => s.partialDeletePreviewT)
  const snapSettings = useEditorStore(s => s.snapSettings)
  const connectedTangent = useEditorStore(s => s.connectedTangent)
  const snappedAngle = useEditorStore(s => s.snappedAngle)
  const symmetricCurve = useEditorStore(s => s.symmetricCurve)
  const overlapResult = useEditorStore(s => s.overlapResult)
  const polygonPoints = useEditorStore(s => s.polygonPoints)

  if (
    placementState === 'polygonDrawing' &&
    selectedObjectType &&
    isPolygonObject(selectedObjectType)
  ) {
    return (
      <PolygonDrawingPreview
        points={polygonPoints}
        cursorPos={previewPosition}
        surfaceType={selectedObjectType}
      />
    )
  }

  const snapPoints = getSnapPoints(placedObjects)

  if (partialDeleteMode) {
    return (
      <PartialDeletePreview
        partialDeleteState={partialDeleteState}
        partialDeletePreviewT={partialDeletePreviewT}
        partialDeleteHover={partialDeleteHover ?? null}
      />
    )
  }

  if (!selectedObjectType || !previewPosition) return null

  const isLinear = isLinearObject(selectedObjectType)
  const isCurveMode = isCurveModeCheck(trackMode)
  const isPit = isPitRoad(trackMode)
  const isWall = selectedObjectType ? isWallType(selectedObjectType) : false

  const sharedSnapLayers = (
    <>
      {isLinear && (
        <SnapIndicatorsLayer snapPoints={snapPoints} previewPosition={previewPosition} />
      )}
      <SnapGuidesLayer
        dragStartPoint={dragStartPoint}
        snapSettings={snapSettings}
        snappedAngle={snappedAngle}
        connectedTangent={connectedTangent}
      />
      <OverlapWarningLayer
        overlapResult={overlapResult}
        dragStartPoint={dragStartPoint}
        previewPosition={previewPosition}
      />
    </>
  )

  if (isLinear && placementState === 'selecting') {
    return (
      <>
        {isLinear && (
          <SnapIndicatorsLayer snapPoints={snapPoints} previewPosition={previewPosition} />
        )}
        <LinearSelectingPreview
          selectedObjectType={selectedObjectType}
          previewPosition={previewPosition}
          previewRotation={previewRotation}
          isPit={isPit}
        />
      </>
    )
  }

  if (isLinear && isCurveMode && !isWall) {
    if (placementState === 'dragging' && dragStartPoint) {
      return (
        <>
          {sharedSnapLayers}
          <CurveDraggingPreview
            selectedObjectType={selectedObjectType}
            previewPosition={previewPosition}
            dragStartPoint={dragStartPoint}
            isPit={isPit}
            barrierBlocked={barrierBlocked}
          />
        </>
      )
    }

    if (placementState === 'placingControlPoint' && dragStartPoint && controlPoint) {
      return (
        <>
          {sharedSnapLayers}
          <CurvePlacingControlPointPreview
            selectedObjectType={selectedObjectType}
            previewPosition={previewPosition}
            dragStartPoint={dragStartPoint}
            controlPoint={controlPoint}
            symmetricCurve={symmetricCurve}
            isPit={isPit}
            barrierBlocked={barrierBlocked}
          />
        </>
      )
    }
  }

  if (isLinear && (!isCurveMode || isWall) && placementState === 'dragging' && dragStartPoint) {
    return (
      <>
        {sharedSnapLayers}
        <LinearDraggingPreview
          selectedObjectType={selectedObjectType}
          previewPosition={previewPosition}
          dragStartPoint={dragStartPoint}
          isPit={isPit}
          barrierBlocked={barrierBlocked}
        />
      </>
    )
  }

  return (
    <PointObjectPreview
      selectedObjectType={selectedObjectType}
      previewPosition={previewPosition}
      previewRotation={previewRotation}
      placementState={placementState}
      checkpointRoadEdge={checkpointRoadEdge ?? null}
      curbEdgeHover={curbEdgeHover ?? null}
      curbDragState={curbDragState}
      curbPreviewEndT={curbPreviewEndT}
      curbPreviewEndPosition={curbPreviewEndPosition}
    />
  )
}
