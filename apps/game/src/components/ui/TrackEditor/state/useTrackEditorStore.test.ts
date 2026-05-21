import { beforeEach, describe, expect, it } from 'vitest'
import { useTrackEditorStore } from './useTrackEditorStore'

describe('useTrackEditorStore pen continuation', () => {
  beforeEach(() => {
    useTrackEditorStore.setState(useTrackEditorStore.getInitialState())
  })

  it('keeps the selected anchor as the next pen start when switching from select', () => {
    const pathId = useTrackEditorStore.getState().beginPath({ x: 0, y: 0 })
    const ref = { pathId, anchorIndex: 0 }

    useTrackEditorStore.getState().setTool('select')
    useTrackEditorStore.getState().setSelected(ref)
    useTrackEditorStore.getState().setTool('pen')

    const state = useTrackEditorStore.getState()
    expect(state.selected).toBeNull()
    expect(state.pen.activePathId).toBeNull()
    expect(state.pen.startRef).toEqual(ref)
  })

  it('clears the pending pen start once a referenced path is begun', () => {
    const pathId = useTrackEditorStore.getState().beginPath({ x: 0, y: 0 })
    const ref = { pathId, anchorIndex: 0 }

    useTrackEditorStore.getState().setTool('select')
    useTrackEditorStore.getState().setSelected(ref)
    useTrackEditorStore.getState().setTool('pen')

    const newPathId = useTrackEditorStore.getState().beginPathWithRef(ref)
    const state = useTrackEditorStore.getState()

    expect(state.pen.activePathId).toBe(newPathId)
    expect(state.pen.startRef).toBeNull()
  })

  it('updates the pending pen start reference without opening a path', () => {
    const pathId = useTrackEditorStore.getState().beginPath({ x: 0, y: 0 })
    const ref = { pathId, anchorIndex: 0 }
    useTrackEditorStore.getState().finishActivePath()

    useTrackEditorStore.getState().setPenStartRef(ref)

    const state = useTrackEditorStore.getState()
    expect(state.pen.startRef).toEqual(ref)
    expect(state.pen.activePathId).toBeNull()
  })
})
