import { useMemo } from 'react'
import { useTrackStore } from '@/stores/useTrackStore'
import HintBar from './HintBar'
import PenCanvas from './PenCanvas'
import Toolbar from './Toolbar'
import { useShortcuts } from './hooks/useShortcuts'
import { useTrackEditorStore, type Tool } from './state/useTrackEditorStore'

const TOOL_LABEL: Record<Tool, string> = {
  pen: 'Pen',
  select: 'Select',
  'start-finish': 'Start / Finish',
  sector: 'Sector',
  'pit-area': 'Pit Area',
}

export default function TrackEditor() {
  useShortcuts()

  return (
    <div className='absolute inset-0 pointer-events-auto overflow-hidden font-sans text-white'>
      <PenCanvas />
      <EditorChrome />
      <Toolbar />
      <HintBar />
    </div>
  )
}

function EditorChrome() {
  const tool = useTrackEditorStore(s => s.tool)
  const doc = useTrackEditorStore(s => s.doc)
  const checkpoints = useTrackEditorStore(s => s.checkpoints)
  const pitBoxAreas = useTrackEditorStore(s => s.pitBoxAreas)
  const pen = useTrackEditorStore(s => s.pen)
  const trackLibrary = useTrackStore(s => s.trackLibrary)

  const activeTrack = useMemo(
    () =>
      trackLibrary.activeTrackId
        ? (trackLibrary.tracks.find(track => track.id === trackLibrary.activeTrackId) ?? null)
        : null,
    [trackLibrary.activeTrackId, trackLibrary.tracks],
  )

  const anchorCount = useMemo(
    () => doc.paths.reduce((total, path) => total + path.anchors.length, 0),
    [doc.paths],
  )

  const modeSummary = (() => {
    if (pen.activePathId) {
      const activePath = doc.paths.find(path => path.id === pen.activePathId)
      return `Drawing ${activePath?.anchors.length ?? 0} anchors`
    }
    if (pen.startRef) return 'Ready to branch from anchor'
    return TOOL_LABEL[tool]
  })()

  return (
    <>
      <div className='pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/45 via-black/16 to-transparent' />
      <div className='pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/40 via-black/14 to-transparent' />

      <div className='pointer-events-none absolute left-1/2 top-4 z-10 w-[min(44rem,calc(100%-2rem))] -translate-x-1/2'>
        <div className='rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,22,30,0.8),rgba(6,8,12,0.55))] px-4 py-3 shadow-[0_22px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div className='min-w-0'>
              <div className='text-[10px] font-semibold uppercase tracking-[0.34em] text-white/45'>
                Authoring Surface
              </div>
              <div className='mt-1 truncate text-sm font-semibold uppercase tracking-[0.24em] text-white'>
                Track Editor
              </div>
              <div className='mt-1 truncate text-xs text-white/58'>
                {activeTrack?.name ?? 'Unsaved Draft'} · {modeSummary}
              </div>
            </div>
            <div className='grid grid-cols-3 gap-2 sm:w-auto'>
              <ChromeStat label='Paths' value={String(doc.paths.length)} />
              <ChromeStat label='Anchors' value={String(anchorCount)} />
              <ChromeStat label='Markers' value={String(checkpoints.length + pitBoxAreas.length)} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function ChromeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-center'>
      <div className='text-[10px] font-semibold uppercase tracking-[0.22em] text-white/42'>
        {label}
      </div>
      <div className='mt-1 text-sm font-medium text-white'>{value}</div>
    </div>
  )
}
