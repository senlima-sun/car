import { useEffect, useRef, useState } from 'react'
import { Cloud, Flag, Gauge, Locate, Map, Menu, Zap } from 'lucide-react'
import { useDevToolsStore, type DevPanelId } from '../../../stores/useDevToolsStore'
import { runDevAction, type DevActionId } from '../../../hooks/useDevToolsHotkeys'

interface ToolEntry {
  id: DevPanelId
  label: string
  hotkey?: string
  icon: typeof Zap
}

interface ActionEntry {
  id: DevActionId
  label: string
  hotkey?: string
  icon: typeof Zap
}

const TOOLS: ToolEntry[] = [
  { id: 'car-status', label: 'Car Status', icon: Gauge },
  { id: 'minimap', label: 'Minimap', icon: Locate },
  { id: 'physics-debug', label: 'Physics', hotkey: 'F9', icon: Zap },
  { id: 'wheel-visual', label: 'Wheel Visual', hotkey: 'F10', icon: Gauge },
  { id: 'weather', label: 'Weather', hotkey: 'F7', icon: Cloud },
  { id: 'track-switcher', label: 'Track', hotkey: 'F8', icon: Map },
]

const ACTIONS: ActionEntry[] = [
  { id: 'start-lights', label: 'Start Lights', hotkey: 'F4', icon: Flag },
]

export default function DevToolbar() {
  const panels = useDevToolsStore(s => s.panels)
  const toggle = useDevToolsStore(s => s.togglePanel)

  const [expanded, setExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!expanded) return
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current) return
      if (containerRef.current.contains(event.target as Node)) return
      setExpanded(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [expanded])

  const openCount = TOOLS.reduce((n, t) => (panels[t.id].isOpen ? n + 1 : n), 0)

  return (
    <div ref={containerRef} className='pointer-events-auto absolute top-4 left-4 z-[1200]'>
      <button
        type='button'
        onClick={() => setExpanded(v => !v)}
        className={`flex h-8 items-center gap-1.5 border border-white/12 px-2 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-colors ${
          expanded ? 'bg-white/15' : 'bg-black/70 hover:bg-black/85'
        }`}
        aria-label='Dev tools menu'
        aria-expanded={expanded}
      >
        <Menu size={14} strokeWidth={2.2} className='text-white' />
        <span className='font-sans text-[9px] font-bold uppercase tracking-[0.32em] text-white/85'>
          Dev
        </span>
        {openCount > 0 && (
          <span className='flex h-4 min-w-[16px] items-center justify-center rounded-full bg-cyan-500/85 px-1 font-mono text-[9px] font-bold leading-none text-black'>
            {openCount}
          </span>
        )}
      </button>

      {expanded && (
        <div className='absolute top-9 left-0 flex flex-col gap-0.5 border border-white/12 bg-black/85 p-1 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.55)]'>
          {TOOLS.map(({ id, label, hotkey, icon: Icon }) => {
            const isOpen = panels[id].isOpen
            return (
              <button
                key={id}
                type='button'
                onClick={() => toggle(id)}
                className={`flex w-full items-center gap-2.5 px-2 py-1.5 text-left transition-colors ${
                  isOpen ? 'bg-white/12 text-white' : 'text-white/75 hover:bg-white/8 hover:text-white'
                }`}
                aria-label={hotkey ? `Toggle ${label} (${hotkey})` : `Toggle ${label}`}
              >
                <Icon size={13} strokeWidth={2} />
                <span className='flex-1 font-sans text-[11px] font-semibold tracking-wide'>
                  {label}
                </span>
                {hotkey && (
                  <span className='font-mono text-[9px] text-white/40'>{hotkey}</span>
                )}
                {isOpen && <span className='h-1.5 w-1.5 rounded-full bg-cyan-400' />}
              </button>
            )
          })}
          <div className='mt-1 border-t border-white/12 pt-1'>
            {ACTIONS.map(({ id, label, hotkey, icon: Icon }) => (
              <button
                key={id}
                type='button'
                onClick={() => runDevAction(id)}
                className='flex w-full items-center gap-2.5 px-2 py-1.5 text-left text-white/75 transition-colors hover:bg-white/8 hover:text-white'
                aria-label={hotkey ? `${label} (${hotkey})` : label}
              >
                <Icon size={13} strokeWidth={2} />
                <span className='flex-1 font-sans text-[11px] font-semibold tracking-wide'>
                  {label}
                </span>
                {hotkey && (
                  <span className='font-mono text-[9px] text-white/40'>{hotkey}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
