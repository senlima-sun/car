import { useMemo, useCallback, useEffect, useRef } from 'react'
import { useCustomizationStore } from '@/stores/useCustomizationStore'
import { useEditorStore } from '@/stores/useEditorStore'
import type { PlacedObject } from '@/types/trackObjects'

import { useSVGCoordinates, worldToSVG } from './hooks/useSVGCoordinates'
import { useSVGViewport } from './hooks/useSVGViewport'
import { useSVGPointerEvents } from './hooks/useSVGPointerEvents'
import { useSVGKeyboard } from './hooks/useSVGKeyboard'
import { SVGViewport } from './SVGViewport'
import { SVGGrid } from './SVGGrid'
import { SVGRoadLayer } from './layers/SVGRoadLayer'
import { SVGCurbLayer } from './layers/SVGCurbLayer'
import { SVGBarrierLayer } from './layers/SVGBarrierLayer'
import { SVGCheckpointLayer } from './layers/SVGCheckpointLayer'
import { SVGSurfacePatchLayer } from './layers/SVGSurfacePatchLayer'
import { SVGObjectLayer } from './layers/SVGObjectLayer'
import { SVGFlowArrows } from './layers/SVGFlowArrows'
import { SVGSnapIndicators } from './layers/SVGSnapIndicators'
import { SVGGhostPreview } from './layers/SVGGhostPreview'
import { SVGValidationOverlay } from './layers/SVGValidationOverlay'
import { SVGRoadHandles } from './handles/SVGRoadHandles'
import { SVGCheckpointHandles } from './handles/SVGCheckpointHandles'
import { SVGWallHandles } from './handles/SVGWallHandles'
import { SVGTrackPathLayer } from './layers/SVGTrackPathLayer'
import { SVGTrackPathHandles } from './handles/SVGTrackPathHandles'
import { useTrackPathStore } from '@/stores/useTrackPathStore'

interface ObjectBuckets {
  roads: PlacedObject[]
  curbs: PlacedObject[]
  barriers: PlacedObject[]
  walls: PlacedObject[]
  checkpoints: PlacedObject[]
  patches: PlacedObject[]
  points: PlacedObject[]
  roadsById: Map<string, PlacedObject>
}

function bucketObjects(objects: PlacedObject[]): ObjectBuckets {
  const roads: PlacedObject[] = []
  const curbs: PlacedObject[] = []
  const barriers: PlacedObject[] = []
  const walls: PlacedObject[] = []
  const checkpoints: PlacedObject[] = []
  const patches: PlacedObject[] = []
  const points: PlacedObject[] = []
  const roadsById = new Map<string, PlacedObject>()

  for (const obj of objects) {
    switch (obj.type) {
      case 'road':
        roads.push(obj)
        roadsById.set(obj.id, obj)
        break
      case 'curb':
        curbs.push(obj)
        break
      case 'barrier':
        barriers.push(obj)
        break
      case 'wall':
      case 'wall_fence':
        walls.push(obj)
        break
      case 'checkpoint':
        checkpoints.push(obj)
        break
      case 'grass_patch':
      case 'gravel_patch':
        patches.push(obj)
        break
      case 'cone':
      case 'ramp':
      case 'pitbox':
        points.push(obj)
        break
    }
  }

  return { roads, curbs, barriers, walls, checkpoints, patches, points, roadsById }
}

export default function SVGEditor() {
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const selectedObjectId = useEditorStore(s => s.selectedObjectId)
  const multiSelectedIds = useEditorStore(s => s.multiSelectedIds)
  const selectedObjectType = useEditorStore(s => s.selectedObjectType)
  const placementState = useEditorStore(s => s.placementState)
  const trackMode = useEditorStore(s => s.trackMode)
  const previewPosition = useEditorStore(s => s.previewPosition)
  const dragStartPoint = useEditorStore(s => s.dragStartPoint)
  const controlPoint = useEditorStore(s => s.controlPoint)
  const polygonPoints = useEditorStore(s => s.polygonPoints)
  const partialDeleteMode = useEditorStore(s => s.partialDeleteMode)
  const partialDeleteState = useEditorStore(s => s.partialDeleteState)
  const partialDeletePreviewPosition = useEditorStore(s => s.partialDeletePreviewPosition)
  const curbDragState = useEditorStore(s => s.curbDragState)
  const curbPreviewEndPosition = useEditorStore(s => s.curbPreviewEndPosition)
  const deleteMode = useEditorStore(s => s.deleteMode)

  const trackPaths = useTrackPathStore(s => s.paths)
  const activePathId = useTrackPathStore(s => s.activePathId)
  const pathEditMode = useTrackPathStore(s => s.editMode)

  const { svgRef, screenToWorld } = useSVGCoordinates()
  const { viewport, getViewBox, startPan, updatePan, endPan, isPanning, fitToContent } =
    useSVGViewport(svgRef)
  const pointerEvents = useSVGPointerEvents()

  useSVGKeyboard()

  const buckets = useMemo(() => bucketObjects(placedObjects), [placedObjects])

  const didFit = useRef(false)
  useEffect(() => {
    if (didFit.current || placedObjects.length === 0) return
    didFit.current = true

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const obj of placedObjects) {
      if (obj.startPoint) {
        const [sx, sy] = worldToSVG(obj.startPoint[0], obj.startPoint[2])
        minX = Math.min(minX, sx)
        minY = Math.min(minY, sy)
        maxX = Math.max(maxX, sx)
        maxY = Math.max(maxY, sy)
      }
      if (obj.endPoint) {
        const [ex, ey] = worldToSVG(obj.endPoint[0], obj.endPoint[2])
        minX = Math.min(minX, ex)
        minY = Math.min(minY, ey)
        maxX = Math.max(maxX, ex)
        maxY = Math.max(maxY, ey)
      }
      if (obj.position) {
        const [px, py] = worldToSVG(obj.position[0], obj.position[2])
        minX = Math.min(minX, px)
        minY = Math.min(minY, py)
        maxX = Math.max(maxX, px)
        maxY = Math.max(maxY, py)
      }
      if (obj.polygonPoints) {
        for (const p of obj.polygonPoints) {
          const [px, py] = worldToSVG(p[0], p[2])
          minX = Math.min(minX, px)
          minY = Math.min(minY, py)
          maxX = Math.max(maxX, px)
          maxY = Math.max(maxY, py)
        }
      }
    }

    if (minX !== Infinity) {
      fitToContent({ minX: minX - 20, minY: minY - 20, maxX: maxX + 20, maxY: maxY + 20 })
    }
  }, [placedObjects, fitToContent])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      startPan(e)

      if (e.button === 0 && !isPanning()) {
        const world = screenToWorld(e.clientX, e.clientY)
        if (world) {
          pointerEvents.handlePointerDown(world, e.button)
        }
      }
    },
    [startPan, isPanning, screenToWorld, pointerEvents],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      updatePan(e)

      if (!isPanning()) {
        const world = screenToWorld(e.clientX, e.clientY)
        if (world) {
          pointerEvents.handlePointerMove(world)
        }
      }
    },
    [updatePan, isPanning, screenToWorld, pointerEvents],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const wasPanning = isPanning()
      endPan()

      if (!wasPanning && e.button === 0) {
        const world = screenToWorld(e.clientX, e.clientY)
        if (world) {
          pointerEvents.handlePointerUp(world, e.button)
        }
      }
    },
    [endPan, isPanning, screenToWorld, pointerEvents],
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      if (isPanning()) return

      const pathStore = useTrackPathStore.getState()
      if (pathStore.editMode === 'draw' && pathStore.activePathId) {
        const world = screenToWorld(e.clientX, e.clientY)
        if (world) {
          pathStore.addControlPoint(pathStore.activePathId, [world[0], world[2]])
        }
        return
      }

      const editor = useEditorStore.getState()

      if (editor.deleteMode || (!editor.selectedObjectType && editor.placementState === 'idle')) {
        const target = e.target as SVGElement
        const objectEl = target.closest('[data-object-id]')
        if (objectEl) {
          const objectId = objectEl.getAttribute('data-object-id')
          if (objectId) {
            if (editor.deleteMode) {
              useCustomizationStore.getState().removeObject(objectId)
              return
            }
            if (e.shiftKey) {
              editor.toggleMultiSelect(objectId)
            } else {
              editor.selectObject(objectId)
            }
            return
          }
        } else if (!editor.deleteMode) {
          editor.selectObject(null)
        }
      }

      const world = screenToWorld(e.clientX, e.clientY)
      if (world) {
        pointerEvents.handleClick(world)
      }
    },
    [isPanning, screenToWorld, pointerEvents],
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const world = screenToWorld(e.clientX, e.clientY)
      if (world) {
        pointerEvents.handleDoubleClick(world)
      }
    },
    [screenToWorld, pointerEvents],
  )

  const allBarriersAndWalls = useMemo(
    () => [...buckets.barriers, ...buckets.walls],
    [buckets.barriers, buckets.walls],
  )

  const showSnapIndicators = selectedObjectType !== null && placementState !== 'idle'

  const cursor = deleteMode
    ? 'not-allowed'
    : pathEditMode === 'draw'
      ? 'crosshair'
      : placementState === 'dragging' || placementState === 'placingControlPoint'
        ? 'crosshair'
        : selectedObjectType
          ? 'crosshair'
          : 'default'

  return (
    <div className="absolute inset-0 pointer-events-auto z-10" style={{ cursor }}>
      <SVGViewport
        ref={svgRef}
        viewBox={getViewBox()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <SVGGrid zoom={viewport.zoom} />

        <SVGSurfacePatchLayer
          patches={buckets.patches}
          selectedId={selectedObjectId}
          zoom={viewport.zoom}
        />

        <SVGRoadLayer
          roads={buckets.roads}
          selectedId={selectedObjectId}
          multiSelectedIds={multiSelectedIds}
          zoom={viewport.zoom}
        />

        <SVGCurbLayer curbs={buckets.curbs} roadsById={buckets.roadsById} />

        <SVGBarrierLayer
          barriers={allBarriersAndWalls}
          selectedId={selectedObjectId}
          zoom={viewport.zoom}
        />

        <SVGCheckpointLayer
          checkpoints={buckets.checkpoints}
          selectedId={selectedObjectId}
          zoom={viewport.zoom}
        />

        <SVGObjectLayer
          objects={buckets.points}
          selectedId={selectedObjectId}
          zoom={viewport.zoom}
        />

        <SVGFlowArrows roads={buckets.roads} zoom={viewport.zoom} />

        {showSnapIndicators && (
          <SVGSnapIndicators
            placedObjects={placedObjects}
            activeSnapPoint={pointerEvents.currentSnapPoint}
            zoom={viewport.zoom}
          />
        )}

        <SVGGhostPreview
          selectedObjectType={selectedObjectType}
          placementState={placementState}
          trackMode={trackMode}
          previewPosition={previewPosition}
          dragStartPoint={dragStartPoint}
          controlPoint={controlPoint}
          currentRoadEdge={pointerEvents.currentRoadEdge}
          polygonPoints={polygonPoints}
          partialDeleteMode={partialDeleteMode}
          partialDeleteState={partialDeleteState}
          partialDeletePreviewPosition={partialDeletePreviewPosition}
          curbDragState={curbDragState}
          curbPreviewEndPosition={curbPreviewEndPosition}
          zoom={viewport.zoom}
        />

        <SVGValidationOverlay placedObjects={placedObjects} zoom={viewport.zoom} />

        {trackPaths.length > 0 && (
          <SVGTrackPathLayer
            paths={trackPaths}
            activePathId={activePathId}
            zoom={viewport.zoom}
          />
        )}

        <SVGRoadHandles zoom={viewport.zoom} screenToWorld={screenToWorld} />
        <SVGCheckpointHandles zoom={viewport.zoom} screenToWorld={screenToWorld} />
        <SVGWallHandles zoom={viewport.zoom} screenToWorld={screenToWorld} />

        {pathEditMode !== 'none' && (
          <SVGTrackPathHandles zoom={viewport.zoom} screenToWorld={screenToWorld} />
        )}
      </SVGViewport>
    </div>
  )
}
