import { useShallow } from 'zustand/react/shallow'
import { useTrackEditorStore } from '../state/useTrackEditorStore'
import { pointOnPath } from '../geometry/closestPoint'
import { worldToScreen } from '../geometry/viewport'

export default function FlowArrowsLayer() {
  const { doc, viewport, raceDirection } = useTrackEditorStore(
    useShallow(s => ({
      doc: s.doc,
      viewport: s.viewport,
      raceDirection: s.raceDirection,
    })),
  )

  const arrows: React.ReactNode[] = []
  for (const path of doc.paths) {
    const segCount = path.closed ? path.anchors.length : path.anchors.length - 1
    for (let si = 0; si < segCount; si++) {
      const onPath = pointOnPath(path, si, 0.5, doc.paths)
      if (!onPath) continue
      const { point, tangent } = onPath
      const dir = raceDirection === 'forward' ? 1 : -1
      const tip = worldToScreen(viewport, {
        x: point.x + dir * tangent.x * 4,
        y: point.y + dir * tangent.y * 4,
      })
      const tail = worldToScreen(viewport, {
        x: point.x - dir * tangent.x * 4,
        y: point.y - dir * tangent.y * 4,
      })
      const leftWing = worldToScreen(viewport, {
        x: point.x + dir * tangent.x * 1.5 + tangent.y * 2,
        y: point.y + dir * tangent.y * 1.5 - tangent.x * 2,
      })
      const rightWing = worldToScreen(viewport, {
        x: point.x + dir * tangent.x * 1.5 - tangent.y * 2,
        y: point.y + dir * tangent.y * 1.5 + tangent.x * 2,
      })
      arrows.push(
        <g key={`${path.id}-${si}`}>
          <line
            x1={tail.x}
            y1={tail.y}
            x2={tip.x}
            y2={tip.y}
            stroke='#fbbf24'
            strokeWidth={1.25}
            opacity={0.7}
          />
          <polyline
            points={`${leftWing.x},${leftWing.y} ${tip.x},${tip.y} ${rightWing.x},${rightWing.y}`}
            fill='none'
            stroke='#fbbf24'
            strokeWidth={1.25}
            opacity={0.85}
          />
        </g>,
      )
    }
  }
  return <g pointerEvents='none'>{arrows}</g>
}
