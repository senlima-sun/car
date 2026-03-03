import { memo, useCallback, useRef, useEffect } from 'react'
import { useEditorStore } from '@/stores/useEditorStore'
import { useCustomizationStore } from '@/stores/useCustomizationStore'
import { isCurveMode } from '@/types/trackObjects'
import { worldToSVG } from '../hooks/useSVGCoordinates'
import type { useSVGCoordinates as UseSVGCoordinates } from '../hooks/useSVGCoordinates'

interface SVGRoadHandlesProps {
  zoom: number
  screenToWorld: ReturnType<typeof UseSVGCoordinates>['screenToWorld']
}

interface RoadDragState {
  roadId: string
  handle: 'start' | 'end' | 'control'
  initialStart: [number, number, number]
  initialEnd: [number, number, number]
  initialControl: [number, number, number] | undefined
}

export const SVGRoadHandles = memo(function SVGRoadHandles({
  zoom,
  screenToWorld,
}: SVGRoadHandlesProps) {
  const selectedObjectId = useEditorStore(s => s.selectedObjectId)
  const placedObjects = useCustomizationStore(s => s.placedObjects)

  const road = selectedObjectId
    ? placedObjects.find(o => o.id === selectedObjectId && o.type === 'road')
    : null

  const dragState = useRef<RoadDragState | null>(null)

  const handlePointerDown = useCallback(
    (handle: 'start' | 'end' | 'control', e: React.PointerEvent) => {
      e.stopPropagation()
      if (!road || !road.startPoint || !road.endPoint) return

      dragState.current = {
        roadId: road.id,
        handle,
        initialStart: [...road.startPoint] as [number, number, number],
        initialEnd: [...road.endPoint] as [number, number, number],
        initialControl: road.controlPoint
          ? ([...road.controlPoint] as [number, number, number])
          : undefined,
      }
    },
    [road],
  )

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const ds = dragState.current
      if (!ds) return

      const world = screenToWorld(e.clientX, e.clientY)
      if (!world) return

      const store = useCustomizationStore.getState()
      const obj = store.placedObjects.find(o => o.id === ds.roadId)
      if (!obj || !obj.startPoint || !obj.endPoint) return

      const updates: Record<string, unknown> = {}

      if (ds.handle === 'start') {
        updates.startPoint = world
        updates.position = [(world[0] + obj.endPoint[0]) / 2, 0, (world[2] + obj.endPoint[2]) / 2]
      } else if (ds.handle === 'end') {
        updates.endPoint = world
        updates.position = [
          (obj.startPoint[0] + world[0]) / 2,
          0,
          (obj.startPoint[2] + world[2]) / 2,
        ]
      } else if (ds.handle === 'control') {
        updates.controlPoint = world
      }

      store.updateObject(ds.roadId, updates)
    }

    const handleUp = () => {
      dragState.current = null
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragState.current) {
        const ds = dragState.current
        useCustomizationStore.getState().updateObject(ds.roadId, {
          startPoint: ds.initialStart,
          endPoint: ds.initialEnd,
          controlPoint: ds.initialControl,
          position: [
            (ds.initialStart[0] + ds.initialEnd[0]) / 2,
            0,
            (ds.initialStart[2] + ds.initialEnd[2]) / 2,
          ],
        })
        dragState.current = null
      }
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [screenToWorld])

  if (!road || !road.startPoint || !road.endPoint) return null

  const [sx, sy] = worldToSVG(road.startPoint[0], road.startPoint[2])
  const [ex, ey] = worldToSVG(road.endPoint[0], road.endPoint[2])
  const hasCurve = isCurveMode(road.trackMode) && road.controlPoint
  const r = 3 / zoom
  const strokeW = 1 / zoom

  return (
    <g>
      <circle
        cx={sx}
        cy={sy}
        r={r}
        fill="#00ff00"
        fillOpacity={0.3}
        stroke="#00ff00"
        strokeWidth={strokeW}
        cursor="grab"
        onPointerDown={e => handlePointerDown('start', e)}
      />
      <circle
        cx={ex}
        cy={ey}
        r={r}
        fill="#ff4444"
        fillOpacity={0.3}
        stroke="#ff4444"
        strokeWidth={strokeW}
        cursor="grab"
        onPointerDown={e => handlePointerDown('end', e)}
      />
      {hasCurve && road.controlPoint && (() => {
        const [cpx, cpy] = worldToSVG(road.controlPoint[0], road.controlPoint[2])
        return (
          <>
            <line
              x1={sx}
              y1={sy}
              x2={cpx}
              y2={cpy}
              stroke="#ffff00"
              strokeWidth={0.5 / zoom}
              opacity={0.4}
              style={{ pointerEvents: 'none' }}
            />
            <line
              x1={cpx}
              y1={cpy}
              x2={ex}
              y2={ey}
              stroke="#ffff00"
              strokeWidth={0.5 / zoom}
              opacity={0.4}
              style={{ pointerEvents: 'none' }}
            />
            <circle
              cx={cpx}
              cy={cpy}
              r={r * 0.7}
              fill="#ffff00"
              fillOpacity={0.3}
              stroke="#ffff00"
              strokeWidth={strokeW}
              cursor="grab"
              onPointerDown={e => handlePointerDown('control', e)}
            />
          </>
        )
      })()}
    </g>
  )
})
