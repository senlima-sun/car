import { useCallback, useEffect } from 'react'
import { useCustomizationStore } from '@/stores/useCustomizationStore'
import { useEditorStore } from '@/stores/useEditorStore'
import type { PlacementState } from '@/types/trackObjects'
import { keyToAction } from '../helpers/keyToAction'

export function useObjectPlacerKeyboard(args: {
  placementState: PlacementState
  partialDeleteMode: boolean
  partialDeleteState: ReturnType<typeof useEditorStore.getState>['partialDeleteState']
  elevationEditMode: boolean
  previewPositionForPaste: [number, number, number] | null
  rotatePreviewCW: () => void
  cancelPlacement: () => void
  cancelCurbPlacement: () => void
  cancelPartialDelete: () => void
  cancelPolygon: () => void
  undoLastPolygonPoint: () => void
  closePolygon: () => void
  setElevationEditMode: (next: boolean) => void
  undo: () => void
  redo: () => void
  copySelected: () => void
  pasteAtPosition: (pos: [number, number, number]) => void
}) {
  const {
    placementState,
    partialDeleteMode,
    partialDeleteState,
    elevationEditMode,
    previewPositionForPaste,
    rotatePreviewCW,
    cancelPlacement,
    cancelCurbPlacement,
    cancelPartialDelete,
    cancelPolygon,
    undoLastPolygonPoint,
    closePolygon,
    setElevationEditMode,
    undo,
    redo,
    copySelected,
    pasteAtPosition,
  } = args

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const action = keyToAction(event, { placementState })
      if (!action) return
      event.preventDefault()

      switch (action.kind) {
        case 'undo':
          undo()
          return
        case 'redo':
          redo()
          return
        case 'copy':
          copySelected()
          return
        case 'paste':
          if (previewPositionForPaste) pasteAtPosition(previewPositionForPaste)
          return
        case 'rotate': {
          const editorState = useEditorStore.getState()
          const customStore = useCustomizationStore.getState()
          if (editorState.selectedObjectId) {
            const obj = customStore.placedObjects.find(o => o.id === editorState.selectedObjectId)
            if (obj?.type === 'checkpoint' && obj.startPoint && obj.endPoint) {
              const cx = (obj.startPoint[0] + obj.endPoint[0]) / 2
              const cz = (obj.startPoint[2] + obj.endPoint[2]) / 2
              const rotateAroundCenter = (
                p: [number, number, number],
              ): [number, number, number] => {
                const dx = p[0] - cx
                const dz = p[2] - cz
                return [cx - dz, p[1], cz + dx]
              }
              const newStart = rotateAroundCenter(obj.startPoint)
              const newEnd = rotateAroundCenter(obj.endPoint)
              const newRotation = Math.atan2(newEnd[0] - newStart[0], newEnd[2] - newStart[2])
              customStore.updateObject(obj.id, {
                startPoint: newStart,
                endPoint: newEnd,
                position: [cx, 0, cz],
                rotation: newRotation,
              })
              return
            }
          }
          rotatePreviewCW()
          return
        }
        case 'toggleElevation':
          setElevationEditMode(useEditorStore.getState().editorMode !== 'elevation')
          return
        case 'cancel':
          if (elevationEditMode) {
            setElevationEditMode(false)
          } else if (placementState === 'polygonDrawing') {
            cancelPolygon()
          } else if (partialDeleteMode && partialDeleteState) {
            cancelPartialDelete()
          } else if (placementState === 'curbDragging') {
            cancelCurbPlacement()
          } else {
            cancelPlacement()
          }
          return
        case 'undoPolygonPoint':
          undoLastPolygonPoint()
          return
        case 'closePolygon':
          closePolygon()
          return
      }
    },
    [
      placementState,
      partialDeleteMode,
      partialDeleteState,
      elevationEditMode,
      previewPositionForPaste,
      rotatePreviewCW,
      cancelPlacement,
      cancelCurbPlacement,
      cancelPartialDelete,
      cancelPolygon,
      undoLastPolygonPoint,
      closePolygon,
      setElevationEditMode,
      undo,
      redo,
      copySelected,
      pasteAtPosition,
    ],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
