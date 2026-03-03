import { memo } from 'react'
import type { PlacedObject } from '@/types/trackObjects'
import { buildLinearPath, getStrokeWidth } from '../utils/svgPathBuilder'
import { getObjectStyle, SELECTION_COLOR } from '../utils/svgColors'

interface SVGRoadLayerProps {
  roads: PlacedObject[]
  selectedId: string | null
  multiSelectedIds: string[]
  zoom: number
}

export const SVGRoadLayer = memo(function SVGRoadLayer({
  roads,
  selectedId,
  multiSelectedIds,
  zoom,
}: SVGRoadLayerProps) {
  return (
    <g>
      {roads.map(road => {
        const d = buildLinearPath(road)
        if (!d) return null

        const style = getObjectStyle('road', road.trackMode)
        const strokeWidth = getStrokeWidth(road)
        const isSelected = road.id === selectedId || multiSelectedIds.includes(road.id)

        return (
          <g key={road.id} data-object-id={road.id}>
            {isSelected && (
              <path
                d={d}
                fill="none"
                stroke={SELECTION_COLOR}
                strokeWidth={strokeWidth + 2 / zoom}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.6}
              />
            )}
            <path
              d={d}
              fill="none"
              stroke={style.stroke}
              strokeWidth={strokeWidth}
              strokeLinecap={style.strokeLinecap}
              strokeLinejoin="round"
              opacity={style.opacity}
            />
          </g>
        )
      })}
    </g>
  )
})
