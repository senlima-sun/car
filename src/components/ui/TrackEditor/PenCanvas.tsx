import { useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTrackEditorStore } from './state/useTrackEditorStore'
import { worldToScreen } from './geometry/viewport'
import { buildPreviewSegment } from './helpers/previewSegment'
import { usePenCanvasInput } from './hooks/usePenCanvasInput'
import { usePenCanvasKeyboard } from './hooks/usePenCanvasKeyboard'
import { useTerrainBrushStroke } from './hooks/useTerrainBrushStroke'
import HeightmapOverlay from './layers/HeightmapOverlay'
import TerrainBrushCursor from './layers/TerrainBrushCursor'
import PenCanvasGrid from './layers/PenCanvasGrid'
import PenCanvasPaths from './layers/PenCanvasPaths'
import PenCanvasAnchors from './layers/PenCanvasAnchors'
import CurbsLayer from './layers/CurbsLayer'
import CheckpointsLayer from './layers/CheckpointsLayer'
import FlowArrowsLayer from './layers/FlowArrowsLayer'
import PitBoxAreaLayer from './layers/PitBoxAreaLayer'

export default function PenCanvas() {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const { spaceDown } = usePenCanvasKeyboard()
  const terrain = useTerrainBrushStroke()

  const snapshot = useTrackEditorStore(
    useShallow(s => ({
      doc: s.doc,
      viewport: s.viewport,
      tool: s.tool,
      pen: s.pen,
      pendingCurbVariant: s.pendingCurbVariant,
    })),
  )
  const { doc, viewport, tool, pen, pendingCurbVariant } = snapshot

  const input = usePenCanvasInput({ svgRef, spaceDown, terrain, snapshot })
  const { drag, hoverWorld, penPathInsertHint, curbHoverHint } = input

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const handler = (e: WheelEvent) => e.preventDefault()
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  const previewSegment =
    tool === 'pen' && !drag
      ? buildPreviewSegment({ paths: doc.paths, viewport, pen, hoverWorld })
      : null

  const cursor =
    spaceDown || drag?.kind === 'pan' ? 'grab' : tool === 'pen' ? 'crosshair' : 'default'

  return (
    <svg
      ref={svgRef}
      className='absolute inset-0 h-full w-full'
      style={{
        cursor,
        background: '#0a0a0a',
        userSelect: tool === 'terrain' ? 'none' : undefined,
        WebkitUserSelect: tool === 'terrain' ? 'none' : undefined,
      }}
      onPointerDown={input.onPointerDown}
      onPointerMove={input.onPointerMove}
      onPointerUp={input.onPointerUp}
      onPointerCancel={input.onPointerUp}
      onWheel={input.onWheel}
      onContextMenu={input.onContextMenu}
    >
      <HeightmapOverlay viewport={viewport} suspendUpdates={terrain.isStrokeActive} />
      {tool !== 'terrain' && <PenCanvasGrid viewport={viewport} svgRef={svgRef} />}
      <PenCanvasPaths />
      {previewSegment && (
        <path
          d={previewSegment}
          stroke='#60a5fa'
          strokeWidth={1}
          fill='none'
          strokeDasharray='4 4'
          opacity={0.9}
        />
      )}
      <FlowArrowsLayer />
      <PitBoxAreaLayer />
      <CheckpointsLayer />
      <CurbsLayer
        drag={
          drag?.kind === 'curb'
            ? {
                pathId: drag.pathId,
                edge: drag.edge,
                pathStart: drag.pathStart,
                pathEnd: drag.pathEnd,
                variant: pendingCurbVariant,
              }
            : null
        }
        hoverHint={tool === 'curb' && !drag ? curbHoverHint : null}
        hoverVariant={pendingCurbVariant}
      />
      <PenCanvasAnchors />
      {penPathInsertHint &&
        tool === 'pen' &&
        (() => {
          const s = worldToScreen(viewport, penPathInsertHint)
          return (
            <g pointerEvents='none'>
              <circle cx={s.x} cy={s.y} r={8} fill='none' stroke='#fbbf24' strokeWidth={1.5} />
              <line
                x1={s.x - 4}
                y1={s.y}
                x2={s.x + 4}
                y2={s.y}
                stroke='#fbbf24'
                strokeWidth={1.5}
              />
              <line
                x1={s.x}
                y1={s.y - 4}
                x2={s.x}
                y2={s.y + 4}
                stroke='#fbbf24'
                strokeWidth={1.5}
              />
            </g>
          )
        })()}
      {tool === 'terrain' && <TerrainBrushCursor viewport={viewport} world={hoverWorld} />}
    </svg>
  )
}
