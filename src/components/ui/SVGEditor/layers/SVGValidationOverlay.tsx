import { memo, useMemo } from 'react'
import type { PlacedObject } from '@/types/trackObjects'
import { useTrackGraphStore } from '@/stores/useTrackGraphStore'
import { worldToSVG } from '../hooks/useSVGCoordinates'

interface SVGValidationOverlayProps {
  placedObjects: PlacedObject[]
  zoom: number
}

interface ValidationMarker {
  position: [number, number, number]
  severity: 'error' | 'warning'
  message: string
}

export const SVGValidationOverlay = memo(function SVGValidationOverlay({
  placedObjects,
  zoom,
}: SVGValidationOverlayProps) {
  const graph = useTrackGraphStore(s => s.graph)

  const markers = useMemo((): ValidationMarker[] => {
    if (!graph || placedObjects.length === 0) return []

    const result: ValidationMarker[] = []

    const roads = placedObjects.filter(o => o.type === 'road')
    if (roads.length < 2) return result

    for (const road of roads) {
      if (!road.startPoint || !road.endPoint) continue

      let startConnected = false
      let endConnected = false

      for (const other of roads) {
        if (other.id === road.id || !other.startPoint || !other.endPoint) continue

        const threshold = 5
        const checkDist = (a: [number, number, number], b: [number, number, number]) =>
          Math.sqrt((a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2) < threshold

        if (checkDist(road.startPoint, other.startPoint) || checkDist(road.startPoint, other.endPoint)) {
          startConnected = true
        }
        if (checkDist(road.endPoint, other.startPoint) || checkDist(road.endPoint, other.endPoint)) {
          endConnected = true
        }
      }

      if (!startConnected) {
        result.push({
          position: road.startPoint,
          severity: 'warning',
          message: 'Disconnected endpoint',
        })
      }
      if (!endConnected) {
        result.push({
          position: road.endPoint,
          severity: 'warning',
          message: 'Disconnected endpoint',
        })
      }
    }

    return result
  }, [placedObjects, graph])

  if (markers.length === 0) return null

  const r = 4 / zoom
  const strokeW = 1.5 / zoom
  const fontSize = 3 / zoom

  return (
    <g style={{ pointerEvents: 'none' }}>
      {markers.map((marker, i) => {
        const [mx, my] = worldToSVG(marker.position[0], marker.position[2])
        const color = marker.severity === 'error' ? '#ff0000' : '#ff8800'

        return (
          <g key={`val-${i}`}>
            <circle
              cx={mx}
              cy={my}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={strokeW}
              opacity={0.7}
            />
            <line
              x1={mx - r * 0.5}
              y1={my - r * 0.5}
              x2={mx + r * 0.5}
              y2={my + r * 0.5}
              stroke={color}
              strokeWidth={strokeW}
              opacity={0.7}
            />
            <line
              x1={mx + r * 0.5}
              y1={my - r * 0.5}
              x2={mx - r * 0.5}
              y2={my + r * 0.5}
              stroke={color}
              strokeWidth={strokeW}
              opacity={0.7}
            />
            <text
              x={mx}
              y={my + r + fontSize}
              fill={color}
              fontSize={fontSize}
              textAnchor="middle"
              opacity={0.7}
            >
              {marker.message}
            </text>
          </g>
        )
      })}
    </g>
  )
})
