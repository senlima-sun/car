import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftRight, MoreHorizontal } from 'lucide-react'
import { listPresetTracks } from '@/constants/tracks'
import { IconButton } from './primitives/IconButton'
import { MenuRow } from './primitives/MenuRow'
import { MenuButton } from './primitives/MenuButton'
import { MenuDivider } from './primitives/MenuDivider'
import { DirChip } from './primitives/DirChip'

export function OverflowMenu({
  raceDirection,
  setRaceDirection,
  activeTrackName,
  onLoadActive,
  onLoadPreset,
  onNewDraft,
}: {
  raceDirection: 'forward' | 'backward'
  setRaceDirection: (value: 'forward' | 'backward') => void
  activeTrackName: string | null
  onLoadActive: () => void
  onLoadPreset: (id: string) => void
  onNewDraft: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const presets = useMemo(() => listPresetTracks(), [])

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

  return (
    <div ref={rootRef} className='relative'>
      <IconButton onClick={() => setOpen(o => !o)} title='More' active={open}>
        <MoreHorizontal size={16} strokeWidth={1.75} />
      </IconButton>
      {open && (
        <div className='pointer-events-auto absolute right-0 top-[calc(100%+8px)] w-64 rounded-2xl border border-white/10 bg-[rgba(14,16,22,0.94)] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.42)] backdrop-blur-xl'>
          <MenuRow
            icon={<ArrowLeftRight size={14} strokeWidth={1.75} />}
            label='Direction'
            trailing={
              <div className='flex items-center gap-1'>
                <DirChip
                  active={raceDirection === 'forward'}
                  onClick={() => setRaceDirection('forward')}
                  label='Fwd'
                />
                <DirChip
                  active={raceDirection === 'backward'}
                  onClick={() => setRaceDirection('backward')}
                  label='Rev'
                />
              </div>
            }
          />
          <MenuDivider />
          <MenuButton
            onClick={() => {
              onLoadActive()
              setOpen(false)
            }}
            label='Load Active Track'
            sub={activeTrackName ?? 'None'}
          />
          <div className='px-2 py-1'>
            <div className='mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/36'>
              Load Preset
            </div>
            <div className='flex flex-col gap-0.5'>
              {presets.map(track => (
                <button
                  key={track.id}
                  className='rounded-lg px-2 py-1.5 text-left text-sm text-white/78 transition hover:bg-white/[0.08] hover:text-white'
                  onClick={() => {
                    onLoadPreset(track.id)
                    setOpen(false)
                  }}
                >
                  {track.name}
                </button>
              ))}
            </div>
          </div>
          <MenuDivider />
          <MenuButton
            onClick={() => {
              onNewDraft()
              setOpen(false)
            }}
            label='New Draft'
            sub='Clear canvas'
          />
        </div>
      )}
    </div>
  )
}
