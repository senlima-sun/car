import { getAnchor, resolveAnchor } from '../geometry/path'
import type { Path, Point } from '../geometry/types'
import { worldToScreen, type Viewport } from '../geometry/viewport'
import type { PenState } from '../state/useTrackEditorStore'

export function buildPreviewSegment(args: {
  paths: Path[]
  viewport: Viewport
  pen: Pick<PenState, 'activePathId' | 'startRef'>
  hoverWorld: Point | null
}): string | null {
  const { paths, viewport, pen, hoverWorld } = args
  if (!hoverWorld) return null

  const last = (() => {
    if (pen.activePathId) {
      const path = paths.find(p => p.id === pen.activePathId)
      if (!path || path.anchors.length === 0) return null
      return resolveAnchor(paths, path.anchors[path.anchors.length - 1]!)
    }
    if (!pen.startRef) return null
    return getAnchor(paths, pen.startRef.pathId, pen.startRef.anchorIndex)
  })()

  if (!last) return null

  const lastS = worldToScreen(viewport, last.point)
  const hoverS = worldToScreen(viewport, hoverWorld)
  const hasOut = last.outHandle.x !== last.point.x || last.outHandle.y !== last.point.y

  if (hasOut) {
    const c1 = worldToScreen(viewport, last.outHandle)
    return `M ${lastS.x} ${lastS.y} C ${c1.x} ${c1.y} ${hoverS.x} ${hoverS.y} ${hoverS.x} ${hoverS.y}`
  }
  return `M ${lastS.x} ${lastS.y} L ${hoverS.x} ${hoverS.y}`
}
