import { useEffect, useMemo, useRef, useState } from 'react'
import { useTrackStore } from '@/stores/useTrackStore'
import { PRESET_TRACK_METAS } from '@/constants/tracks'
import DraggablePanel from '../DevTools/DraggablePanel'

const DRAFT_ID = 'editor_draft'

export default function TrackSwitcher() {
  const activeTrackId = useTrackStore(s => s.trackLibrary.activeTrackId)
  const tracks = useTrackStore(s => s.trackLibrary.tracks)
  const loadTrack = useTrackStore(s => s.loadTrack)
  const loadPresetTrack = useTrackStore(s => s.loadPresetTrack)

  const draft = useMemo(() => tracks.find(t => t.id === DRAFT_ID), [tracks])

  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleSelect = (value: string) => {
    if (value === DRAFT_ID) {
      loadTrack(DRAFT_ID)
    } else if (value.startsWith('preset:')) {
      loadPresetTrack(value.slice(7))
    }
    setOpen(false)
  }

  const currentValue = (() => {
    if (!activeTrackId) return ''
    if (activeTrackId === DRAFT_ID) return DRAFT_ID
    const track = tracks.find(t => t.id === activeTrackId)
    if (track?.presetId) return `preset:${track.presetId}`
    return activeTrackId
  })()

  const currentLabel = (() => {
    if (currentValue === DRAFT_ID) return 'Editor Draft'
    if (currentValue.startsWith('preset:')) {
      const presetId = currentValue.slice(7)
      return PRESET_TRACK_METAS.find(p => p.id === presetId)?.name ?? 'Select track'
    }
    return 'Select track'
  })()

  return (
    <DraggablePanel id='track-switcher' title='Track' hotkey='F8'>
      <div className='flex flex-col gap-1 px-3 py-2 text-xs text-white'>
        <div ref={rootRef} className='relative'>
          <button
            type='button'
            onClick={() => setOpen(o => !o)}
            className='flex w-full items-center justify-between rounded bg-neutral-900/90 px-2 py-1 font-mono text-xs text-white ring-1 ring-white/10 hover:ring-white/20 focus:outline-none'
          >
            <span className='truncate'>{currentLabel}</span>
            <span className={`ml-2 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
          {open && (
            <div className='pointer-events-auto absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-64 overflow-y-auto rounded border border-white/10 bg-neutral-900/95 py-1 font-mono text-xs text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur'>
              {draft && (
                <button
                  type='button'
                  onClick={() => handleSelect(DRAFT_ID)}
                  className={`flex w-full px-2 py-1 text-left hover:bg-white/10 ${
                    currentValue === DRAFT_ID ? 'bg-white/[0.06] text-white' : 'text-white/85'
                  }`}
                >
                  Editor Draft
                </button>
              )}
              {PRESET_TRACK_METAS.map(p => {
                const value = `preset:${p.id}`
                const isActive = currentValue === value
                return (
                  <button
                    key={p.id}
                    type='button'
                    onClick={() => handleSelect(value)}
                    className={`flex w-full px-2 py-1 text-left hover:bg-white/10 ${
                      isActive ? 'bg-white/[0.06] text-white' : 'text-white/85'
                    }`}
                  >
                    {p.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </DraggablePanel>
  )
}
