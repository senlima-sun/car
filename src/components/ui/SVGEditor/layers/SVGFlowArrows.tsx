import { memo } from 'react'
import type { PlacedObject } from '@/types/trackObjects'
import { getRoadCenterPositionAt } from '@/utils/roadGeometry'
import { worldToSVG } from '../hooks/useSVGCoordinates'

interface SVGFlowArrowsProps {
  roads: PlacedObject[]
  zoom: number
}

export const SVGFlowArrows = memo(function SVGFlowArrows({ roads, zoom }: SVGFlowArrowsProps) {
  const arrowSize = 2 / zoom

  return (
    <g>
      <defs>
        <marker
          id='flow-arrow'
          markerWidth={arrowSize * 3}
          markerHeight={arrowSize * 3}
          refX={arrowSize * 1.5}
          refY={arrowSize * 1.5}
          orient='auto'
          markerUnits='userSpaceOnUse'
        >
          <polygon
            points={`0,0 ${arrowSize * 3},${arrowSize * 1.5} 0,${arrowSize * 3}`}
            fill='rgba(255,255,255,0.3)'
          />
        </marker>
      </defs>

      {roads.map(road => {
        if (!road.startPoint || !road.endPoint) return null

        const pos1 = getRoadCenterPositionAt(road, 0.45)
        const pos2 = getRoadCenterPositionAt(road, 0.55)
        const [x1, y1] = worldToSVG(pos1[0], pos1[2])
        const [x2, y2] = worldToSVG(pos2[0], pos2[2])

        return (
          <line
            key={`arrow-${road.id}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke='rgba(255,255,255,0.3)'
            strokeWidth={0.5 / zoom}
            markerEnd='url(#flow-arrow)'
            style={{ pointerEvents: 'none' }}
          />
        )
      })}
    </g>
  )
})
