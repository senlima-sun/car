import type { Anchor, AnchorSlot, Path, Point } from './types'
import { isAnchorRefSlot } from './types'
import { clonePt, eq } from './point'

export function resolveAnchor(
  paths: Path[],
  slot: AnchorSlot,
  visited: Set<string> = new Set(),
): Anchor | null {
  if (!isAnchorRefSlot(slot)) return slot
  const key = `${slot.pathId}:${slot.anchorIndex}`
  if (visited.has(key)) return null
  visited.add(key)
  const path = paths.find(p => p.id === slot.pathId)
  if (!path) return null
  const next = path.anchors[slot.anchorIndex]
  if (!next) return null
  return resolveAnchor(paths, next, visited)
}

export function getAnchor(paths: Path[], pathId: string, anchorIndex: number): Anchor | null {
  const path = paths.find(p => p.id === pathId)
  if (!path) return null
  const slot = path.anchors[anchorIndex]
  if (!slot) return null
  return resolveAnchor(paths, slot)
}

let idCounter = 0
export const nextId = (prefix = 'id'): string =>
  `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`

export function makeAnchor(point: Point, inH?: Point, outH?: Point): Anchor {
  return {
    id: nextId('a'),
    point: clonePt(point),
    inHandle: inH ? clonePt(inH) : clonePt(point),
    outHandle: outH ? clonePt(outH) : clonePt(point),
    handleType: 'corner',
  }
}

export function makePath(first?: Anchor): Path {
  return {
    id: nextId('p'),
    anchors: first ? [first] : [],
    closed: false,
    stroke: '#e5e7eb',
    strokeWidth: 1.5,
    fill: 'none',
  }
}

export function anchorHasInHandle(a: Anchor): boolean {
  return !eq(a.inHandle, a.point)
}

export function anchorHasOutHandle(a: Anchor): boolean {
  return !eq(a.outHandle, a.point)
}

export function pathToSvgD(path: Path, paths: Path[] = [path]): string {
  const { anchors, closed } = path
  if (anchors.length === 0) return ''
  const first = resolveAnchor(paths, anchors[0]!)
  if (!first) return ''
  let d = `M ${first.point.x} ${first.point.y}`

  for (let i = 1; i < anchors.length; i++) {
    const prev = resolveAnchor(paths, anchors[i - 1]!)
    const curr = resolveAnchor(paths, anchors[i]!)
    if (!prev || !curr) continue
    d += segmentD(prev, curr)
  }

  if (closed && anchors.length > 1) {
    const last = resolveAnchor(paths, anchors[anchors.length - 1]!)
    if (last) {
      d += segmentD(last, first)
      d += ' Z'
    }
  }
  return d
}

function segmentD(from: Anchor, to: Anchor): string {
  const hasOut = anchorHasOutHandle(from)
  const hasIn = anchorHasInHandle(to)
  if (!hasOut && !hasIn) {
    return ` L ${to.point.x} ${to.point.y}`
  }
  const c1 = hasOut ? from.outHandle : from.point
  const c2 = hasIn ? to.inHandle : to.point
  return ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${to.point.x} ${to.point.y}`
}

export function segmentToSvgD(path: Path, segmentIndex: number, paths: Path[] = [path]): string {
  const { anchors, closed } = path
  if (segmentIndex < 0) return ''
  if (segmentIndex < anchors.length - 1) {
    const from = resolveAnchor(paths, anchors[segmentIndex]!)
    const to = resolveAnchor(paths, anchors[segmentIndex + 1]!)
    if (!from || !to) return ''
    return `M ${from.point.x} ${from.point.y}${segmentD(from, to)}`
  }
  if (closed && segmentIndex === anchors.length - 1) {
    const from = resolveAnchor(paths, anchors[anchors.length - 1]!)
    const to = resolveAnchor(paths, anchors[0]!)
    if (!from || !to) return ''
    return `M ${from.point.x} ${from.point.y}${segmentD(from, to)}`
  }
  return ''
}
