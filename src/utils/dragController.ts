export interface Position {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface Viewport {
  width: number
  height: number
}

export interface DragSession {
  startPointer: Position
  startPanelPos: Position
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  if (max < min) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

export function clampPositionToViewport(
  pos: Position,
  viewport: Viewport,
  panelSize: Size,
): Position {
  const maxX = Math.max(0, viewport.width - panelSize.width)
  const maxY = Math.max(0, viewport.height - panelSize.height)
  return {
    x: clamp(pos.x, 0, maxX),
    y: clamp(pos.y, 0, maxY),
  }
}

export function applyPointerDelta(session: DragSession, currentPointer: Position): Position {
  return {
    x: session.startPanelPos.x + (currentPointer.x - session.startPointer.x),
    y: session.startPanelPos.y + (currentPointer.y - session.startPointer.y),
  }
}

export function dragStep(
  session: DragSession,
  currentPointer: Position,
  viewport: Viewport,
  panelSize: Size,
): Position {
  return clampPositionToViewport(applyPointerDelta(session, currentPointer), viewport, panelSize)
}
