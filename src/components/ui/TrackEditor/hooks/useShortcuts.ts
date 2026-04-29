import { useEffect } from 'react'
import { getAnchor } from '../geometry/path'
import { useTrackEditorStore } from '../state/useTrackEditorStore'

const ARROW_KEYS: Record<string, { dx: number; dy: number }> = {
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
}

export function useShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

      const mod = e.metaKey || e.ctrlKey
      const state = useTrackEditorStore.getState()
      const {
        undo,
        redo,
        setTool,
        selected,
        deleteAnchor,
        commit,
        selectedPitBoxAreaId,
        deletePitBoxArea,
        setAnchorPoint,
        selectedCurbId,
        deleteCurb,
      } = state

      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        redo()
        return
      }

      const arrow = ARROW_KEYS[e.key]
      if (arrow && !mod && !e.altKey) {
        if (selected) {
          const anchor = getAnchor(state.doc.paths, selected.pathId, selected.anchorIndex)
          if (!anchor) return
          e.preventDefault()
          if (!e.repeat) commit()
          const step = e.shiftKey ? 10 : 1
          setAnchorPoint(
            selected,
            { x: anchor.point.x + arrow.dx * step, y: anchor.point.y + arrow.dy * step },
            true,
          )
        }
        return
      }

      if (e.key === 'v' || e.key === 'V') {
        setTool('select')
        return
      }
      if (e.key === 'p' || e.key === 'P') {
        setTool('pen')
        return
      }
      if (e.key === 't' || e.key === 'T') {
        setTool('terrain')
        return
      }
      if (e.key === 'c' || e.key === 'C') {
        setTool('curb')
        return
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedCurbId) {
          e.preventDefault()
          deleteCurb(selectedCurbId)
          return
        }
        if (selectedPitBoxAreaId) {
          e.preventDefault()
          deletePitBoxArea(selectedPitBoxAreaId)
          return
        }
        if (selected) {
          e.preventDefault()
          commit()
          deleteAnchor(selected)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
