import type { AnchorRef, CheckpointMarker, HandleRef, Path, PitBoxArea, Point } from './types'
import { getAnchor, resolveAnchor } from './path'
import { dist } from './point'
import { worldToScreen, type Viewport } from './viewport'
import { pointOnPath, pointOnPathAt } from './closestPoint'

export const HIT_RADIUS_SCREEN = 10
export const CLOSE_RADIUS_SCREEN = 12
export const DRAG_THRESHOLD_SCREEN = 3
export const PATH_HIT_RADIUS_SCREEN = 10
export const PIT_AREA_WIDTH = 8
export const PIT_AREA_DEPTH = 15
export const PIT_ROTATE_HANDLE_DIST = 2
export const CURB_HIT_RADIUS_SCREEN = 8
export const CURB_OFFSET_SCREEN = 5
export const CHECKPOINT_HIT_RADIUS_SCREEN = 14
export const CHECKPOINT_WIDTH_WORLD = 12

export function hitTestCheckpoint(
  paths: Path[],
  viewport: Viewport,
  checkpoints: CheckpointMarker[],
  screen: Point,
): string | null {
  let best: { id: string; dist: number } | null = null
  for (let i = checkpoints.length - 1; i >= 0; i--) {
    const cp = checkpoints[i]!
    const path = paths.find(p => p.id === cp.pathId)
    if (!path) continue
    const onPath = pointOnPath(path, cp.segmentIndex, cp.t, paths)
    if (!onPath) continue
    const centerScreen = worldToScreen(viewport, onPath.point)
    const dCenter = dist(centerScreen, screen)
    if (dCenter <= CHECKPOINT_HIT_RADIUS_SCREEN) {
      if (!best || dCenter < best.dist) best = { id: cp.id, dist: dCenter }
      continue
    }
    const half = CHECKPOINT_WIDTH_WORLD / 2
    const left = worldToScreen(viewport, {
      x: onPath.point.x - onPath.tangent.y * half,
      y: onPath.point.y + onPath.tangent.x * half,
    })
    const right = worldToScreen(viewport, {
      x: onPath.point.x + onPath.tangent.y * half,
      y: onPath.point.y - onPath.tangent.x * half,
    })
    const lineDist = pointToSegmentDist(screen, left, right)
    if (lineDist <= CHECKPOINT_HIT_RADIUS_SCREEN && (!best || lineDist < best.dist)) {
      best = { id: cp.id, dist: lineDist }
    }
  }
  return best?.id ?? null
}

function pointToSegmentDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const L2 = dx * dx + dy * dy
  if (L2 < 1e-9) return dist(p, a)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2
  t = Math.max(0, Math.min(1, t))
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy })
}

export function hitTestAnchor(
  paths: Path[],
  viewport: Viewport,
  screen: Point,
  restrictPathId: string | null = null,
): AnchorRef | null {
  for (let pi = paths.length - 1; pi >= 0; pi--) {
    const p = paths[pi]!
    if (restrictPathId !== null && p.id !== restrictPathId) continue
    for (let ai = 0; ai < p.anchors.length; ai++) {
      const a = resolveAnchor(paths, p.anchors[ai]!)
      if (!a) continue
      const as = worldToScreen(viewport, a.point)
      if (dist(as, screen) <= HIT_RADIUS_SCREEN) {
        return { pathId: p.id, anchorIndex: ai }
      }
    }
  }
  return null
}

export function hitTestHandle(
  paths: Path[],
  viewport: Viewport,
  selected: AnchorRef | null,
  screen: Point,
): HandleRef | null {
  if (!selected) return null
  const path = paths.find(p => p.id === selected.pathId)
  if (!path) return null
  const a = getAnchor(paths, selected.pathId, selected.anchorIndex)
  if (!a) return null
  const inS = worldToScreen(viewport, a.inHandle)
  const outS = worldToScreen(viewport, a.outHandle)
  if (dist(inS, screen) <= HIT_RADIUS_SCREEN && a.handleType !== 'corner') {
    return { pathId: path.id, anchorIndex: selected.anchorIndex, which: 'in' }
  }
  if (dist(outS, screen) <= HIT_RADIUS_SCREEN && a.handleType !== 'corner') {
    return { pathId: path.id, anchorIndex: selected.anchorIndex, which: 'out' }
  }
  return null
}

export function hitTestPitArea(pitBoxAreas: PitBoxArea[], world: Point): string | null {
  for (let i = pitBoxAreas.length - 1; i >= 0; i--) {
    const a = pitBoxAreas[i]!
    const cos = Math.cos(-a.rotation)
    const sin = Math.sin(-a.rotation)
    const dx = world.x - a.position.x
    const dy = world.y - a.position.y
    const lx = dx * cos - dy * sin
    const ly = dx * sin + dy * cos
    if (Math.abs(lx) <= PIT_AREA_WIDTH / 2 && Math.abs(ly) <= PIT_AREA_DEPTH / 2) {
      return a.id
    }
  }
  return null
}

export function pitAreaRotateHandleWorld(area: { position: Point; rotation: number }): Point {
  const sin = Math.sin(area.rotation)
  const cos = Math.cos(area.rotation)
  const ly = -(PIT_AREA_DEPTH / 2 + PIT_ROTATE_HANDLE_DIST)
  return {
    x: area.position.x + 0 * cos - ly * sin,
    y: area.position.y + 0 * sin + ly * cos,
  }
}

export function edgeSideAt(
  pathHit: { tangent: Point; point: Point },
  world: Point,
): 'left' | 'right' {
  const dx = world.x - pathHit.point.x
  const dy = world.y - pathHit.point.y
  const cross = pathHit.tangent.x * dy - pathHit.tangent.y * dx
  return cross >= 0 ? 'right' : 'left'
}

export function hitTestCurb(
  paths: Path[],
  viewport: Viewport,
  curbs: {
    id: string
    pathId: string
    pathStart: number
    pathEnd: number
    edge: 'left' | 'right'
  }[],
  screen: Point,
): string | null {
  let best: { id: string; dist: number } | null = null
  for (const c of curbs) {
    const path = paths.find(p => p.id === c.pathId)
    if (!path) continue
    const span = c.pathEnd - c.pathStart
    const samples = Math.max(12, Math.ceil(span * 16))
    const sign = c.edge === 'left' ? 1 : -1
    for (let i = 0; i <= samples; i++) {
      const p = c.pathStart + (span * i) / samples
      const onPath = pointOnPathAt(path, p, paths)
      if (!onPath) continue
      const onScreen = worldToScreen(viewport, onPath.point)
      const len = Math.hypot(onPath.tangent.x, onPath.tangent.y) || 1
      const offsetScreen = {
        x: onScreen.x + (-onPath.tangent.y / len) * sign * CURB_OFFSET_SCREEN,
        y: onScreen.y + (onPath.tangent.x / len) * sign * CURB_OFFSET_SCREEN,
      }
      const d = dist(offsetScreen, screen)
      if (d <= CURB_HIT_RADIUS_SCREEN && (!best || d < best.dist)) {
        best = { id: c.id, dist: d }
      }
    }
  }
  return best?.id ?? null
}
