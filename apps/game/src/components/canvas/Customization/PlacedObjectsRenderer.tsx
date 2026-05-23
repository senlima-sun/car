import { useEffect, useCallback, useMemo, useRef } from 'react'
import { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useEditorStore } from '../../../stores/useEditorStore'
import { useTrackStore } from '../../../stores/useTrackStore'
import { useVisibilityStore } from '../../../stores/useVisibilityStore'
import { TrackObjectWrapper } from '../TrackObjects'
import VisibilityUpdater from './VisibilityUpdater'
import type { PlacedObject } from '../../../types/trackObjects'

interface PlacedObjectsRendererProps {
  enablePhysics?: boolean
}

export function isAlwaysVisibleTrackObject(type: PlacedObject['type']): boolean {
  return (
    type === 'track_ribbon' ||
    type === 'painted_area' ||
    type === 'edge_line' ||
    type === 'curb'
  )
}

export default function PlacedObjectsRenderer({
  enablePhysics = true,
}: PlacedObjectsRendererProps) {
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const selectedObjectId = useEditorStore(s => s.selectedObjectId)
  const deleteMode = useEditorStore(s => s.editorMode === 'delete')
  const selectObject = useEditorStore(s => s.selectObject)
  const loadLibrary = useTrackStore(s => s.loadLibrary)
  const autoCurbMode = useEditorStore(s => s.editorMode === 'autoCurb')
  const selectedRoadIds = useEditorStore(s => s.selectedRoadIds)
  const toggleRoadSelection = useEditorStore(s => s.toggleRoadSelection)
  const multiSelectedIds = useEditorStore(s => s.multiSelectedIds)
  const toggleMultiSelect = useEditorStore(s => s.toggleMultiSelect)
  const visibleObjectIds = useVisibilityStore(s => s.visibleObjectIds)

  useEffect(() => {
    void loadLibrary()
  }, [loadLibrary])

  const objectMap = useMemo(() => {
    const map = new Map<string, PlacedObject>()
    for (const obj of placedObjects) {
      map.set(obj.id, obj)
    }
    return map
  }, [placedObjects])

  const visibleObjects = useMemo(() => {
    const baseObjects = placedObjects.filter(obj => isAlwaysVisibleTrackObject(obj.type))
    const result: PlacedObject[] = [...baseObjects]

    if (visibleObjectIds.size === 0 && placedObjects.length > 0) {
      result.push(...placedObjects.filter(obj => !isAlwaysVisibleTrackObject(obj.type)))
      return result
    }

    for (const id of visibleObjectIds) {
      const obj = objectMap.get(id)
      if (obj && !isAlwaysVisibleTrackObject(obj.type)) result.push(obj)
    }
    return result
  }, [visibleObjectIds, objectMap, placedObjects])

  const stateRef = useRef({ deleteMode, autoCurbMode, selectedObjectId })
  stateRef.current = { deleteMode, autoCurbMode, selectedObjectId }

  const handleGroupClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      let target = e.object as THREE.Object3D | null
      let objectId: string | undefined
      let objectType: string | undefined
      while (target) {
        if (target.userData.trackObjectId) {
          objectId = target.userData.trackObjectId
          objectType = target.userData.trackObjectType
          break
        }
        target = target.parent
      }
      if (!objectId || !objectType) return

      const { deleteMode: dm, autoCurbMode: acm, selectedObjectId: selId } = stateRef.current

      if (acm && objectType === 'road') {
        e.stopPropagation()
        toggleRoadSelection(objectId)
        return
      }

      if (!dm && !acm && objectType === 'checkpoint') {
        e.stopPropagation()
        selectObject(selId === objectId ? null : objectId)
        return
      }

      if (dm) {
        e.stopPropagation()
        if (e.nativeEvent.shiftKey) {
          toggleMultiSelect(objectId)
        } else if (selId === objectId) {
          selectObject(null)
        } else {
          selectObject(objectId)
        }
      }
    },
    [selectObject, toggleRoadSelection, toggleMultiSelect],
  )

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    let target = e.object as THREE.Object3D | null
    let objectType: string | undefined
    while (target) {
      if (target.userData.trackObjectId) {
        objectType = target.userData.trackObjectType
        break
      }
      target = target.parent
    }
    if (!objectType) return

    const { deleteMode: dm, autoCurbMode: acm } = stateRef.current
    if (dm || (acm && objectType === 'road') || objectType === 'checkpoint') {
      e.stopPropagation()
      document.body.style.cursor = 'pointer'
    }
  }, [])

  const handlePointerOut = useCallback(() => {
    document.body.style.cursor = 'auto'
  }, [])

  return (
    <>
      <VisibilityUpdater />
      <group
        onClick={handleGroupClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        {visibleObjects.map(object => {
          const parentRoad = object.parentRoadId ? objectMap.get(object.parentRoadId) : undefined
          return (
            <group
              key={object.id}
              userData={{ trackObjectId: object.id, trackObjectType: object.type }}
            >
              <TrackObjectWrapper
                object={object}
                parentRoad={parentRoad}
                allObjects={placedObjects}
                enablePhysics={enablePhysics}
                isSelected={selectedObjectId === object.id || multiSelectedIds.includes(object.id)}
                isSelectedForCurb={autoCurbMode && selectedRoadIds.includes(object.id)}
              />
            </group>
          )
        })}
      </group>
    </>
  )
}
