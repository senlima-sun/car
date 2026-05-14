import { useShallow } from 'zustand/react/shallow'
import { useTrackEditorStore } from '../state/useTrackEditorStore'
import type { Point } from '../geometry/types'
import { worldToScreen } from '../geometry/viewport'
import { PIT_AREA_DEPTH, PIT_AREA_WIDTH, PIT_ROTATE_HANDLE_DIST } from '../geometry/hitTest'

export default function PitBoxAreaLayer() {
  const { viewport, pitBoxAreas, selectedPitBoxAreaId, tool } = useTrackEditorStore(
    useShallow(s => ({
      viewport: s.viewport,
      pitBoxAreas: s.pitBoxAreas,
      selectedPitBoxAreaId: s.selectedPitBoxAreaId,
      tool: s.tool,
    })),
  )

  return (
    <g pointerEvents='none'>
      {pitBoxAreas.map(area => {
        const isSel = area.id === selectedPitBoxAreaId && tool === 'select'
        const halfW = PIT_AREA_WIDTH / 2
        const halfD = PIT_AREA_DEPTH / 2
        const corners: Point[] = [
          { x: -halfW, y: -halfD },
          { x: halfW, y: -halfD },
          { x: halfW, y: halfD },
          { x: -halfW, y: halfD },
        ]
        const sin = Math.sin(area.rotation)
        const cos = Math.cos(area.rotation)
        const cornersWorld = corners.map(c => ({
          x: area.position.x + c.x * cos - c.y * sin,
          y: area.position.y + c.x * sin + c.y * cos,
        }))
        const cornersScreen = cornersWorld.map(c => worldToScreen(viewport, c))
        const centerScreen = worldToScreen(viewport, area.position)
        const frontWorld = {
          x: area.position.x + 0 * cos - -halfD * sin,
          y: area.position.y + 0 * sin + -halfD * cos,
        }
        const frontScreen = worldToScreen(viewport, frontWorld)
        const polygonPoints = cornersScreen.map(c => `${c.x},${c.y}`).join(' ')
        return (
          <g key={area.id}>
            <polygon
              points={polygonPoints}
              fill='#f97316'
              fillOpacity={isSel ? 0.35 : 0.22}
              stroke='#f97316'
              strokeWidth={isSel ? 2 : 1.25}
              strokeLinejoin='round'
            />
            <line
              x1={centerScreen.x}
              y1={centerScreen.y}
              x2={frontScreen.x}
              y2={frontScreen.y}
              stroke='#fef3c7'
              strokeWidth={1.5}
              opacity={0.8}
            />
            {isSel &&
              (() => {
                const handleLocalY = -(halfD + PIT_ROTATE_HANDLE_DIST)
                const handleWorld = {
                  x: area.position.x + 0 * cos - handleLocalY * sin,
                  y: area.position.y + 0 * sin + handleLocalY * cos,
                }
                const handleScreen = worldToScreen(viewport, handleWorld)
                const stemScreen = worldToScreen(viewport, {
                  x: area.position.x + 0 * cos - -halfD * sin,
                  y: area.position.y + 0 * sin + -halfD * cos,
                })
                return (
                  <g>
                    <line
                      x1={stemScreen.x}
                      y1={stemScreen.y}
                      x2={handleScreen.x}
                      y2={handleScreen.y}
                      stroke='#f97316'
                      strokeWidth={1.5}
                      opacity={0.8}
                    />
                    <circle
                      cx={handleScreen.x}
                      cy={handleScreen.y}
                      r={5}
                      fill='#0a0a0a'
                      stroke='#f97316'
                      strokeWidth={1.5}
                    />
                  </g>
                )
              })()}
          </g>
        )
      })}
    </g>
  )
}
