import type { TrackRibbonPoint } from '../types/trackObjects'
import { smoothstep } from './roadGeometry'
import type { RoadCorridor } from './roadCorridor'
import { buildRoadCorridorsFromObjects } from './roadCorridor'

/**
 * Track-stamp pass: imprint the ribbon's locally-smoothed elevation
 * profile into the terrain baseline. After stamping, every cell within
 * the ribbon footprint sits at the ribbon's target y; cells in the
 * transition zone smoothstep back to the original DEM; cells outside
 * keep the DEM verbatim.
 *
 * Why: F1 circuits are flat asphalt strips cut into landscape, not a
 * sheet that drapes over every terrain wrinkle. Without stamping, a
 * 100m-period bump in the DEM lifts the asphalt by metres and the
 * mesh disagrees with what the racing line "should" look like, OR
 * (worse) terrain mesh wins the depth fight and the ribbon disappears
 * beneath the hillside.
 *
 * After this, the ribbon mesh — which samples `getHeightAt(x, z)` at
 * its edges — naturally inherits the stamped y, so visual + physics
 * agree without any plumbing through ribbon geometry code.
 */

export interface RibbonStampInput {
  /** Ordered centerline points (x, z). */
  points: TrackRibbonPoint[]
  /** Full ribbon width in metres. */
  width: number
  closed: boolean
}

export interface StampConfig {
  /** Half-window of along-track smoothing in metres. ~30m caters for
   *  Eau Rouge-class real elevation while flattening sub-25m bumps. */
  smoothHalfWindowMeters: number
  /** Width of the ease-out zone beyond the ribbon edge, in metres.
   *  Inside [width/2, width/2 + transitionMeters] the baseline
   *  smoothstep-blends from ribbon-y back to raw-y. */
  transitionMeters: number
  /** Maximum lateral climb rate beside the ribbon, in metres per
   *  metre of perpendicular distance past the full-stamp footprint.
   *  Caps how steep the cutting/embankment can be — keeps mountains
   *  from poking through the road when the raw DEM has a 60m hill
   *  40m off the centerline. ~0.25 ≈ 1:4 slope (14°). */
  maxLateralClimbRate: number
  /** Maximum along-track gradient (rise/run). SRTM 30m DEM aliasing
   *  in mountain terrain (Spielberg, Spa) regularly invents 30-50%
   *  gradients where the road is actually <12%. Clamps the smoothed
   *  ribbon target y so any back-to-back jump cannot exceed this
   *  fraction of the inter-point arc distance. F1's steepest real
   *  grade is ~12% (Eau Rouge). */
  maxAlongTrackGradient: number
}

export const DEFAULT_STAMP_CONFIG: StampConfig = {
  smoothHalfWindowMeters: 30,
  transitionMeters: 50,
  maxLateralClimbRate: 0.25,
  maxAlongTrackGradient: 0.06,
}

interface RibbonSegment {
  ax: number
  az: number
  bx: number
  bz: number
  /** Length of the segment in metres. */
  length: number
  /** Arc length at the start vertex. */
  arcAtStart: number
  /** Smoothed target y at the start vertex. */
  targetAtStart: number
  /** Smoothed target y at the end vertex. */
  targetAtEnd: number
}

interface FlatRibbon {
  segments: RibbonSegment[]
  /** Smoothed target y at each input centerline point. */
  targetY: number[]
  /** Closed ribbon? */
  closed: boolean
  /** Half ribbon width. */
  halfWidth: number
  /**
   * Footprint half-width INCLUDING the bilinear-correctness expansion.
   * Equal to `halfWidth + cellSize * Math.SQRT2`. Cells within this
   * distance are stamped to `targetY` (full stamp). This guarantees
   * every bilinear `getHeightAt` query inside the original ribbon
   * footprint has all four corners stamped — see Phase 1.5a decision
   * row in `.claude/plans/terrain-conforms-to-ribbon.md`.
   */
  fullStampHalfWidth: number
  /** `fullStampHalfWidth + transitionMeters`. */
  halfWidthPlusTransition: number
}

function bilinearSample(
  data: Float32Array,
  resolution: number,
  worldSize: number,
  x: number,
  z: number,
): number {
  const half = worldSize / 2
  const cell = worldSize / (resolution - 1)
  const fx = (x + half) / cell
  const fz = (z + half) / cell
  if (fx < 0 || fz < 0 || fx >= resolution - 1 || fz >= resolution - 1) return 0
  const gx = Math.floor(fx)
  const gz = Math.floor(fz)
  const tx = fx - gx
  const tz = fz - gz
  const i00 = gz * resolution + gx
  const h00 = data[i00]!
  const h10 = data[i00 + 1]!
  const h01 = data[i00 + resolution]!
  const h11 = data[i00 + resolution + 1]!
  const h0 = h00 + (h10 - h00) * tx
  const h1 = h01 + (h11 - h01) * tx
  return h0 + (h1 - h0) * tz
}

function buildArcTable(
  points: TrackRibbonPoint[],
  closed: boolean,
): { arc: number[]; total: number } {
  const arc = new Array<number>(points.length)
  arc[0] = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x
    const dz = points[i]!.z - points[i - 1]!.z
    arc[i] = arc[i - 1]! + Math.hypot(dx, dz)
  }
  const last = arc[arc.length - 1]!
  const closeDx = points[0]!.x - points[points.length - 1]!.x
  const closeDz = points[0]!.z - points[points.length - 1]!.z
  const total = closed ? last + Math.hypot(closeDx, closeDz) : last
  return { arc, total }
}

/**
 * Sample the raw DEM along ribbon centerline, then smooth with a
 * moving average over `±smoothHalfWindowMeters`. Returns one target y
 * per input ribbon point.
 *
 * The smoothing window is in arc-length space, so dense-sampled or
 * sparse-sampled ribbons both behave consistently.
 */
/**
 * Sample density inside the smoothing window (1 sample per metre). Dense
 * enough to catch sub-window DEM noise even when the ribbon's own input
 * points are sparse (which is common — preset ribbons can have 100m+
 * gaps between consecutive centerline points).
 */
const SMOOTH_SAMPLE_STEP_METERS = 1

function pointAtArc(
  s: number,
  points: TrackRibbonPoint[],
  arc: number[],
  total: number,
  closed: boolean,
): { x: number; z: number } {
  const n = points.length
  let target = s
  if (closed) {
    target = ((target % total) + total) % total
  } else {
    if (target < 0) target = 0
    if (target > arc[n - 1]!) target = arc[n - 1]!
  }
  // Linear scan for the segment containing `target`.
  let segIdx = 0
  for (let i = 0; i < n - 1; i++) {
    if (arc[i + 1]! >= target) {
      segIdx = i
      break
    }
    segIdx = i
  }
  // Closed loop's final segment wraps from arc[n-1] to total.
  if (closed && target > arc[n - 1]!) segIdx = n - 1
  const segStart = arc[segIdx]!
  const isWrapSeg = closed && segIdx === n - 1
  const segEnd = isWrapSeg ? total : arc[segIdx + 1]!
  const segLen = segEnd - segStart
  const u = segLen > 1e-9 ? (target - segStart) / segLen : 0
  const a = points[segIdx]!
  const b = points[isWrapSeg ? 0 : segIdx + 1]!
  return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u }
}

function computeTargetYAlongRibbon(
  raw: Float32Array,
  resolution: number,
  worldSize: number,
  points: TrackRibbonPoint[],
  closed: boolean,
  smoothHalfWindowMeters: number,
): number[] {
  const n = points.length
  if (smoothHalfWindowMeters <= 0) {
    const out = new Array<number>(n)
    for (let i = 0; i < n; i++) {
      out[i] = bilinearSample(raw, resolution, worldSize, points[i]!.x, points[i]!.z)
    }
    return out
  }

  const { arc, total } = buildArcTable(points, closed)
  const target = new Array<number>(n)
  const w = smoothHalfWindowMeters

  for (let i = 0; i < n; i++) {
    const center = arc[i]!
    let sum = 0
    let count = 0
    // Walk symmetric arc-space samples in fixed metre steps. Dense enough
    // (1m steps over a 30m window = 61 samples) to smooth out sub-window
    // DEM noise even when ribbon input points are >>1m apart.
    for (let ds = -w; ds <= w; ds += SMOOTH_SAMPLE_STEP_METERS) {
      const s = center + ds
      if (!closed && (s < 0 || s > arc[n - 1]!)) continue
      const p = pointAtArc(s, points, arc, total, closed)
      sum += bilinearSample(raw, resolution, worldSize, p.x, p.z)
      count++
    }
    target[i] =
      count > 0
        ? sum / count
        : bilinearSample(raw, resolution, worldSize, points[i]!.x, points[i]!.z)
  }
  return target
}

/**
 * Two-pass slope clamp: walk forward then backward along the ribbon
 * and limit step-to-step y delta to `maxGradient × arc_distance`.
 * Spreads the clamp evenly in both directions so a tall outlier
 * doesn't bias the long-run mean.
 */
function clampAlongTrackGradient(
  targetY: number[],
  points: TrackRibbonPoint[],
  closed: boolean,
  maxGradient: number,
): void {
  const n = targetY.length
  if (n < 2 || maxGradient <= 0) return
  const distTo = (i: number, j: number) =>
    Math.hypot(points[j]!.x - points[i]!.x, points[j]!.z - points[i]!.z)
  for (let i = 1; i < n; i++) {
    const rise = maxGradient * distTo(i - 1, i)
    const lo = targetY[i - 1]! - rise
    const hi = targetY[i - 1]! + rise
    if (targetY[i]! > hi) targetY[i] = hi
    else if (targetY[i]! < lo) targetY[i] = lo
  }
  for (let i = n - 2; i >= 0; i--) {
    const rise = maxGradient * distTo(i, i + 1)
    const lo = targetY[i + 1]! - rise
    const hi = targetY[i + 1]! + rise
    if (targetY[i]! > hi) targetY[i] = hi
    else if (targetY[i]! < lo) targetY[i] = lo
  }
  if (closed) {
    const wrapDist = distTo(n - 1, 0)
    const rise = maxGradient * wrapDist
    if (targetY[0]! - targetY[n - 1]! > rise) targetY[0] = targetY[n - 1]! + rise
    else if (targetY[n - 1]! - targetY[0]! > rise) targetY[0] = targetY[n - 1]! - rise
  }
}

function flattenRibbon(
  raw: Float32Array,
  resolution: number,
  worldSize: number,
  input: RibbonStampInput,
  config: StampConfig,
): FlatRibbon | null {
  const { points, closed, width } = input
  if (points.length < 2 || width <= 0) return null

  // If every ribbon point carries an authored elevation (Phase 1
  // satellite-truth-ingest), trust it directly — no smoothing, no
  // slope clamp. Both passes existed only to compensate for DEM
  // aliasing that the new ingest pipeline eliminates upstream.
  // Fall back to the old sample-and-smooth path only when elevation
  // data is missing (legacy tracks not yet migrated).
  let targetY: number[]
  const allAuthored = points.every(p => p.elevation !== undefined)
  if (allAuthored) {
    targetY = points.map(p => p.elevation as number)
  } else {
    targetY = computeTargetYAlongRibbon(
      raw,
      resolution,
      worldSize,
      points,
      closed,
      config.smoothHalfWindowMeters,
    )
    clampAlongTrackGradient(targetY, points, closed, config.maxAlongTrackGradient)
  }

  const segments: RibbonSegment[] = []
  let arc = 0
  const segCount = closed ? points.length : points.length - 1
  for (let i = 0; i < segCount; i++) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    const dx = b.x - a.x
    const dz = b.z - a.z
    const length = Math.hypot(dx, dz)
    if (length < 1e-6) continue
    segments.push({
      ax: a.x,
      az: a.z,
      bx: b.x,
      bz: b.z,
      length,
      arcAtStart: arc,
      targetAtStart: targetY[i]!,
      targetAtEnd: targetY[(i + 1) % points.length]!,
    })
    arc += length
  }
  if (segments.length === 0) return null

  // Phase 1.5a — expand the full-stamp footprint by `cellSize * SQRT2`
  // so every bilinear corner around any in-footprint query is stamped.
  // The worst-case bilinear sample sits at the centre of a cell quadrant
  // and its farthest corner is `sqrt(2) * cellSize` away — stamping
  // within `halfWidth + cellSize * SQRT2` of the ribbon guarantees all
  // four corners are stamped.
  const halfWidth = width / 2
  const cellSize = worldSize / (resolution - 1)
  const fullStampHalfWidth = halfWidth + cellSize * Math.SQRT2
  return {
    segments,
    targetY,
    closed,
    halfWidth,
    fullStampHalfWidth,
    halfWidthPlusTransition: fullStampHalfWidth + config.transitionMeters,
  }
}

/**
 * Returns the closest-point info for (cx, cz) against the segment:
 *  - dist: perpendicular distance to the segment
 *  - targetY: interpolated ribbon target y at that closest point
 *  Returns null if (cx, cz) is beyond `halfWidthPlusTransition` of
 *  this segment's bounding range (cheap early-out).
 */
function closestSegmentInfluence(
  seg: RibbonSegment,
  cx: number,
  cz: number,
  halfWidthPlusTransition: number,
): { dist: number; targetY: number } | null {
  // AABB reject — segment can only influence cells within this margin.
  const minX = Math.min(seg.ax, seg.bx) - halfWidthPlusTransition
  const maxX = Math.max(seg.ax, seg.bx) + halfWidthPlusTransition
  const minZ = Math.min(seg.az, seg.bz) - halfWidthPlusTransition
  const maxZ = Math.max(seg.az, seg.bz) + halfWidthPlusTransition
  if (cx < minX || cx > maxX || cz < minZ || cz > maxZ) return null

  const dx = seg.bx - seg.ax
  const dz = seg.bz - seg.az
  const lenSq = dx * dx + dz * dz
  const tRaw = ((cx - seg.ax) * dx + (cz - seg.az) * dz) / lenSq
  const t = Math.max(0, Math.min(1, tRaw))
  const px = seg.ax + dx * t
  const pz = seg.az + dz * t
  const dist = Math.hypot(cx - px, cz - pz)
  if (dist > halfWidthPlusTransition) return null
  const targetY = seg.targetAtStart + (seg.targetAtEnd - seg.targetAtStart) * t
  return { dist, targetY }
}

/**
 * Stamp every supplied ribbon into a copy of the raw baseline.
 *
 * For every cell:
 *   - If outside every ribbon's (fullStampHalfWidth + transition) — keep raw.
 *   - If inside [0, fullStampHalfWidth] of the closest ribbon — set to that
 *     ribbon's target y (full stamp).
 *   - In the transition zone — smoothstep blend raw DEM toward the
 *     ribbon target y, then clamp the result to
 *     ±(maxLateralClimbRate × distancePastFullStamp) so DEM aliasing
 *     cannot stamp a cliff next to the road.
 *
 * Time complexity: O(R² × S) worst-case where R is grid resolution
 * and S is total ribbon segments. AABB early-out reduces this to
 * roughly O(R² × S × footprint_fraction) which for a 4km square
 * world and a ~6km circuit is < 5% — well under 30ms on a dev
 * machine.
 */
export function stampRibbonsIntoBaseline(
  raw: Float32Array,
  resolution: number,
  worldSize: number,
  ribbons: ReadonlyArray<RibbonStampInput>,
  config: StampConfig = DEFAULT_STAMP_CONFIG,
): Float32Array {
  const out = new Float32Array(raw.length)
  out.set(raw)
  if (ribbons.length === 0) return out

  const flats: FlatRibbon[] = []
  for (const r of ribbons) {
    const flat = flattenRibbon(raw, resolution, worldSize, r, config)
    if (flat) flats.push(flat)
  }
  if (flats.length === 0) return out

  const half = worldSize / 2
  const cell = worldSize / (resolution - 1)
  const SUPER_SAMPLE_SIDE = 4
  const SUPER_SAMPLE_OFFSETS = (() => {
    const offsets = new Array<number>(SUPER_SAMPLE_SIDE)
    const step = cell / SUPER_SAMPLE_SIDE
    const start = -cell / 2 + step / 2
    for (let k = 0; k < SUPER_SAMPLE_SIDE; k++) offsets[k] = start + k * step
    return offsets
  })()

  function closestAt(cx: number, cz: number) {
    let bestDist = Infinity
    let bestTargetY = 0
    let bestRibbon: FlatRibbon | null = null
    for (const flat of flats) {
      for (const seg of flat.segments) {
        const inf = closestSegmentInfluence(seg, cx, cz, flat.halfWidthPlusTransition)
        if (inf && inf.dist < bestDist) {
          bestDist = inf.dist
          bestTargetY = inf.targetY
          bestRibbon = flat
        }
      }
    }
    return { dist: bestDist, targetY: bestTargetY, ribbon: bestRibbon }
  }

  for (let gz = 0; gz < resolution; gz++) {
    const cz = -half + gz * cell
    for (let gx = 0; gx < resolution; gx++) {
      const cx = -half + gx * cell

      const center = closestAt(cx, cz)
      const bestRibbon = center.ribbon
      const bestDist = center.dist
      const bestTargetY = center.targetY
      if (!bestRibbon) continue

      if (bestDist <= bestRibbon.fullStampHalfWidth) {
        // Super-sample inside the road footprint to soften per-cell
        // target-y jumps where adjacent cells snap to different ribbon
        // segments. Without this the bilinear interpolation that the
        // runtime samples for car physics produces visible micro-bumps
        // at every cell boundary on curved road sections.
        let ySum = 0
        let yCount = 0
        for (let sz = 0; sz < SUPER_SAMPLE_SIDE; sz++) {
          const cz2 = cz + SUPER_SAMPLE_OFFSETS[sz]!
          for (let sx = 0; sx < SUPER_SAMPLE_SIDE; sx++) {
            const cx2 = cx + SUPER_SAMPLE_OFFSETS[sx]!
            const sub = closestAt(cx2, cz2)
            if (sub.ribbon && sub.dist <= sub.ribbon.fullStampHalfWidth) {
              ySum += sub.targetY
              yCount++
            }
          }
        }
        out[gz * resolution + gx] = yCount > 0 ? ySum / yCount : bestTargetY
      } else {
        // Transition: blend raw DEM toward the ribbon target y and
        // then clamp the result to a road-realistic envelope around
        // the ribbon. The clamp envelope grows linearly with distance
        // past the full-stamp footprint, so close to the road the
        // baseline cannot deviate more than a few metres from the
        // ribbon (preventing visible hillside/cliff intrusions),
        // while far cells revert toward raw DEM.
        const inTransition =
          (bestDist - bestRibbon.fullStampHalfWidth) /
          (bestRibbon.halfWidthPlusTransition - bestRibbon.fullStampHalfWidth)
        const blend = smoothstep(1 - inTransition)
        const rawCell = raw[gz * resolution + gx]!
        const blended = rawCell + (bestTargetY - rawCell) * blend
        const distPastFull = bestDist - bestRibbon.fullStampHalfWidth
        const clampMargin = config.maxLateralClimbRate * distPastFull
        out[gz * resolution + gx] = Math.max(
          bestTargetY - clampMargin,
          Math.min(bestTargetY + clampMargin, blended),
        )
      }
    }
  }

  return out
}

/**
 * Compute the roadbed cut/fill layer as `stamped - raw`. The resulting
 * Float32Array is what useTerrainStore.replaceRoadbed expects: when
 * added on top of the raw baseline + user delta, the road footprint
 * sits at the stamped target height while terrain outside the corridor
 * is unaffected.
 *
 * Returns a zero-filled array when no ribbons influence the grid; this
 * keeps the derived layer transparent for preset tracks whose baseline
 * already has the stamp baked in.
 */
export function computeRoadbedLayer(
  raw: Float32Array,
  resolution: number,
  worldSize: number,
  ribbons: ReadonlyArray<RibbonStampInput>,
  config: StampConfig = DEFAULT_STAMP_CONFIG,
): Float32Array {
  const out = new Float32Array(raw.length)
  if (ribbons.length === 0) return out
  const stamped = stampRibbonsIntoBaseline(raw, resolution, worldSize, ribbons, config)
  for (let i = 0; i < out.length; i++) out[i] = stamped[i]! - raw[i]!
  return out
}

export function ribbonStampInputFromCorridor(corridor: RoadCorridor): RibbonStampInput {
  return {
    points: corridor.centerline,
    width: corridor.width,
    closed: corridor.closed,
  }
}

/**
 * Pull every track_ribbon PlacedObject out and produce stamp inputs.
 * Kept in this module so the call site is one line in useTrackStore.
 */
export function ribbonStampInputsFromObjects(
  objects: ReadonlyArray<{
    id?: string
    type: string
    ribbonPoints?: TrackRibbonPoint[]
    ribbonClosed?: boolean
    width?: number
  }>,
  defaultWidth: number,
): RibbonStampInput[] {
  return buildRoadCorridorsFromObjects(objects, defaultWidth).map(ribbonStampInputFromCorridor)
}
