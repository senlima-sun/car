import { useCustomizationStore } from '../../../../stores/useCustomizationStore'
import { useEditorStore } from '../../../../stores/useEditorStore'
import { useTrackGraphStore } from '../../../../stores/useTrackGraphStore'
import { SectionShell } from '../SectionShell'

const ACTION_BUTTON =
  'flex-1 px-3 py-2 border-0 rounded-md cursor-pointer text-xs font-bold transition-all duration-200 ease text-white'

export default function TrackDirectionSection() {
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const selectedObjectId = useEditorStore(s => s.selectedObjectId)
  const multiSelectedIds = useEditorStore(s => s.multiSelectedIds)
  const hasFlow = useTrackGraphStore(s => s.hasFlow)
  const flowWarnings = useTrackGraphStore(s => s.flowWarnings)

  const checkpoint = placedObjects.find(obj => obj.type === 'checkpoint')
  const hasCheckpoint = !!checkpoint

  const selectedObject = selectedObjectId
    ? placedObjects.find(obj => obj.id === selectedObjectId)
    : null

  const selectedRoads =
    multiSelectedIds.length > 0
      ? multiSelectedIds.filter(id => placedObjects.find(o => o.id === id)?.type === 'road')
      : selectedObject?.type === 'road'
        ? [selectedObject.id]
        : []
  const hasSelectedRoads = selectedRoads.length > 0

  return (
    <SectionShell title="Track Direction">
      {hasFlow ? (
        <>
          <div className='text-[#22c55e] text-[11px] mb-2 px-2 py-1.5 bg-[#22c55e]/10 rounded'>
            Direction set
            {flowWarnings.length > 0 ? ` (${flowWarnings.length} unconnected)` : ''}
          </div>
          {hasSelectedRoads && (
            <button
              className={`${ACTION_BUTTON} bg-[#f97316] w-full mb-1.5`}
              onClick={() => useTrackGraphStore.getState().flipRoadDirection(selectedRoads)}
            >
              Flip Direction ({selectedRoads.length} road{selectedRoads.length > 1 ? 's' : ''})
            </button>
          )}
          <button
            className={`${ACTION_BUTTON} bg-[#dc2626] w-full`}
            onClick={() => useTrackGraphStore.getState().clearTrackFlow()}
          >
            Clear Direction
          </button>
        </>
      ) : (
        <>
          <button
            className={`${ACTION_BUTTON} w-full ${
              hasCheckpoint
                ? 'bg-[#3b82f6] opacity-100 cursor-pointer'
                : 'bg-[#666] opacity-50 cursor-not-allowed'
            }`}
            onClick={() => useTrackGraphStore.getState().setTrackFlow()}
            disabled={!hasCheckpoint}
          >
            Set Track Direction
          </button>
          {!hasCheckpoint && (
            <div className='text-[#888] text-[10px] mt-1.5'>Place a checkpoint first</div>
          )}
        </>
      )}
    </SectionShell>
  )
}
