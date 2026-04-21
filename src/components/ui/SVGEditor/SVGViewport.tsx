import { type ReactNode, forwardRef } from 'react'
import { BACKGROUND_COLOR } from './utils/svgColors'

interface SVGViewportProps {
  viewBox: string
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onClick: (e: React.MouseEvent) => void
  onDoubleClick: (e: React.MouseEvent) => void
  children: ReactNode
}

export const SVGViewport = forwardRef<SVGSVGElement, SVGViewportProps>(function SVGViewport(
  { viewBox, onPointerDown, onPointerMove, onPointerUp, onClick, onDoubleClick, children },
  ref,
) {
  return (
    <svg
      ref={ref}
      viewBox={viewBox}
      className='w-full h-full block select-none'
      style={{ background: BACKGROUND_COLOR }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={e => e.preventDefault()}
    >
      {children}
    </svg>
  )
})
