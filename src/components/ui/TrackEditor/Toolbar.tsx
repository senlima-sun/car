import { useMemo, useState } from 'react'
import { PRESET_TRACKS } from '@/constants/tracks'
import { useGameStore } from '@/stores/useGameStore'
import { useTrackStore } from '@/stores/useTrackStore'
import { exportToTrackStore } from './export/exportToTrackStore'
import { getAnchor } from './geometry/path'
import {
  fitViewportToEditorState,
  importTrackObjectsToEditorState,
} from './import/trackObjectsToEditor'
import { useTrackEditorStore, type Tool } from './state/useTrackEditorStore'

const TOOL_META: Record<Tool, { label: string; short: string; tint: string; dot: string }> = {
  pen: {
    label: 'Pen',
    short: 'Draw',
    tint: 'border-sky-300/28 bg-sky-500/18 text-white',
    dot: 'bg-sky-300',
  },
  select: {
    label: 'Select',
    short: 'Edit',
    tint: 'border-cyan-300/28 bg-cyan-500/16 text-white',
    dot: 'bg-cyan-300',
  },
  'start-finish': {
    label: 'Start / Finish',
    short: 'Lap',
    tint: 'border-emerald-300/28 bg-emerald-500/16 text-white',
    dot: 'bg-emerald-300',
  },
  sector: {
    label: 'Sector',
    short: 'Split',
    tint: 'border-lime-300/28 bg-lime-500/16 text-white',
    dot: 'bg-lime-300',
  },
  'pit-area': {
    label: 'Pit Area',
    short: 'Pit',
    tint: 'border-amber-300/28 bg-amber-500/16 text-white',
    dot: 'bg-amber-300',
  },
}

const panelClass =
  'rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,22,30,0.88),rgba(8,10,16,0.84))] p-3 shadow-[0_16px_48px_rgba(0,0,0,0.38)] backdrop-blur-xl'

const sectionLabelClass = 'text-[10px] font-semibold uppercase tracking-[0.28em] text-white/42'

export default function Toolbar() {
  const [presetId, setPresetId] = useState(PRESET_TRACKS[0]?.id ?? '')
  const tool = useTrackEditorStore(s => s.tool)
  const setTool = useTrackEditorStore(s => s.setTool)
  const undo = useTrackEditorStore(s => s.undo)
  const redo = useTrackEditorStore(s => s.redo)
  const past = useTrackEditorStore(s => s.past.length)
  const future = useTrackEditorStore(s => s.future.length)
  const newDocument = useTrackEditorStore(s => s.newDocument)
  const selected = useTrackEditorStore(s => s.selected)
  const doc = useTrackEditorStore(s => s.doc)
  const setHandleType = useTrackEditorStore(s => s.setHandleType)
  const deleteAnchor = useTrackEditorStore(s => s.deleteAnchor)
  const commit = useTrackEditorStore(s => s.commit)
  const enterMenu = useGameStore(s => s.enterMenu)
  const checkpoints = useTrackEditorStore(s => s.checkpoints)
  const raceDirection = useTrackEditorStore(s => s.raceDirection)
  const setRaceDirection = useTrackEditorStore(s => s.setRaceDirection)
  const selectedAnchors = useTrackEditorStore(s => s.selectedAnchors)
  const pitBoxAreas = useTrackEditorStore(s => s.pitBoxAreas)
  const markPitLaneSegments = useTrackEditorStore(s => s.markPitLaneSegments)
  const unmarkPitLaneSegments = useTrackEditorStore(s => s.unmarkPitLaneSegments)
  const loadDocument = useTrackEditorStore(s => s.loadDocument)
  const setViewport = useTrackEditorStore(s => s.setViewport)
  const pen = useTrackEditorStore(s => s.pen)
  const trackLibrary = useTrackStore(s => s.trackLibrary)
  const loadPresetTrack = useTrackStore(s => s.loadPresetTrack)

  const activeTrack = useMemo(
    () =>
      trackLibrary.activeTrackId
        ? (trackLibrary.tracks.find(track => track.id === trackLibrary.activeTrackId) ?? null)
        : null,
    [trackLibrary.activeTrackId, trackLibrary.tracks],
  )

  const startFinishCount = checkpoints.filter(c => c.kind === 'start-finish').length
  const sectorCount = checkpoints.filter(c => c.kind === 'sector').length
  const anchorCount = useMemo(
    () => doc.paths.reduce((total, path) => total + path.anchors.length, 0),
    [doc.paths],
  )

  const pitLaneSelection = (() => {
    if (selectedAnchors.length < 2) return null
    const pathId = selectedAnchors[0]!.pathId
    if (!selectedAnchors.every(anchor => anchor.pathId === pathId)) return null
    const indices = selectedAnchors.map(anchor => anchor.anchorIndex).sort((a, b) => a - b)
    const start = indices[0]!
    const end = indices[indices.length - 1]!
    const segmentIndices: number[] = []
    for (let i = start; i < end; i++) segmentIndices.push(i)
    return { pathId, segmentIndices }
  })()

  const path = pitLaneSelection ? doc.paths.find(item => item.id === pitLaneSelection.pathId) : null
  const pitSegSet = new Set(path?.pitLaneSegments ?? [])
  const allMarked =
    pitLaneSelection !== null &&
    pitLaneSelection.segmentIndices.length > 0 &&
    pitLaneSelection.segmentIndices.every(index => pitSegSet.has(index))

  const onExportTo3D = () => {
    if (doc.paths.length === 0) {
      alert('Draw at least one path segment before exporting.')
      return
    }
    if (startFinishCount === 0) {
      alert('Place a Start/Finish line before exporting.')
      return
    }
    const result = exportToTrackStore({
      paths: doc.paths,
      checkpoints,
      raceDirection,
      pitBoxAreas,
    })
    if (result.ribbonCount === 0) {
      alert('No track produced. Add more anchors first.')
      return
    }
    if (
      !confirm(
        `Export ${result.ribbonCount} track + ${result.checkpointCount} checkpoint(s) + ${result.pitBoxCount} pit box(es)? This will become the active track.`,
      )
    ) {
      return
    }
    result.commit()
    alert('Export complete. Return to main menu and start a test session to drive.')
  }

  const selectedAnchor = (() => {
    if (!selected) return null
    return getAnchor(doc.paths, selected.pathId, selected.anchorIndex)
  })()

  const importObjectsIntoEditor = (
    objects: Parameters<typeof importTrackObjectsToEditorState>[0],
  ): boolean => {
    const imported = importTrackObjectsToEditorState(objects)
    if (imported.doc.paths.length === 0) {
      alert('This track cannot be loaded into the new editor yet.')
      return false
    }

    if (
      (doc.paths.length > 0 || checkpoints.length > 0 || pitBoxAreas.length > 0) &&
      !confirm('Replace the current editor document with the imported track?')
    ) {
      return false
    }

    loadDocument(imported)
    setViewport(fitViewportToEditorState(imported, window.innerWidth, window.innerHeight))
    return true
  }

  const onImportActiveTrack = () => {
    if (!activeTrack) {
      alert('No active track is loaded.')
      return
    }

    importObjectsIntoEditor(activeTrack.objects)
  }

  const onImportPreset = () => {
    const preset = PRESET_TRACKS.find(track => track.id === presetId)
    if (!preset) return
    if (!importObjectsIntoEditor(preset.objects)) return
    loadPresetTrack(preset.id)
  }

  const toolMeta = TOOL_META[tool]
  const summary = (() => {
    if (pen.activePathId) {
      const activePath = doc.paths.find(item => item.id === pen.activePathId)
      return `Drawing ${activePath?.anchors.length ?? 0}`
    }
    if (pitLaneSelection && pitLaneSelection.segmentIndices.length > 0) {
      return `Pit ${pitLaneSelection.segmentIndices.length} seg`
    }
    if (selectedAnchors.length > 1) return `${selectedAnchors.length} selected`
    if (selectedAnchor) return selectedAnchor.handleType
    return toolMeta.short
  })()

  return (
    <div className='pointer-events-none absolute inset-x-4 top-4 z-20 flex flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,29rem)_22rem] xl:items-start'>
      <div className='pointer-events-auto flex flex-col gap-3'>
        <section className={panelClass}>
          <div className='flex items-center justify-between gap-3'>
            <div className='min-w-0'>
              <div className='flex items-center gap-2'>
                <span className={`h-2.5 w-2.5 rounded-full ${toolMeta.dot}`} />
                <div className='truncate text-sm font-semibold uppercase tracking-[0.24em] text-white'>
                  Track Editor
                </div>
              </div>
              <div className='mt-1 truncate text-xs text-white/52'>
                {activeTrack?.name ?? 'Editor Draft'} · {summary}
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <TinyActionButton disabled={past === 0} onClick={undo} label='Undo' meta='⌘Z'>
                ↶
              </TinyActionButton>
              <TinyActionButton disabled={future === 0} onClick={redo} label='Redo' meta='⇧⌘Z'>
                ↷
              </TinyActionButton>
              <button
                className='inline-flex h-10 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.05] px-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/82 transition hover:border-white/18 hover:bg-white/[0.08] hover:text-white'
                onClick={enterMenu}
                title='Back to Main Menu'
              >
                Menu
              </button>
            </div>
          </div>
          <div className='mt-3 flex flex-wrap gap-2'>
            <StatPill label='Paths' value={String(doc.paths.length)} />
            <StatPill label='Anchors' value={String(anchorCount)} />
            <StatPill label='Checks' value={String(checkpoints.length)} />
            <StatPill label='Pit' value={String(pitBoxAreas.length)} />
          </div>
        </section>

        <section className={panelClass}>
          <div className='flex items-center justify-between gap-3'>
            <div className={sectionLabelClass}>Tools</div>
            <div
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${toolMeta.tint}`}
            >
              {toolMeta.label}
            </div>
          </div>

          <div className='mt-3 grid gap-2 sm:grid-cols-2'>
            <ToolButton
              active={tool === 'pen'}
              label='Pen'
              kbd='P'
              icon={<PenIcon />}
              onClick={() => setTool('pen')}
            />
            <ToolButton
              active={tool === 'select'}
              label='Select'
              kbd='V'
              icon={<ArrowIcon />}
              onClick={() => setTool('select')}
            />
          </div>

          <div className='mt-2 grid gap-2 sm:grid-cols-3'>
            <ModeButton
              active={tool === 'start-finish'}
              label='Start / Finish'
              value={startFinishCount > 0 ? 'Set' : null}
              onClick={() => setTool('start-finish')}
            />
            <ModeButton
              active={tool === 'sector'}
              label='Sector'
              value={sectorCount > 0 ? String(sectorCount) : null}
              onClick={() => setTool('sector')}
            />
            <ModeButton
              active={tool === 'pit-area'}
              label='Pit Area'
              value={pitBoxAreas.length > 0 ? String(pitBoxAreas.length) : null}
              onClick={() => setTool('pit-area')}
            />
          </div>

          <div className='mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <div className='grid grid-cols-2 gap-2 sm:w-[15rem]'>
              <SegmentButton
                active={raceDirection === 'forward'}
                label='Forward'
                onClick={() => setRaceDirection('forward')}
              />
              <SegmentButton
                active={raceDirection === 'backward'}
                label='Backward'
                onClick={() => setRaceDirection('backward')}
              />
            </div>
            <div className='rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/55'>
              {startFinishCount > 0 ? 'Ready to export' : 'Start / Finish required'}
            </div>
          </div>
        </section>

        {selectedAnchor && selected && (
          <section className={panelClass}>
            <div className='flex items-center justify-between gap-3'>
              <div>
                <div className={sectionLabelClass}>Anchor</div>
                <div className='mt-1 text-sm font-medium text-white'>
                  {selectedAnchor.handleType}
                </div>
              </div>
              <button
                className='inline-flex h-10 items-center justify-center rounded-2xl border border-red-400/16 bg-red-500/12 px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-red-100 transition hover:border-red-300/24 hover:bg-red-500/18'
                onClick={() => {
                  commit()
                  deleteAnchor(selected)
                }}
              >
                Delete
              </button>
            </div>
            <div className='mt-3 grid grid-cols-3 gap-2'>
              <SegmentButton
                active={selectedAnchor.handleType === 'corner'}
                label='Corner'
                onClick={() => {
                  commit()
                  setHandleType(selected, 'corner')
                }}
              />
              <SegmentButton
                active={selectedAnchor.handleType === 'smooth'}
                label='Smooth'
                onClick={() => {
                  commit()
                  setHandleType(selected, 'smooth')
                }}
              />
              <SegmentButton
                active={selectedAnchor.handleType === 'mirror'}
                label='Mirror'
                onClick={() => {
                  commit()
                  setHandleType(selected, 'mirror')
                }}
              />
            </div>
          </section>
        )}

        {pitLaneSelection && pitLaneSelection.segmentIndices.length > 0 && (
          <section className={panelClass}>
            <div className='flex items-center justify-between gap-3'>
              <div>
                <div className={sectionLabelClass}>Pit Lane</div>
                <div className='mt-1 text-sm text-white'>
                  {pitLaneSelection.segmentIndices.length} selected
                </div>
              </div>
              <div className='text-xs text-white/45'>{allMarked ? 'Marked' : 'Unmarked'}</div>
            </div>
            <button
              className={`mt-3 inline-flex h-10 w-full items-center justify-center rounded-2xl border px-3 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
                allMarked
                  ? 'border-white/12 bg-white/[0.05] text-white/78 hover:border-white/18 hover:bg-white/[0.08] hover:text-white'
                  : 'border-amber-400/20 bg-amber-500/14 text-amber-50 hover:border-amber-300/30 hover:bg-amber-500/20'
              }`}
              onClick={() =>
                allMarked
                  ? unmarkPitLaneSegments(pitLaneSelection.pathId, pitLaneSelection.segmentIndices)
                  : markPitLaneSegments(pitLaneSelection.pathId, pitLaneSelection.segmentIndices)
              }
            >
              {allMarked ? 'Unmark Pit Lane' : 'Mark Pit Lane'}
            </button>
          </section>
        )}
      </div>

      <div className='pointer-events-auto flex flex-col gap-3 xl:w-full'>
        <section className={panelClass}>
          <div className='flex items-center justify-between gap-3'>
            <div className={sectionLabelClass}>Actions</div>
            <div className='text-xs text-white/45'>{activeTrack?.name ?? 'Draft'}</div>
          </div>

          <div className='mt-3 flex flex-col gap-2'>
            <button
              className='inline-flex h-10 w-full items-center justify-between rounded-2xl border border-white/12 bg-white/[0.05] px-3 text-sm font-medium text-white/82 transition hover:border-white/18 hover:bg-white/[0.08] hover:text-white'
              onClick={onImportActiveTrack}
            >
              <span>Load Active</span>
              <span className='truncate pl-3 text-xs text-white/45'>
                {activeTrack?.name ?? 'None'}
              </span>
            </button>

            <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]'>
              <select
                className='min-w-0 rounded-2xl border border-white/10 bg-black/28 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/18'
                value={presetId}
                onChange={event => setPresetId(event.target.value)}
              >
                {PRESET_TRACKS.map(track => (
                  <option key={track.id} value={track.id}>
                    {track.name}
                  </option>
                ))}
              </select>
              <button
                className='inline-flex h-10 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.05] px-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/82 transition hover:border-white/18 hover:bg-white/[0.08] hover:text-white'
                onClick={onImportPreset}
              >
                Load F1
              </button>
            </div>

            <button
              className='inline-flex h-11 w-full items-center justify-between rounded-2xl border border-sky-300/20 bg-sky-500/18 px-4 text-sm font-semibold text-white transition hover:border-sky-200/32 hover:bg-sky-500/24'
              onClick={onExportTo3D}
            >
              <span>Export to 3D</span>
              <span className='text-xs text-sky-100/72'>
                {startFinishCount > 0 ? 'Ready' : 'Needs S/F'}
              </span>
            </button>

            <button
              className='inline-flex h-10 w-full items-center justify-between rounded-2xl border border-white/12 bg-white/[0.05] px-3 text-sm font-medium text-white/78 transition hover:border-white/18 hover:bg-white/[0.08] hover:text-white'
              onClick={() => {
                if (confirm('Clear canvas?')) newDocument()
              }}
            >
              <span>New Draft</span>
              <span className='text-xs text-white/42'>Reset</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/68'>
      <span className='text-white/42'>{label}</span>
      <span className='px-1.5 text-white/28'>·</span>
      <span className='font-medium text-white'>{value}</span>
    </div>
  )
}

function ToolButton({
  active,
  onClick,
  label,
  kbd,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  kbd: string
  icon: React.ReactNode
}) {
  return (
    <button
      className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
        active
          ? 'border-sky-300/26 bg-sky-500/16 text-white'
          : 'border-white/10 bg-white/[0.04] text-white/74 hover:border-white/16 hover:bg-white/[0.08] hover:text-white'
      }`}
      onClick={onClick}
      title={`${label} (${kbd})`}
    >
      <span className='flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/18'>
        {icon}
      </span>
      <span className='flex-1 text-sm font-medium'>{label}</span>
      <kbd className='rounded-lg border border-white/10 bg-black/18 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/48'>
        {kbd}
      </kbd>
    </button>
  )
}

function ModeButton({
  active,
  label,
  value,
  onClick,
}: {
  active: boolean
  label: string
  value: string | null
  onClick: () => void
}) {
  return (
    <button
      className={`rounded-2xl border px-3 py-2.5 text-left transition ${
        active
          ? 'border-emerald-300/24 bg-emerald-500/16 text-white'
          : 'border-white/10 bg-white/[0.04] text-white/74 hover:border-white/16 hover:bg-white/[0.08] hover:text-white'
      }`}
      onClick={onClick}
    >
      <div className='flex items-center justify-between gap-2'>
        <span className='text-sm font-medium'>{label}</span>
        {value && <span className='text-[11px] text-white/55'>{value}</span>}
      </div>
    </button>
  )
}

function TinyActionButton({
  children,
  onClick,
  label,
  meta,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
  meta: string
  disabled?: boolean
}) {
  return (
    <button
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-2xl border px-3 text-sm transition ${
        disabled
          ? 'cursor-not-allowed border-white/6 bg-white/[0.03] text-white/28'
          : 'border-white/10 bg-white/[0.04] text-white/78 hover:border-white/16 hover:bg-white/[0.08] hover:text-white'
      }`}
      disabled={disabled}
      onClick={onClick}
      title={`${label} (${meta})`}
    >
      <span>{children}</span>
    </button>
  )
}

function SegmentButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={`h-10 rounded-2xl border px-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
        active
          ? 'border-sky-300/26 bg-sky-500/18 text-white'
          : 'border-white/10 bg-white/[0.04] text-white/65 hover:border-white/16 hover:bg-white/[0.08] hover:text-white'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function PenIcon() {
  return (
    <svg width='18' height='18' viewBox='0 0 16 16' fill='none'>
      <path
        d='M2 14l3-1 7.5-7.5a1.5 1.5 0 10-2.1-2.1L3 10.9l-1 3.1z'
        stroke='currentColor'
        strokeWidth='1.5'
        strokeLinejoin='round'
      />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width='18' height='18' viewBox='0 0 16 16' fill='none'>
      <path
        d='M3 2l9 6-4 1-1.5 4L3 2z'
        stroke='currentColor'
        strokeWidth='1.5'
        strokeLinejoin='round'
        fill='currentColor'
        fillOpacity='0.18'
      />
    </svg>
  )
}
