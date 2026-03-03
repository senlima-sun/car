import { memo } from 'react'
import { GRID_COLOR_MINOR, GRID_COLOR_MAJOR, GRID_COLOR_ORIGIN } from './utils/svgColors'

interface SVGGridProps {
  zoom: number
}

function getGridStep(zoom: number): { minor: number; major: number } {
  if (zoom >= 4) return { minor: 5, major: 25 }
  if (zoom >= 1.5) return { minor: 10, major: 50 }
  if (zoom >= 0.5) return { minor: 25, major: 100 }
  if (zoom >= 0.15) return { minor: 50, major: 250 }
  return { minor: 100, major: 500 }
}

export const SVGGrid = memo(function SVGGrid({ zoom }: SVGGridProps) {
  const { minor, major } = getGridStep(zoom)
  const extent = 5000

  return (
    <g>
      <defs>
        <pattern
          id="grid-minor"
          width={minor}
          height={minor}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${minor} 0 L 0 0 0 ${minor}`}
            fill="none"
            stroke={GRID_COLOR_MINOR}
            strokeWidth={0.5 / zoom}
          />
        </pattern>
        <pattern
          id="grid-major"
          width={major}
          height={major}
          patternUnits="userSpaceOnUse"
        >
          <rect width={major} height={major} fill="url(#grid-minor)" />
          <path
            d={`M ${major} 0 L 0 0 0 ${major}`}
            fill="none"
            stroke={GRID_COLOR_MAJOR}
            strokeWidth={1 / zoom}
          />
        </pattern>
      </defs>

      <rect
        x={-extent}
        y={-extent}
        width={extent * 2}
        height={extent * 2}
        fill="url(#grid-major)"
      />

      <line
        x1={-extent}
        y1={0}
        x2={extent}
        y2={0}
        stroke={GRID_COLOR_ORIGIN}
        strokeWidth={1.5 / zoom}
      />
      <line
        x1={0}
        y1={-extent}
        x2={0}
        y2={extent}
        stroke={GRID_COLOR_ORIGIN}
        strokeWidth={1.5 / zoom}
      />
    </g>
  )
})
