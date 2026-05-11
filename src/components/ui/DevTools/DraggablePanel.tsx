import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useDevToolsStore, type DevPanelId } from '../../../stores/useDevToolsStore'
import { clampPositionToViewport, type Size } from '../../../utils/dragController'
import { useDraggable } from '../../../hooks/useDraggable'

interface DraggablePanelProps {
  id: DevPanelId
  title: string
  hotkey?: string
  children: ReactNode
  defaultSize?: Size
}

export default function DraggablePanel({
  id,
  title,
  hotkey,
  children,
  defaultSize,
}: DraggablePanelProps) {
  const panel = useDevToolsStore(s => s.panels[id])
  const closePanel = useDevToolsStore(s => s.closePanel)
  const bringToFront = useDevToolsStore(s => s.bringToFront)
  const setPanelPosition = useDevToolsStore(s => s.setPanelPosition)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const sizeRef = useRef<Size | null>(defaultSize ?? null)

  const { handleProps } = useDraggable(id, sizeRef)

  useEffect(() => {
    if (!panel.isOpen) return
    function measure() {
      const el = containerRef.current
      if (!el) return
      sizeRef.current = { width: el.offsetWidth, height: el.offsetHeight }
    }
    measure()
    const handleResize = () => {
      measure()
      const size = sizeRef.current
      if (!size) return
      const clamped = clampPositionToViewport(
        panel.position,
        { width: window.innerWidth, height: window.innerHeight },
        size,
      )
      if (clamped.x !== panel.position.x || clamped.y !== panel.position.y) {
        setPanelPosition(id, clamped)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [panel.isOpen, panel.position, id, setPanelPosition])

  if (!panel.isOpen) return null

  return (
    <div
      ref={containerRef}
      className='absolute pointer-events-auto select-none'
      style={{
        left: panel.position.x,
        top: panel.position.y,
        zIndex: 1000 + panel.focusOrder,
      }}
      onPointerDown={() => bringToFront(id)}
    >
      <div
        className='flex flex-col border border-white/12 bg-black/85 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.55)]'
        style={{ minWidth: 200 }}
      >
        <div
          {...handleProps}
          className='flex items-center justify-between gap-2 border-b border-white/10 bg-white/[0.04] px-3 py-1.5 cursor-grab active:cursor-grabbing'
        >
          <div className='flex items-baseline gap-2'>
            <span className='font-sans text-[10px] font-bold uppercase tracking-[0.32em] text-white/85'>
              {title}
            </span>
            {hotkey && (
              <span className='font-mono text-[9px] text-white/35'>{hotkey}</span>
            )}
          </div>
          <button
            type='button'
            onClick={() => closePanel(id)}
            onPointerDown={e => e.stopPropagation()}
            className='pointer-events-auto flex h-5 w-5 items-center justify-center rounded text-white/55 hover:bg-white/10 hover:text-white'
            aria-label={`Close ${title}`}
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        </div>
        <div className='dev-panel-content'>{children}</div>
      </div>
    </div>
  )
}
