import { useEffect } from 'react'
import { useEditorStore } from '@/stores/useEditorStore'
import { useTrackPathStore } from '@/stores/useTrackPathStore'

export function useSVGKeyboard() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const pathStore = useTrackPathStore.getState()
      if (pathStore.editMode === 'draw' && pathStore.activePathId) {
        if (e.key === 'Enter') {
          e.preventDefault()
          pathStore.setEditMode('edit')
          return
        }
        if (e.key === 'c' || e.key === 'C') {
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            pathStore.closePath(pathStore.activePathId)
            pathStore.setEditMode('edit')
            return
          }
        }
        if (e.key === 'Escape') {
          pathStore.setEditMode('none')
          pathStore.setActivePath(null)
          return
        }
        if (e.key === 'Backspace') {
          e.preventDefault()
          if (pathStore.selectedPointId) {
            pathStore.removeControlPoint(pathStore.activePathId, pathStore.selectedPointId)
          }
          return
        }
        return
      }

      const editor = useEditorStore.getState()
      const isMeta = e.metaKey || e.ctrlKey

      if (isMeta && e.shiftKey && e.key === 'z') {
        e.preventDefault()
        editor.redo()
        return
      }

      if (isMeta && e.key === 'z') {
        e.preventDefault()
        editor.undo()
        return
      }

      if (isMeta && e.key === 'c') {
        e.preventDefault()
        editor.copySelected()
        return
      }

      if (isMeta && e.key === 'v') {
        e.preventDefault()
        if (editor.previewPosition) {
          editor.pasteAtPosition(editor.previewPosition)
        }
        return
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        editor.rotatePreviewCW()
        return
      }

      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault()
        editor.setElevationEditMode(!editor.elevationEditMode)
        return
      }

      if (e.key === 'Escape') {
        if (editor.elevationEditMode) {
          editor.setElevationEditMode(false)
          return
        }
        if (editor.placementState === 'polygonDrawing') {
          editor.cancelPolygon()
          return
        }
        if (editor.partialDeleteMode && editor.partialDeleteState) {
          editor.cancelPartialDelete()
          return
        }
        if (editor.placementState === 'curbDragging') {
          editor.cancelCurbPlacement()
          return
        }
        editor.cancelPlacement()
        return
      }

      if (e.key === 'Backspace') {
        if (editor.placementState === 'polygonDrawing') {
          e.preventDefault()
          editor.undoLastPolygonPoint()
          return
        }
      }

      if (e.key === 'Enter') {
        if (editor.placementState === 'polygonDrawing') {
          e.preventDefault()
          editor.closePolygon()
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
