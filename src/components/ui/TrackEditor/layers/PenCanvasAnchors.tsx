import { useShallow } from 'zustand/react/shallow'
import { useTrackEditorStore } from '../state/useTrackEditorStore'
import { getAnchor, resolveAnchor } from '../geometry/path'
import { worldToScreen } from '../geometry/viewport'

export default function PenCanvasAnchors() {
  const { doc, viewport, tool, selected, selectedAnchors, selectedPathId, pen } =
    useTrackEditorStore(
      useShallow(s => ({
        doc: s.doc,
        viewport: s.viewport,
        tool: s.tool,
        selected: s.selected,
        selectedAnchors: s.selectedAnchors,
        selectedPathId: s.selectedPathId,
        pen: s.pen,
      })),
    )

  const penStartAnchor =
    tool === 'pen' && !pen.activePathId && pen.startRef
      ? getAnchor(doc.paths, pen.startRef.pathId, pen.startRef.anchorIndex)
      : null

  return (
    <g pointerEvents='none'>
      {doc.paths.map(path => {
        const isActive = path.id === pen.activePathId
        if (tool === 'start-finish' || tool === 'sector') return null
        if (tool === 'select' && path.id !== selectedPathId) return null
        return (
          <g key={path.id}>
            {path.anchors.map((slot, i) => {
              const a = resolveAnchor(doc.paths, slot)
              if (!a) return null
              const p = worldToScreen(viewport, a.point)
              const inS = worldToScreen(viewport, a.inHandle)
              const outS = worldToScreen(viewport, a.outHandle)
              const isSel =
                (selected?.pathId === path.id && selected.anchorIndex === i) ||
                selectedAnchors.some(s => s.pathId === path.id && s.anchorIndex === i)
              const isPrimary = selected?.pathId === path.id && selected.anchorIndex === i
              const showHandles = isPrimary || (isActive && i === path.anchors.length - 1)
              const isFirst = i === 0
              const isPenFirstHover = isActive && isFirst && pen.hoverClose
              const isPenVisible = tool === 'pen'
              const hasIn = a.inHandle.x !== a.point.x || a.inHandle.y !== a.point.y
              const hasOut = a.outHandle.x !== a.point.x || a.outHandle.y !== a.point.y
              return (
                <g key={`${i}`}>
                  {showHandles && a.handleType !== 'corner' && (
                    <>
                      {hasIn && (
                        <>
                          <line
                            x1={p.x}
                            y1={p.y}
                            x2={inS.x}
                            y2={inS.y}
                            stroke='#60a5fa'
                            strokeWidth={1}
                            opacity={0.6}
                          />
                          <circle cx={inS.x} cy={inS.y} r={3.5} fill='#60a5fa' />
                        </>
                      )}
                      {hasOut && (
                        <>
                          <line
                            x1={p.x}
                            y1={p.y}
                            x2={outS.x}
                            y2={outS.y}
                            stroke='#60a5fa'
                            strokeWidth={1}
                            opacity={0.6}
                          />
                          <circle cx={outS.x} cy={outS.y} r={3.5} fill='#60a5fa' />
                        </>
                      )}
                    </>
                  )}
                  {isPenFirstHover && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={8}
                      fill='none'
                      stroke='#fbbf24'
                      strokeWidth={1.5}
                    />
                  )}
                  <rect
                    x={p.x - 3.5}
                    y={p.y - 3.5}
                    width={7}
                    height={7}
                    fill={isSel || isActive ? '#60a5fa' : '#0a0a0a'}
                    stroke={isSel || isActive ? '#ffffff' : '#60a5fa'}
                    strokeWidth={1.25}
                    opacity={isPenVisible || isSel ? 1 : 0.9}
                  />
                </g>
              )
            })}
          </g>
        )
      })}
      {penStartAnchor &&
        (() => {
          const p = worldToScreen(viewport, penStartAnchor.point)
          return (
            <g>
              <rect
                x={p.x - 3.5}
                y={p.y - 3.5}
                width={7}
                height={7}
                fill='#60a5fa'
                stroke='#ffffff'
                strokeWidth={1.25}
              />
            </g>
          )
        })()}
    </g>
  )
}
