import { useTrackEditorStore, type Tool } from './state/useTrackEditorStore'

type ShortcutHint = {
  key: string
  label: string
}

const TOOL_LABEL: Record<Tool, string> = {
  pen: 'Pen',
  select: 'Select',
  'start-finish': 'Start / Finish',
  sector: 'Sector',
  'pit-area': 'Pit Area',
}

export default function HintBar() {
  const tool = useTrackEditorStore(s => s.tool)
  const pen = useTrackEditorStore(s => s.pen)
  const selected = useTrackEditorStore(s => s.selected)
  const selectedPitBoxAreaId = useTrackEditorStore(s => s.selectedPitBoxAreaId)

  const content = (() => {
    if (tool === 'pen') {
      if (pen.activePathId) {
        return {
          label: 'Click to add, drag to curve, Enter to finish.',
          shortcuts: [
            { key: 'Click', label: 'Add' },
            { key: 'Drag', label: 'Curve' },
            { key: 'Enter', label: 'Finish' },
          ],
        }
      }
      if (pen.startRef) {
        return {
          label: 'Click an anchor or segment to branch.',
          shortcuts: [
            { key: 'Click', label: 'Connect' },
            { key: 'V', label: 'Select' },
            { key: 'Space', label: 'Pan' },
          ],
        }
      }
      return {
        label: 'Click to start a path.',
        shortcuts: [
          { key: 'Click', label: 'Start' },
          { key: 'Drag', label: 'Curve' },
          { key: '⌘Z', label: 'Undo' },
        ],
      }
    }

    if (tool === 'select') {
      if (selectedPitBoxAreaId) {
        return {
          label: 'Drag to move or rotate pit area.',
          shortcuts: [
            { key: 'Drag', label: 'Move' },
            { key: 'Delete', label: 'Remove' },
            { key: 'P', label: 'Pen' },
          ],
        }
      }
      if (selected) {
        return {
          label: 'Drag anchor, Alt-click to toggle handle mode.',
          shortcuts: [
            { key: 'Drag', label: 'Move' },
            { key: 'Alt+Click', label: 'Toggle' },
            { key: 'Delete', label: 'Remove' },
          ],
        }
      }
      return {
        label: 'Select anchors or pit areas.',
        shortcuts: [
          { key: 'Click', label: 'Select' },
          { key: 'P', label: 'Pen' },
          { key: 'Space', label: 'Pan' },
        ],
      }
    }

    if (tool === 'start-finish') {
      return {
        label: 'Click a segment to place start / finish.',
        shortcuts: [
          { key: 'Click', label: 'Place' },
          { key: 'V', label: 'Select' },
          { key: 'P', label: 'Pen' },
        ],
      }
    }

    if (tool === 'sector') {
      return {
        label: 'Click a segment to add sector timing.',
        shortcuts: [
          { key: 'Click', label: 'Add' },
          { key: 'V', label: 'Select' },
          { key: 'P', label: 'Pen' },
        ],
      }
    }

    return {
      label: 'Click to place a pit area.',
      shortcuts: [
        { key: 'Click', label: 'Place' },
        { key: 'V', label: 'Adjust' },
        { key: 'Delete', label: 'Remove' },
      ],
    }
  })()

  return (
    <div className='pointer-events-none absolute bottom-4 left-1/2 z-20 w-[min(56rem,calc(100%-2rem))] -translate-x-1/2'>
      <div className='flex flex-col gap-2 rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,20,28,0.92),rgba(8,10,16,0.86))] px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.36)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between'>
        <div className='min-w-0 text-sm text-white/76'>
          <span className='text-white/46'>{TOOL_LABEL[tool]}:</span> <span>{content.label}</span>
        </div>
        <div className='flex flex-wrap gap-2'>
          {content.shortcuts.map(shortcut => (
            <ShortcutChip key={`${shortcut.key}-${shortcut.label}`} shortcut={shortcut} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ShortcutChip({ shortcut }: { shortcut: ShortcutHint }) {
  return (
    <div className='inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white/72'>
      <kbd className='rounded-lg border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/56'>
        {shortcut.key}
      </kbd>
      <span>{shortcut.label}</span>
    </div>
  )
}
