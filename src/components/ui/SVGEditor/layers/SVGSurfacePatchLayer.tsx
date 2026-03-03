import { memo } from 'react'
import type { PlacedObject } from '@/types/trackObjects'
import { buildPolygonPath } from '../utils/svgPathBuilder'
import { getObjectStyle, SELECTION_COLOR } from '../utils/svgColors'

interface SVGSurfacePatchLayerProps {
  patches: PlacedObject[]
  selectedId: string | null
  zoom: number
}

export const SVGSurfacePatchLayer = memo(function SVGSurfacePatchLayer({
  patches,
  selectedId,
  zoom,
}: SVGSurfacePatchLayerProps) {
  return (
    <g>
      {patches.map(patch => {
        const d = buildPolygonPath(patch)
        if (!d) return null

        const style = getObjectStyle(patch.type)
        const isSelected = patch.id === selectedId

        return (
          <g key={patch.id} data-object-id={patch.id}>
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
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              opacity={style.opacity}
            />
          </g>
        )
      })}
    </g>
  )
})
