import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

type Point = { x: number; y: number }

type Anchor = {
  id: string
  point: Point
  inHandle: Point
  outHandle: Point
  handleType: 'corner' | 'smooth' | 'mirror'
}

type AnchorRefSlot = { kind: 'ref'; pathId: string; anchorIndex: number }
type AnchorSlot = Anchor | AnchorRefSlot

type Path = {
  id: string
  anchors: AnchorSlot[]
  closed?: boolean
  pitLaneSegments?: number[]
}

type TrackSource = { id?: string; name?: string; paths: Path[] }

const EPS = 1e-6
const SAMPLE_SPACING_METERS = 1
const SEAM_DEDUP_FACTOR = 0.6

const isRef = (s: AnchorSlot): s is AnchorRefSlot =>
  (s as AnchorRefSlot).kind === 'ref'

const eq = (a: Point, b: Point): boolean =>
  Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS

function f32(v: number): number {
  return Math.fround(v)
}

function f32hypot(dx: number, dy: number): number {
  const x = Math.fround(dx)
  const y = Math.fround(dy)
  return Math.fround(Math.sqrt(Math.fround(Math.fround(x * x) + Math.fround(y * y))))
}

function cubicPointF32(p0: Point, c1: Point, c2: Point, p3: Point, t: number): Point {
  const tt = Math.fround(t)
  const u = Math.fround(1 - tt)
  const uu = Math.fround(u * u)
  const t2 = Math.fround(tt * tt)
  const uuu = Math.fround(uu * u)
  const ttt = Math.fround(t2 * tt)
  const w1 = Math.fround(Math.fround(3 * uu) * tt)
  const w2 = Math.fround(Math.fround(3 * u) * t2)
  const x = Math.fround(
    Math.fround(
      Math.fround(Math.fround(uuu * p0.x) + Math.fround(w1 * c1.x)) +
        Math.fround(w2 * c2.x),
    ) + Math.fround(ttt * p3.x),
  )
  const y = Math.fround(
    Math.fround(
      Math.fround(Math.fround(uuu * p0.y) + Math.fround(w1 * c1.y)) +
        Math.fround(w2 * c2.y),
    ) + Math.fround(ttt * p3.y),
  )
  return { x, y }
}

function segmentEndpoints(from: Anchor, to: Anchor) {
  const hasOut = !eq(from.outHandle, from.point)
  const hasIn = !eq(to.inHandle, to.point)
  const p0: Point = { x: f32(from.point.x), y: f32(from.point.y) }
  const c1: Point = hasOut
    ? { x: f32(from.outHandle.x), y: f32(from.outHandle.y) }
    : p0
  const c2: Point = hasIn ? { x: f32(to.inHandle.x), y: f32(to.inHandle.y) } : { x: f32(to.point.x), y: f32(to.point.y) }
  const p3: Point = { x: f32(to.point.x), y: f32(to.point.y) }
  return { p0, c1, c2, p3 }
}

function segmentLengthF32(from: Anchor, to: Anchor): number {
  const { p0, c1, c2, p3 } = segmentEndpoints(from, to)
  const isStraight = eq(c1, p0) && eq(c2, p3)
  if (isStraight) return f32hypot(p3.x - p0.x, p3.y - p0.y)
  const SAMPLES = 32
  let total = f32(0)
  let prev = p0
  for (let i = 1; i <= SAMPLES; i++) {
    const t = f32(i / SAMPLES)
    const cur = cubicPointF32(p0, c1, c2, p3, t)
    total = f32(total + f32hypot(cur.x - prev.x, cur.y - prev.y))
    prev = cur
  }
  return total
}

function sampleSegmentDenseF32(from: Anchor, to: Anchor, includeStart: boolean): Point[] {
  const { p0, c1, c2, p3 } = segmentEndpoints(from, to)
  const isStraight = eq(c1, p0) && eq(c2, p3)
  const length = segmentLengthF32(from, to)
  const raw = Math.ceil(length / SAMPLE_SPACING_METERS)
  const steps = raw < 2 ? 2 : raw
  const startI = includeStart ? 0 : 1
  const out: Point[] = []
  for (let i = startI; i <= steps; i++) {
    const t = f32(i / steps)
    if (isStraight) {
      out.push({
        x: f32(p0.x + f32(f32(p3.x - p0.x) * t)),
        y: f32(p0.y + f32(f32(p3.y - p0.y) * t)),
      })
    } else {
      out.push(cubicPointF32(p0, c1, c2, p3, t))
    }
  }
  return out
}

function resolveAnchor(
  paths: Path[],
  slot: AnchorSlot,
  visited: Set<string> = new Set(),
): Anchor | null {
  if (!isRef(slot)) return slot
  const key = `${slot.pathId}:${slot.anchorIndex}`
  if (visited.has(key)) return null
  visited.add(key)
  const p = paths.find(x => x.id === slot.pathId)
  if (!p) return null
  const next = p.anchors[slot.anchorIndex]
  if (!next) return null
  return resolveAnchor(paths, next, visited)
}

type FixturePolyline = {
  path_id: string
  closed: boolean
  points: Array<[number, number]>
  cumulative_arc: number[]
}

function samplePath(path: Path, allPaths: Path[]): FixturePolyline | null {
  if (path.anchors.length < 2) return null
  const resolved = path.anchors.map(a => resolveAnchor(allPaths, a))

  const points: Point[] = []
  for (let i = 1; i < path.anchors.length; i++) {
    const from = resolved[i - 1]
    const to = resolved[i]
    if (!from || !to) continue
    points.push(...sampleSegmentDenseF32(from, to, i === 1))
  }
  if (path.closed && path.anchors.length > 1) {
    const closingIndex = path.anchors.length - 1
    const from = resolved[closingIndex]
    const to = resolved[0]
    if (from && to) {
      points.push(...sampleSegmentDenseF32(from, to, false))
    }
  }
  if (points.length < 2) return null

  if (path.closed && points.length > 1) {
    const first = points[0]!
    const last = points[points.length - 1]!
    if (f32hypot(first.x - last.x, first.y - last.y) < SAMPLE_SPACING_METERS * SEAM_DEDUP_FACTOR) {
      points.pop()
    }
  }

  const xz: Array<[number, number]> = points.map(p => [p.x, p.y])
  const arc: number[] = [0]
  for (let i = 1; i < xz.length; i++) {
    const dx = xz[i]![0] - xz[i - 1]![0]
    const dy = xz[i]![1] - xz[i - 1]![1]
    arc.push(f32(arc[i - 1]! + f32hypot(dx, dy)))
  }

  return {
    path_id: path.id,
    closed: !!path.closed,
    points: xz,
    cumulative_arc: arc,
  }
}

function dump(sourcePath: string, outPath: string): void {
  const raw = readFileSync(sourcePath, 'utf8')
  const src = JSON.parse(raw) as TrackSource
  const polylines = src.paths
    .map(p => samplePath(p, src.paths))
    .filter((p): p is FixturePolyline => p !== null)

  const out = {
    source: sourcePath.split('/').slice(-3).join('/'),
    centerline_source: 'rust_bezier' as const,
    spacing_m: SAMPLE_SPACING_METERS,
    polylines,
  }
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(out, null, 2))
  const totals = polylines.map(p => p.points.length).join(', ')
  console.log(`wrote ${outPath}  (polylines=${polylines.length}, points=[${totals}])`)
}

function main(): void {
  const repoRoot = resolve(import.meta.dirname, '..')
  const inputs: Array<{ src: string; out: string }> = [
    {
      src: resolve(repoRoot, 'apps/game/src/constants/tracks/sources/silverstone.json'),
      out: resolve(repoRoot, 'physics-engine/tests/fixtures/silverstone.ribbon.json'),
    },
  ]
  for (const { src, out } of inputs) dump(src, out)
}

main()
