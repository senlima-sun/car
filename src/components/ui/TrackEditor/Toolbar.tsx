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

const TOOL_META: Record<Tool, { label: string; detail: string; accent: string; dot: string }> = {
  pen: {
    label: 'Pen',
    detail: 'Draw centerlines and branch paths',
    accent: 'border-sky-400/40 bg-sky-500/18 text-white shadow-[0_16px_38px_rgba(14,165,233,0.2)]',
    dot: 'bg-sky-300',
  },
  select: {
    label: 'Select',
    detail: 'Adjust anchors, handles, and pit areas',
    accent:
      'border-cyan-400/40 bg-cyan-500/16 text-white shadow-[0_16px_38px_rgba(34,211,238,0.2)]',
    dot: 'bg-cyan-300',
  },
  'start-finish': {
    label: 'Start / Finish',
    detail: 'Place the lap trigger on an existing path',
    accent:
      'border-emerald-400/40 bg-emerald-500/16 text-white shadow-[0_16px_38px_rgba(16,185,129,0.18)]',
    dot: 'bg-emerald-300',
  },
  sector: {
    label: 'Sector',
    detail: 'Add timing sectors along the ribbon',
    accent:
      'border-lime-400/40 bg-lime-500/16 text-white shadow-[0_16px_38px_rgba(132,204,22,0.18)]',
    dot: 'bg-lime-300',
  },
  'pit-area': {
    label: 'Pit Area',
    detail: 'Drop service boxes and orient the pit lane',
    accent:
      'border-amber-400/40 bg-amber-500/16 text-white shadow-[0_16px_38px_rgba(245,158,11,0.18)]',
    dot: 'bg-amber-300',
  },
}

const panelClass =
  'rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,24,32,0.9),rgba(8,10,16,0.86))] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl'

const sectionLabelClass = 'text-[10px] font-semibold uppercase tracking-[0.32em] text-white/45'

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
  const pitLaneSegmentCount = useMemo(
    () => doc.paths.reduce((total, path) => total + (path.pitLaneSegments?.length ?? 0), 0),
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
  const selectionSummary = (() => {
    if (pitLaneSelection && pitLaneSelection.segmentIndices.length > 0) {
      return `${pitLaneSelection.segmentIndices.length} pit-lane segment${pitLaneSelection.segmentIndices.length === 1 ? '' : 's'} selected`
    }
    if (selectedAnchor) {
      return `${selectedAnchor.handleType} anchor selected`
    }
    if (selectedAnchors.length > 1) {
      return `${selectedAnchors.length} anchors selected`
    }
    return toolMeta.detail
  })()
  const liveStatus = (() => {
    if (pen.activePathId) {
      const activePath = doc.paths.find(item => item.id === pen.activePathId)
      return `Path in progress · ${activePath?.anchors.length ?? 0} anchors`
    }
    if (pen.startRef) return 'Continue drawing from selected anchor'
    return selectionSummary
  })()

  return (
    <div className='pointer-events-none absolute inset-x-4 top-24 z-20 flex flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,34rem)_minmax(18rem,26rem)] xl:items-start'>
      <div className='pointer-events-auto flex flex-col gap-3'>
        <section className={panelClass}>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div className='min-w-0'>
              <div className={sectionLabelClass}>Workspace</div>
              <div className='mt-2 flex items-start gap-3'>
                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${toolMeta.dot}`} />
                <div className='min-w-0'>
                  <div className='text-[15px] font-semibold uppercase tracking-[0.22em] text-white'>
                    Track Editor
                  </div>
                  <div className='mt-1 text-sm text-white/70'>{liveStatus}</div>
                  <div className='mt-2 text-xs text-white/45'>
                    Active track: {activeTrack?.name ?? 'Unsaved draft'}
                  </div>
                </div>
              </div>
            </div>
            <button
              className='inline-flex h-11 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-xs font-semibold uppercase tracking-[0.22em] text-white/82 transition hover:border-white/20 hover:bg-white/[0.1] hover:text-white'
              onClick={enterMenu}
              title='Back to Main Menu'
            >
              Main Menu
            </button>
          </div>
          <div className='mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4'>
            <MetricChip label='Paths' value={String(doc.paths.length)} />
            <MetricChip label='Anchors' value={String(anchorCount)} />
            <MetricChip label='Checks' value={String(checkpoints.length)} />
            <MetricChip label='Pit Areas' value={String(pitBoxAreas.length)} />
          </div>
        </section>

        <section className={panelClass}>
          <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
            <div>
              <div className={sectionLabelClass}>Tools</div>
              <div className='mt-1 text-sm text-white/65'>{toolMeta.detail}</div>
            </div>
            <div className='grid grid-cols-2 gap-2 sm:flex'>
              <MiniActionButton disabled={past === 0} onClick={undo} label='Undo' meta='⌘Z'>
                ↶
              </MiniActionButton>
              <MiniActionButton disabled={future === 0} onClick={redo} label='Redo' meta='⇧⌘Z'>
                ↷
              </MiniActionButton>
            </div>
          </div>

          <div className='mt-3 grid gap-2 sm:grid-cols-2'>
            <ToolModeButton
              active={tool === 'pen'}
              label='Pen'
              detail='Sketch and continue paths'
              kbd='P'
              icon={<PenIcon />}
              onClick={() => setTool('pen')}
            />
            <ToolModeButton
              active={tool === 'select'}
              label='Select'
              detail='Edit anchors and pit areas'
              kbd='V'
              icon={<ArrowIcon />}
              onClick={() => setTool('select')}
            />
          </div>

          <div className='mt-2 grid gap-2 sm:grid-cols-3'>
            <FeatureButton
              active={tool === 'start-finish'}
              label='Start / Finish'
              detail={startFinishCount > 0 ? 'Lap trigger placed' : 'Place a lap trigger'}
              count={startFinishCount > 0 ? '1' : null}
              onClick={() => setTool('start-finish')}
            />
            <FeatureButton
              active={tool === 'sector'}
              label='Sector'
              detail='Timing checkpoints'
              count={sectorCount > 0 ? String(sectorCount) : null}
              onClick={() => setTool('sector')}
            />
            <FeatureButton
              active={tool === 'pit-area'}
              label='Pit Area'
              detail='Service box placement'
              count={pitBoxAreas.length > 0 ? String(pitBoxAreas.length) : null}
              onClick={() => setTool('pit-area')}
            />
          </div>

          <div className='mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end'>
            <div>
              <div className={sectionLabelClass}>Race Direction</div>
              <div className='mt-2 grid grid-cols-2 gap-2'>
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
            </div>
            <div className='rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right text-xs text-white/55'>
              {selectionSummary}
            </div>
          </div>
        </section>

        {selectedAnchor && selected && (
          <section className={panelClass}>
            <div className='flex items-center justify-between gap-3'>
              <div>
                <div className={sectionLabelClass}>Anchor</div>
                <div className='mt-1 text-sm font-medium text-white'>
                  Handle Mode · {selectedAnchor.handleType}
                </div>
              </div>
              <div className='rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50'>
                Path {selected.pathId.slice(0, 4)}
              </div>
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
            <button
              className='mt-3 inline-flex h-11 w-full items-center justify-between rounded-2xl border border-red-400/18 bg-red-500/12 px-4 text-sm font-medium text-red-100 transition hover:border-red-300/28 hover:bg-red-500/18'
              onClick={() => {
                commit()
                deleteAnchor(selected)
              }}
            >
              <span>Delete Anchor</span>
              <kbd className='rounded-lg border border-red-200/18 bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-red-100/75'>
                Delete
              </kbd>
            </button>
          </section>
        )}

        {pitLaneSelection && pitLaneSelection.segmentIndices.length > 0 && (
          <section className={panelClass}>
            <div className='flex items-center justify-between gap-3'>
              <div>
                <div className={sectionLabelClass}>Pit Lane</div>
                <div className='mt-1 text-sm font-medium text-white'>
                  {pitLaneSelection.segmentIndices.length} segment
                  {pitLaneSelection.segmentIndices.length === 1 ? '' : 's'} selected
                </div>
              </div>
              <div className='rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50'>
                {allMarked ? 'Marked' : 'Pending'}
              </div>
            </div>
            {allMarked ? (
              <button
                className='mt-3 inline-flex h-11 w-full items-center justify-between rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm font-medium text-white/82 transition hover:border-white/20 hover:bg-white/[0.1] hover:text-white'
                onClick={() =>
                  unmarkPitLaneSegments(pitLaneSelection.pathId, pitLaneSelection.segmentIndices)
                }
              >
                <span>Unmark Pit Lane</span>
                <span className='text-xs text-white/45'>Revert to normal ribbon</span>
              </button>
            ) : (
              <button
                className='mt-3 inline-flex h-11 w-full items-center justify-between rounded-2xl border border-amber-400/22 bg-amber-500/14 px-4 text-sm font-medium text-amber-50 transition hover:border-amber-300/34 hover:bg-amber-500/20'
                onClick={() =>
                  markPitLaneSegments(pitLaneSelection.pathId, pitLaneSelection.segmentIndices)
                }
              >
                <span>Mark as Pit Lane</span>
                <span className='text-xs text-amber-100/75'>Enable lane export</span>
              </button>
            )}
          </section>
        )}
      </div>

      <div className='pointer-events-auto flex flex-col gap-3 xl:justify-self-end xl:w-full'>
        <section className={panelClass}>
          <div className='flex items-start justify-between gap-3'>
            <div>
              <div className={sectionLabelClass}>Document Health</div>
              <div className='mt-1 text-sm text-white/65'>
                Quick read on the current editor draft before export.
              </div>
            </div>
            <div
              className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] ${toolMeta.accent}`}
            >
              {toolMeta.label}
            </div>
          </div>
          <div className='mt-3 grid grid-cols-2 gap-2'>
            <MetricChip label='Start / Finish' value={startFinishCount > 0 ? 'Ready' : 'Missing'} />
            <MetricChip label='Pit Lane Segs' value={String(pitLaneSegmentCount)} />
            <MetricChip
              label='Race Dir'
              value={raceDirection === 'forward' ? 'Forward' : 'Backward'}
            />
            <MetricChip
              label='Selection'
              value={
                selectedAnchors.length > 1
                  ? `${selectedAnchors.length} anchors`
                  : selectedAnchor
                    ? '1 anchor'
                    : 'None'
              }
            />
          </div>
        </section>

        <section className={panelClass}>
          <div>
            <div className={sectionLabelClass}>Import</div>
            <div className='mt-1 text-sm text-white/65'>
              Seed the editor from the active runtime track or a bundled F1 preset.
            </div>
          </div>
          <button
            className='mt-3 inline-flex h-11 w-full items-center justify-between rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm font-medium text-white/82 transition hover:border-white/20 hover:bg-white/[0.1] hover:text-white'
            onClick={onImportActiveTrack}
          >
            <span>Load Active Track</span>
            <span className='truncate pl-3 text-xs text-white/45'>
              {activeTrack?.name ?? 'None loaded'}
            </span>
          </button>
          <div className='mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]'>
            <select
              className='min-w-0 rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none transition focus:border-white/20'
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
              className='inline-flex h-11 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-xs font-semibold uppercase tracking-[0.22em] text-white/82 transition hover:border-white/20 hover:bg-white/[0.1] hover:text-white'
              onClick={onImportPreset}
            >
              Load F1
            </button>
          </div>
        </section>

        <section className={panelClass}>
          <div>
            <div className={sectionLabelClass}>Export</div>
            <div className='mt-1 text-sm text-white/65'>
              Push this draft into the runtime track store and make it the active layout.
            </div>
          </div>
          <button
            className='mt-3 inline-flex h-12 w-full items-center justify-between rounded-2xl border border-sky-300/22 bg-sky-500/18 px-4 text-sm font-semibold text-white transition hover:border-sky-200/38 hover:bg-sky-500/24'
            onClick={onExportTo3D}
          >
            <span>Export to 3D</span>
            <span className='text-xs font-medium text-sky-100/78'>
              Ribbon + checkpoints + pit boxes
            </span>
          </button>
          <div className='mt-2 grid gap-2 sm:grid-cols-2'>
            <button
              className='inline-flex h-11 items-center justify-between rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm font-medium text-white/82 transition hover:border-white/20 hover:bg-white/[0.1] hover:text-white'
              onClick={() => {
                if (confirm('Clear canvas?')) newDocument()
              }}
            >
              <span>New Draft</span>
              <span className='text-xs text-white/45'>Reset canvas</span>
            </button>
            <div className='rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white/55'>
              Export requires at least one path and one start / finish line.
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5'>
      <div className='text-[10px] font-semibold uppercase tracking-[0.24em] text-white/40'>
        {label}
      </div>
      <div className='mt-1 text-sm font-medium text-white'>{value}</div>
    </div>
  )
}

function ToolModeButton({
  active,
  onClick,
  label,
  detail,
  kbd,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  detail: string
  kbd: string
  icon: React.ReactNode
}) {
  return (
    <button
      className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
        active
          ? 'border-sky-300/28 bg-sky-500/18 text-white shadow-[0_18px_40px_rgba(14,165,233,0.18)]'
          : 'border-white/10 bg-white/[0.04] text-white/72 hover:border-white/16 hover:bg-white/[0.08] hover:text-white'
      }`}
      onClick={onClick}
      title={`${label} (${kbd})`}
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${
          active ? 'border-sky-200/20 bg-black/12' : 'border-white/10 bg-black/18'
        }`}
      >
        {icon}
      </span>
      <span className='min-w-0 flex-1'>
        <span className='block text-sm font-medium'>{label}</span>
        <span className='mt-0.5 block text-xs text-white/52'>{detail}</span>
      </span>
      <kbd
        className={`rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
          active
            ? 'border border-sky-100/18 bg-black/18 text-sky-50/82'
            : 'border border-white/10 bg-black/18 text-white/48'
        }`}
      >
        {kbd}
      </kbd>
    </button>
  )
}

function FeatureButton({
  active,
  label,
  detail,
  count,
  onClick,
}: {
  active: boolean
  label: string
  detail: string
  count: string | null
  onClick: () => void
}) {
  return (
    <button
      className={`rounded-2xl border px-3 py-3 text-left transition ${
        active
          ? 'border-emerald-300/24 bg-emerald-500/16 text-white shadow-[0_18px_40px_rgba(16,185,129,0.14)]'
          : 'border-white/10 bg-white/[0.04] text-white/72 hover:border-white/16 hover:bg-white/[0.08] hover:text-white'
      }`}
      onClick={onClick}
    >
      <div className='flex items-center justify-between gap-2'>
        <span className='text-sm font-medium'>{label}</span>
        {count && (
          <span className='rounded-full border border-white/12 bg-black/18 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/62'>
            {count}
          </span>
        )}
      </div>
      <div className='mt-1 text-xs text-white/48'>{detail}</div>
    </button>
  )
}

function MiniActionButton({
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
      className={`inline-flex h-11 items-center justify-between gap-3 rounded-2xl border px-3 text-sm transition ${
        disabled
          ? 'cursor-not-allowed border-white/6 bg-white/[0.03] text-white/28'
          : 'border-white/10 bg-white/[0.04] text-white/78 hover:border-white/16 hover:bg-white/[0.08] hover:text-white'
      }`}
      disabled={disabled}
      onClick={onClick}
      title={`${label} (${meta})`}
    >
      <span className='text-base'>{children}</span>
      <span className='text-xs font-medium'>{label}</span>
      <kbd className='rounded-lg border border-white/10 bg-black/18 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/45'>
        {meta}
      </kbd>
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
      className={`h-10 rounded-2xl border px-3 text-xs font-semibold uppercase tracking-[0.18em] transition ${
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
