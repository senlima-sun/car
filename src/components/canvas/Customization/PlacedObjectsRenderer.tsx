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

  // Load track library on mount (handles migration from legacy storage)
  useEffect(() => {
    loadLibrary()
  }, [loadLibrary])

  const handleObjectClick = useCallback(
    (objectId: string) => (e: ThreeEvent<MouseEvent>) => {
      // Only handle clicks when in delete mode
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
    [deleteMode, selectedObjectId, selectObject],
  )

  return (
    <>
      {placedObjects.map(object => (
        <group
          key={object.id}
          onClick={handleObjectClick(object.id)}
          onPointerOver={
            deleteMode
              ? e => {
                  e.stopPropagation()
                  document.body.style.cursor = 'pointer'
                }
              : undefined
          }
          onPointerOut={
            deleteMode
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
          />
        </group>
      ))}
    </>
  )
}
