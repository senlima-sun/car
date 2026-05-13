import { computeRibbonTangents } from '@/components/canvas/TrackObjects/geometry/ribbonGeometry'
import type { PlacedObject, TrackRibbonPoint } from '@/types/trackObjects'

export interface ParentDerivedResult {
  points: TrackRibbonPoint[]
  closed: boolean
  width: number
}

export interface ParentDerivedOptions {
  terrainHeightAt?: (x: number, z: number) => number
  resampleSpacing?: number
}

export type ResolveContext =
  | { parent: PlacedObject | undefined }
  | { allObjects: readonly PlacedObject[] }

function resolveParent(
  placed: PlacedObject,
  ctx: ResolveContext,
): PlacedObject | undefined {
  const hasParent = 'parent' in ctx
  const hasAllObjects = 'allObjects' in ctx
  if (hasParent && hasAllObjects) {
    throw new Error(
      '[parentDerivedLayer] ResolveContext must specify either parent OR allObjects, not both',
    )
  }
  if (hasParent) return (ctx as { parent: PlacedObject | undefined }).parent
  return (ctx as { allObjects: readonly PlacedObject[] }).allObjects.find(
    o => o.id === placed.parentRibbonId,
  )
}

function arcLengthTable(points: TrackRibbonPoint[], closed: boolean): number[] {
  const n = points.length
  const table = new Array<number>(n)
  table[0] = 0
  for (let i = 1; i < n; i++) {
    const dx = points[i]!.x - points[i - 1]!.x
    const dz = points[i]!.z - points[i - 1]!.z
    table[i] = table[i - 1]! + Math.hypot(dx, dz)
  }
  if (closed) {
    const last = points[n - 1]!
    const first = points[0]!
    table.push(table[n - 1]! + Math.hypot(last.x - first.x, last.z - first.z))
  }
  return table
}

function densifyParent(
  points: TrackRibbonPoint[],
  closed: boolean,
  spacing: number,
): { points: TrackRibbonPoint[]; closed: boolean } {
  const n = points.length
  if (n < 2 || spacing <= 0) return { points, closed }
  const out: TrackRibbonPoint[] = []
  const segLimit = closed ? n : n - 1
  for (let i = 0; i < segLimit; i++) {
    const a = points[i]!
    const b = points[(i + 1) % n]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    const steps = Math.max(1, Math.ceil(len / spacing))
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      out.push({
        x: a.x + dx * t,
        y: a.y + dy * t,
        z: a.z + dz * t,
        isPitLane: a.isPitLane,
      })
    }
  }
  if (!closed) out.push(points[n - 1]!)
  return { points: out, closed }
}

function filterInvertedDerivedPoints(
  raw: Array<TrackRibbonPoint & { srcIdx: number }>,
  parentTangents: Array<{ x: number; z: number }>,
  sourcePoints: TrackRibbonPoint[],
  centerOffset: number,
): TrackRibbonPoint[] {
  const out: TrackRibbonPoint[] = []
  let prevSrcIdx = -1
  for (let k = 0; k < raw.length; k++) {
    const curr = raw[k]!
    if (out.length === 0) {
      out.push({ x: curr.x, y: curr.y, z: curr.z, isPitLane: curr.isPitLane })
      prevSrcIdx = curr.srcIdx
      continue
    }
    const prev = out[out.length - 1]!
    const dx = curr.x - prev.x
    const dz = curr.z - prev.z
    const derivedStep = Math.hypot(dx, dz)
    if (derivedStep < 1e-6) continue

    const srcA = sourcePoints[prevSrcIdx]!
    const srcB = sourcePoints[curr.srcIdx]!
    const sourceStep = Math.hypot(srcB.x - srcA.x, srcB.z - srcA.z)
    // If the derived step balloons relative to its parent step, the offset
    // curve is fanning across a sharp tangent change — the derived sample
    // would render as a spike. Drop it; the next in-bounds sample takes over.
    const fanThreshold = Math.max(sourceStep * 3, centerOffset * 0.5)
    if (derivedStep > fanThreshold) continue

    const parentTan = parentTangents[curr.srcIdx]!
    const dot = (dx / derivedStep) * parentTan.x + (dz / derivedStep) * parentTan.z
    if (dot <= 0) continue

    out.push({ x: curr.x, y: curr.y, z: curr.z, isPitLane: curr.isPitLane })
    prevSrcIdx = curr.srcIdx
  }
  return out
}

export function resolveParentDerivedLayer(
  placed: PlacedObject,
  ctx: ResolveContext,
  opts: ParentDerivedOptions = {},
): ParentDerivedResult | null {
  if (placed.parentRibbonId === undefined) return null
  const parent = resolveParent(placed, ctx)
  if (!parent || !parent.ribbonPoints || parent.ribbonPoints.length < 2) return null

  const parentWidth = parent.width ?? 12
  const halfParent = parentWidth / 2
  const innerOffset = placed.innerOffset ?? 0
  const derivedWidth = placed.derivedWidth ?? placed.width ?? 3
  const side = placed.parentSide ?? 'right'
  const sign = side === 'left' ? 1 : -1
  const centerOffset = halfParent + innerOffset + derivedWidth / 2

  if (
    import.meta.env.DEV &&
    placed.derivedWidth !== undefined &&
    placed.width !== undefined &&
    Math.abs(placed.derivedWidth - placed.width) > 1e-3
  ) {
    console.warn(
      `[parentDerived] ${placed.id} has derivedWidth=${placed.derivedWidth} ≠ width=${placed.width}; resolver uses derivedWidth.`,
    )
  }

  const parentClosed = placed.parentClosedOverride ?? parent.ribbonClosed ?? false
  const dense = opts.resampleSpacing
    ? densifyParent(parent.ribbonPoints, parentClosed, opts.resampleSpacing)
    : { points: parent.ribbonPoints, closed: parentClosed }

  const tangents = computeRibbonTangents(dense.points, dense.closed)
  const arcs = arcLengthTable(dense.points, dense.closed)
  const totalArc = arcs[arcs.length - 1]!
  if (totalArc <= 0) return null

  const [tStart, tEnd] = placed.tRange ?? [0, 1]
  const startArc = totalArc * Math.min(tStart, tEnd)
  const endArc = totalArc * Math.max(tStart, tEnd)

  const rawPoints: Array<TrackRibbonPoint & { srcIdx: number }> = []
  for (let i = 0; i < dense.points.length; i++) {
    const arc = arcs[i]!
    if (arc < startArc - 1e-6 || arc > endArc + 1e-6) continue
    const src = dense.points[i]!
    const tan = tangents[i]!
    const nx = -tan.z * sign
    const nz = tan.x * sign
    const wx = src.x + nx * centerOffset
    const wz = src.z + nz * centerOffset
    const wy = opts.terrainHeightAt ? opts.terrainHeightAt(wx, wz) : src.y
    rawPoints.push({ x: wx, y: wy, z: wz, isPitLane: src.isPitLane, srcIdx: i })
  }

  const points = filterInvertedDerivedPoints(rawPoints, tangents, dense.points, centerOffset)
  if (points.length < 2) return null
  const fullSpan = (placed.tRange ?? [0, 1])[0] === 0 && (placed.tRange ?? [0, 1])[1] === 1
  const derivedClosed = fullSpan && dense.closed
  return { points, closed: derivedClosed, width: derivedWidth }
}
