import { useShallow } from 'zustand/react/shallow'
import { useTrackEditorStore } from '../state/useTrackEditorStore'
import { pointOnPath } from '../geometry/closestPoint'
import { worldToScreen } from '../geometry/viewport'

const CHECKPOINT_WIDTH_WORLD = 12

export default function CheckpointsLayer() {
  const { doc, viewport, checkpoints } = useTrackEditorStore(
    useShallow(s => ({
      doc: s.doc,
      viewport: s.viewport,
      checkpoints: s.checkpoints,
    })),
  )

  const sectorOrder = new Map<string, number>()
  let sectorIdx = 0
  for (const cp of checkpoints) {
    if (cp.kind === 'sector') {
      sectorIdx += 1
      sectorOrder.set(cp.id, sectorIdx)
    }
  }

  return (
    <g pointerEvents='none'>
      {checkpoints.map(cp => {
        const path = doc.paths.find(p => p.id === cp.pathId)
        if (!path) return null
        const onPath = pointOnPath(path, cp.segmentIndex, cp.t, doc.paths)
        if (!onPath) return null
        const { point, tangent } = onPath
        const half = CHECKPOINT_WIDTH_WORLD / 2
        const leftWorld = { x: point.x - tangent.y * half, y: point.y + tangent.x * half }
        const rightWorld = { x: point.x + tangent.y * half, y: point.y - tangent.x * half }
        const center = worldToScreen(viewport, point)
        const left = worldToScreen(viewport, leftWorld)
        const right = worldToScreen(viewport, rightWorld)
        const isStartFinish = cp.kind === 'start-finish'
        const color = isStartFinish ? '#38bdf8' : '#34d399'
        const label = isStartFinish ? 'S/F' : `S${sectorOrder.get(cp.id) ?? '?'}`
        return (
          <g key={cp.id}>
            <line
              x1={left.x}
              y1={left.y}
              x2={right.x}
              y2={right.y}
              stroke={color}
              strokeWidth={3}
              strokeLinecap='round'
            />
            <circle cx={center.x} cy={center.y} r={4} fill={color} />
            <text
              x={center.x + 8}
              y={center.y - 8}
              fill={color}
              fontSize={11}
              fontFamily='monospace'
              fontWeight='bold'
            >
              {label}
            </text>
          </g>
        )
      })}
    </g>
  )
}
