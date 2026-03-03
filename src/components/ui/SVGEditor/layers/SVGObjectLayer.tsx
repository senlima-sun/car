import { memo } from 'react'
import type { PlacedObject } from '@/types/trackObjects'
import { getPointObjectCenter, getPointObjectRadius } from '../utils/svgPathBuilder'
import { getObjectStyle, SELECTION_COLOR } from '../utils/svgColors'
import { worldToSVG } from '../hooks/useSVGCoordinates'
import { OBJECT_CONFIGS } from '@/constants/trackObjects'

interface SVGObjectLayerProps {
  objects: PlacedObject[]
  selectedId: string | null
  zoom: number
}

export const SVGObjectLayer = memo(function SVGObjectLayer({
  objects,
  selectedId,
  zoom,
}: SVGObjectLayerProps) {
  return (
    <g>
      {objects.map(obj => {
        const style = getObjectStyle(obj.type)
        const isSelected = obj.id === selectedId

        if (obj.type === 'pitbox') {
          const config = OBJECT_CONFIGS.pitbox
          const [cx, cy] = worldToSVG(obj.position[0], obj.position[2])
          const hw = config.defaultSize.depth / 2
          const hd = config.defaultSize.width / 2

          return (
            <g key={obj.id} data-object-id={obj.id}>
              {isSelected && (
                <rect
                  x={cx - hd - 0.5 / zoom}
                  y={cy - hw - 0.5 / zoom}
                  width={(hd + 0.5 / zoom) * 2}
                  height={(hw + 0.5 / zoom) * 2}
                  fill="none"
                  stroke={SELECTION_COLOR}
                  strokeWidth={0.5 / zoom}
                  opacity={0.6}
                  transform={`rotate(${(-obj.rotation * 180) / Math.PI} ${cx} ${cy})`}
                />
              )}
              <rect
                x={cx - hd}
                y={cy - hw}
                width={hd * 2}
                height={hw * 2}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                strokeDasharray={style.strokeDasharray}
                opacity={style.opacity}
                transform={`rotate(${(-obj.rotation * 180) / Math.PI} ${cx} ${cy})`}
              />
            </g>
          )
        }

        if (obj.type === 'ramp') {
          const config = OBJECT_CONFIGS.ramp
          const [cx, cy] = worldToSVG(obj.position[0], obj.position[2])
          const hw = config.defaultSize.width / 2
          const hd = config.defaultSize.depth / 2

          return (
            <g key={obj.id} data-object-id={obj.id}>
              <rect
                x={cx - hw}
                y={cy - hd}
                width={hw * 2}
                height={hd * 2}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                opacity={style.opacity}
                transform={`rotate(${(-obj.rotation * 180) / Math.PI} ${cx} ${cy})`}
              />
            </g>
          )
        }

        const [cx, cy] = getPointObjectCenter(obj)
        const r = getPointObjectRadius(obj)

        return (
          <g key={obj.id} data-object-id={obj.id}>
            {isSelected && (
              <circle
                cx={cx}
                cy={cy}
                r={r + 0.5 / zoom}
                fill="none"
                stroke={SELECTION_COLOR}
                strokeWidth={0.5 / zoom}
                opacity={0.6}
              />
            )}
            <circle
              cx={cx}
              cy={cy}
              r={r}
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
