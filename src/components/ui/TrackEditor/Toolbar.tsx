import { useMemo, useState } from 'react'
import { useTrackEditorStore } from './state/useTrackEditorStore'
import { useGameStore } from '@/stores/useGameStore'
import { exportToTrackStore } from './export/exportToTrackStore'
import { getAnchor } from './geometry/path'
import { PRESET_TRACKS } from '@/constants/tracks'
import { useTrackStore } from '@/stores/useTrackStore'
import {
  fitViewportToEditorState,
  importTrackObjectsToEditorState,
} from './import/trackObjectsToEditor'

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

  const pitLaneSelection = (() => {
    if (selectedAnchors.length < 2) return null
    const pathId = selectedAnchors[0]!.pathId
    if (!selectedAnchors.every(a => a.pathId === pathId)) return null
    const indices = selectedAnchors.map(a => a.anchorIndex).sort((a, b) => a - b)
    const start = indices[0]!
    const end = indices[indices.length - 1]!
    const segmentIndices: number[] = []
    for (let i = start; i < end; i++) segmentIndices.push(i)
    return { pathId, segmentIndices }
  })()

  const path = pitLaneSelection ? doc.paths.find(p => p.id === pitLaneSelection.pathId) : null
  const pitSegSet = new Set(path?.pitLaneSegments ?? [])
  const allMarked =
    pitLaneSelection !== null &&
    pitLaneSelection.segmentIndices.length > 0 &&
    pitLaneSelection.segmentIndices.every(i => pitSegSet.has(i))

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

  return (
    <div className='pointer-events-auto absolute left-4 top-4 flex flex-col gap-3 text-xs'>
      <button
        className='flex items-center justify-center rounded-lg bg-neutral-800/90 px-3 py-2 text-neutral-200 shadow-lg ring-1 ring-white/10 backdrop-blur hover:bg-neutral-700'
        onClick={enterMenu}
        title='Back to Main Menu'
      >
        ← Main Menu
      </button>

      <div className='flex gap-1 rounded-lg bg-neutral-800/90 p-1 shadow-lg ring-1 ring-white/10 backdrop-blur'>
        <ToolBtn
          active={tool === 'pen'}
          onClick={() => setTool('pen')}
          label='Pen'
          kbd='P'
          icon={<PenIcon />}
        />
        <ToolBtn
          active={tool === 'select'}
          onClick={() => setTool('select')}
          label='Select'
          kbd='V'
          icon={<ArrowIcon />}
        />
      </div>

      <div className='flex flex-col gap-1 rounded-lg bg-neutral-800/90 p-1 shadow-lg ring-1 ring-white/10 backdrop-blur'>
        <button
          className={`rounded px-2 py-1.5 text-left transition ${
            tool === 'start-finish'
              ? 'bg-sky-500 text-white'
              : 'text-neutral-200 hover:bg-neutral-700'
          }`}
          onClick={() => setTool('start-finish')}
          title='Place Start/Finish line on a path'
        >
          Start/Finish {startFinishCount > 0 && <span className='opacity-70'>(set)</span>}
        </button>
        <button
          className={`rounded px-2 py-1.5 text-left transition ${
            tool === 'sector'
              ? 'bg-emerald-500 text-white'
              : 'text-neutral-200 hover:bg-neutral-700'
          }`}
          onClick={() => setTool('sector')}
          title='Place sector checkpoint on a path'
        >
          Sector {sectorCount > 0 && <span className='opacity-70'>× {sectorCount}</span>}
        </button>
        <button
          className={`rounded px-2 py-1.5 text-left transition ${
            tool === 'pit-area'
              ? 'bg-orange-500 text-white'
              : 'text-neutral-200 hover:bg-neutral-700'
          }`}
          onClick={() => setTool('pit-area')}
          title='Place pit service area'
        >
          Pit Area{' '}
          {pitBoxAreas.length > 0 && <span className='opacity-70'>× {pitBoxAreas.length}</span>}
        </button>
      </div>

      <div className='flex flex-col gap-1 rounded-lg bg-neutral-800/90 p-2 shadow-lg ring-1 ring-white/10 backdrop-blur'>
        <div className='px-1 text-[10px] uppercase tracking-wider text-neutral-400'>
          Race Direction
        </div>
        <div className='flex gap-1'>
          <TypeBtn active={raceDirection === 'forward'} onClick={() => setRaceDirection('forward')}>
            Forward
          </TypeBtn>
          <TypeBtn
            active={raceDirection === 'backward'}
            onClick={() => setRaceDirection('backward')}
          >
            Backward
          </TypeBtn>
        </div>
      </div>

      <div className='flex gap-1 rounded-lg bg-neutral-800/90 p-1 shadow-lg ring-1 ring-white/10 backdrop-blur'>
        <IconBtn disabled={past === 0} onClick={undo} label='Undo (⌘Z)'>
          ↶
        </IconBtn>
        <IconBtn disabled={future === 0} onClick={redo} label='Redo (⇧⌘Z)'>
          ↷
        </IconBtn>
      </div>

      {selectedAnchor && selected && (
        <div className='flex flex-col gap-1 rounded-lg bg-neutral-800/90 p-2 shadow-lg ring-1 ring-white/10 backdrop-blur'>
          <div className='px-1 text-[10px] uppercase tracking-wider text-neutral-400'>Anchor</div>
          <div className='flex gap-1'>
            <TypeBtn
              active={selectedAnchor.handleType === 'corner'}
              onClick={() => {
                commit()
                setHandleType(selected, 'corner')
              }}
            >
              Corner
            </TypeBtn>
            <TypeBtn
              active={selectedAnchor.handleType === 'smooth'}
              onClick={() => {
                commit()
                setHandleType(selected, 'smooth')
              }}
            >
              Smooth
            </TypeBtn>
            <TypeBtn
              active={selectedAnchor.handleType === 'mirror'}
              onClick={() => {
                commit()
                setHandleType(selected, 'mirror')
              }}
            >
              Mirror
            </TypeBtn>
          </div>
          <button
            className='mt-1 rounded bg-red-900/60 px-2 py-1 text-left hover:bg-red-900'
            onClick={() => {
              commit()
              deleteAnchor(selected)
            }}
          >
            Delete anchor (⌫)
          </button>
        </div>
      )}

      {pitLaneSelection && pitLaneSelection.segmentIndices.length > 0 && (
        <div className='flex flex-col gap-1 rounded-lg bg-neutral-800/90 p-2 shadow-lg ring-1 ring-white/10 backdrop-blur'>
          <div className='px-1 text-[10px] uppercase tracking-wider text-neutral-400'>
            Pit Lane · {pitLaneSelection.segmentIndices.length} seg
          </div>
          {allMarked ? (
            <button
              className='rounded bg-neutral-700 px-2 py-1 text-left hover:bg-neutral-600'
              onClick={() =>
                unmarkPitLaneSegments(pitLaneSelection.pathId, pitLaneSelection.segmentIndices)
              }
            >
              Unmark Pit Lane
            </button>
          ) : (
            <button
              className='rounded bg-orange-500 px-2 py-1 text-left font-semibold text-white hover:bg-orange-400'
              onClick={() =>
                markPitLaneSegments(pitLaneSelection.pathId, pitLaneSelection.segmentIndices)
              }
            >
              Mark as Pit Lane
            </button>
          )}
        </div>
      )}

      <div className='flex flex-col gap-1 rounded-lg bg-neutral-800/90 p-2 shadow-lg ring-1 ring-white/10 backdrop-blur'>
        <div className='px-1 text-[10px] uppercase tracking-wider text-neutral-400'>
          Import Track
        </div>
        <button
          className='rounded bg-neutral-700 px-2 py-1 text-left hover:bg-neutral-600'
          onClick={onImportActiveTrack}
        >
          Load Active Track
          {activeTrack && <span className='opacity-70'> · {activeTrack.name}</span>}
        </button>
        <div className='flex gap-1'>
          <select
            className='min-w-0 flex-1 rounded bg-neutral-900 px-2 py-1 text-xs text-white ring-1 ring-white/10 focus:outline-none'
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
            className='rounded bg-neutral-700 px-2 py-1 hover:bg-neutral-600'
            onClick={onImportPreset}
          >
            Load F1
          </button>
        </div>
      </div>

      <div className='flex flex-col gap-1 rounded-lg bg-neutral-800/90 p-2 shadow-lg ring-1 ring-white/10 backdrop-blur'>
        <button
          className='rounded bg-blue-600 px-2 py-1 text-left font-semibold text-white hover:bg-blue-500'
          onClick={onExportTo3D}
        >
          Export to 3D
        </button>
        <button
          className='rounded bg-neutral-700 px-2 py-1 text-left hover:bg-neutral-600'
          onClick={() => {
            if (confirm('Clear canvas?')) newDocument()
          }}
        >
          New
        </button>
      </div>
    </div>
  )
}

function ToolBtn({
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
      className={`flex h-9 w-9 items-center justify-center rounded transition ${
        active ? 'bg-blue-500 text-white' : 'text-neutral-300 hover:bg-neutral-700'
      }`}
      onClick={onClick}
      title={`${label} (${kbd})`}
    >
      {icon}
    </button>
  )
}

function IconBtn({
  children,
  onClick,
  label,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      className={`flex h-9 w-9 items-center justify-center rounded text-lg transition ${
        disabled ? 'cursor-not-allowed text-neutral-600' : 'text-neutral-300 hover:bg-neutral-700'
      }`}
      disabled={disabled}
      onClick={onClick}
      title={label}
    >
      {children}
    </button>
  )
}

function TypeBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      className={`flex-1 rounded px-2 py-1 text-xs ${
        active ? 'bg-blue-500 text-white' : 'bg-neutral-700 hover:bg-neutral-600'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function PenIcon() {
  return (
    <svg width='16' height='16' viewBox='0 0 16 16' fill='none'>
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
    <svg width='16' height='16' viewBox='0 0 16 16' fill='none'>
      <path
        d='M3 2l9 6-4 1-1.5 4L3 2z'
        stroke='currentColor'
        strokeWidth='1.5'
        strokeLinejoin='round'
        fill='currentColor'
        fillOpacity='0.2'
      />
    </svg>
  )
}
