import { useEffect } from 'react'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useEditorStore } from '../../../stores/useEditorStore'
import { useCheckpointDragStore } from '../../../stores/useCheckpointDragStore'
import { useTrackStore } from '../../../stores/useTrackStore'
import { isLinearObject } from '../../../types/trackObjects'
import { LabelTag, Surface } from '../primitives'
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
    <Surface
      variant='card'
      className='absolute left-5 top-20 p-4 pointer-events-auto w-[260px]'
    >
      <div className='flex items-center justify-between border-b border-white/8 pb-2 mb-3'>
        <span className='text-white text-sm font-bold'>Track Editor</span>
        <LabelTag>Editor</LabelTag>
      </div>
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
    </Surface>
  )
}
