import { useShallow } from 'zustand/react/shallow'
import { useTrackEditorStore } from '../state/useTrackEditorStore'
import { curbPolylinePoints } from '../geometry/curbPolyline'
import { CURB_VARIANT_COLOR } from '../../../../constants/colors'

type CurbDragPreview = {
  pathId: string
  edge: 'left' | 'right'
  pathStart: number
  pathEnd: number
  variant: 'apex' | 'exit' | 'flat'
}

type Props = {
  drag: CurbDragPreview | null
  hoverHint: { pathId: string; pathPos: number; edge: 'left' | 'right' } | null
  hoverVariant: 'apex' | 'exit' | 'flat'
}

export default function CurbsLayer({ drag, hoverHint, hoverVariant }: Props) {
  const { doc, viewport, curbs, selectedCurbId } = useTrackEditorStore(
    useShallow(s => ({
      doc: s.doc,
      viewport: s.viewport,
      curbs: s.curbs,
      selectedCurbId: s.selectedCurbId,
    })),
  )

  const hoverPreviewPoints = (() => {
    if (!hoverHint) return null
    const path = doc.paths.find(p => p.id === hoverHint.pathId)
    if (!path) return null
    const segLimit = path.closed ? path.anchors.length : Math.max(0, path.anchors.length - 1)
    const half = 0.08
    const lo = Math.max(0, hoverHint.pathPos - half)
    const hi = Math.min(segLimit - 1e-6, hoverHint.pathPos + half)
    return curbPolylinePoints(doc.paths, hoverHint.pathId, lo, hi, hoverHint.edge, viewport)
  })()

  return (
    <g pointerEvents='none'>
      {curbs.map(c => {
        const points = curbPolylinePoints(
          doc.paths,
          c.pathId,
          c.pathStart,
          c.pathEnd,
          c.edge,
          viewport,
        )
        if (!points) return null
        const color = CURB_VARIANT_COLOR[c.variant]
        const isSelected = c.id === selectedCurbId
        return (
          <g key={c.id}>
            {isSelected && (
              <polyline
                points={points}
                fill='none'
                stroke={color}
                strokeOpacity={0.35}
                strokeWidth={10}
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            )}
            <polyline
              points={points}
              fill='none'
              stroke={color}
              strokeWidth={isSelected ? 3.5 : 2.5}
              strokeOpacity={0.95}
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </g>
        )
      })}
      {drag && (
        <polyline
          points={curbPolylinePoints(
            doc.paths,
            drag.pathId,
            drag.pathStart,
            drag.pathEnd,
            drag.edge,
            viewport,
          )}
          fill='none'
          stroke={CURB_VARIANT_COLOR[drag.variant]}
          strokeOpacity={0.85}
          strokeWidth={4}
          strokeLinecap='round'
        />
      )}
      {!drag && hoverPreviewPoints && (
        <polyline
          points={hoverPreviewPoints}
          fill='none'
          stroke={CURB_VARIANT_COLOR[hoverVariant]}
          strokeOpacity={0.55}
          strokeWidth={2.5}
          strokeDasharray='4 3'
          strokeLinecap='round'
        />
      )}
    </g>
  )
}
