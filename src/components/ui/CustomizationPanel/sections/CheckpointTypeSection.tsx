import { useCustomizationStore } from '../../../../stores/useCustomizationStore'
import { useEditorStore } from '../../../../stores/useEditorStore'
import { SectionShell } from '../SectionShell'

const MODE_BUTTON_BASE =
  'flex-1 px-2.5 py-1.5 border-2 border-transparent rounded-md cursor-pointer text-[11px] font-bold transition-all duration-200 ease'
const MODE_BUTTON_INACTIVE = 'bg-white/10 text-[#888]'
const MODE_BUTTON_START_ACTIVE = 'bg-[#00ff00]/20 border-[#00ff00] text-[#00ff00]'
const MODE_BUTTON_SECTOR_ACTIVE = 'bg-[#3b82f6]/20 border-[#3b82f6] text-[#3b82f6]'
const PLACEMENT_HINT =
  'text-[#888] text-[10px] mt-1.5 px-2 py-1.5 bg-white/5 rounded leading-[1.4]'

export default function CheckpointTypeSection() {
  const checkpointPlacementType = useEditorStore(s => s.checkpointPlacementType)
  const placedObjects = useCustomizationStore(s => s.placedObjects)

  const sectorCount = placedObjects.filter(
    o => o.type === 'checkpoint' && o.checkpointType === 'sector',
  ).length

  return (
    <SectionShell title="Checkpoint Type">
      <div className='flex gap-1 mb-2.5'>
        <button
          className={`${MODE_BUTTON_BASE} ${
            checkpointPlacementType === 'start-finish'
              ? MODE_BUTTON_START_ACTIVE
              : MODE_BUTTON_INACTIVE
          }`}
          onClick={() => useEditorStore.getState().setCheckpointPlacementType('start-finish')}
        >
          Start/Finish
        </button>
        <button
          className={`${MODE_BUTTON_BASE} ${
            checkpointPlacementType === 'sector'
              ? MODE_BUTTON_SECTOR_ACTIVE
              : MODE_BUTTON_INACTIVE
          }`}
          onClick={() => useEditorStore.getState().setCheckpointPlacementType('sector')}
        >
          Sector
        </button>
      </div>
      <div className={PLACEMENT_HINT}>
        {checkpointPlacementType === 'start-finish'
          ? 'Only one start/finish line allowed. Replaces existing.'
          : `Sector ${sectorCount + 1} — placed in order along track.`}
      </div>
      <div className={PLACEMENT_HINT}>Click on a road to place checkpoint across it</div>
    </SectionShell>
  )
}
