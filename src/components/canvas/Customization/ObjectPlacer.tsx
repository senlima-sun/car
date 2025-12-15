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
import { MIN_SEGMENT_LENGTH } from '../../../constants/trackObjects'
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

  const selectedObjectType = useCustomizationStore(s => s.selectedObjectType)
  const placementState = useCustomizationStore(s => s.placementState)
  const trackMode = useCustomizationStore(s => s.trackMode)
  const dragStartPoint = useCustomizationStore(s => s.dragStartPoint)
  const controlPoint = useCustomizationStore(s => s.controlPoint)
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const curbDragState = useCustomizationStore(s => s.curbDragState)
  const setPreviewPosition = useCustomizationStore(s => s.setPreviewPosition)
  const startDrag = useCustomizationStore(s => s.startDrag)
  const setControlPoint = useCustomizationStore(s => s.setControlPoint)
  const setEndSnapEdges = useCustomizationStore(s => s.setEndSnapEdges)
  const confirmPlacement = useCustomizationStore(s => s.confirmPlacement)
  const confirmCheckpointPlacement = useCustomizationStore(s => s.confirmCheckpointPlacement)
  const cancelPlacement = useCustomizationStore(s => s.cancelPlacement)
  const rotatePreviewCW = useCustomizationStore(s => s.rotatePreviewCW)
  // Curb placement actions
  const startCurbDrag = useCustomizationStore(s => s.startCurbDrag)
  const updateCurbDrag = useCustomizationStore(s => s.updateCurbDrag)
  const confirmCurbPlacement = useCustomizationStore(s => s.confirmCurbPlacement)
  const cancelCurbPlacement = useCustomizationStore(s => s.cancelCurbPlacement)
  // Partial delete state and actions
  const partialDeleteMode = useCustomizationStore(s => s.partialDeleteMode)
  const partialDeleteState = useCustomizationStore(s => s.partialDeleteState)
  const startPartialDelete = useCustomizationStore(s => s.startPartialDelete)
  const updatePartialDeletePreview = useCustomizationStore(s => s.updatePartialDeletePreview)
  const confirmPartialDelete = useCustomizationStore(s => s.confirmPartialDelete)
  const cancelPartialDelete = useCustomizationStore(s => s.cancelPartialDelete)

  // Get snap points from existing road/barrier segments
  const snapPoints = getSnapPoints(placedObjects)

  // Raycaster for ground intersection
  const raycaster = useRef(new Raycaster())
  const pointer = useRef(new Vector2())
  const groundPlane = useRef(new Plane(new Vector3(0, 1, 0), 0))

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
      if (!selectedObjectType) return
      if (event.button !== 0) return // Left click only
      // Curbs use pointer down/up for drag interaction
      if (selectedObjectType === 'curb') return

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
      if (isLinearObject(selectedObjectType)) {
        const snappedPoint = findNearestSnapPoint(clickPos, snapPoints)
        if (snappedPoint) {
          clickPos = snappedPoint.position
          snapEdges = { left: snappedPoint.leftEdge, right: snappedPoint.rightEdge }
        }
      }

      if (isLinearObject(selectedObjectType)) {
        if (trackMode === 'curve') {
          // Curve mode: 3-click workflow
          // 1. First click: set start point
          // 2. Second click: set control point
          // 3. Third click: set end point and confirm
          if (placementState === 'selecting') {
            // First click - set start point (snapped, with edge positions)
            startDrag(clickPos, snapEdges)
          } else if (placementState === 'dragging') {
            // Second click - set control point (no snapping for control point)
            setControlPoint([intersectPoint.x, 0, intersectPoint.z])
          } else if (placementState === 'placingControlPoint') {
            // Third click - set end point and confirm (snapped)
            if (dragStartPoint) {
              const dx = clickPos[0] - dragStartPoint[0]
              const dz = clickPos[2] - dragStartPoint[2]
              const length = Math.sqrt(dx * dx + dz * dz)
              if (length >= MIN_SEGMENT_LENGTH) {
                // Store end snap edges before confirming
                if (snapEdges) {
                  setEndSnapEdges(snapEdges)
                }
                // Update preview position to snapped position before confirming
                setPreviewPosition(clickPos)
                setTimeout(() => confirmPlacement(), 0)
              }
            }
          }
        } else {
          // Straight mode: 2-click workflow
          if (placementState === 'selecting') {
            // First click - start dragging (snapped, with edges for consistency)
            startDrag(clickPos, snapEdges)
          } else if (placementState === 'dragging') {
            // Second click - confirm if long enough (snapped)
            if (dragStartPoint) {
              const dx = clickPos[0] - dragStartPoint[0]
              const dz = clickPos[2] - dragStartPoint[2]
              const length = Math.sqrt(dx * dx + dz * dz)
              if (length >= MIN_SEGMENT_LENGTH) {
                // Update preview position to snapped position before confirming
                setPreviewPosition(clickPos)
                setTimeout(() => confirmPlacement(), 0)
              }
            }
          }
        }
      } else if (selectedObjectType === 'checkpoint') {
        // Checkpoint - place on road only
        if (placementState === 'selecting') {
          const roadEdge = findRoadAtPosition(clickPos, placedObjects)
          if (roadEdge) {
            // Place checkpoint spanning road edges
            confirmCheckpointPlacement(roadEdge.leftEdge, roadEdge.rightEdge)
          }
          // If not on road, don't place anything
        }
      } else {
        // Other point objects - place immediately
        if (placementState === 'selecting') {
          confirmPlacement()
        }
      }
    },
    [
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
      confirmPlacement,
      confirmCheckpointPlacement,
    ],
  )

  // Handle pointer down for curb drag start
  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      if (selectedObjectType !== 'curb') return
      if (event.button !== 0) return // Left button only
      if (placementState !== 'selecting') return

      // Get intersection point
      raycaster.current.setFromCamera(pointer.current, camera)
      const intersectPoint = new Vector3()
      raycaster.current.ray.intersectPlane(groundPlane.current, intersectPoint)

      if (!intersectPoint) return

      const clickPos: [number, number, number] = [intersectPoint.x, 0, intersectPoint.z]

      // Check if clicking on a road edge
      const edgeHit = findRoadEdgeAtPosition(clickPos, placedObjects)
      if (edgeHit) {
        // Start curb drag
        startCurbDrag(edgeHit.roadId, edgeHit.road, edgeHit.edge, edgeHit.t, edgeHit.worldPosition)
      }
    },
    [selectedObjectType, placementState, camera, placedObjects, startCurbDrag],
  )

  // Handle pointer up for curb drag end
  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      if (selectedObjectType !== 'curb') return
      if (event.button !== 0) return

      if (placementState === 'curbDragging') {
        // Confirm curb placement
        confirmCurbPlacement()
      }
    },
    [selectedObjectType, placementState, confirmCurbPlacement],
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
      switch (event.code) {
        case 'KeyR':
          rotatePreviewCW()
          break
        case 'Escape':
          if (partialDeleteMode && partialDeleteState) {
            cancelPartialDelete()
          } else if (placementState === 'curbDragging') {
            cancelCurbPlacement()
          } else {
            cancelPlacement()
          }
          break
      }
    },
    [
      rotatePreviewCW,
      cancelPlacement,
      cancelCurbPlacement,
      cancelPartialDelete,
      placementState,
      partialDeleteMode,
      partialDeleteState,
    ],
  )

  // Setup event listeners
  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('click', handleClick)
    canvas.addEventListener('click', handlePartialDeleteClick)
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('click', handleClick)
      canvas.removeEventListener('click', handlePartialDeleteClick)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    gl,
    handlePointerMove,
    handleClick,
    handlePartialDeleteClick,
    handlePointerDown,
    handlePointerUp,
    handleKeyDown,
  ])

  // Update preview position each frame
  useFrame(() => {
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
      let previewPos: [number, number, number] = [intersectPoint.x, 0, intersectPoint.z]

      // Apply snapping for linear objects (start point in selecting, end point in dragging/placingControlPoint)
      if (
        isLinearObject(selectedObjectType) &&
        (placementState === 'selecting' ||
          placementState === 'dragging' ||
          placementState === 'placingControlPoint')
      ) {
        const snappedPoint = findNearestSnapPoint(previewPos, snapPoints)
        if (snappedPoint) {
          previewPos = snappedPoint.position
        }
      }

      // For checkpoints, detect road and update edge preview
      if (selectedObjectType === 'checkpoint' && placementState === 'selecting') {
        const roadEdge = findRoadAtPosition(previewPos, placedObjects)
        setCurrentRoadEdge(roadEdge)
      }

      // For curbs, handle edge detection and drag updates
      if (selectedObjectType === 'curb') {
        if (placementState === 'selecting') {
          // Hovering - detect road edge for preview
          const edgeHit = findRoadEdgeAtPosition(previewPos, placedObjects)
          setCurrentCurbEdge(edgeHit)
        } else if (placementState === 'curbDragging' && curbDragState) {
          // Dragging - update curb end position on same road edge
          const edgeHit = findRoadEdgeAtPosition(previewPos, placedObjects)
          if (
            edgeHit &&
            edgeHit.roadId === curbDragState.roadId &&
            edgeHit.edge === curbDragState.edge
          ) {
            // On same road edge - update drag position
            updateCurbDrag(edgeHit.t, edgeHit.worldPosition)
          }
          // If not on same edge, keep the previous position (don't update)
        }
      }

      setPreviewPosition(previewPos)
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
      />
    </>
  )
}
