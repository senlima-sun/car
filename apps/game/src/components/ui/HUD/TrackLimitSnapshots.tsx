import { useState } from 'react'
import { useTrackLimitSnapshotStore } from '../../../stores/useTrackLimitSnapshotStore'
import { useDevToolsStore } from '../../../stores/useDevToolsStore'

/**
 * Side-panel thumbnail list of recent off-track snapshots.
 *
 * Visibility + capture are both gated by the Dev menu entry
 * `track-limit-snapshots`. Click a thumbnail to enlarge; X removes the entry.
 */
export function TrackLimitSnapshots() {
  const isOpen = useDevToolsStore(s => s.panels['track-limit-snapshots'].isOpen)
  const snapshots = useTrackLimitSnapshotStore(s => s.snapshots)
  const removeSnapshot = useTrackLimitSnapshotStore(s => s.removeSnapshot)
  const clear = useTrackLimitSnapshotStore(s => s.clear)
  const [enlargedId, setEnlargedId] = useState<number | null>(null)

  if (!isOpen) return null

  const enlarged = enlargedId == null ? null : snapshots.find(s => s.id === enlargedId)

  return (
    <>
      <div className='pointer-events-auto flex flex-col gap-1 max-w-[150px]'>
        <div className='flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-white/60'>
          <span>off-track {snapshots.length}</span>
          <button
            onClick={clear}
            className='text-white/40 hover:text-white/80 text-xs px-1'
            type='button'
          >
            clear
          </button>
        </div>
        {snapshots.map(s => (
          <div key={s.id} className='relative group'>
            <button
              onClick={() => setEnlargedId(s.id)}
              type='button'
              className='block w-full border border-white/10 hover:border-white/40 transition'
            >
              <img
                src={s.dataUrl}
                alt='track-limit snapshot'
                className='w-full h-auto block'
              />
              <div className='text-[9px] font-mono text-white/40 px-1 py-0.5 bg-black/60'>
                {new Date(s.timestampMs).toLocaleTimeString()}
              </div>
            </button>
            <button
              onClick={e => {
                e.stopPropagation()
                removeSnapshot(s.id)
              }}
              type='button'
              className='absolute top-0 right-0 w-5 h-5 bg-black/70 text-white/80 hover:text-red-400 text-xs leading-none opacity-0 group-hover:opacity-100 transition'
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {enlarged && (
        <div
          className='fixed inset-0 bg-black/80 flex items-center justify-center z-50 pointer-events-auto'
          onClick={() => setEnlargedId(null)}
        >
          <div
            className='relative max-w-[90vw] max-h-[90vh]'
            onClick={e => e.stopPropagation()}
          >
            <img
              src={enlarged.dataUrl}
              alt='track-limit snapshot (enlarged)'
              className='max-w-[90vw] max-h-[90vh] block border border-white/20'
            />
            <div className='absolute top-2 right-2 flex gap-2'>
              <a
                href={enlarged.dataUrl}
                download={`track-limit-${enlarged.timestampMs}.png`}
                className='px-2 py-1 bg-black/70 text-white/80 hover:text-white text-xs font-mono'
                onClick={e => e.stopPropagation()}
              >
                download
              </a>
              <button
                onClick={() => setEnlargedId(null)}
                type='button'
                className='px-2 py-1 bg-black/70 text-white/80 hover:text-red-400 text-xs font-mono'
              >
                close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
