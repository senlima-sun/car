import { useTerrainBrushStore } from '@/stores/useTerrainBrushStore'
import { useTerrainStore } from '@/stores/useTerrainStore'
import type { Point } from '../geometry/types'
import { worldToScreen, type Viewport } from '../geometry/viewport'

const BRUSH_COLORS: Record<string, string> = {
  raise: '#ef4444',
  lower: '#3b82f6',
  flatten: '#eab308',
  smooth: '#22c55e',
}

export default function TerrainBrushCursor({
  viewport,
  world,
}: {
  viewport: Viewport
  world: Point | null
}) {
  const brushType = useTerrainBrushStore(s => s.terrainBrushType)
  const radius = useTerrainBrushStore(s => s.terrainBrushRadius)
  const version = useTerrainStore(s => s.terrainGeneration)

  if (!world) return null

  const screen = worldToScreen(viewport, world)
  const cx = screen.x
  const cy = screen.y
  const r = radius * viewport.zoom
  const color = BRUSH_COLORS[brushType] ?? '#ffffff'

  const height = useTerrainStore.getState().getHeightAt(world.x, world.y)
  void version

  return (
    <g style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={color}
        fillOpacity={0.14}
        stroke={color}
        strokeOpacity={0.9}
        strokeWidth={1.5}
      />
      <circle cx={cx} cy={cy} r={2} fill={color} />
      <g transform={`translate(${cx} ${cy - r - 14})`}>
        <text
          textAnchor='middle'
          dominantBaseline='central'
          fill='#ffffff'
          fontSize={11}
          style={{
            paintOrder: 'stroke',
            stroke: 'rgba(14,16,22,0.92)',
            strokeWidth: 3,
            strokeLinejoin: 'round',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontWeight: 600,
          }}
        >
          {height.toFixed(2)} m
        </text>
      </g>
    </g>
  )
}
