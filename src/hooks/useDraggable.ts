import { useCallback, useEffect, useRef } from 'react'
import { useDevToolsStore, type DevPanelId } from '../stores/useDevToolsStore'
import {
  dragStep,
  type DragSession,
  type Position,
  type Size,
} from '../utils/dragController'

interface DragHandleProps {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
}

export function useDraggable(
  id: DevPanelId,
  panelSizeRef: React.RefObject<Size | null>,
): { handleProps: DragHandleProps } {
  const sessionRef = useRef<DragSession | null>(null)
  const captureTargetRef = useRef<HTMLElement | null>(null)
  const movedRef = useRef(false)

  const endDrag = useCallback(() => {
    const target = captureTargetRef.current
    if (target && sessionRef.current) {
      try {
        target.releasePointerCapture?.(0)
      } catch {
        // ignore — pointerId already released
      }
    }
    sessionRef.current = null
    captureTargetRef.current = null
    movedRef.current = false
  }, [])

  useEffect(() => {
    function handleMove(event: PointerEvent) {
      const session = sessionRef.current
      if (!session) return
      const panelSize = panelSizeRef.current ?? { width: 200, height: 100 }
      const viewport = { width: window.innerWidth, height: window.innerHeight }
      const next: Position = dragStep(
        session,
        { x: event.clientX, y: event.clientY },
        viewport,
        panelSize,
      )
      movedRef.current = true
      useDevToolsStore.getState().setPanelPosition(id, next)
    }
    function handleUp() {
      endDrag()
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
      endDrag()
    }
  }, [id, endDrag, panelSizeRef])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      const currentPos = useDevToolsStore.getState().panels[id].position
      sessionRef.current = {
        startPointer: { x: event.clientX, y: event.clientY },
        startPanelPos: currentPos,
      }
      captureTargetRef.current = event.currentTarget
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // ignore
      }
      event.preventDefault()
    },
    [id],
  )

  return { handleProps: { onPointerDown } }
}
