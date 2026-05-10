import { useMemo } from 'react'
import {
  CornerRightDown,
  Download,
  GitCompare,
  Home,
  Spline,
  Trash2,
  Redo2,
  Undo2,
  Upload,
} from 'lucide-react'
import { PRESET_TRACKS } from '@/constants/tracks'
import { useGameStore } from '@/stores/useGameStore'
import { useTrackStore } from '@/stores/useTrackStore'
import { exportToTrackStore } from '../export/exportToTrackStore'
import {
  buildEditorTrackSource,
  downloadEditorTrackSourceJson,
} from '@/utils/exportEditorTrackSource'
import { getAnchor } from '../geometry/path'
import {
  fitViewportToEditorState,
  importTrackObjectsToEditorState,
} from '../import/trackObjectsToEditor'
import { useTrackEditorStore } from '../state/useTrackEditorStore'
import { TOOLS } from './constants/tools'
import { CURB_VARIANTS } from './constants/curbVariants'
import { pillClass } from './constants/pillClass'
import { IconButton } from './primitives/IconButton'
import { OverflowMenu } from './OverflowMenu'
import { TerrainControls } from './TerrainControls'

export default function Toolbar() {
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
  const curbs = useTrackEditorStore(s => s.curbs)
  const selectedCurbId = useTrackEditorStore(s => s.selectedCurbId)
  const pendingCurbVariant = useTrackEditorStore(s => s.pendingCurbVariant)
  const setPendingCurbVariant = useTrackEditorStore(s => s.setPendingCurbVariant)
  const updateCurb = useTrackEditorStore(s => s.updateCurb)
  const deleteCurb = useTrackEditorStore(s => s.deleteCurb)
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

  const selectedAnchor = selected
    ? getAnchor(doc.paths, selected.pathId, selected.anchorIndex)
    : null

  const selectedCurb = selectedCurbId ? (curbs.find(c => c.id === selectedCurbId) ?? null) : null
  const activeVariant = selectedCurb ? selectedCurb.variant : pendingCurbVariant
  const showCurbVariantPill = tool === 'curb' || selectedCurb !== null

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

  const onExportAsPreset = () => {
    if (doc.paths.length === 0) {
      alert('Draw at least one path before exporting as preset.')
      return
    }
    const rawName = activeTrack?.name ?? 'Custom Track'
    const baseSlug =
      rawName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '') || 'custom_track'
    const slug = activeTrack ? baseSlug : `${baseSlug}_${Date.now().toString(36)}`
    const source = buildEditorTrackSource({
      id: `f1_${slug}`,
      name: rawName,
      paths: doc.paths,
      checkpoints,
      raceDirection,
      pitBoxAreas,
      curbs,
    })
    downloadEditorTrackSourceJson(source)
  }

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
      curbs,
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

  return (
    <>
      <div className='pointer-events-none absolute left-4 top-4 z-20 flex items-center gap-3'>
        <div className={pillClass}>
          {TOOLS.map(({ id, icon: Icon, label, kbd }) => (
            <IconButton
              key={id}
              active={tool === id}
              onClick={() => setTool(id)}
              title={kbd ? `${label} (${kbd})` : label}
            >
              <Icon size={16} strokeWidth={1.75} />
            </IconButton>
          ))}
        </div>
      </div>

      {tool === 'terrain' && <TerrainControls />}

      <div className='pointer-events-none absolute right-4 top-4 z-20 flex items-center gap-2'>
        <div className={pillClass}>
          <IconButton disabled={past === 0} onClick={undo} title='Undo (⌘Z)'>
            <Undo2 size={16} strokeWidth={1.75} />
          </IconButton>
          <IconButton disabled={future === 0} onClick={redo} title='Redo (⇧⌘Z)'>
            <Redo2 size={16} strokeWidth={1.75} />
          </IconButton>
        </div>

        <div className={pillClass}>
          <IconButton
            primary
            onClick={onExportTo3D}
            title={startFinishCount > 0 ? 'Export to 3D' : 'Export to 3D (needs Start / Finish)'}
          >
            <Upload size={16} strokeWidth={1.75} />
          </IconButton>
          <IconButton onClick={onExportAsPreset} title='Export as Preset (JSON)'>
            <Download size={16} strokeWidth={1.75} />
          </IconButton>
          <OverflowMenu
            raceDirection={raceDirection}
            setRaceDirection={setRaceDirection}
            activeTrackName={activeTrack?.name ?? null}
            onLoadActive={() => {
              if (!activeTrack) {
                alert('No active track is loaded.')
                return
              }
              importObjectsIntoEditor(activeTrack.objects)
            }}
            onLoadPreset={id => {
              const preset = PRESET_TRACKS.find(track => track.id === id)
              if (!preset) return
              if (!importObjectsIntoEditor(preset.objects)) return
              loadPresetTrack(preset.id)
            }}
            onNewDraft={() => {
              if (confirm('Clear canvas?')) newDocument()
            }}
          />
          <IconButton onClick={enterMenu} title='Exit to Main Menu'>
            <Home size={16} strokeWidth={1.75} />
          </IconButton>
        </div>
      </div>

      {selectedAnchor && selected && (
        <div className='pointer-events-none absolute bottom-20 left-4 z-20'>
          <div className={pillClass}>
            <IconButton
              active={selectedAnchor.handleType === 'corner'}
              onClick={() => {
                commit()
                setHandleType(selected, 'corner')
              }}
              title='Corner'
              tooltipSide='top'
            >
              <CornerRightDown size={16} strokeWidth={1.75} />
            </IconButton>
            <IconButton
              active={selectedAnchor.handleType === 'smooth'}
              onClick={() => {
                commit()
                setHandleType(selected, 'smooth')
              }}
              title='Smooth'
              tooltipSide='top'
            >
              <Spline size={16} strokeWidth={1.75} />
            </IconButton>
            <IconButton
              active={selectedAnchor.handleType === 'mirror'}
              onClick={() => {
                commit()
                setHandleType(selected, 'mirror')
              }}
              title='Mirror'
              tooltipSide='top'
            >
              <GitCompare size={16} strokeWidth={1.75} />
            </IconButton>
            <span className='mx-1 h-5 w-px bg-white/10' />
            <IconButton
              danger
              onClick={() => {
                commit()
                deleteAnchor(selected)
              }}
              title='Delete anchor (⌫)'
              tooltipSide='top'
            >
              <Trash2 size={16} strokeWidth={1.75} />
            </IconButton>
          </div>
        </div>
      )}

      {showCurbVariantPill && !selectedAnchor && (
        <div className='pointer-events-none absolute bottom-20 left-4 z-20'>
          <div className={pillClass}>
            {CURB_VARIANTS.map(({ id, label, color }) => {
              const isActive = activeVariant === id
              return (
                <button
                  key={id}
                  className={`pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                    isActive
                      ? 'bg-white/[0.14] text-white'
                      : 'text-white/60 hover:bg-white/[0.06] hover:text-white'
                  }`}
                  onClick={() => {
                    if (selectedCurb) updateCurb(selectedCurb.id, { variant: id })
                    else setPendingCurbVariant(id)
                  }}
                >
                  <span
                    className='inline-block h-2 w-2 rounded-full'
                    style={{ backgroundColor: color }}
                  />
                  {label}
                </button>
              )
            })}
            {selectedCurb && (
              <>
                <span className='mx-1 h-5 w-px bg-white/10' />
                <IconButton
                  danger
                  onClick={() => deleteCurb(selectedCurb.id)}
                  title='Delete curb (⌫)'
                  tooltipSide='top'
                >
                  <Trash2 size={16} strokeWidth={1.75} />
                </IconButton>
              </>
            )}
          </div>
        </div>
      )}

      {pitLaneSelection && pitLaneSelection.segmentIndices.length > 0 && (
        <div className='pointer-events-none absolute bottom-20 left-4 z-20'>
          <button
            className={`pointer-events-auto inline-flex h-9 items-center gap-2 rounded-full border px-4 text-[11px] font-semibold uppercase tracking-[0.22em] shadow-[0_8px_24px_rgba(0,0,0,0.32)] backdrop-blur-xl transition ${
              allMarked
                ? 'border-white/12 bg-[rgba(14,16,22,0.82)] text-white/78 hover:border-white/20 hover:text-white'
                : 'border-amber-300/24 bg-amber-500/18 text-amber-50 hover:border-amber-200/36 hover:bg-amber-500/26'
            }`}
            onClick={() =>
              allMarked
                ? unmarkPitLaneSegments(pitLaneSelection.pathId, pitLaneSelection.segmentIndices)
                : markPitLaneSegments(pitLaneSelection.pathId, pitLaneSelection.segmentIndices)
            }
          >
            {allMarked ? 'Unmark Pit Lane' : 'Mark Pit Lane'}
            <span className='text-white/50'>· {pitLaneSelection.segmentIndices.length}</span>
          </button>
        </div>
      )}
    </>
  )
}
