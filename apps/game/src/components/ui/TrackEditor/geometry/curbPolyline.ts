import type { Path } from './types'
import { pointOnPathAt } from './closestPoint'
import { worldToScreen, type Viewport } from './viewport'
import { CURB_OFFSET_SCREEN } from './hitTest'

export function curbPolylinePoints(
  paths: Path[],
  pathId: string,
  pathStart: number,
  pathEnd: number,
  edge: 'left' | 'right',
  viewport: Viewport,
): string {
  const path = paths.find(p => p.id === pathId)
  if (!path) return ''
  const lo = Math.min(pathStart, pathEnd)
  const hi = Math.max(pathStart, pathEnd)
  const span = hi - lo
  if (span < 1e-6) return ''
  const samples = Math.max(8, Math.ceil(span * 32))
  const sign = edge === 'left' ? 1 : -1
  const pts: string[] = []
  for (let i = 0; i <= samples; i++) {
    const p = lo + (span * i) / samples
    const onPath = pointOnPathAt(path, p, paths)
    if (!onPath) continue
    const sp = worldToScreen(viewport, onPath.point)
    const tx = onPath.tangent.x
    const ty = onPath.tangent.y
    const len = Math.hypot(tx, ty) || 1
    const perpX = (-ty / len) * sign * CURB_OFFSET_SCREEN
    const perpY = (tx / len) * sign * CURB_OFFSET_SCREEN
    pts.push(`${sp.x + perpX},${sp.y + perpY}`)
  }
  return pts.join(' ')
}

