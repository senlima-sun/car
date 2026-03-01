import { useRef, useEffect, useCallback, useState } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Mesh, Raycaster, Vector2, Plane, Vector3 } from 'three'
import {
  useCustomizationStore,
  isLinearObject,
  getSnapPoints,
  findNearestSnapPoint,
  findRoadAtPosition,
  findRoadEdgeAtPosition,
  findRoadSurfaceAtPosition,
  RoadEdgeResult,
  RoadEdgeHitResult,
  RoadSurfaceHitResult,
} from '../../../stores/useCustomizationStore'
import { isCurveMode, isPolygonObject, isWallType } from '../../../types/trackObjects'
import { useEditorStore } from '../../../stores/useEditorStore'
import { MIN_SEGMENT_LENGTH, PIT_ROAD_WIDTH } from '../../../constants/trackObjects'
import { calculateSnappedPosition } from '../../../utils/roadSnapping'
import { checkOverlap } from '../../../utils/trackConnection'
import { findBarriersOnRoad } from '../../../utils/trackValidation'
import { TRACK_WIDTH } from '../../../constants/dimensions'
import { useTerrainStore } from '../../../stores/useTerrainStore'
import GhostPreview from './GhostPreview'

export default function ObjectPlacer() {
  const groundRef = useRef<Mesh>(null)
  const { camera, gl } = useThree()

  // Track current road edge result for checkpoint preview
  const [currentRoadEdge, setCurrentRoadEdge] = useState<RoadEdgeResult | null>(null)
  // Track current road edge for curb hover preview
  const [currentCurbEdge, setCurrentCurbEdge] = useState<RoadEdgeHitResult | null>(null)
  // Track current road surface for partial delete hover preview
  const [currentPartialDeleteHover, setCurrentPartialDeleteHover] =
    useState<RoadSurfaceHitResult | null>(null)

  const selectedObjectType = useEditorStore(s => s.selectedObjectType)
  const placementState = useEditorStore(s => s.placementState)
  const trackMode = useEditorStore(s => s.trackMode)
  const dragStartPoint = useEditorStore(s => s.dragStartPoint)
  const controlPoint = useEditorStore(s => s.controlPoint)
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const curbDragState = useEditorStore(s => s.curbDragState)
  const setPreviewPosition = useEditorStore(s => s.setPreviewPosition)
  const startDrag = useEditorStore(s => s.startDrag)
  const setControlPoint = useEditorStore(s => s.setControlPoint)
  const setEndSnapEdges = useEditorStore(s => s.setEndSnapEdges)
  const confirmPlacement = useEditorStore(s => s.confirmPlacement)
  const confirmCheckpointPlacement = useEditorStore(s => s.confirmCheckpointPlacement)
  const cancelPlacement = useEditorStore(s => s.cancelPlacement)
  const rotatePreviewCW = useEditorStore(s => s.rotatePreviewCW)
  const startCurbDrag = useEditorStore(s => s.startCurbDrag)
  const updateCurbDrag = useEditorStore(s => s.updateCurbDrag)
  const confirmCurbPlacement = useEditorStore(s => s.confirmCurbPlacement)
  const cancelCurbPlacement = useEditorStore(s => s.cancelCurbPlacement)
  const partialDeleteMode = useEditorStore(s => s.partialDeleteMode)
  const partialDeleteState = useEditorStore(s => s.partialDeleteState)
  const startPartialDelete = useEditorStore(s => s.startPartialDelete)
  const updatePartialDeletePreview = useEditorStore(s => s.updatePartialDeletePreview)
  const confirmPartialDelete = useEditorStore(s => s.confirmPartialDelete)
  const cancelPartialDelete = useEditorStore(s => s.cancelPartialDelete)
  const snapSettings = useEditorStore(s => s.snapSettings)
  const connectedTangent = useEditorStore(s => s.connectedTangent)
  const setConnectedTangent = useEditorStore(s => s.setConnectedTangent)
  const setSnappedAngle = useEditorStore(s => s.setSnappedAngle)
  const undo = useEditorStore(s => s.undo)
  const redo = useEditorStore(s => s.redo)
  const copySelected = useEditorStore(s => s.copySelected)
  const pasteAtPosition = useEditorStore(s => s.pasteAtPosition)
  const previewPositionForPaste = useEditorStore(s => s.previewPosition)
  const terrainEditMode = useEditorStore(s => s.terrainEditMode)
  const elevationEditMode = useEditorStore(s => s.elevationEditMode)
  const setElevationEditMode = useEditorStore(s => s.setElevationEditMode)
  const setStartSnapElevation = useEditorStore(s => s.setStartSnapElevation)
  const setEndSnapElevation = useEditorStore(s => s.setEndSnapElevation)
  const setStartSnapBanking = useEditorStore(s => s.setStartSnapBanking)
  const setEndSnapBanking = useEditorStore(s => s.setEndSnapBanking)
  const setOverlapResult = useEditorStore(s => s.setOverlapResult)
  const addPolygonPoint = useEditorStore(s => s.addPolygonPoint)
  const cancelPolygon = useEditorStore(s => s.cancelPolygon)
  const undoLastPolygonPoint = useEditorStore(s => s.undoLastPolygonPoint)
  const closePolygon = useEditorStore(s => s.closePolygon)

  // Get snap points from existing road/barrier segments
  const snapPoints = getSnapPoints(placedObjects)

  const [barrierBlocked, setBarrierBlocked] = useState(false)

  const raycaster = useRef(new Raycaster())
  const pointer = useRef(new Vector2())
  const groundPlane = useRef(new Plane(new Vector3(0, 1, 0), 0))
  const overlapFrameCounter = useRef(0)
  const barrierCheckCounter = useRef(0)

  // Track pointer position
  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect()
      pointer.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    },
    [gl],
  )

  // Handle click for placement (not used for curbs which use pointer down/up)
  const handleClick = useCallback(
    (event: MouseEvent) => {
      if (terrainEditMode) return
      if (elevationEditMode) return
      if (!selectedObjectType) return
      if (event.button !== 0) return // Left click only
      if (selectedObjectType === 'curb' || selectedObjectType === 'pitbox') return

      if (isPolygonObject(selectedObjectType)) {
        if (event.detail >= 2) return
        raycaster.current.setFromCamera(pointer.current, camera)
        const intersectPoint = new Vector3()
        raycaster.current.ray.intersectPlane(groundPlane.current, intersectPoint)
        if (intersectPoint) {
          addPolygonPoint([intersectPoint.x, 0, intersectPoint.z])
        }
        return
      }

      // Get intersection point
      raycaster.current.setFromCamera(pointer.current, camera)
      const intersectPoint = new Vector3()
      raycaster.current.ray.intersectPlane(groundPlane.current, intersectPoint)

      if (!intersectPoint) return

      let clickPos: [number, number, number] = [intersectPoint.x, 0, intersectPoint.z]
      let snapEdges:
        | { left: [number, number, number]; right: [number, number, number] }
        | undefined = undefined

      // Apply snapping for linear objects (roads, barriers)
      let snappedSnapPoint: (typeof snapPoints)[number] | null = null
      if (isLinearObject(selectedObjectType)) {
        snappedSnapPoint = findNearestSnapPoint(clickPos, snapPoints)
        if (snappedSnapPoint) {
          clickPos = snappedSnapPoint.position
          snapEdges = { left: snappedSnapPoint.leftEdge, right: snappedSnapPoint.rightEdge }
          setConnectedTangent(snappedSnapPoint.tangent)
        } else {
          setConnectedTangent(null)
        }
      }

      if (isLinearObject(selectedObjectType)) {
        if (isCurveMode(trackMode)) {
          if (placementState === 'selecting') {
            if (snappedSnapPoint) {
              setStartSnapElevation(snappedSnapPoint.elevation)
              setStartSnapBanking(snappedSnapPoint.banking)
            } else {
              setStartSnapElevation(null)
              setStartSnapBanking(null)
            }
            startDrag(clickPos, snapEdges)
          } else if (placementState === 'dragging') {
            // Second click - set control point (no snapping for control point)
            setControlPoint([intersectPoint.x, 0, intersectPoint.z])
          } else if (placementState === 'placingControlPoint') {
            if (dragStartPoint) {
              const dx = clickPos[0] - dragStartPoint[0]
              const dz = clickPos[2] - dragStartPoint[2]
              const length = Math.sqrt(dx * dx + dz * dz)
              if (length >= MIN_SEGMENT_LENGTH) {
                if (snapEdges) {
                  setEndSnapEdges(snapEdges)
                }
                if (snappedSnapPoint) {
                  setEndSnapElevation(snappedSnapPoint.elevation)
                  setEndSnapBanking(snappedSnapPoint.banking)
                } else {
                  setEndSnapElevation(null)
                  setEndSnapBanking(null)
                }
                setPreviewPosition(clickPos)
                setTimeout(() => confirmPlacement(), 0)
              }
            }
          }
        } else {
          if (placementState === 'selecting') {
            if (snappedSnapPoint) {
              setStartSnapElevation(snappedSnapPoint.elevation)
              setStartSnapBanking(snappedSnapPoint.banking)
            } else {
              setStartSnapElevation(null)
              setStartSnapBanking(null)
            }
            startDrag(clickPos, snapEdges)
          } else if (placementState === 'dragging') {
            if (dragStartPoint) {
              const dx = clickPos[0] - dragStartPoint[0]
              const dz = clickPos[2] - dragStartPoint[2]
              const length = Math.sqrt(dx * dx + dz * dz)
              if (length >= MIN_SEGMENT_LENGTH) {
                if (snapEdges) {
                  setEndSnapEdges(snapEdges)
                }
                if (snappedSnapPoint) {
                  setEndSnapElevation(snappedSnapPoint.elevation)
                  setEndSnapBanking(snappedSnapPoint.banking)
                } else {
                  setEndSnapElevation(null)
                  setEndSnapBanking(null)
                }
                setPreviewPosition(clickPos)
                setTimeout(() => confirmPlacement(), 0)
              }
            }
          }
        }
      } else if (selectedObjectType === 'checkpoint') {
        if (placementState === 'selecting') {
          const roadEdge = findRoadAtPosition(clickPos, placedObjects)
          if (roadEdge) {
            confirmCheckpointPlacement(roadEdge.leftEdge, roadEdge.rightEdge)
          }
        }
      } else {
        // Other point objects - place immediately
        if (placementState === 'selecting') {
          confirmPlacement()
        }
      }
    },
    [
      terrainEditMode,
      elevationEditMode,
      selectedObjectType,
      placementState,
      trackMode,
      dragStartPoint,
      controlPoint,
      camera,
      snapPoints,
      placedObjects,
      startDrag,
      setControlPoint,
      setPreviewPosition,
      setEndSnapEdges,
      setStartSnapElevation,
      setEndSnapElevation,
      setStartSnapBanking,
      setEndSnapBanking,
      confirmPlacement,
      confirmCheckpointPlacement,
    ],
  )

  // Handle pointer down for curb drag start
  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      if (terrainEditMode) return
      if (selectedObjectType !== 'curb' && selectedObjectType !== 'pitbox') return
      if (event.button !== 0) return
      if (placementState !== 'selecting') return

      raycaster.current.setFromCamera(pointer.current, camera)
      const intersectPoint = new Vector3()
      raycaster.current.ray.intersectPlane(groundPlane.current, intersectPoint)

      if (!intersectPoint) return

      const clickPos: [number, number, number] = [intersectPoint.x, 0, intersectPoint.z]

      if (selectedObjectType === 'pitbox') {
        const straightPitroads = placedObjects.filter(
          o => o.type === 'road' && o.trackMode === 'pitroad',
        )
        const edgeHit = findRoadEdgeAtPosition(clickPos, straightPitroads, PIT_ROAD_WIDTH)
        if (edgeHit) {
          startCurbDrag(
            edgeHit.roadId,
            edgeHit.road,
            edgeHit.edge,
            edgeHit.t,
            edgeHit.worldPosition,
          )
        }
      } else {
        const edgeHit = findRoadEdgeAtPosition(clickPos, placedObjects)
        if (edgeHit) {
          startCurbDrag(
            edgeHit.roadId,
            edgeHit.road,
            edgeHit.edge,
            edgeHit.t,
            edgeHit.worldPosition,
          )
        }
      }
    },
    [terrainEditMode, selectedObjectType, placementState, camera, placedObjects, startCurbDrag],
  )

  // Handle pointer up for curb drag end
  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      if (terrainEditMode) return
      if (selectedObjectType !== 'curb' && selectedObjectType !== 'pitbox') return
      if (event.button !== 0) return

      if (placementState === 'curbDragging') {
        confirmCurbPlacement()
      }
    },
    [terrainEditMode, selectedObjectType, placementState, confirmCurbPlacement],
  )

  // Handle click for partial delete mode
  const handlePartialDeleteClick = useCallback(
    (event: MouseEvent) => {
      if (!partialDeleteMode) return
      if (event.button !== 0) return // Left click only

      // Get intersection point
      raycaster.current.setFromCamera(pointer.current, camera)
      const intersectPoint = new Vector3()
      raycaster.current.ray.intersectPlane(groundPlane.current, intersectPoint)

      if (!intersectPoint) return

      const clickPos: [number, number, number] = [intersectPoint.x, 0, intersectPoint.z]

      // Find road surface at click position
      const roadHit = findRoadSurfaceAtPosition(clickPos, placedObjects)

      if (!roadHit) return

      if (!partialDeleteState) {
        // First click - set start point
        startPartialDelete(roadHit.roadId, roadHit.road, roadHit.t, roadHit.centerPosition)
      } else if (roadHit.roadId === partialDeleteState.roadId) {
        // Second click on same road - confirm deletion
        confirmPartialDelete()
      } else {
        // Clicking different road - start new selection on this road
        startPartialDelete(roadHit.roadId, roadHit.road, roadHit.t, roadHit.centerPosition)
      }
    },
    [
      partialDeleteMode,
      partialDeleteState,
      camera,
      placedObjects,
      startPartialDelete,
      confirmPartialDelete,
    ],
  )

  // Handle keyboard
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') {
        event.preventDefault()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyC') {
        event.preventDefault()
        copySelected()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyV') {
        event.preventDefault()
        if (previewPositionForPaste) {
          pasteAtPosition(previewPositionForPaste)
        }
        return
      }

      switch (event.code) {
        case 'KeyR': {
          const editorState = useEditorStore.getState()
          const customStore = useCustomizationStore.getState()
          if (editorState.selectedObjectId) {
            const obj = customStore.placedObjects.find(o => o.id === editorState.selectedObjectId)
            if (obj?.type === 'checkpoint' && obj.startPoint && obj.endPoint) {
              const cx = (obj.startPoint[0] + obj.endPoint[0]) / 2
              const cz = (obj.startPoint[2] + obj.endPoint[2]) / 2
              const rotateAroundCenter = (
                p: [number, number, number],
              ): [number, number, number] => {
                const dx = p[0] - cx
                const dz = p[2] - cz
                return [cx - dz, p[1], cz + dx]
              }
              const newStart = rotateAroundCenter(obj.startPoint)
              const newEnd = rotateAroundCenter(obj.endPoint)
              const newRotation = Math.atan2(
                newEnd[0] - newStart[0],
                newEnd[2] - newStart[2],
              )
              customStore.updateObject(obj.id, {
                startPoint: newStart,
                endPoint: newEnd,
                position: [cx, 0, cz],
                rotation: newRotation,
              })
              break
            }
          }
          rotatePreviewCW()
          break
        }
        case 'KeyY':
          setElevationEditMode(!useEditorStore.getState().elevationEditMode)
          break
        case 'Escape':
          if (elevationEditMode) {
            setElevationEditMode(false)
          } else if (placementState === 'polygonDrawing') {
            cancelPolygon()
          } else if (partialDeleteMode && partialDeleteState) {
            cancelPartialDelete()
          } else if (placementState === 'curbDragging') {
            cancelCurbPlacement()
          } else {
            cancelPlacement()
          }
          break
        case 'Backspace':
          if (placementState === 'polygonDrawing') {
            undoLastPolygonPoint()
          }
          break
        case 'Enter':
          if (placementState === 'polygonDrawing') {
            closePolygon()
          }
          break
      }
    },
    [
      rotatePreviewCW,
      cancelPlacement,
      cancelCurbPlacement,
      cancelPartialDelete,
      cancelPolygon,
      undoLastPolygonPoint,
      closePolygon,
      placementState,
      partialDeleteMode,
      partialDeleteState,
      elevationEditMode,
      setElevationEditMode,
      undo,
      redo,
      copySelected,
      pasteAtPosition,
      previewPositionForPaste,
    ],
  )

  const handleDblClick = useCallback(
    (event: MouseEvent) => {
      if (placementState === 'polygonDrawing') {
        event.preventDefault()
        closePolygon()
      }
    },
    [placementState, closePolygon],
  )

  // Setup event listeners
  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('click', handleClick)
    canvas.addEventListener('click', handlePartialDeleteClick)
    canvas.addEventListener('dblclick', handleDblClick)
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('click', handleClick)
      canvas.removeEventListener('click', handlePartialDeleteClick)
      canvas.removeEventListener('dblclick', handleDblClick)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    gl,
    handlePointerMove,
    handleClick,
    handlePartialDeleteClick,
    handleDblClick,
    handlePointerDown,
    handlePointerUp,
    handleKeyDown,
  ])

  // Update preview position each frame
  useFrame(() => {
    if (terrainEditMode) return

    raycaster.current.setFromCamera(pointer.current, camera)
    const intersectPoint = new Vector3()
    raycaster.current.ray.intersectPlane(groundPlane.current, intersectPoint)

    // Handle partial delete mode preview updates
    if (partialDeleteMode && intersectPoint) {
      const hoverPos: [number, number, number] = [intersectPoint.x, 0, intersectPoint.z]
      const roadHit = findRoadSurfaceAtPosition(hoverPos, placedObjects)

      if (partialDeleteState && roadHit && roadHit.roadId === partialDeleteState.roadId) {
        // Update preview position on same road
        updatePartialDeletePreview(roadHit.t, roadHit.centerPosition)
      }

      // Update hover state for visual feedback
      setCurrentPartialDeleteHover(roadHit)
      return
    }

    if (!selectedObjectType) return

    if (intersectPoint) {
      const terrainY = !isLinearObject(selectedObjectType)
        ? useTerrainStore.getState().getHeightAt(intersectPoint.x, intersectPoint.z)
        : 0
      let previewPos: [number, number, number] = [intersectPoint.x, terrainY, intersectPoint.z]

      if (isLinearObject(selectedObjectType)) {
        if (placementState === 'selecting') {
          // Selecting start point - only endpoint snapping
          const snappedPoint = findNearestSnapPoint(previewPos, snapPoints)
          if (snappedPoint) {
            previewPos = snappedPoint.position
          }
        } else if (
          (placementState === 'dragging' || placementState === 'placingControlPoint') &&
          dragStartPoint
        ) {
          // Dragging to place end point - apply angle and tangent snapping
          // First check for endpoint snapping (highest priority)
          const snappedPoint = findNearestSnapPoint(previewPos, snapPoints)
          if (snappedPoint) {
            previewPos = snappedPoint.position
            setSnappedAngle(null) // Clear angle snap when endpoint snapping
          } else {
            // Apply angle and tangent snapping
            const snapResult = calculateSnappedPosition(
              previewPos,
              dragStartPoint,
              connectedTangent,
              snapSettings,
            )
            previewPos = snapResult.position
            setSnappedAngle(snapResult.snappedAngle)
          }
        }
      }

      if (selectedObjectType === 'checkpoint' && placementState === 'selecting') {
        const roadEdge = findRoadAtPosition(previewPos, placedObjects)
        setCurrentRoadEdge(roadEdge)
      }

      if (selectedObjectType === 'curb') {
        if (placementState === 'selecting') {
          const edgeHit = findRoadEdgeAtPosition(previewPos, placedObjects)
          setCurrentCurbEdge(edgeHit)
        } else if (placementState === 'curbDragging' && curbDragState) {
          const edgeHit = findRoadEdgeAtPosition(previewPos, placedObjects)
          if (
            edgeHit &&
            edgeHit.roadId === curbDragState.roadId &&
            edgeHit.edge === curbDragState.edge
          ) {
            updateCurbDrag(edgeHit.t, edgeHit.worldPosition)
          }
        }
      }

      if (selectedObjectType === 'pitbox') {
        const straightPitroads = placedObjects.filter(
          o => o.type === 'road' && o.trackMode === 'pitroad',
        )
        if (placementState === 'selecting') {
          const edgeHit = findRoadEdgeAtPosition(previewPos, straightPitroads, PIT_ROAD_WIDTH)
          setCurrentCurbEdge(edgeHit)
        } else if (placementState === 'curbDragging' && curbDragState) {
          const edgeHit = findRoadEdgeAtPosition(previewPos, straightPitroads, PIT_ROAD_WIDTH)
          if (
            edgeHit &&
            edgeHit.roadId === curbDragState.roadId &&
            edgeHit.edge === curbDragState.edge
          ) {
            updateCurbDrag(edgeHit.t, edgeHit.worldPosition)
          }
        }
      }

      setPreviewPosition(previewPos)

      if (
        isLinearObject(selectedObjectType) &&
        selectedObjectType === 'road' &&
        (placementState === 'dragging' || placementState === 'placingControlPoint') &&
        dragStartPoint
      ) {
        overlapFrameCounter.current++
        if (overlapFrameCounter.current % 3 === 0) {
          const result = checkOverlap(
            {
              startPoint: dragStartPoint,
              endPoint: previewPos,
              controlPoint: controlPoint ?? undefined,
            },
            placedObjects,
            TRACK_WIDTH / 2,
          )
          setOverlapResult(result.hasOverlap ? result : null)
        }
      } else {
        if (overlapFrameCounter.current > 0) {
          overlapFrameCounter.current = 0
          setOverlapResult(null)
        }
      }

      if (
        (selectedObjectType === 'barrier' || isWallType(selectedObjectType)) &&
        (placementState === 'dragging' || placementState === 'placingControlPoint') &&
        dragStartPoint
      ) {
        barrierCheckCounter.current++
        if (barrierCheckCounter.current % 3 === 0) {
          const candidateBarrier = {
            id: '_preview',
            type: 'barrier' as const,
            position: previewPos,
            rotation: 0,
            startPoint: dragStartPoint,
            endPoint: previewPos,
            controlPoint: controlPoint ?? undefined,
          }
          const roads = placedObjects.filter(o => o.type === 'road')
          const onRoad = findBarriersOnRoad([candidateBarrier], roads)
          setBarrierBlocked(onRoad.length > 0)
        }
      } else {
        if (barrierCheckCounter.current > 0) {
          barrierCheckCounter.current = 0
          setBarrierBlocked(false)
        }
      }
    }
  })

  return (
    <>
      {/* Invisible ground plane for raycasting (backup) */}
      <mesh ref={groundRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} visible={false}>
        <planeGeometry args={[2000, 2000]} />
        <meshBasicMaterial />
      </mesh>

      {/* Ghost preview of object being placed */}
      <GhostPreview
        checkpointRoadEdge={currentRoadEdge}
        curbEdgeHover={currentCurbEdge}
        partialDeleteHover={currentPartialDeleteHover}
        barrierBlocked={barrierBlocked}
      />
    </>
  )
}
