import { useMemo, useState } from 'react'
import { PRESET_TRACK_METAS } from '@/constants/tracks'
import { LabelTag } from '@/components/ui/primitives'
import { MenuItem } from '../MenuItem'

type Track = {
  id: string
  name: string
  objectCount: number
}

export function ListMode({
  tracks,
  activeTrack,
  onSelectTrack,
  onLoadPreset,
  onNewTrack,
  onRename,
  onDuplicate,
  onDelete,
}: {
  tracks: Track[]
  activeTrack: Track | null
  onSelectTrack: (id: string) => void
  onLoadPreset: (id: string) => void
  onNewTrack: () => void
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [filter, setFilter] = useState('')

  const normalizedFilter = filter.trim().toLowerCase()
  const filteredPresets = useMemo(() => {
    if (!normalizedFilter) return PRESET_TRACK_METAS
    return PRESET_TRACK_METAS.filter(p => p.name.toLowerCase().includes(normalizedFilter))
  }, [normalizedFilter])
  const filteredTracks = useMemo(() => {
    if (!normalizedFilter) return tracks
    return tracks.filter(t => t.name.toLowerCase().includes(normalizedFilter))
  }, [tracks, normalizedFilter])

  return (
    <>
      <input
        type='text'
        placeholder='Search tracks…'
        value={filter}
        onChange={e => setFilter(e.target.value)}
        className='block mx-3 mt-3 mb-2 w-[calc(100%-24px)] px-3 py-2 rounded-md bg-white/[0.08] border border-white/15 text-white text-[13px] outline-none focus:border-white/30'
        autoFocus
      />

      {filteredPresets.length > 0 && (
        <div className='border-b border-white/8'>
          <LabelTag className='block px-3 py-2'>🏎️ F1 Tracks</LabelTag>
          {filteredPresets.map(preset => (
            <MenuItem
              key={preset.id}
              icon='🏁'
              name={preset.name}
              meta={`${(preset.trackLength / 1000).toFixed(1)}km`}
              onClick={() => onLoadPreset(preset.id)}
            />
          ))}
        </div>
      )}

      <div className='border-b border-white/8'>
        <LabelTag className='block px-3 py-2'>Tracks</LabelTag>
        {filteredTracks.length === 0 ? (
          <div className='px-3 py-5 text-center text-white/45 text-[13px]'>
            {tracks.length === 0 ? 'No tracks yet' : 'No matches'}
          </div>
        ) : (
          filteredTracks.map(track => (
            <MenuItem
              key={track.id}
              icon={track.id === activeTrack?.id ? '●' : '○'}
              name={track.name}
              meta={`${track.objectCount} obj`}
              isActive={track.id === activeTrack?.id}
              onClick={() => onSelectTrack(track.id)}
            />
          ))
        )}
      </div>

      <div className='py-1'>
        <ActionButton icon='+' label='New Track' onClick={onNewTrack} />
        {activeTrack && (
          <>
            <ActionButton icon='✎' label='Rename' onClick={onRename} />
            <ActionButton icon='⧉' label='Duplicate' onClick={onDuplicate} />
            <ActionButton icon='✕' label='Delete' danger onClick={onDelete} />
          </>
        )}
      </div>
    </>
  )
}

function ActionButton({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: string
  label: string
  danger?: boolean
  onClick: () => void
}) {
  const text = danger ? 'text-red-300 hover:text-red-200' : 'text-white hover:text-white'
  return (
    <button
      type='button'
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] cursor-pointer transition-colors hover:bg-white/[0.08] ${text}`}
    >
      <span className='w-[18px] text-center opacity-70'>{icon}</span>
      {label}
    </button>
  )
}
