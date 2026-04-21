import { memo, useCallback, useRef, useEffect } from 'react'
import { useEditorStore } from '@/stores/useEditorStore'
import { useCustomizationStore } from '@/stores/useCustomizationStore'
import { isWallType } from '@/types/trackObjects'
import { worldToSVG } from '../hooks/useSVGCoordinates'
import type { useSVGCoordinates as UseSVGCoordinates } from '../hooks/useSVGCoordinates'

interface SVGWallHandlesProps {
  zoom: number
  screenToWorld: ReturnType<typeof UseSVGCoordinates>['screenToWorld']
}

interface WallDragState {
  wallId: string
  handle: 'start' | 'end' | 'center'
  initialStart: [number, number, number]
  initialEnd: [number, number, number]
}

export const SVGWallHandles = memo(function SVGWallHandles({
  zoom,
  screenToWorld,
}: SVGWallHandlesProps) {
  const selectedObjectId = useEditorStore(s => s.selectedObjectId)
  const placedObjects = useCustomizationStore(s => s.placedObjects)

  const wall = selectedObjectId
    ? placedObjects.find(o => o.id === selectedObjectId && isWallType(o.type))
    : null

  const dragState = useRef<WallDragState | null>(null)

  const handlePointerDown = useCallback(
    (handle: 'start' | 'end' | 'center', e: React.PointerEvent) => {
      e.stopPropagation()
      if (!wall || !wall.startPoint || !wall.endPoint) return

      dragState.current = {
        wallId: wall.id,
        handle,
        initialStart: [...wall.startPoint] as [number, number, number],
        initialEnd: [...wall.endPoint] as [number, number, number],
      }
    },
    [wall],
  )

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const ds = dragState.current
      if (!ds) return

      const world = screenToWorld(e.clientX, e.clientY)
      if (!world) return

      const store = useCustomizationStore.getState()
      const obj = store.placedObjects.find(o => o.id === ds.wallId)
      if (!obj || !obj.startPoint || !obj.endPoint) return

      let newStart = obj.startPoint
      let newEnd = obj.endPoint

      if (ds.handle === 'start') {
        newStart = world
      } else if (ds.handle === 'end') {
        newEnd = world
      } else {
        const cx = (obj.startPoint[0] + obj.endPoint[0]) / 2
        const cz = (obj.startPoint[2] + obj.endPoint[2]) / 2
        const dx = world[0] - cx
        const dz = world[2] - cz
        newStart = [obj.startPoint[0] + dx, 0, obj.startPoint[2] + dz]
        newEnd = [obj.endPoint[0] + dx, 0, obj.endPoint[2] + dz]
      }

      const position: [number, number, number] = [
        (newStart[0] + newEnd[0]) / 2,
        0,
        (newStart[2] + newEnd[2]) / 2,
      ]
      const rotation = Math.atan2(newEnd[0] - newStart[0], newEnd[2] - newStart[2])

      store.updateObject(ds.wallId, { startPoint: newStart, endPoint: newEnd, position, rotation })
    }

    const handleUp = () => {
      dragState.current = null
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragState.current) {
        const ds = dragState.current
        useCustomizationStore.getState().updateObject(ds.wallId, {
          startPoint: ds.initialStart,
          endPoint: ds.initialEnd,
          position: [
            (ds.initialStart[0] + ds.initialEnd[0]) / 2,
            0,
            (ds.initialStart[2] + ds.initialEnd[2]) / 2,
          ],
          rotation: Math.atan2(
            ds.initialEnd[0] - ds.initialStart[0],
            ds.initialEnd[2] - ds.initialStart[2],
          ),
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

  if (!wall || !wall.startPoint || !wall.endPoint) return null

  const [sx, sy] = worldToSVG(wall.startPoint[0], wall.startPoint[2])
  const [ex, ey] = worldToSVG(wall.endPoint[0], wall.endPoint[2])
  const cx = (sx + ex) / 2
  const cy = (sy + ey) / 2
  const r = 2.5 / zoom
  const strokeW = 1 / zoom

  return (
    <g>
      <circle
        cx={sx}
        cy={sy}
        r={r}
        fill='#00ff00'
        fillOpacity={0.3}
        stroke='#00ff00'
        strokeWidth={strokeW}
        cursor='grab'
        onPointerDown={e => handlePointerDown('start', e)}
      />
      <circle
        cx={ex}
        cy={ey}
        r={r}
        fill='#ff4444'
        fillOpacity={0.3}
        stroke='#ff4444'
        strokeWidth={strokeW}
        cursor='grab'
        onPointerDown={e => handlePointerDown('end', e)}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.8}
        fill='#ff8800'
        fillOpacity={0.3}
        stroke='#ff8800'
        strokeWidth={strokeW}
        cursor='grab'
        onPointerDown={e => handlePointerDown('center', e)}
      />
    </g>
  )
})
