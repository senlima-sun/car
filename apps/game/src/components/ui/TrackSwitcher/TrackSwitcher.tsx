import { useMemo } from 'react'
import { useTrackStore } from '@/stores/useTrackStore'
import { PRESET_TRACKS } from '@/constants/tracks'
import DraggablePanel from '../DevTools/DraggablePanel'

const DRAFT_ID = 'editor_draft'

export default function TrackSwitcher() {
  const activeTrackId = useTrackStore(s => s.trackLibrary.activeTrackId)
  const tracks = useTrackStore(s => s.trackLibrary.tracks)
  const loadTrack = useTrackStore(s => s.loadTrack)
  const loadPresetTrack = useTrackStore(s => s.loadPresetTrack)

  const draft = useMemo(() => tracks.find(t => t.id === DRAFT_ID), [tracks])

  const onChange = (value: string) => {
    if (value.startsWith('preset:')) {
      loadPresetTrack(value.slice(7))
      return
    }
    loadTrack(value)
  }

  const currentValue = (() => {
    if (!activeTrackId) return ''
    if (activeTrackId === DRAFT_ID) return DRAFT_ID
    const track = tracks.find(t => t.id === activeTrackId)
    if (track?.presetId) return `preset:${track.presetId}`
    return activeTrackId
  })()

  return (
    <DraggablePanel id='track-switcher' title='Track' hotkey='F8'>
      <div className='flex flex-col gap-1 px-3 py-2 text-xs text-white'>
        <select
          className='rounded bg-neutral-900/90 px-2 py-1 font-mono text-xs text-white focus:outline-none ring-1 ring-white/10'
          value={currentValue}
          onChange={e => {
            onChange(e.target.value)
            e.currentTarget.blur()
          }}
        >
          {draft && <option value={DRAFT_ID}>Editor Draft</option>}
          {PRESET_TRACKS.map(p => (
            <option key={p.id} value={`preset:${p.id}`}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </DraggablePanel>
  )
}
