import { memo } from 'react'
import type { PlacedObject } from '@/types/trackObjects'
import { buildCurbPath } from '../utils/svgPathBuilder'
import { getObjectStyle } from '../utils/svgColors'

interface SVGCurbLayerProps {
  curbs: PlacedObject[]
  roadsById: Map<string, PlacedObject>
}

export const SVGCurbLayer = memo(function SVGCurbLayer({ curbs, roadsById }: SVGCurbLayerProps) {
  const style = getObjectStyle('curb')

  return (
    <g>
      {curbs.map(curb => {
        const parent = curb.parentRoadId ? roadsById.get(curb.parentRoadId) : undefined
        if (!parent) return null

        const d = buildCurbPath(curb, parent)
        if (!d) return null

        return (
          <path
            key={curb.id}
            data-object-id={curb.id}
            d={d}
            fill='none'
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
            strokeLinecap='round'
            strokeLinejoin='round'
          />
        )
      })}
    </g>
  )
})
