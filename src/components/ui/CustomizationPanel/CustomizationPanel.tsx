import { useEffect } from 'react'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useEditorStore } from '../../../stores/useEditorStore'
import { useCheckpointDragStore } from '../../../stores/useCheckpointDragStore'
import { useTrackStore } from '../../../stores/useTrackStore'
import { isLinearObject } from '../../../types/trackObjects'
import TrackValidationPanel from './TrackValidationPanel'
import ObjectSection from './sections/ObjectSection'
import CheckpointTypeSection from './sections/CheckpointTypeSection'
import CurbTypeSection from './sections/CurbTypeSection'
import TrackShapeSection from './sections/TrackShapeSection'
import SnapSettingsSection from './sections/SnapSettingsSection'
import AutoCurbSection from './sections/AutoCurbSection'
import ElevationSection from './sections/ElevationSection'
import TrackDirectionSection from './sections/TrackDirectionSection'
import SelectedRoadPropertiesSection from './sections/SelectedRoadPropertiesSection'
import TrackActionsSection from './sections/TrackActionsSection'
import ControlsHelp from './sections/ControlsHelp'
import StatsFooter from './sections/StatsFooter'

export default function CustomizationPanel() {
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const selectedObjectType = useEditorStore(s => s.selectedObjectType)
  const selectedObjectId = useEditorStore(s => s.selectedObjectId)
  const isDirty = useTrackStore(s => s.isDirty)

  useEffect(() => {
    useTrackStore.getState().markDirty()
  }, [placedObjects])

  useEffect(() => {
    if (!isDirty) return
    const timer = setTimeout(() => {
      useTrackStore.getState().saveCurrentTrack()
    }, 2000)
    return () => clearTimeout(timer)
  }, [placedObjects, isDirty])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectId) {
        if (e.key === 'Backspace' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
          e.preventDefault()
        }
        const customStore = useCustomizationStore.getState()
        const editor = useEditorStore.getState()
        const obj = customStore.placedObjects.find(o => o.id === selectedObjectId)
        if (obj?.type === 'checkpoint' && obj.checkpointType === 'sector') {
          useCheckpointDragStore.getState().deleteSectorCheckpoint(selectedObjectId, () =>
            editor.selectObject(null),
          )
        } else {
          customStore.removeObject(selectedObjectId)
          editor.selectObject(null)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedObjectId])

  const showTrackModeToggle = !!selectedObjectType && isLinearObject(selectedObjectType)

  return (
    <div className='absolute left-5 top-20 bg-black/80 p-[15px] rounded-[10px] pointer-events-auto max-w-[220px]'>
      <div className='text-white text-sm font-bold mb-3 border-b border-[#333] pb-2'>Track Editor</div>
      <ObjectSection />
      {selectedObjectType === 'checkpoint' && <CheckpointTypeSection />}
      {selectedObjectType === 'curb' && <CurbTypeSection />}
      {showTrackModeToggle && <TrackShapeSection />}
      {showTrackModeToggle && <SnapSettingsSection />}
      <AutoCurbSection />
      <ElevationSection />
      <TrackDirectionSection />
      <SelectedRoadPropertiesSection />
      <TrackValidationPanel />
      <TrackActionsSection />
      <ControlsHelp />
      <StatsFooter />
    </div>
  )
}
