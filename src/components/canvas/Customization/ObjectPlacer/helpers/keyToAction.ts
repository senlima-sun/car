export type PlacementState =
  | 'selecting'
  | 'placing'
  | 'dragging'
  | 'placingControlPoint'
  | 'curbDragging'
  | 'polygonDrawing'

export type PlacerAction =
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'copy' }
  | { kind: 'paste' }
  | { kind: 'rotate' }
  | { kind: 'toggleElevation' }
  | { kind: 'cancel' }
  | { kind: 'undoPolygonPoint' }
  | { kind: 'closePolygon' }

export type KeyboardEventLike = {
  code: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}

export type PlacerKeyContext = {
  placementState: PlacementState
}

export function keyToAction(
  event: KeyboardEventLike,
  ctx: PlacerKeyContext,
): PlacerAction | null {
  const cmd = event.ctrlKey || event.metaKey

  if (cmd && event.code === 'KeyZ') {
    return event.shiftKey ? { kind: 'redo' } : { kind: 'undo' }
  }

  if (cmd && event.code === 'KeyC') return { kind: 'copy' }
  if (cmd && event.code === 'KeyV') return { kind: 'paste' }

  switch (event.code) {
    case 'KeyR':
      return { kind: 'rotate' }
    case 'KeyY':
      return { kind: 'toggleElevation' }
    case 'Escape':
      return { kind: 'cancel' }
    case 'Backspace':
      return ctx.placementState === 'polygonDrawing' ? { kind: 'undoPolygonPoint' } : null
    case 'Enter':
      return ctx.placementState === 'polygonDrawing' ? { kind: 'closePolygon' } : null
    default:
      return null
  }
}
