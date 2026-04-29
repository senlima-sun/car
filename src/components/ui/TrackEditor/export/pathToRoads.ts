import type { Anchor, Path } from '../geometry/types'
import { eq } from '../geometry/point'
import { resolveAnchor } from '../geometry/path'
import type { PlacedObject } from '@/types/trackObjects'
import { TRACK_WIDTH } from '@/constants/dimensions'

const ROAD_WIDTH = TRACK_WIDTH
const SUBDIVISION_TOLERANCE = 0.25

type Vec3 = [number, number, number]

function editorToWorld(x: number, y: number): Vec3 {
  return [x, 0, y]
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function midpoint(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
}

function cubicToQuadraticControl(p0: Vec3, c1: Vec3, c2: Vec3, p3: Vec3): Vec3 {
  return [
    (3 * c1[0] + 3 * c2[0] - p0[0] - p3[0]) / 4,
    (3 * c1[1] + 3 * c2[1] - p0[1] - p3[1]) / 4,
    (3 * c1[2] + 3 * c2[2] - p0[2] - p3[2]) / 4,
  ]
}

function cubicPoint(p0: Vec3, c1: Vec3, c2: Vec3, p3: Vec3, t: number): Vec3 {
  const u = 1 - t
  return [
    u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1],
    u * u * u * p0[2] + 3 * u * u * t * c1[2] + 3 * u * t * t * c2[2] + t * t * t * p3[2],
  ]
}

function quadraticPoint(p0: Vec3, q: Vec3, p2: Vec3, t: number): Vec3 {
  const u = 1 - t
  return [
    u * u * p0[0] + 2 * u * t * q[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * q[1] + t * t * p2[1],
    u * u * p0[2] + 2 * u * t * q[2] + t * t * p2[2],
  ]
}

function dist3(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dz = a[2] - b[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function cubicQuadraticMaxError(p0: Vec3, c1: Vec3, c2: Vec3, p3: Vec3): number {
  const q = cubicToQuadraticControl(p0, c1, c2, p3)
  let maxErr = 0
  const SAMPLES = 16
  for (let i = 1; i < SAMPLES; i++) {
    const t = i / SAMPLES
    const d = dist3(cubicPoint(p0, c1, c2, p3, t), quadraticPoint(p0, q, p3, t))
    if (d > maxErr) maxErr = d
  }
  return maxErr
}

function deCasteljauSplit(
  p0: Vec3,
  c1: Vec3,
  c2: Vec3,
  p3: Vec3,
): { left: [Vec3, Vec3, Vec3, Vec3]; right: [Vec3, Vec3, Vec3, Vec3] } {
  const m01 = midpoint(p0, c1)
  const m12 = midpoint(c1, c2)
  const m23 = midpoint(c2, p3)
  const m012 = midpoint(m01, m12)
  const m123 = midpoint(m12, m23)
  const m0123 = midpoint(m012, m123)
  return {
    left: [p0, m01, m012, m0123],
    right: [m0123, m123, m23, p3],
  }
}

function subdivideCubic(
  p0: Vec3,
  c1: Vec3,
  c2: Vec3,
  p3: Vec3,
  out: Array<{ p0: Vec3; c1: Vec3; c2: Vec3; p3: Vec3 }>,
  depth = 0,
): void {
  if (depth < 1 || (depth < 8 && cubicQuadraticMaxError(p0, c1, c2, p3) > SUBDIVISION_TOLERANCE)) {
    const { left, right } = deCasteljauSplit(p0, c1, c2, p3)
    subdivideCubic(left[0], left[1], left[2], left[3], out, depth + 1)
    subdivideCubic(right[0], right[1], right[2], right[3], out, depth + 1)
  } else {
    out.push({ p0, c1, c2, p3 })
  }
}

function curvedSegmentsFromCubic(
  p0: Vec3,
  c1: Vec3,
  c2: Vec3,
  p3: Vec3,
): Array<{ p0: Vec3; c1: Vec3; c2: Vec3; p3: Vec3 }> {
  const pieces: Array<{ p0: Vec3; c1: Vec3; c2: Vec3; p3: Vec3 }> = []
  subdivideCubic(p0, c1, c2, p3, pieces)
  return pieces
}

function makeRoadObject(start: Vec3, end: Vec3, controlPoint?: Vec3, isPit = false): PlacedObject {
  const curve = controlPoint !== undefined
  const trackMode = curve
    ? isPit
      ? ('pitroad-curve' as const)
      : ('curve' as const)
    : isPit
      ? ('pitroad' as const)
      : ('straight' as const)
  return {
    id: genId('road'),
    type: 'road',
    position: midpoint(start, end),
    rotation: 0,
    startPoint: start,
    endPoint: end,
    ...(curve ? { controlPoint, trackMode } : { trackMode }),
    width: ROAD_WIDTH,
  }
}

function normalize2D(x: number, z: number): [number, number] {
  const len = Math.sqrt(x * x + z * z)
  if (len < 1e-9) return [1, 0]
  return [x / len, z / len]
}

function entryTangent(road: PlacedObject): [number, number] {
  const start = road.startPoint!
  const ref = road.trackMode === 'curve' && road.controlPoint ? road.controlPoint : road.endPoint!
  return normalize2D(ref[0] - start[0], ref[2] - start[2])
}

function exitTangent(road: PlacedObject): [number, number] {
  const end = road.endPoint!
  const ref = road.trackMode === 'curve' && road.controlPoint ? road.controlPoint : road.startPoint!
  return normalize2D(end[0] - ref[0], end[2] - ref[2])
}

const MAX_MITER_FACTOR = 4

function computeMiterEdges(
  join: Vec3,
  prevExit: [number, number],
  nextEntry: [number, number],
  halfWidth: number,
): { left: Vec3; right: Vec3 } {
  const avgX = prevExit[0] + nextEntry[0]
  const avgZ = prevExit[1] + nextEntry[1]
  const [tx, tz] = normalize2D(avgX, avgZ)
  const [nx, nz] = [-tz, tx]
  const cos = prevExit[0] * nextEntry[0] + prevExit[1] * nextEntry[1]
  const miterScale = Math.min(MAX_MITER_FACTOR, 1 / Math.max(0.25, Math.sqrt(0.5 * (1 + cos))))
  const offset = halfWidth * miterScale
  return {
    left: [join[0] + nx * offset, join[1], join[2] + nz * offset],
    right: [join[0] - nx * offset, join[1], join[2] - nz * offset],
  }
}

function segmentToRoads(from: Anchor, to: Anchor, isPit: boolean): PlacedObject[] {
  const p0 = editorToWorld(from.point.x, from.point.y)
  const p3 = editorToWorld(to.point.x, to.point.y)
  const hasOut = !eq(from.outHandle, from.point)
  const hasIn = !eq(to.inHandle, to.point)

  if (!hasOut && !hasIn) {
    return [makeRoadObject(p0, p3, undefined, isPit)]
  }

  const c1: Vec3 = hasOut ? editorToWorld(from.outHandle.x, from.outHandle.y) : p0
  const c2: Vec3 = hasIn ? editorToWorld(to.inHandle.x, to.inHandle.y) : p3

  const pieces = curvedSegmentsFromCubic(p0, c1, c2, p3)
  return pieces.map(piece =>
    makeRoadObject(
      piece.p0,
      piece.p3,
      cubicToQuadraticControl(piece.p0, piece.c1, piece.c2, piece.p3),
      isPit,
    ),
  )
}

type JoinKey = string

type TaggedRoad = {
  road: PlacedObject
  startKey: JoinKey | null
  endKey: JoinKey | null
}

function anchorJoinKey(paths: Path[], pathId: string, anchorIndex: number): JoinKey {
  const visited = new Set<string>()
  let curPath = pathId
  let curIdx = anchorIndex
  while (true) {
    const k = `${curPath}:${curIdx}`
    if (visited.has(k)) return k
    visited.add(k)
    const p = paths.find(pp => pp.id === curPath)
    if (!p) return k
    const slot = p.anchors[curIdx]
    if (!slot) return k
    if (!('kind' in slot) || slot.kind !== 'ref') return k
    curPath = slot.pathId
    curIdx = slot.anchorIndex
  }
}

function taggedPathToRoads(path: Path, allPaths: Path[]): TaggedRoad[] {
  const { anchors, closed } = path
  if (anchors.length < 2) return []
  const pitSet = new Set(path.pitLaneSegments ?? [])
  const out: TaggedRoad[] = []
  const resolved: (Anchor | null)[] = anchors.map(a => resolveAnchor(allPaths, a))
  const keys = anchors.map((_, i) => anchorJoinKey(allPaths, path.id, i))

  for (let i = 1; i < anchors.length; i++) {
    const from = resolved[i - 1]
    const to = resolved[i]
    if (!from || !to) continue
    const isPit = pitSet.has(i - 1)
    const segRoads = segmentToRoads(from, to, isPit)
    segRoads.forEach((road, idx) => {
      out.push({
        road,
        startKey: idx === 0 ? keys[i - 1]! : null,
        endKey: idx === segRoads.length - 1 ? keys[i]! : null,
      })
    })
  }
  if (closed && anchors.length > 1) {
    const closingIndex = anchors.length - 1
    const from = resolved[closingIndex]
    const to = resolved[0]
    if (from && to) {
      const isPit = pitSet.has(closingIndex)
      const segRoads = segmentToRoads(from, to, isPit)
      segRoads.forEach((road, idx) => {
        out.push({
          road,
          startKey: idx === 0 ? keys[closingIndex]! : null,
          endKey: idx === segRoads.length - 1 ? keys[0]! : null,
        })
      })
    }
  }

  applyInternalMiter(out)
  return out
}

function applyInternalMiter(tagged: TaggedRoad[]): void {
  if (tagged.length < 2) return
  const halfWidth = ROAD_WIDTH / 2
  for (let i = 0; i < tagged.length - 1; i++) {
    const prev = tagged[i]!.road
    const next = tagged[i + 1]!.road
    const edges = computeMiterEdges(
      prev.endPoint!,
      exitTangent(prev),
      entryTangent(next),
      halfWidth,
    )
    prev.endLeftEdge = edges.left
    prev.endRightEdge = edges.right
    next.startLeftEdge = edges.left
    next.startRightEdge = edges.right
  }
}

function applyCrossPathJoins(tagged: TaggedRoad[]): void {
  const halfWidth = ROAD_WIDTH / 2
  type Incidence = { road: PlacedObject; tangent: [number, number]; side: 'start' | 'end' }
  const byKey = new Map<JoinKey, Incidence[]>()
  for (const t of tagged) {
    if (t.startKey) {
      const arr = byKey.get(t.startKey) ?? []
      arr.push({ road: t.road, tangent: entryTangent(t.road), side: 'start' })
      byKey.set(t.startKey, arr)
    }
    if (t.endKey) {
      const arr = byKey.get(t.endKey) ?? []
      arr.push({ road: t.road, tangent: exitTangent(t.road), side: 'end' })
      byKey.set(t.endKey, arr)
    }
  }

  for (const incidences of byKey.values()) {
    if (incidences.length < 2) continue
    const join =
      incidences[0]!.side === 'end'
        ? incidences[0]!.road.endPoint!
        : incidences[0]!.road.startPoint!
    let sumX = 0
    let sumZ = 0
    for (const inc of incidences) {
      const sign = inc.side === 'end' ? 1 : -1
      sumX += inc.tangent[0] * sign
      sumZ += inc.tangent[1] * sign
    }
    const [tx, tz] = normalize2D(sumX, sumZ)
    const [nx, nz] = [-tz, tx]
    const left: Vec3 = [join[0] + nx * halfWidth, join[1], join[2] + nz * halfWidth]
    const right: Vec3 = [join[0] - nx * halfWidth, join[1], join[2] - nz * halfWidth]
    for (const inc of incidences) {
      if (inc.side === 'end') {
        inc.road.endLeftEdge = left
        inc.road.endRightEdge = right
      } else {
        inc.road.startLeftEdge = left
        inc.road.startRightEdge = right
      }
    }
  }
}

export function pathToRoads(path: Path, allPaths: Path[] = [path]): PlacedObject[] {
  return taggedPathToRoads(path, allPaths).map(t => t.road)
}

export function documentToRoads(paths: Path[]): PlacedObject[] {
  const allTagged: TaggedRoad[] = []
  for (const p of paths) allTagged.push(...taggedPathToRoads(p, paths))
  applyCrossPathJoins(allTagged)
  return allTagged.map(t => t.road)
}
