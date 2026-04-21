import { memo, useCallback, useRef, useEffect } from 'react'
import { useEditorStore } from '@/stores/useEditorStore'
import { useCustomizationStore } from '@/stores/useCustomizationStore'
import { worldToSVG } from '../hooks/useSVGCoordinates'
import type { useSVGCoordinates as UseSVGCoordinates } from '../hooks/useSVGCoordinates'

interface SVGCheckpointHandlesProps {
  zoom: number
  screenToWorld: ReturnType<typeof UseSVGCoordinates>['screenToWorld']
}

export const SVGCheckpointHandles = memo(function SVGCheckpointHandles({
  zoom,
  screenToWorld,
}: SVGCheckpointHandlesProps) {
  const selectedObjectId = useEditorStore(s => s.selectedObjectId)
  const checkpointDragState = useEditorStore(s => s.checkpointDragState)
  const placedObjects = useCustomizationStore(s => s.placedObjects)

  const checkpoint = selectedObjectId
    ? placedObjects.find(o => o.id === selectedObjectId && o.type === 'checkpoint')
    : null

  const isDragging = useRef(false)

  const handlePointerDown = useCallback(
    (handle: 'start' | 'end' | 'center', e: React.PointerEvent) => {
      e.stopPropagation()
      if (!checkpoint || !checkpoint.startPoint || !checkpoint.endPoint) return

      useEditorStore
        .getState()
        .startCheckpointDrag(checkpoint.id, handle, checkpoint.startPoint, checkpoint.endPoint)
      isDragging.current = true
    },
    [checkpoint],
  )

  useEffect(() => {
    if (!checkpointDragState) return

    const handleMove = (e: PointerEvent) => {
      if (!isDragging.current) return
      const world = screenToWorld(e.clientX, e.clientY)
      if (world) {
        useEditorStore.getState().updateCheckpointDrag(world)
      }
    }

    const handleUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      useEditorStore.getState().confirmCheckpointDrag()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        isDragging.current = false
        useEditorStore.getState().cancelCheckpointDrag()
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
  }, [checkpointDragState, screenToWorld])

  if (!checkpoint || !checkpoint.startPoint || !checkpoint.endPoint) return null

  const [sx, sy] = worldToSVG(checkpoint.startPoint[0], checkpoint.startPoint[2])
  const [ex, ey] = worldToSVG(checkpoint.endPoint[0], checkpoint.endPoint[2])
  const cx = (sx + ex) / 2
  const cy = (sy + ey) / 2
  const r = 3 / zoom
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
