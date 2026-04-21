import { memo } from 'react'
import type { PlacedObject, RoadEdgeResult } from '@/types/trackObjects'
import { isLinearObject, isPolygonObject } from '@/types/trackObjects'
import { worldToSVG } from '../hooks/useSVGCoordinates'
import { getObjectStyle } from '../utils/svgColors'
import { getStrokeWidth } from '../utils/svgPathBuilder'

interface SVGGhostPreviewProps {
  selectedObjectType: string | null
  placementState: string
  trackMode: string
  previewPosition: [number, number, number] | null
  dragStartPoint: [number, number, number] | null
  controlPoint: [number, number, number] | null
  currentRoadEdge: RoadEdgeResult | null
  polygonPoints: Array<[number, number, number]>
  partialDeleteMode: boolean
  partialDeleteState: {
    startT: number
    startPosition: [number, number, number]
  } | null
  partialDeletePreviewPosition: [number, number, number] | null
  curbDragState: {
    roadId: string
    edge: 'left' | 'right'
    startT: number
    startPosition: [number, number, number]
  } | null
  curbPreviewEndPosition: [number, number, number] | null
  zoom: number
}

export const SVGGhostPreview = memo(function SVGGhostPreview({
  selectedObjectType,
  placementState,
  trackMode,
  previewPosition,
  dragStartPoint,
  controlPoint,
  currentRoadEdge,
  polygonPoints,
  partialDeleteMode,
  partialDeleteState,
  partialDeletePreviewPosition,
  curbDragState,
  curbPreviewEndPosition,
  zoom,
}: SVGGhostPreviewProps) {
  if (!previewPosition && !partialDeleteMode) return null

  const markerR = 3 / zoom
  const strokeW = 1.5 / zoom

  if (partialDeleteMode) {
    if (partialDeleteState && partialDeletePreviewPosition) {
      const [sx, sy] = worldToSVG(
        partialDeleteState.startPosition[0],
        partialDeleteState.startPosition[2],
      )
      const [ex, ey] = worldToSVG(
        partialDeletePreviewPosition[0],
        partialDeletePreviewPosition[2],
      )
      return (
        <g style={{ pointerEvents: 'none' }}>
          <circle cx={sx} cy={sy} r={markerR} fill="none" stroke="#ff0000" strokeWidth={strokeW} />
          <circle cx={ex} cy={ey} r={markerR} fill="none" stroke="#ff4444" strokeWidth={strokeW} />
          <line
            x1={sx}
            y1={sy}
            x2={ex}
            y2={ey}
            stroke="#ff0000"
            strokeWidth={strokeW}
            strokeDasharray={`${2 / zoom} ${1 / zoom}`}
            opacity={0.6}
          />
        </g>
      )
    }
    if (previewPosition) {
      const [px, py] = worldToSVG(previewPosition[0], previewPosition[2])
      return (
        <g style={{ pointerEvents: 'none' }}>
          <circle
            cx={px}
            cy={py}
            r={markerR}
            fill="none"
            stroke="#ff6600"
            strokeWidth={strokeW}
          />
        </g>
      )
    }
    return null
  }

  if (!previewPosition || !selectedObjectType) return null

  if (placementState === 'polygonDrawing' && isPolygonObject(selectedObjectType as any)) {
    if (polygonPoints.length === 0) return null

    const [px, py] = worldToSVG(previewPosition[0], previewPosition[2])
    const style = getObjectStyle(selectedObjectType as any)

    const pathParts = polygonPoints.map((p, i) => {
      const [x, y] = worldToSVG(p[0], p[2])
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
    })
    pathParts.push(`L ${px} ${py}`)

    const fillParts = [...polygonPoints.map((p, i) => {
      const [x, y] = worldToSVG(p[0], p[2])
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
    }), `L ${px} ${py}`, 'Z']

    return (
      <g style={{ pointerEvents: 'none' }}>
        <path d={fillParts.join(' ')} fill={style.fill} opacity={0.15} />
        <path
          d={pathParts.join(' ')}
          fill="none"
          stroke={style.stroke}
          strokeWidth={strokeW}
          strokeDasharray={`${3 / zoom} ${1.5 / zoom}`}
        />
        {polygonPoints.map((p, i) => {
          const [x, y] = worldToSVG(p[0], p[2])
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={1.5 / zoom}
              fill={i === 0 ? '#00ff88' : '#ffffff'}
              opacity={0.8}
            />
          )
        })}
        <circle cx={px} cy={py} r={1.5 / zoom} fill="#ffaa00" opacity={0.8} />
      </g>
    )
  }

  if (
    (selectedObjectType === 'curb' || selectedObjectType === 'pitbox') &&
    placementState === 'curbDragging' &&
    curbDragState &&
    curbPreviewEndPosition
  ) {
    const [sx, sy] = worldToSVG(
      curbDragState.startPosition[0],
      curbDragState.startPosition[2],
    )
    const [ex, ey] = worldToSVG(curbPreviewEndPosition[0], curbPreviewEndPosition[2])
    const color = selectedObjectType === 'curb' ? '#ff0000' : '#ff8800'

    return (
      <g style={{ pointerEvents: 'none' }}>
        <line
          x1={sx}
          y1={sy}
          x2={ex}
          y2={ey}
          stroke={color}
          strokeWidth={selectedObjectType === 'curb' ? 1.5 : 2}
          strokeLinecap="round"
          opacity={0.7}
        />
        <circle cx={sx} cy={sy} r={1.5 / zoom} fill={color} opacity={0.8} />
        <circle cx={ex} cy={ey} r={1.5 / zoom} fill={color} opacity={0.8} />
      </g>
    )
  }

  if (isLinearObject(selectedObjectType as any)) {
    const [px, py] = worldToSVG(previewPosition[0], previewPosition[2])
    const style = getObjectStyle(selectedObjectType as any, trackMode as any)
    const sw = getStrokeWidth({
      type: selectedObjectType as any,
      trackMode: trackMode as any,
    } as PlacedObject)

    if (placementState === 'selecting') {
      return null
    }

    if (placementState === 'dragging' && dragStartPoint) {
      const [sx, sy] = worldToSVG(dragStartPoint[0], dragStartPoint[2])

      return (
        <g style={{ pointerEvents: 'none' }}>
          <line
            x1={sx}
            y1={sy}
            x2={px}
            y2={py}
            stroke={style.stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            opacity={0.5}
          />
          <circle cx={sx} cy={sy} r={1.2 / zoom} fill="#ffffff" opacity={0.9} />
        </g>
      )
    }

    if (placementState === 'placingControlPoint' && dragStartPoint && controlPoint) {
      const [sx, sy] = worldToSVG(dragStartPoint[0], dragStartPoint[2])
      const [cx, cy] = worldToSVG(controlPoint[0], controlPoint[2])

      const d = `M ${sx} ${sy} Q ${cx} ${cy} ${px} ${py}`

      return (
        <g style={{ pointerEvents: 'none' }}>
          <line x1={sx} y1={sy} x2={cx} y2={cy} stroke="#ffff00" strokeWidth={0.5 / zoom} opacity={0.4} />
          <line x1={cx} y1={cy} x2={px} y2={py} stroke="#ffff00" strokeWidth={0.5 / zoom} opacity={0.4} />
          <path
            d={d}
            fill="none"
            stroke={style.stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            opacity={0.5}
          />
          <circle cx={sx} cy={sy} r={1.2 / zoom} fill="#ffffff" opacity={0.9} />
          <circle cx={cx} cy={cy} r={1.2 / zoom} fill="#ffff00" opacity={0.9} />
        </g>
      )
    }

    return null
  }

  if (selectedObjectType === 'checkpoint') {
    if (currentRoadEdge) {
      const [lx, ly] = worldToSVG(currentRoadEdge.leftEdge[0], currentRoadEdge.leftEdge[2])
      const [rx, ry] = worldToSVG(currentRoadEdge.rightEdge[0], currentRoadEdge.rightEdge[2])

      return (
        <g style={{ pointerEvents: 'none' }}>
          <line
            x1={lx}
            y1={ly}
            x2={rx}
            y2={ry}
            stroke="#00ff00"
            strokeWidth={0.3}
            strokeDasharray={`${2 / zoom} ${1 / zoom}`}
            opacity={0.6}
          />
        </g>
      )
    }
    const [px, py] = worldToSVG(previewPosition[0], previewPosition[2])
    return (
      <g style={{ pointerEvents: 'none' }}>
        <circle cx={px} cy={py} r={markerR} fill="none" stroke="#ff8800" strokeWidth={strokeW} opacity={0.5} />
      </g>
    )
  }

  const [px, py] = worldToSVG(previewPosition[0], previewPosition[2])
  const style = getObjectStyle(selectedObjectType as any)
  return (
    <g style={{ pointerEvents: 'none' }}>
      <circle
        cx={px}
        cy={py}
        r={2}
        fill={style.fill !== 'none' ? style.fill : style.stroke}
        stroke={style.stroke}
        strokeWidth={0.3}
        opacity={0.5}
      />
    </g>
  )
})
