import { memo } from 'react'
import type { PlacedObject } from '@/types/trackObjects'
import { buildCheckpointPath } from '../utils/svgPathBuilder'
import { getObjectStyle, SELECTION_COLOR } from '../utils/svgColors'
import { worldToSVG } from '../hooks/useSVGCoordinates'

interface SVGCheckpointLayerProps {
  checkpoints: PlacedObject[]
  selectedId: string | null
  zoom: number
}

export const SVGCheckpointLayer = memo(function SVGCheckpointLayer({
  checkpoints,
  selectedId,
  zoom,
}: SVGCheckpointLayerProps) {
  const style = getObjectStyle('checkpoint')

  return (
    <g>
      {checkpoints.map(cp => {
        const d = buildCheckpointPath(cp)
        if (!d) return null

        const isSelected = cp.id === selectedId
        const isStartFinish = (cp.checkpointType ?? 'start-finish') === 'start-finish'
        const labelPos = cp.position
        const [lx, ly] = worldToSVG(labelPos[0], labelPos[2])

        return (
          <g key={cp.id} data-object-id={cp.id}>
            {isSelected && (
              <path
                d={d}
                fill="none"
                stroke={SELECTION_COLOR}
                strokeWidth={1 / zoom}
                opacity={0.6}
              />
            )}
            <path
              d={d}
              fill="none"
              stroke={isStartFinish ? '#ffffff' : style.stroke}
              strokeWidth={style.strokeWidth}
              strokeDasharray={isStartFinish ? undefined : style.strokeDasharray}
              strokeLinecap="round"
            />
            <text
              x={lx}
              y={ly - 2 / zoom}
              fill={isStartFinish ? '#ffffff' : style.stroke}
              fontSize={3 / zoom}
              textAnchor="middle"
              dominantBaseline="auto"
              style={{ pointerEvents: 'none' }}
            >
              {isStartFinish ? 'S/F' : `S${cp.checkpointOrder ?? ''}`}
            </text>
          </g>
        )
      })}
    </g>
  )
})
