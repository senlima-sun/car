import { useCustomizationStore } from '../../../../stores/useCustomizationStore'
import { useTrackStore } from '../../../../stores/useTrackStore'
import { SectionShell } from '../SectionShell'

const ACTION_BUTTON =
  'flex-1 px-3 py-2 border-0 rounded-md cursor-pointer text-xs font-bold transition-all duration-200 ease text-white'

export default function TrackActionsSection() {
  const isDirty = useTrackStore(s => s.isDirty)

  return (
    <SectionShell title="Track">
      <div
        className={`text-[11px] mb-2 px-2 py-1.5 rounded ${
          isDirty
            ? 'text-[#fbbf24] bg-[#fbbf24]/10'
            : 'text-[#22c55e] bg-[#22c55e]/10'
        }`}
      >
        {isDirty ? 'Unsaved changes...' : 'All changes saved'}
      </div>
      <div className='flex gap-1.5'>
        <button
          className={`${ACTION_BUTTON} bg-[#2563eb]`}
          onClick={() => useTrackStore.getState().saveCurrentTrack()}
        >
          Save Now
        </button>
      </div>
      <div className='flex gap-1.5 mt-1.5'>
        <button
          className={`${ACTION_BUTTON} bg-[#8b5cf6]`}
          onClick={() => useTrackStore.getState().exportCurrentTrack()}
        >
          Export Track
        </button>
      </div>
      <div className='flex gap-1.5 mt-1.5'>
        <button
          className={`${ACTION_BUTTON} bg-[#dc2626]`}
          onClick={() => {
            if (window.confirm('Clear all placed objects?')) {
              useCustomizationStore.getState().clearAll()
            }
          }}
        >
          Clear All
        </button>
      </div>
    </SectionShell>
  )
}
