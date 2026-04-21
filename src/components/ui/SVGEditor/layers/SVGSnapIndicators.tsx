import { memo, useMemo } from 'react'
import type { PlacedObject, SnapPointWithDirection } from '@/types/trackObjects'
import { getSnapPoints } from '@/utils/roadGeometry'
import { worldToSVG } from '../hooks/useSVGCoordinates'
import { SNAP_POINT_COLOR } from '../utils/svgColors'

interface SVGSnapIndicatorsProps {
  placedObjects: PlacedObject[]
  activeSnapPoint: SnapPointWithDirection | null
  zoom: number
}

export const SVGSnapIndicators = memo(function SVGSnapIndicators({
  placedObjects,
  activeSnapPoint,
  zoom,
}: SVGSnapIndicatorsProps) {
  const snapPoints = useMemo(() => getSnapPoints(placedObjects), [placedObjects])

  const radius = 3 / zoom
  const activeRadius = 4 / zoom
  const strokeWidth = 1 / zoom

  return (
    <g>
      {snapPoints.map((sp, i) => {
        const [sx, sy] = worldToSVG(sp.position[0], sp.position[2])
        const isActive =
          activeSnapPoint &&
          Math.abs(sp.position[0] - activeSnapPoint.position[0]) < 0.1 &&
          Math.abs(sp.position[2] - activeSnapPoint.position[2]) < 0.1

        return (
          <circle
            key={`snap-${sp.roadId}-${sp.endpoint}-${i}`}
            cx={sx}
            cy={sy}
            r={isActive ? activeRadius : radius}
            fill='none'
            stroke={isActive ? SNAP_POINT_COLOR : 'rgba(0,255,255,0.3)'}
            strokeWidth={strokeWidth}
            style={{ pointerEvents: 'none' }}
          />
        )
      })}
    </g>
  )
})
