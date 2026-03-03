import { useCallback, useRef } from 'react'
import { useEditorStore } from '@/stores/useEditorStore'
import { useCustomizationStore } from '@/stores/useCustomizationStore'
import { isLinearObject, isCurveMode, isPolygonObject } from '@/types/trackObjects'
import {
  getSnapPoints,
  findNearestSnapPoint,
  findRoadAtPosition,
  findRoadEdgeAtPosition,
  findRoadSurfaceAtPosition,
} from '@/utils/roadGeometry'
import { calculateSnappedPosition } from '@/utils/roadSnapping'
import { MIN_SEGMENT_LENGTH, PIT_ROAD_WIDTH } from '@/constants/trackObjects'
import type { SnapPointWithDirection, RoadEdgeResult } from '@/types/trackObjects'

interface PointerEventHandlers {
  handleClick: (worldPos: [number, number, number]) => void
  handlePointerMove: (worldPos: [number, number, number]) => void
  handlePointerDown: (worldPos: [number, number, number], button: number) => void
  handlePointerUp: (worldPos: [number, number, number], button: number) => void
  handleDoubleClick: (worldPos: [number, number, number]) => void
  currentSnapPoint: SnapPointWithDirection | null
  currentRoadEdge: RoadEdgeResult | null
  hoveredRoadEdge: {
    roadId: string
    edge: 'left' | 'right'
    t: number
    position: [number, number, number]
  } | null
}

export function useSVGPointerEvents(): PointerEventHandlers {
  const currentSnapPointRef = useRef<SnapPointWithDirection | null>(null)
  const currentRoadEdgeRef = useRef<RoadEdgeResult | null>(null)
  const hoveredRoadEdgeRef = useRef<{
    roadId: string
    edge: 'left' | 'right'
    t: number
    position: [number, number, number]
  } | null>(null)

  const handlePointerMove = useCallback((worldPos: [number, number, number]) => {
    const editor = useEditorStore.getState()
    const { selectedObjectType, placementState, dragStartPoint, connectedTangent, snapSettings } =
      editor

    const placedObjects = useCustomizationStore.getState().placedObjects

    if (editor.partialDeleteMode) {
      if (editor.partialDeleteState) {
        const hit = findRoadSurfaceAtPosition(worldPos, placedObjects)
        if (hit && hit.roadId === editor.partialDeleteState.roadId) {
          editor.updatePartialDeletePreview(hit.t, hit.centerPosition)
        }
      }
      return
    }

    if (!selectedObjectType) return

    const snapPoints = getSnapPoints(placedObjects)

    if (selectedObjectType === 'curb' || selectedObjectType === 'pitbox') {
      if (placementState === 'curbDragging') {
        const curbState = editor.curbDragState
        if (!curbState) return
        const roads =
          selectedObjectType === 'pitbox'
            ? placedObjects.filter(o => o.type === 'road' && o.trackMode === 'pitroad')
            : placedObjects
        const roadWidth = selectedObjectType === 'pitbox' ? PIT_ROAD_WIDTH : undefined
        const hit = findRoadEdgeAtPosition(worldPos, roads, roadWidth)
        if (hit && hit.roadId === curbState.roadId && hit.edge === curbState.edge) {
          editor.updateCurbDrag(hit.t, hit.worldPosition)
        }
      } else if (placementState === 'selecting') {
        const roads =
          selectedObjectType === 'pitbox'
            ? placedObjects.filter(o => o.type === 'road' && o.trackMode === 'pitroad')
            : placedObjects
        const roadWidth = selectedObjectType === 'pitbox' ? PIT_ROAD_WIDTH : undefined
        const hit = findRoadEdgeAtPosition(worldPos, roads, roadWidth)
        hoveredRoadEdgeRef.current = hit
          ? { roadId: hit.roadId, edge: hit.edge, t: hit.t, position: hit.worldPosition }
          : null
      }
      editor.setPreviewPosition(worldPos)
      return
    }

    if (selectedObjectType === 'checkpoint') {
      const roadEdge = findRoadAtPosition(worldPos, placedObjects)
      currentRoadEdgeRef.current = roadEdge
      editor.setPreviewPosition(worldPos)
      return
    }

    if (isLinearObject(selectedObjectType)) {
      let snappedPos = worldPos

      const nearSnap = findNearestSnapPoint(worldPos, snapPoints)
      currentSnapPointRef.current = nearSnap

      if (placementState === 'selecting') {
        if (nearSnap) snappedPos = nearSnap.position
        editor.setPreviewPosition(snappedPos)
        return
      }

      if (placementState === 'dragging' || placementState === 'placingControlPoint') {
        if (nearSnap) {
          snappedPos = nearSnap.position
          editor.setEndSnapEdges({ left: nearSnap.leftEdge, right: nearSnap.rightEdge })
          editor.setEndSnapElevation(nearSnap.elevation)
          editor.setEndSnapBanking(nearSnap.banking)
          editor.setSnappedAngle(null)
        } else {
          editor.setEndSnapEdges(null)
          editor.setEndSnapElevation(null)
          editor.setEndSnapBanking(null)

          if (dragStartPoint) {
            const snapResult = calculateSnappedPosition(
              worldPos,
              dragStartPoint,
              connectedTangent,
              snapSettings,
            )
            snappedPos = snapResult.position
            editor.setSnappedAngle(snapResult.snappedAngle)
          }
        }

        editor.setPreviewPosition(snappedPos)
        return
      }
    }

    if (isPolygonObject(selectedObjectType) && placementState === 'polygonDrawing') {
      editor.setPreviewPosition(worldPos)
      return
    }

    editor.setPreviewPosition(worldPos)
  }, [])

  const handleClick = useCallback((worldPos: [number, number, number]) => {
    const editor = useEditorStore.getState()
    const {
      selectedObjectType,
      placementState,
      dragStartPoint,
      trackMode,
      partialDeleteMode,
      partialDeleteState,
    } = editor

    if (partialDeleteMode) {
      const placedObjects = useCustomizationStore.getState().placedObjects
      const hit = findRoadSurfaceAtPosition(worldPos, placedObjects)
      if (!hit) return

      if (!partialDeleteState) {
        editor.startPartialDelete(hit.roadId, hit.road, hit.t, hit.centerPosition)
      } else if (partialDeleteState.roadId === hit.roadId) {
        editor.confirmPartialDelete()
      } else {
        editor.startPartialDelete(hit.roadId, hit.road, hit.t, hit.centerPosition)
      }
      return
    }

    if (!selectedObjectType) return
    if (selectedObjectType === 'curb' || selectedObjectType === 'pitbox') return

    if (isPolygonObject(selectedObjectType) && placementState === 'polygonDrawing') {
      editor.addPolygonPoint(worldPos)
      return
    }

    if (selectedObjectType === 'checkpoint') {
      if (placementState !== 'selecting') return
      const placedObjects = useCustomizationStore.getState().placedObjects
      const roadEdge = findRoadAtPosition(worldPos, placedObjects)
      if (roadEdge) {
        editor.confirmCheckpointPlacement(roadEdge.leftEdge, roadEdge.rightEdge)
      }
      return
    }

    if (isLinearObject(selectedObjectType)) {
      const placedObjects = useCustomizationStore.getState().placedObjects
      const snapPoints = getSnapPoints(placedObjects)

      if (placementState === 'selecting') {
        let clickPos = worldPos
        const nearSnap = findNearestSnapPoint(worldPos, snapPoints)

        if (nearSnap) {
          clickPos = nearSnap.position
          editor.setStartSnapElevation(nearSnap.elevation)
          editor.setStartSnapBanking(nearSnap.banking)
          editor.setConnectedTangent(nearSnap.tangent)
          editor.startDrag(clickPos, { left: nearSnap.leftEdge, right: nearSnap.rightEdge })
        } else {
          editor.setStartSnapElevation(null)
          editor.setStartSnapBanking(null)
          editor.setConnectedTangent(null)
          editor.startDrag(clickPos)
        }
        return
      }

      if (placementState === 'dragging') {
        if (isCurveMode(trackMode)) {
          editor.setControlPoint(worldPos)
          return
        }

        if (dragStartPoint) {
          const dx = worldPos[0] - dragStartPoint[0]
          const dz = worldPos[2] - dragStartPoint[2]
          const dist = Math.sqrt(dx * dx + dz * dz)
          if (dist < MIN_SEGMENT_LENGTH) return
        }

        const nearSnap = findNearestSnapPoint(worldPos, snapPoints)
        if (nearSnap) {
          editor.setPreviewPosition(nearSnap.position)
          editor.setEndSnapEdges({ left: nearSnap.leftEdge, right: nearSnap.rightEdge })
          editor.setEndSnapElevation(nearSnap.elevation)
          editor.setEndSnapBanking(nearSnap.banking)
        } else {
          editor.setPreviewPosition(worldPos)
        }
        editor.confirmPlacement()
        return
      }

      if (placementState === 'placingControlPoint') {
        if (dragStartPoint) {
          const dx = worldPos[0] - dragStartPoint[0]
          const dz = worldPos[2] - dragStartPoint[2]
          const dist = Math.sqrt(dx * dx + dz * dz)
          if (dist < MIN_SEGMENT_LENGTH) return
        }

        const nearSnap = findNearestSnapPoint(worldPos, snapPoints)
        if (nearSnap) {
          editor.setPreviewPosition(nearSnap.position)
          editor.setEndSnapEdges({ left: nearSnap.leftEdge, right: nearSnap.rightEdge })
          editor.setEndSnapElevation(nearSnap.elevation)
          editor.setEndSnapBanking(nearSnap.banking)
        } else {
          editor.setPreviewPosition(worldPos)
        }
        editor.confirmPlacement()
        return
      }

      return
    }

    if (placementState === 'selecting') {
      editor.setPreviewPosition(worldPos)
      editor.confirmPlacement()
    }
  }, [])

  const handlePointerDown = useCallback((worldPos: [number, number, number], button: number) => {
    if (button !== 0) return

    const editor = useEditorStore.getState()
    const { selectedObjectType, placementState } = editor
    if (!selectedObjectType) return
    if (selectedObjectType !== 'curb' && selectedObjectType !== 'pitbox') return
    if (placementState !== 'selecting') return

    const placedObjects = useCustomizationStore.getState().placedObjects

    if (selectedObjectType === 'pitbox') {
      const pitRoads = placedObjects.filter(o => o.type === 'road' && o.trackMode === 'pitroad')
      const hit = findRoadEdgeAtPosition(worldPos, pitRoads, PIT_ROAD_WIDTH)
      if (hit) {
        editor.startCurbDrag(hit.roadId, hit.road, hit.edge, hit.t, hit.worldPosition)
      }
      return
    }

    const hit = findRoadEdgeAtPosition(worldPos, placedObjects)
    if (hit) {
      editor.startCurbDrag(hit.roadId, hit.road, hit.edge, hit.t, hit.worldPosition)
    }
  }, [])

  const handlePointerUp = useCallback((_worldPos: [number, number, number], button: number) => {
    if (button !== 0) return

    const editor = useEditorStore.getState()
    const { selectedObjectType, placementState } = editor
    if (!selectedObjectType) return
    if (selectedObjectType !== 'curb' && selectedObjectType !== 'pitbox') return
    if (placementState !== 'curbDragging') return

    editor.confirmCurbPlacement()
  }, [])

  const handleDoubleClick = useCallback((_worldPos: [number, number, number]) => {
    const editor = useEditorStore.getState()
    if (editor.placementState === 'polygonDrawing') {
      editor.closePolygon()
    }
  }, [])

  return {
    handleClick,
    handlePointerMove,
    handlePointerDown,
    handlePointerUp,
    handleDoubleClick,
    get currentSnapPoint() {
      return currentSnapPointRef.current
    },
    get currentRoadEdge() {
      return currentRoadEdgeRef.current
    },
    get hoveredRoadEdge() {
      return hoveredRoadEdgeRef.current
    },
  }
}
