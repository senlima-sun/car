import { useCustomizationStore } from '../../../../stores/useCustomizationStore'
import { useEditorStore } from '../../../../stores/useEditorStore'
import { generateCurbsForRoads } from '../../../../utils/autoCurbGenerator'
import { SectionShell } from '../SectionShell'

const DELETE_BUTTON_BASE =
  'w-full px-3 py-2.5 border-2 border-transparent rounded-md cursor-pointer text-xs font-bold transition-all duration-200 ease mb-2.5'
const DELETE_BUTTON_INACTIVE = 'bg-white/10 text-[#888]'
const AUTO_CURB_ACTIVE = 'bg-[#22c55e]/30 border-[#22c55e] text-[#4ade80]'
const PLACEMENT_HINT =
  'text-[#888] text-[10px] mt-1.5 px-2 py-1.5 bg-white/5 rounded leading-[1.4]'

export default function AutoCurbSection() {
  const autoCurbMode = useEditorStore(s => s.editorMode === 'autoCurb')
  const selectedRoadIds = useEditorStore(s => s.selectedRoadIds)

  const handleToggleAutoCurbMode = () => {
    const editor = useEditorStore.getState()
    if (editor.editorMode === 'autoCurb') {
      editor.setAutoCurbMode(false)
    } else {
      editor.setAutoCurbMode(true)
    }
  }

  const handleGenerateCurbs = () => {
    const editor = useEditorStore.getState()
    const customStore = useCustomizationStore.getState()
    if (editor.selectedRoadIds.length === 0) return
    const curbs = generateCurbsForRoads(editor.selectedRoadIds, customStore.placedObjects)
    if (curbs.length > 0) {
      customStore.addGeneratedCurbs(curbs)
      editor.clearRoadSelection()
      editor.setAutoCurbMode(false)
    }
  }

  return (
    <SectionShell title="Auto Curbs">
      <button
        className={`${DELETE_BUTTON_BASE} ${
          autoCurbMode ? AUTO_CURB_ACTIVE : DELETE_BUTTON_INACTIVE
        }`}
        onClick={handleToggleAutoCurbMode}
      >
        {autoCurbMode ? 'Cancel Selection' : 'Select Roads for Curbs'}
      </button>

      {autoCurbMode && (
        <div className={PLACEMENT_HINT}>
          {selectedRoadIds.length > 0
            ? `${selectedRoadIds.length} road(s) selected - click Generate to add curbs`
            : 'Click on roads to select them for auto-curb generation'}
        </div>
      )}

      {autoCurbMode && selectedRoadIds.length > 0 && (
        <button
          className='flex-1 px-3 py-2 border-0 rounded-md cursor-pointer text-xs font-bold transition-all duration-200 ease bg-[#22c55e] text-white w-full mt-2'
          onClick={handleGenerateCurbs}
        >
          Generate Curbs
        </button>
      )}
    </SectionShell>
  )
}
