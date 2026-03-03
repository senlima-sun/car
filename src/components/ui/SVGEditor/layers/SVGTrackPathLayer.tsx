import { memo } from 'react'
import type { TrackPath } from '@/types/trackPath'
import { getSplineSegment, getSplineSegmentCount, evaluateCubicBezier } from '@/utils/trackPathInterpolation'
import { worldToSVG } from '../hooks/useSVGCoordinates'

interface SVGTrackPathLayerProps {
  paths: TrackPath[]
  activePathId: string | null
  zoom: number
}

function buildSplineSVGPath(path: TrackPath): string {
  const segCount = getSplineSegmentCount(path)
  if (segCount === 0) return ''

  const parts: string[] = []

  for (let i = 0; i < segCount; i++) {
    const seg = getSplineSegment(path, i)
    const [sx, sy] = worldToSVG(seg.P0[0], seg.P0[1])
    const [c1x, c1y] = worldToSVG(seg.P1[0], seg.P1[1])
    const [c2x, c2y] = worldToSVG(seg.P2[0], seg.P2[1])
    const [ex, ey] = worldToSVG(seg.P3[0], seg.P3[1])

    if (i === 0) {
      parts.push(`M ${sx} ${sy}`)
    }
    parts.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${ex} ${ey}`)
  }

  if (path.closed) {
    parts.push('Z')
  }

  return parts.join(' ')
}

function buildEdgePath(path: TrackPath, side: 'left' | 'right'): string {
  const segCount = getSplineSegmentCount(path)
  if (segCount === 0) return ''

  const samples = 8
  const parts: string[] = []
  let first = true

  for (let i = 0; i < segCount; i++) {
    const seg = getSplineSegment(path, i)
    const w = (seg.startWidth + seg.endWidth) / 2 / 2

    for (let j = 0; j <= samples; j++) {
      if (!first && i > 0 && j === 0) continue
      const t = j / samples
      const pt = evaluateCubicBezier(seg.P0, seg.P1, seg.P2, seg.P3, t)

      const dt = 0.001
      const pt2 = evaluateCubicBezier(seg.P0, seg.P1, seg.P2, seg.P3, Math.min(1, t + dt))
      const tx = pt2[0] - pt[0]
      const ty = pt2[1] - pt[1]
      const len = Math.sqrt(tx * tx + ty * ty)
      if (len < 1e-10) continue

      const nx = -ty / len
      const ny = tx / len
      const sign = side === 'left' ? 1 : -1

      const ex = pt[0] + nx * w * sign
      const ey = pt[1] + ny * w * sign
      const [svgX, svgY] = worldToSVG(ex, ey)

      parts.push(first ? `M ${svgX} ${svgY}` : `L ${svgX} ${svgY}`)
      first = false
    }
  }

  return parts.join(' ')
}

export const SVGTrackPathLayer = memo(function SVGTrackPathLayer({
  paths,
  activePathId,
  zoom,
}: SVGTrackPathLayerProps) {
  return (
    <g>
      {paths.map(path => {
        if (path.controlPoints.length < 2) return null

        const centerD = buildSplineSVGPath(path)
        const leftD = buildEdgePath(path, 'left')
        const rightD = buildEdgePath(path, 'right')
        const isActive = path.id === activePathId
        const color = path.type === 'pit' ? '#ff8800' : '#ffffff'

        return (
          <g key={path.id} data-path-id={path.id}>
            <path
              d={centerD}
              fill="none"
              stroke={color}
              strokeWidth={path.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.15}
            />

            <path
              d={centerD}
              fill="none"
              stroke={color}
              strokeWidth={0.5 / zoom}
              strokeDasharray={`${4 / zoom} ${2 / zoom}`}
              opacity={0.5}
            />

            <path
              d={leftD}
              fill="none"
              stroke={color}
              strokeWidth={0.5 / zoom}
              opacity={isActive ? 0.6 : 0.3}
            />
            <path
              d={rightD}
              fill="none"
              stroke={color}
              strokeWidth={0.5 / zoom}
              opacity={isActive ? 0.6 : 0.3}
            />
          </g>
        )
      })}
    </g>
  )
})
