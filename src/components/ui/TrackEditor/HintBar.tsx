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
  const selectedAnchors = useTrackEditorStore(s => s.selectedAnchors)
  const selectedPitBoxAreaId = useTrackEditorStore(s => s.selectedPitBoxAreaId)

  const content = (() => {
    if (tool === 'pen') {
      if (pen.activePathId) {
        return {
          label: 'Drawing Path',
          hint: 'Click to extend, drag to set curve handles, click the first anchor to close, Enter or Esc to finish.',
          shortcuts: [
            { key: 'Click', label: 'Add anchor' },
            { key: 'Drag', label: 'Curve handle' },
            { key: 'Enter', label: 'Finish' },
            { key: 'Space', label: 'Pan' },
          ],
        }
      }
      if (pen.startRef) {
        return {
          label: 'Branch From Anchor',
          hint: 'Click another anchor to connect immediately, or click a path segment to insert and branch cleanly.',
          shortcuts: [
            { key: 'Click', label: 'Connect' },
            { key: 'P', label: 'Stay in pen' },
            { key: 'V', label: 'Switch select' },
            { key: 'Space', label: 'Pan' },
          ],
        }
      }
      return {
        label: 'Start Drawing',
        hint: 'Click to begin a new path, then drag during placement when you want bezier curvature on the anchor.',
        shortcuts: [
          { key: 'Click', label: 'Start path' },
          { key: 'Drag', label: 'Curve anchor' },
          { key: 'V', label: 'Select' },
          { key: '⌘Z', label: 'Undo' },
        ],
      }
    }

    if (tool === 'select') {
      if (selectedPitBoxAreaId) {
        return {
          label: 'Pit Area Selected',
          hint: 'Drag the box to move it, drag the top handle to rotate it, and use Delete to remove it.',
          shortcuts: [
            { key: 'Drag', label: 'Move' },
            { key: 'Drag ring', label: 'Rotate' },
            { key: 'Delete', label: 'Remove' },
            { key: 'P', label: 'Pen' },
          ],
        }
      }
      if (selected || selectedAnchors.length > 0) {
        return {
          label: 'Anchor Editing',
          hint: 'Drag anchors to reshape the line, drag handles to tune curvature, Alt-click an anchor to toggle its handle mode.',
          shortcuts: [
            { key: 'Drag', label: 'Move anchor' },
            { key: 'Alt+Click', label: 'Toggle mode' },
            { key: 'Delete', label: 'Remove' },
            { key: '⌘Z', label: 'Undo' },
          ],
        }
      }
      return {
        label: 'Selection',
        hint: 'Select anchors or pit areas to edit geometry, then switch back to pen when you want to continue layout work.',
        shortcuts: [
          { key: 'Click', label: 'Select' },
          { key: 'P', label: 'Pen' },
          { key: 'Delete', label: 'Remove' },
          { key: 'Space', label: 'Pan' },
        ],
      }
    }

    if (tool === 'start-finish') {
      return {
        label: TOOL_LABEL[tool],
        hint: 'Click a path segment to place the lap trigger. Placing another one replaces the previous start / finish line.',
        shortcuts: [
          { key: 'Click', label: 'Place line' },
          { key: 'V', label: 'Select' },
          { key: 'P', label: 'Pen' },
          { key: 'Space', label: 'Pan' },
        ],
      }
    }

    if (tool === 'sector') {
      return {
        label: TOOL_LABEL[tool],
        hint: 'Click along the ribbon to drop timing sectors in order. They are exported in the sequence you place them.',
        shortcuts: [
          { key: 'Click', label: 'Add sector' },
          { key: 'V', label: 'Select' },
          { key: 'P', label: 'Pen' },
          { key: '⌘Z', label: 'Undo' },
        ],
      }
    }

    return {
      label: TOOL_LABEL[tool],
      hint: 'Click anywhere to drop a pit service area, then switch to Select when you need to move or rotate it.',
      shortcuts: [
        { key: 'Click', label: 'Drop area' },
        { key: 'V', label: 'Adjust' },
        { key: 'Delete', label: 'Remove' },
        { key: 'Space', label: 'Pan' },
      ],
    }
  })()

  return (
    <div className='pointer-events-none absolute bottom-4 left-1/2 z-20 w-[min(72rem,calc(100%-2rem))] -translate-x-1/2'>
      <div className='rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,20,28,0.92),rgba(8,10,16,0.86))] px-4 py-3 shadow-[0_20px_70px_rgba(0,0,0,0.42)] backdrop-blur-xl'>
        <div className='flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between'>
          <div className='min-w-0'>
            <div className='text-[10px] font-semibold uppercase tracking-[0.32em] text-white/42'>
              {content.label}
            </div>
            <div className='mt-1 text-sm text-white/78'>{content.hint}</div>
          </div>
          <div className='flex flex-wrap gap-2'>
            {content.shortcuts.map(shortcut => (
              <ShortcutChip key={`${shortcut.key}-${shortcut.label}`} shortcut={shortcut} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ShortcutChip({ shortcut }: { shortcut: ShortcutHint }) {
  return (
    <div className='inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white/74'>
      <kbd className='rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/56'>
        {shortcut.key}
      </kbd>
      <span>{shortcut.label}</span>
    </div>
  )
}
