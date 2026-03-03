import { memo, useCallback, useRef, useEffect } from 'react'
import { useTrackPathStore } from '@/stores/useTrackPathStore'
import { worldToSVG } from '../hooks/useSVGCoordinates'
import type { useSVGCoordinates as UseSVGCoordinates } from '../hooks/useSVGCoordinates'

interface SVGTrackPathHandlesProps {
  zoom: number
  screenToWorld: ReturnType<typeof UseSVGCoordinates>['screenToWorld']
}

interface DragState {
  pathId: string
  pointId: string
  type: 'point' | 'handleIn' | 'handleOut'
  symmetric: boolean
}

export const SVGTrackPathHandles = memo(function SVGTrackPathHandles({
  zoom,
  screenToWorld,
}: SVGTrackPathHandlesProps) {
  const paths = useTrackPathStore(s => s.paths)
  const activePathId = useTrackPathStore(s => s.activePathId)
  const selectedPointId = useTrackPathStore(s => s.selectedPointId)

  const activePath = activePathId ? paths.find(p => p.id === activePathId) : null

  const dragRef = useRef<DragState | null>(null)

  const handlePointDown = useCallback(
    (pointId: string, e: React.PointerEvent) => {
      e.stopPropagation()
      if (!activePathId) return
      dragRef.current = {
        pathId: activePathId,
        pointId,
        type: 'point',
        symmetric: false,
      }
      useTrackPathStore.getState().setSelectedPoint(pointId)
    },
    [activePathId],
  )

  const handleHandleDown = useCallback(
    (pointId: string, handle: 'handleIn' | 'handleOut', e: React.PointerEvent) => {
      e.stopPropagation()
      if (!activePathId) return
      dragRef.current = {
        pathId: activePathId,
        pointId,
        type: handle,
        symmetric: !e.shiftKey,
      }
    },
    [activePathId],
  )

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const ds = dragRef.current
      if (!ds) return

      const world = screenToWorld(e.clientX, e.clientY)
      if (!world) return

      const store = useTrackPathStore.getState()

      if (ds.type === 'point') {
        store.updateControlPoint(
          ds.pathId,
          ds.pointId,
          {
            position: [world[0], world[2]],
          },
          false,
        )
      } else {
        const path = store.getPathById(ds.pathId)
        if (!path) return
        const cp = path.controlPoints.find(c => c.id === ds.pointId)
        if (!cp) return

        const offset: [number, number] = [world[0] - cp.position[0], world[2] - cp.position[1]]
        store.updateHandle(
          ds.pathId,
          ds.pointId,
          ds.type === 'handleIn' ? 'in' : 'out',
          offset,
          ds.symmetric,
          false,
        )
      }
    }

    const handleUp = () => {
      if (dragRef.current) {
        useTrackPathStore.getState().regenerateRoads()
      }
      dragRef.current = null
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          (e.target instanceof HTMLElement && e.target.isContentEditable)
        ) {
          return
        }
        const store = useTrackPathStore.getState()
        if (store.selectedPointId && store.activePathId) {
          e.preventDefault()
          store.removeControlPoint(store.activePathId, store.selectedPointId)
        }
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

  if (!activePath || activePath.controlPoints.length === 0) return null

  const cpR = 4 / zoom
  const handleR = 2.5 / zoom
  const strokeW = 1 / zoom
  const handleLineW = 0.5 / zoom

  return (
    <g>
      {activePath.controlPoints.map((cp, i) => {
        const [cx, cy] = worldToSVG(cp.position[0], cp.position[1])
        const isSelected = cp.id === selectedPointId
        const isFirst = i === 0
        const isLast = i === activePath.controlPoints.length - 1

        const hiX = cp.handleIn ? cp.position[0] + cp.handleIn[0] : null
        const hiY = cp.handleIn ? cp.position[1] + cp.handleIn[1] : null
        const hoX = cp.handleOut ? cp.position[0] + cp.handleOut[0] : null
        const hoY = cp.handleOut ? cp.position[1] + cp.handleOut[1] : null

        return (
          <g key={cp.id}>
            {isSelected && hiX !== null && hiY !== null && (
              <>
                {(() => {
                  const [hx, hy] = worldToSVG(hiX, hiY)
                  return (
                    <>
                      <line
                        x1={cx}
                        y1={cy}
                        x2={hx}
                        y2={hy}
                        stroke='#6688ff'
                        strokeWidth={handleLineW}
                        opacity={0.6}
                        style={{ pointerEvents: 'none' }}
                      />
                      <circle
                        cx={hx}
                        cy={hy}
                        r={handleR}
                        fill='#6688ff'
                        fillOpacity={0.5}
                        stroke='#6688ff'
                        strokeWidth={strokeW * 0.5}
                        cursor='crosshair'
                        onPointerDown={e => handleHandleDown(cp.id, 'handleIn', e)}
                      />
                    </>
                  )
                })()}
              </>
            )}

            {isSelected && hoX !== null && hoY !== null && (
              <>
                {(() => {
                  const [hx, hy] = worldToSVG(hoX, hoY)
                  return (
                    <>
                      <line
                        x1={cx}
                        y1={cy}
                        x2={hx}
                        y2={hy}
                        stroke='#ff8844'
                        strokeWidth={handleLineW}
                        opacity={0.6}
                        style={{ pointerEvents: 'none' }}
                      />
                      <circle
                        cx={hx}
                        cy={hy}
                        r={handleR}
                        fill='#ff8844'
                        fillOpacity={0.5}
                        stroke='#ff8844'
                        strokeWidth={strokeW * 0.5}
                        cursor='crosshair'
                        onPointerDown={e => handleHandleDown(cp.id, 'handleOut', e)}
                      />
                    </>
                  )
                })()}
              </>
            )}

            <circle
              cx={cx}
              cy={cy}
              r={isSelected ? cpR * 1.2 : cpR}
              fill={isFirst ? '#00ff88' : isLast && !activePath.closed ? '#ff4444' : '#ffffff'}
              fillOpacity={isSelected ? 0.6 : 0.3}
              stroke={isSelected ? '#00bfff' : '#ffffff'}
              strokeWidth={strokeW}
              cursor='grab'
              onPointerDown={e => handlePointDown(cp.id, e)}
            />

            <text
              x={cx}
              y={cy - cpR - 2 / zoom}
              fill='#ffffff'
              fontSize={3 / zoom}
              textAnchor='middle'
              opacity={0.4}
              style={{ pointerEvents: 'none' }}
            >
              {i}
            </text>
          </g>
        )
      })}
    </g>
  )
})
