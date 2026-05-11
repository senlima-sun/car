import { Cloud, Map, Zap } from 'lucide-react'
import { useDevToolsStore, type DevPanelId } from '../../../stores/useDevToolsStore'

interface ToolEntry {
  id: DevPanelId
  label: string
  hotkey: string
  icon: typeof Zap
}

const TOOLS: ToolEntry[] = [
  { id: 'physics-debug', label: 'Physics', hotkey: 'F9', icon: Zap },
  { id: 'weather', label: 'Weather', hotkey: 'F7', icon: Cloud },
  { id: 'track-switcher', label: 'Track', hotkey: 'F8', icon: Map },
]

export default function DevToolbar() {
  const panels = useDevToolsStore(s => s.panels)
  const toggle = useDevToolsStore(s => s.togglePanel)

  return (
    <div className='pointer-events-auto absolute top-4 left-4 z-[1200] flex items-center gap-1.5 border border-white/12 bg-black/70 px-1.5 py-1 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.45)]'>
      <span className='px-2 font-sans text-[9px] font-bold uppercase tracking-[0.32em] text-white/45'>
        Dev
      </span>
      <div className='h-5 w-px bg-white/10' />
      {TOOLS.map(({ id, label, hotkey, icon: Icon }) => {
        const isOpen = panels[id].isOpen
        return (
          <button
            key={id}
            type='button'
            onClick={() => toggle(id)}
            className={`group relative flex h-7 w-7 items-center justify-center rounded transition-colors ${
              isOpen ? 'bg-white/15 text-white' : 'text-white/55 hover:bg-white/8 hover:text-white'
            }`}
            aria-label={`Toggle ${label} (${hotkey})`}
            title={`${label} (${hotkey})`}
          >
            <Icon size={14} strokeWidth={2} />
            {isOpen && (
              <span className='absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 bg-cyan-400' />
            )}
          </button>
        )
      })}
    </div>
  )
}
