import { useEffect, useCallback } from 'react'
import { ThreeEvent } from '@react-three/fiber'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useTrackStore } from '../../../stores/useTrackStore'
import { TrackObjectWrapper } from '../TrackObjects'

interface PlacedObjectsRendererProps {
  enablePhysics?: boolean
}

export default function PlacedObjectsRenderer({
  enablePhysics = true,
}: PlacedObjectsRendererProps) {
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const selectedObjectId = useCustomizationStore(s => s.selectedObjectId)
  const deleteMode = useCustomizationStore(s => s.deleteMode)
  const selectObject = useCustomizationStore(s => s.selectObject)
  const loadLibrary = useTrackStore(s => s.loadLibrary)
  // Auto curb mode state
  const autoCurbMode = useCustomizationStore(s => s.autoCurbMode)
  const selectedRoadIds = useCustomizationStore(s => s.selectedRoadIds)
  const toggleRoadSelection = useCustomizationStore(s => s.toggleRoadSelection)

  // Load track library on mount (handles migration from legacy storage)
  useEffect(() => {
    loadLibrary()
  }, [loadLibrary])

  const handleObjectClick = useCallback(
    (objectId: string, objectType: string) => (e: ThreeEvent<MouseEvent>) => {
      // Handle auto curb mode: only allow selecting roads
      if (autoCurbMode && objectType === 'road') {
        e.stopPropagation()
        toggleRoadSelection(objectId)
        return
      }

      // Handle delete mode
      if (deleteMode) {
        e.stopPropagation()
        // Toggle selection or select new object
        if (selectedObjectId === objectId) {
          selectObject(null)
        } else {
          selectObject(objectId)
        }
      }
    },
    [deleteMode, autoCurbMode, selectedObjectId, selectObject, toggleRoadSelection],
  )

  // Check if pointer events should be active (for delete or auto curb mode)
  const isInteractiveMode = deleteMode || autoCurbMode

  return (
    <>
      {placedObjects.map(object => {
        // In auto curb mode, only roads are clickable
        const isClickable = deleteMode || (autoCurbMode && object.type === 'road')
        return (
          <group
            key={object.id}
            onClick={handleObjectClick(object.id, object.type)}
            onPointerOver={
              isClickable
                ? e => {
                    e.stopPropagation()
                    document.body.style.cursor = 'pointer'
                  }
                : undefined
            }
            onPointerOut={
              isInteractiveMode
                ? () => {
                    document.body.style.cursor = 'auto'
                  }
                : undefined
            }
          >
            <TrackObjectWrapper
              object={object}
              enablePhysics={enablePhysics}
              isSelected={selectedObjectId === object.id}
              isSelectedForCurb={autoCurbMode && selectedRoadIds.includes(object.id)}
            />
          </group>
        )
      })}
    </>
  )
}
