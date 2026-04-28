import { useMemo, useState, useCallback, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useElevationEditStore } from '../../../stores/useElevationEditStore'
import {
  getElevationControlPoints,
  getConnectedEndpoints,
  findRoadPath,
  computeRoadGrade,
} from '../../../utils/elevationHandles'
import { editorCommandStack } from '../../../utils/commandStack'
import type { ElevationControlPoint } from '../../../types/trackObjects'
import type { EditorCommand } from '../../../types/editor'

function ElevationHandle({
  point,
  isDragging,
  isSlopeAnchor,
  isSmoothSelected,
  grade,
  onClick,
}: {
  point: ElevationControlPoint
  isDragging: boolean
  isSlopeAnchor: boolean
  isSmoothSelected: boolean
  grade: number
  onClick: (point: ElevationControlPoint, screenY: number, shiftKey: boolean) => void
}) {
  const [hovered, setHovered] = useState(false)
  const elevation = point.elevation

  let color = '#3b82f6'
  if (isDragging) color = '#22c55e'
  else if (isSlopeAnchor) color = '#f59e0b'
  else if (isSmoothSelected) color = '#a855f7'
  else if (hovered) color = '#06b6d4'

  const radius = isDragging ? 0.7 : hovered ? 0.6 : 0.5

  const gradeWarning = grade > 15 ? '#ef4444' : grade > 10 ? '#f59e0b' : null

  return (
    <group position={[point.worldPosition[0], 0, point.worldPosition[2]]}>
      {elevation > 0.01 && (
        <mesh position={[0, elevation / 2, 0]}>
          <cylinderGeometry args={[0.08, 0.08, elevation, 8]} />
          <meshBasicMaterial color='#666' transparent opacity={0.5} />
        </mesh>
      )}

      <mesh
        position={[0, elevation, 0]}
        onPointerOver={e => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
        onPointerDown={e => {
          e.stopPropagation()
          onClick(point, e.clientY, e.shiftKey)
        }}
      >
        <sphereGeometry args={[radius, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>

      <Billboard position={[0, elevation + 1.2, 0]}>
        <Text
          fontSize={0.6}
          color='#fff'
          anchorX='center'
          anchorY='middle'
          outlineWidth={0.05}
          outlineColor='#000'
        >
          {elevation.toFixed(1)}m
        </Text>
      </Billboard>

      {gradeWarning && (
        <Billboard position={[0, elevation + 2.0, 0]}>
          <Text
            fontSize={0.45}
            color={gradeWarning}
            anchorX='center'
            anchorY='middle'
            outlineWidth={0.04}
            outlineColor='#000'
          >
            {grade.toFixed(1)}%
          </Text>
        </Billboard>
      )}
    </group>
  )
}

export default function ElevationHandles() {
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const elevationDragState = useElevationEditStore(s => s.elevationDragState)
  const startElevationDrag = useElevationEditStore(s => s.startElevationDrag)
  const updateElevationDrag = useElevationEditStore(s => s.updateElevationDrag)
  const confirmElevationDrag = useElevationEditStore(s => s.confirmElevationDrag)
  const cancelElevationDrag = useElevationEditStore(s => s.cancelElevationDrag)
  const elevationTool = useElevationEditStore(s => s.elevationTool)
  const targetLevelHeight = useElevationEditStore(s => s.targetLevelHeight)
  const slopeAnchor = useElevationEditStore(s => s.slopeAnchor)
  const setSlopeAnchor = useElevationEditStore(s => s.setSlopeAnchor)
  const smoothSelectedRoadIds = useElevationEditStore(s => s.smoothSelectedRoadIds)
  const toggleSmoothRoadSelection = useElevationEditStore(s => s.toggleSmoothRoadSelection)

  const controlPoints = useMemo(() => getElevationControlPoints(placedObjects), [placedObjects])

  const roadGrades = useMemo(() => {
    const grades = new Map<string, number>()
    for (const obj of placedObjects) {
      if (obj.type !== 'road') continue
      grades.set(obj.id, computeRoadGrade(obj))
    }
    return grades
  }, [placedObjects])

  const applyLevelTool = useCallback(
    (point: ElevationControlPoint, shiftKey: boolean) => {
      const connected = getConnectedEndpoints(point.roadId, point.endpoint, placedObjects)
      const allUpdates: { id: string; prop: string; before: number; after: number }[] = []

      if (shiftKey) {
        const road = placedObjects.find(o => o.id === point.roadId)
        if (road) {
          allUpdates.push({
            id: road.id,
            prop: 'startElevation',
            before: road.startElevation ?? 0,
            after: targetLevelHeight,
          })
          allUpdates.push({
            id: road.id,
            prop: 'endElevation',
            before: road.endElevation ?? 0,
            after: targetLevelHeight,
          })
        }
      } else {
        const elevProp = point.endpoint === 'start' ? 'startElevation' : 'endElevation'
        allUpdates.push({
          id: point.roadId,
          prop: elevProp,
          before: point.elevation,
          after: targetLevelHeight,
        })
        for (const cp of connected) {
          if (cp.roadId === point.roadId && cp.endpoint === point.endpoint) continue
          const cpProp = cp.endpoint === 'start' ? 'startElevation' : 'endElevation'
          allUpdates.push({
            id: cp.roadId,
            prop: cpProp,
            before: cp.elevation,
            after: targetLevelHeight,
          })
        }
      }

      const command: EditorCommand = {
        execute: () => {
          const store = useCustomizationStore.getState()
          for (const u of allUpdates) store.updateObject(u.id, { [u.prop]: u.after })
        },
        undo: () => {
          const store = useCustomizationStore.getState()
          for (const u of allUpdates) store.updateObject(u.id, { [u.prop]: u.before })
        },
        description: 'Level elevation',
      }
      editorCommandStack.push(command)
    },
    [placedObjects, targetLevelHeight],
  )

  const applySlopeTool = useCallback(
    (point: ElevationControlPoint) => {
      if (!slopeAnchor) {
        setSlopeAnchor({ roadId: point.roadId, endpoint: point.endpoint, height: point.elevation })
        return
      }

      const path = findRoadPath(
        slopeAnchor.roadId,
        slopeAnchor.endpoint,
        point.roadId,
        point.endpoint,
        placedObjects,
      )

      if (!path || path.length < 2) {
        setSlopeAnchor(null)
        return
      }

      const startHeight = slopeAnchor.height
      const endHeight = point.elevation
      const nodeCount = path.length
      const allUpdates: { id: string; prop: string; before: number; after: number }[] = []

      for (let i = 0; i < nodeCount; i++) {
        const t = nodeCount > 1 ? i / (nodeCount - 1) : 0
        const height = Math.round((startHeight + (endHeight - startHeight) * t) / 0.25) * 0.25
        const node = path[i]
        const road = placedObjects.find(o => o.id === node.roadId)
        if (!road) continue
        const prop = node.endpoint === 'start' ? 'startElevation' : 'endElevation'
        const before =
          node.endpoint === 'start' ? (road.startElevation ?? 0) : (road.endElevation ?? 0)
        allUpdates.push({ id: node.roadId, prop, before, after: height })
      }

      const command: EditorCommand = {
        execute: () => {
          const store = useCustomizationStore.getState()
          for (const u of allUpdates) store.updateObject(u.id, { [u.prop]: u.after })
        },
        undo: () => {
          const store = useCustomizationStore.getState()
          for (const u of allUpdates) store.updateObject(u.id, { [u.prop]: u.before })
        },
        description: 'Slope elevation',
      }
      editorCommandStack.push(command)
      setSlopeAnchor(null)
    },
    [placedObjects, slopeAnchor, setSlopeAnchor],
  )

  const handleClick = useCallback(
    (point: ElevationControlPoint, screenY: number, shiftKey: boolean) => {
      switch (elevationTool) {
        case 'raise': {
          const connected = getConnectedEndpoints(point.roadId, point.endpoint, placedObjects)
          startElevationDrag(point.roadId, point.endpoint, point.elevation, screenY, connected)
          break
        }
        case 'level':
          applyLevelTool(point, shiftKey)
          break
        case 'slope':
          applySlopeTool(point)
          break
        case 'smooth':
          toggleSmoothRoadSelection(point.roadId)
          break
      }
    },
    [
      elevationTool,
      placedObjects,
      startElevationDrag,
      applyLevelTool,
      applySlopeTool,
      toggleSmoothRoadSelection,
    ],
  )

  const isDraggingRef = useRef(false)
  isDraggingRef.current = !!elevationDragState

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDraggingRef.current) return
      updateElevationDrag(e.clientY)

      const state = useElevationEditStore.getState()
      if (!state.elevationDragState) return
      const { roadId, endpoint, currentHeight, connectedEndpoints } = state.elevationDragState
      const customStore = useCustomizationStore.getState()
      const elevProp = endpoint === 'start' ? 'startElevation' : 'endElevation'
      customStore.updateObject(roadId, { [elevProp]: currentHeight })

      for (const cp of connectedEndpoints) {
        if (cp.roadId === roadId && cp.endpoint === endpoint) continue
        const cpProp = cp.endpoint === 'start' ? 'startElevation' : 'endElevation'
        customStore.updateObject(cp.roadId, { [cpProp]: currentHeight })
      }
    },
    [updateElevationDrag],
  )

  const handlePointerUp = useCallback(() => {
    if (!isDraggingRef.current) return
    confirmElevationDrag()
  }, [confirmElevationDrag])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === 'Escape' && isDraggingRef.current) {
        cancelElevationDrag()
      }
    },
    [cancelElevationDrag],
  )

  const listenersAttached = useRef(false)

  useFrame(() => {
    if (elevationDragState && !listenersAttached.current) {
      listenersAttached.current = true
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
      window.addEventListener('keydown', handleKeyDown)
    } else if (!elevationDragState && listenersAttached.current) {
      listenersAttached.current = false
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('keydown', handleKeyDown)
    }
  })

  return (
    <group>
      {controlPoints.map(point => {
        const key = `${point.roadId}-${point.endpoint}`
        const isDragging =
          elevationDragState !== null &&
          elevationDragState.roadId === point.roadId &&
          elevationDragState.endpoint === point.endpoint

        const isSlopeAnchor =
          slopeAnchor !== null &&
          slopeAnchor.roadId === point.roadId &&
          slopeAnchor.endpoint === point.endpoint

        const isSmoothSelected = smoothSelectedRoadIds.includes(point.roadId)

        const displayPoint = isDragging
          ? {
              ...point,
              elevation: elevationDragState!.currentHeight,
              worldPosition: [
                point.worldPosition[0],
                elevationDragState!.currentHeight,
                point.worldPosition[2],
              ] as [number, number, number],
            }
          : point

        return (
          <ElevationHandle
            key={key}
            point={displayPoint}
            isDragging={isDragging}
            isSlopeAnchor={isSlopeAnchor}
            isSmoothSelected={isSmoothSelected}
            grade={roadGrades.get(point.roadId) ?? 0}
            onClick={handleClick}
          />
        )
      })}

      {elevationTool === 'level' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, targetLevelHeight, 0]}>
          <planeGeometry args={[200, 200]} />
          <meshBasicMaterial color='#3b82f6' transparent opacity={0.05} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}
