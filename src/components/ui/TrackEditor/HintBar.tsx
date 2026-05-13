import { useMemo } from 'react'
import { useTrackEditorStore } from './state/useTrackEditorStore'
import { useTrackStore } from '../../../stores/useTrackStore'
import { IS_DEV } from '../../../utils/isDev'

type ShortcutHint = {
  key: string
  label: string
}

export default function HintBar() {
  const tool = useTrackEditorStore(s => s.tool)
  const pen = useTrackEditorStore(s => s.pen)
  const selected = useTrackEditorStore(s => s.selected)
  const selectedPitBoxAreaId = useTrackEditorStore(s => s.selectedPitBoxAreaId)
  const activeTrackId = useTrackStore(s => s.trackLibrary.activeTrackId)
  const tracks = useTrackStore(s => s.trackLibrary.tracks)
  const activePresetId = useMemo(() => {
    if (!activeTrackId) return null
    return tracks.find(t => t.id === activeTrackId)?.presetId ?? null
  }, [activeTrackId, tracks])

  const shortcuts: ShortcutHint[] = (() => {
    if (tool === 'pen') {
      if (pen.activePathId) {
        return [
          { key: 'Click', label: 'Add' },
          { key: 'Drag', label: 'Curve' },
          { key: 'Enter', label: 'Finish' },
        ]
      }
      if (pen.startRef) {
        return [
          { key: 'Click', label: 'Connect' },
          { key: 'V', label: 'Select' },
          { key: 'Space', label: 'Pan' },
        ]
      }
      return [
        { key: 'Click', label: 'Start' },
        { key: 'Drag', label: 'Curve' },
        { key: '⌘Z', label: 'Undo' },
      ]
    }

    if (tool === 'select') {
      if (selectedPitBoxAreaId) {
        return [
          { key: 'Drag', label: 'Move' },
          { key: '⌫', label: 'Remove' },
          { key: 'P', label: 'Pen' },
        ]
      }
      if (selected) {
        return [
          { key: 'Drag', label: 'Move' },
          { key: '⌥Click', label: 'Toggle' },
          { key: '⌫', label: 'Remove' },
        ]
      }
      return [
        { key: 'Click', label: 'Select' },
        { key: 'P', label: 'Pen' },
        { key: 'Space', label: 'Pan' },
      ]
    }

    if (tool === 'start-finish' || tool === 'sector') {
      return [
        { key: 'Click', label: 'Place' },
        { key: 'V', label: 'Select' },
        { key: 'P', label: 'Pen' },
      ]
    }

    if (tool === 'curb') {
      return [
        { key: 'Drag', label: 'Place curb' },
        { key: 'V', label: 'Select' },
        { key: 'Space', label: 'Pan' },
      ]
    }

    if (tool === 'terrain') {
      return [
        { key: 'Drag', label: 'Paint' },
        { key: '⌘Z', label: 'Undo' },
        { key: 'V', label: 'Select' },
      ]
    }

    return [
      { key: 'Click', label: 'Place' },
      { key: 'V', label: 'Adjust' },
      { key: '⌫', label: 'Remove' },
    ]
  })()

  return (
    <div className='pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2'>
      <div className='flex items-center gap-1.5'>
        {shortcuts.map(shortcut => (
          <ShortcutChip key={`${shortcut.key}-${shortcut.label}`} shortcut={shortcut} />
        ))}
        {IS_DEV && activePresetId && <PreviewLink presetId={activePresetId} />}
      </div>
    </div>
  )
}

function PreviewLink({ presetId }: { presetId: string }) {
  return (
    <a
      href={`/track-preview?track=${presetId}`}
      target='_blank'
      rel='noopener'
      className='pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/15 px-2.5 py-1 text-[11px] text-cyan-200 backdrop-blur-md hover:bg-cyan-500/25'
    >
      <span className='text-[10px] font-semibold uppercase tracking-[0.14em]'>Preview</span>
      <span>Open ↗</span>
    </a>
  )
}

function ShortcutChip({ shortcut }: { shortcut: ShortcutHint }) {
  return (
    <div className='inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-[rgba(14,16,22,0.72)] px-2.5 py-1 text-[11px] text-white/62 backdrop-blur-md'>
      <kbd className='text-[10px] font-semibold uppercase tracking-[0.14em] text-white/78'>
        {shortcut.key}
      </kbd>
      <span className='text-white/48'>{shortcut.label}</span>
    </div>
  )
}
