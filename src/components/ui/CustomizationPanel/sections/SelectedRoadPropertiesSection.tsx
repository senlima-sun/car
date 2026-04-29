import { useCustomizationStore } from '../../../../stores/useCustomizationStore'
import { useEditorStore } from '../../../../stores/useEditorStore'
import { isCurveMode } from '../../../../types/trackObjects'

const SECTION = 'mb-[15px]'
const SECTION_TITLE = 'text-[#888] text-[11px] uppercase mb-2'
const SLIDER_ROW = 'flex items-center gap-2'
const SLIDER_ROW_WITH_GAP = 'flex items-center gap-2 mb-1.5'
const SLIDER_LABEL = 'text-[#aaa] text-[11px] min-w-[80px]'
const SLIDER_INPUT = 'flex-1 accent-[#3b82f6]'
const SLIDER_VALUE_NARROW = 'text-white text-xs font-mono min-w-[28px]'
const SLIDER_VALUE = 'text-white text-xs font-mono min-w-[36px]'

export default function SelectedRoadPropertiesSection() {
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const selectedObjectId = useEditorStore(s => s.selectedObjectId)
  const deleteMode = useEditorStore(s => s.editorMode === 'delete')

  const selectedObject = selectedObjectId
    ? placedObjects.find(obj => obj.id === selectedObjectId)
    : null

  if (!selectedObject || selectedObject.type !== 'road' || deleteMode) return null

  const updateObject = (
    patch: Parameters<ReturnType<typeof useCustomizationStore.getState>['updateObject']>[1],
  ) => useCustomizationStore.getState().updateObject(selectedObject.id, patch)

  return (
    <>
      <div className={SECTION}>
        <div className={SECTION_TITLE}>Road Width</div>
        <div className={SLIDER_ROW}>
          <input
            type='range'
            min={8}
            max={24}
            step={2}
            value={selectedObject.width ?? 12}
            onChange={e => updateObject({ width: Number(e.target.value) })}
            className={SLIDER_INPUT}
          />
          <span className={SLIDER_VALUE_NARROW}>{selectedObject.width ?? 12}</span>
        </div>
      </div>

      <div className={SECTION}>
        <div className={SECTION_TITLE}>Elevation</div>
        <div className={SLIDER_ROW_WITH_GAP}>
          <span className={SLIDER_LABEL}>Start Height</span>
          <input
            type='range'
            min={0}
            max={20}
            step={0.5}
            value={selectedObject.startElevation ?? 0}
            onChange={e => updateObject({ startElevation: Number(e.target.value) })}
            className={SLIDER_INPUT}
          />
          <span className={SLIDER_VALUE}>{(selectedObject.startElevation ?? 0).toFixed(1)}m</span>
        </div>
        <div className={SLIDER_ROW_WITH_GAP}>
          <span className={SLIDER_LABEL}>End Height</span>
          <input
            type='range'
            min={0}
            max={20}
            step={0.5}
            value={selectedObject.endElevation ?? 0}
            onChange={e => updateObject({ endElevation: Number(e.target.value) })}
            className={SLIDER_INPUT}
          />
          <span className={SLIDER_VALUE}>{(selectedObject.endElevation ?? 0).toFixed(1)}m</span>
        </div>
        {isCurveMode(selectedObject.trackMode) && (
          <div className={SLIDER_ROW}>
            <span className={SLIDER_LABEL}>Banking</span>
            <input
              type='range'
              min={-30}
              max={30}
              step={5}
              value={selectedObject.banking ?? 0}
              onChange={e => updateObject({ banking: Number(e.target.value) })}
              className={SLIDER_INPUT}
            />
            <span className={SLIDER_VALUE}>{(selectedObject.banking ?? 0).toFixed(0)}°</span>
          </div>
        )}
      </div>
    </>
  )
}
