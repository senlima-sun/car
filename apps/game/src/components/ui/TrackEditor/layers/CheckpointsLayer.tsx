import { useShallow } from 'zustand/react/shallow'
import { useTrackEditorStore } from '../state/useTrackEditorStore'
import { pointOnPath } from '../geometry/closestPoint'
import { worldToScreen } from '../geometry/viewport'

const CHECKPOINT_WIDTH_WORLD = 12

export default function CheckpointsLayer() {
  const { doc, viewport, checkpoints, tool, selectedCheckpointId } = useTrackEditorStore(
    useShallow(s => ({
      doc: s.doc,
      viewport: s.viewport,
      checkpoints: s.checkpoints,
      tool: s.tool,
      selectedCheckpointId: s.selectedCheckpointId,
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

  const interactive = tool === 'select'

  return (
    <g pointerEvents={interactive ? 'auto' : 'none'}>
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
        const isSelected = selectedCheckpointId === cp.id
        const color = isStartFinish ? '#38bdf8' : '#34d399'
        const label = isStartFinish ? 'S/F' : `S${sectorOrder.get(cp.id) ?? '?'}`
        const strokeWidth = isSelected ? 5 : 3
        const ringRadius = isSelected ? 8 : 4
        return (
          <g
            key={cp.id}
            style={{ cursor: interactive ? 'pointer' : 'default' }}
          >
            <line
              x1={left.x}
              y1={left.y}
              x2={right.x}
              y2={right.y}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap='round'
            />
            {isSelected && (
              <circle
                cx={center.x}
                cy={center.y}
                r={ringRadius + 4}
                fill='none'
                stroke={color}
                strokeWidth={2}
                strokeDasharray='3 3'
              />
            )}
            <circle cx={center.x} cy={center.y} r={ringRadius} fill={color} />
            <text
              x={center.x + 10}
              y={center.y - 10}
              fill={color}
              fontSize={12}
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
