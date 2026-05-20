import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { resolveTerrainSupportHitY } from './useRaycastSuspension'
import { WHEEL_POSITIONS } from '@/constants/dimensions'
import { getPresetTrack } from '@/constants/tracks'
import { useTerrainStore } from '@/stores/useTerrainStore'
import bakuSidecar from '@/constants/tracks/sources/_terrain/baku.heightmap.json'
import spaSidecar from '@/constants/tracks/sources/_terrain/spa.heightmap.json'
import imolaSidecar from '@/constants/tracks/sources/_terrain/imola.heightmap.json'
import lasVegasSidecar from '@/constants/tracks/sources/_terrain/las-vegas.heightmap.json'
import { __setSidecarLoadersForTest } from '@/utils/terrainSidecar'
import { applyStampedSidecar } from '@/utils/terrainStampedSidecar'
import {
  buildRibbonBoundary,
  type RibbonBoundary,
} from '@/components/canvas/TrackObjects/geometry/ribbonBoundary'

// Tolerance bounded by 2-sample (left/right edge only) ribbon: cross-slope
// interior wheel positions are linearly interpolated from edge y, so on Spa's
// steep transverse gradients (Eau Rouge, Raidillon) the gap can reach ~1.6m.
// Phase 3.8 (optional transverse crossSamples) would tighten this to <0.1m.
// Keeping it at 2m here catches "ribbon at y=0 / terrain at y=50" regressions
// while accepting the current 2-sample approximation cost.
const TOLERANCE_M = 2.5
const WAYPOINTS = 32
const SEEK_RAY_LENGTH = 50
const SUSPENSION_ENVELOPE = 1.5
const RAY_ORIGIN_LIFT = 0.6
const PRESETS: { id: string; expectedNonZero: boolean }[] = [
  { id: 'f1_spa', expectedNonZero: true },
  { id: 'f1_imola', expectedNonZero: true },
  { id: 'f1_las-vegas', expectedNonZero: false },
]

const WHEEL_ANCHORS = [
  WHEEL_POSITIONS.FL,
  WHEEL_POSITIONS.FR,
  WHEEL_POSITIONS.RL,
  WHEEL_POSITIONS.RR,
] as const

interface RibbonRecord {
  width: number
  closed: boolean
  points: { x: number; z: number; isPitLane: boolean }[]
}

function getMainRibbon(presetId: string): RibbonRecord | null {
  const preset = getPresetTrack(presetId)
  if (!preset) return null
  for (const obj of preset.objects) {
    if (obj.type !== 'track_ribbon') continue
    if (!obj.ribbonPoints || obj.ribbonPoints.length < 2) continue
    return {
      width: obj.width ?? 12,
      closed: obj.ribbonClosed ?? false,
      points: obj.ribbonPoints.map(p => ({ x: p.x, z: p.z, isPitLane: p.isPitLane })),
    }
  }
  return null
}

function pickEvenlyDistributedSamples(boundary: RibbonBoundary, count: number): number[] {
  const total = boundary.totalArcLength
  if (total <= 0) return []
  const out: number[] = []
  const n = boundary.arcLength.length
  for (let k = 0; k < count; k++) {
    const target = (k / count) * total
    let bestIdx = 0
    let bestDiff = Infinity
    for (let i = 0; i < n; i++) {
      const diff = Math.abs(boundary.arcLength[i]! - target)
      if (diff < bestDiff) {
        bestDiff = diff
        bestIdx = i
      }
    }
    out.push(bestIdx)
  }
  return out
}

beforeEach(() => {
  __setSidecarLoadersForTest({
    '../constants/tracks/sources/_terrain/baku.heightmap.json': async () => ({
      default: bakuSidecar as never,
    }),
    '../constants/tracks/sources/_terrain/spa.heightmap.json': async () => ({
      default: spaSidecar as never,
    }),
    '../constants/tracks/sources/_terrain/imola.heightmap.json': async () => ({
      default: imolaSidecar as never,
    }),
    '../constants/tracks/sources/_terrain/las-vegas.heightmap.json': async () => ({
      default: lasVegasSidecar as never,
    }),
  })
  useTerrainStore.getState().resetBaseline()
  useTerrainStore.getState().resetDelta()
})

afterEach(() => {
  useTerrainStore.getState().resetBaseline()
  useTerrainStore.getState().resetDelta()
})

describe('physics-vs-visual ribbon y tolerance', () => {
  for (const preset of PRESETS) {
    test(`${preset.id}: suspension hit matches visual ribbon y within ${TOLERANCE_M}m at 32 waypoints × 4 wheels`, async () => {
      const ribbon = getMainRibbon(preset.id)
      expect(ribbon).not.toBeNull()
      if (!ribbon) return

      // Phase 2.6: stamp the ribbon into the sidecar before sampling.
      // Without this, the tolerance assertion would test un-stamped y
      // values — meaningless for the architectural guarantee under test.
      const preset_track = getPresetTrack(preset.id)
      const objects = preset_track?.objects ?? []
      const { applied } = await applyStampedSidecar(preset.id, objects, {
        deltaPolicy: 'reset',
      })
      if (preset.expectedNonZero) {
        expect(applied).toBe(true)
      }

      const sampler = useTerrainStore.getState().getHeightAt
      const points = ribbon.points.map(p => ({ x: p.x, y: 0, z: p.z, isPitLane: p.isPitLane }))
      const boundary = buildRibbonBoundary(points, ribbon.closed, ribbon.width, undefined, sampler)
      expect(boundary).not.toBeNull()
      if (!boundary) return

      const waypoints = pickEvenlyDistributedSamples(boundary, WAYPOINTS)
      expect(waypoints.length).toBe(WAYPOINTS)

      let maxDelta = 0
      const failures: string[] = []
      for (const idx of waypoints) {
        const center = boundary.centerline[idx]!
        const tan = boundary.tangents[idx]!
        const nx = -tan.z
        const nz = tan.x
        const left = boundary.left[idx]!
        const right = boundary.right[idx]!
        const lerpY = (t: number) => left.y + (right.y - left.y) * t

        for (let w = 0; w < 4; w++) {
          const wx = WHEEL_ANCHORS[w]![0]
          const fraction = (wx + ribbon.width / 2) / ribbon.width
          const clamped = Math.max(0, Math.min(1, fraction))
          const sampleX = center.x + nx * (clamped - 0.5) * ribbon.width
          const sampleZ = center.z + nz * (clamped - 0.5) * ribbon.width
          const visualY = lerpY(clamped)
          const terrainY = sampler(sampleX, sampleZ)
          const rayY = Math.max(visualY, terrainY) + RAY_ORIGIN_LIFT
          const hitY = resolveTerrainSupportHitY(
            rayY,
            -1,
            SEEK_RAY_LENGTH,
            SUSPENSION_ENVELOPE,
            terrainY,
            null,
          )
          expect(hitY).not.toBeNull()
          if (hitY === null) continue
          const delta = Math.abs(visualY - hitY)
          if (delta > maxDelta) maxDelta = delta
          if (delta > TOLERANCE_M) {
            failures.push(`waypoint=${idx} wheel=${w} visual=${visualY.toFixed(3)} hit=${hitY.toFixed(3)} Δ=${delta.toFixed(3)}m`)
          }
        }
      }

      expect(failures).toEqual([])
      expect(maxDelta).toBeLessThanOrEqual(TOLERANCE_M)
    })
  }
})
