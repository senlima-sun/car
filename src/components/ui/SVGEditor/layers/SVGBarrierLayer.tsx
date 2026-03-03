import { memo } from 'react'
import type { PlacedObject } from '@/types/trackObjects'
import { buildLinearPath, getStrokeWidth } from '../utils/svgPathBuilder'
import { getObjectStyle, SELECTION_COLOR } from '../utils/svgColors'

interface SVGBarrierLayerProps {
  barriers: PlacedObject[]
  selectedId: string | null
  zoom: number
}

export const SVGBarrierLayer = memo(function SVGBarrierLayer({
  barriers,
  selectedId,
  zoom,
}: SVGBarrierLayerProps) {
  return (
    <g>
      {barriers.map(obj => {
        const d = buildLinearPath(obj)
        if (!d) return null

        const style = getObjectStyle(obj.type)
        const strokeWidth = getStrokeWidth(obj)
        const isSelected = obj.id === selectedId

        return (
          <g key={obj.id} data-object-id={obj.id}>
            {isSelected && (
              <path
                d={d}
                fill="none"
                stroke={SELECTION_COLOR}
                strokeWidth={strokeWidth + 1.5 / zoom}
                strokeLinecap="round"
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
            />
          </g>
        )
      })}
    </g>
  )
})
