import { useShallow } from 'zustand/react/shallow'
import { useTrackEditorStore } from '../state/useTrackEditorStore'
import { pathToSvgD, segmentToSvgD } from '../geometry/path'

export default function PenCanvasPaths() {
  const { doc, viewport, tool, pen, selectedPathId } = useTrackEditorStore(
    useShallow(s => ({
      doc: s.doc,
      viewport: s.viewport,
      tool: s.tool,
      pen: s.pen,
      selectedPathId: s.selectedPathId,
    })),
  )

  return (
    <g>
      {doc.paths.map(path => {
        const d = pathToSvgD(path, doc.paths)
        const isActive = path.id === pen.activePathId
        const isSelectedPath = tool === 'select' && selectedPathId === path.id
        const rotDeg = (viewport.rotation * 180) / Math.PI
        const transform = `translate(${viewport.pan.x} ${viewport.pan.y}) rotate(${rotDeg}) scale(${viewport.zoom})`
        return (
          <g key={path.id} transform={transform}>
            {(tool === 'select' || isActive) && (
              <path
                d={d}
                stroke={isSelectedPath ? '#60a5fa' : '#3b82f6'}
                strokeOpacity={isSelectedPath ? 0.9 : 0.45}
                strokeWidth={isSelectedPath ? 2 : 1}
                fill='none'
                strokeLinecap='round'
                strokeLinejoin='round'
                vectorEffect='non-scaling-stroke'
              />
            )}
            <path
              d={d}
              stroke={isActive ? '#60a5fa' : path.stroke}
              strokeWidth={path.strokeWidth}
              fill={path.fill}
              strokeLinecap='round'
              strokeLinejoin='round'
              vectorEffect='non-scaling-stroke'
            />
            {(path.pitLaneSegments ?? []).map(i => {
              const pd = segmentToSvgD(path, i, doc.paths)
              if (!pd) return null
              return (
                <path
                  key={`pit-${i}`}
                  d={pd}
                  stroke='#f97316'
                  strokeWidth={6}
                  fill='none'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  vectorEffect='non-scaling-stroke'
                />
              )
            })}
          </g>
        )
      })}
    </g>
  )
}
