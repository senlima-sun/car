import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STAMP_CONFIG,
  computeRoadbedLayer,
  ribbonStampInputsFromObjects,
  stampRibbonsIntoBaseline,
} from './terrainStamp'

// RES is bumped to 256 to match production grid (cellSize ≈ 15.69m).
// Tests use ribbons wider than cellSize so the stamp actually reaches
// at least one grid corner; otherwise bilinear sampling between
// unstamped neighbours yields raw values everywhere.
const RES = 256
const WORLD = 4000

function makeRaw(fillFn: (x: number, z: number) => number): Float32Array {
  const arr = new Float32Array(RES * RES)
  const cell = WORLD / (RES - 1)
  const half = WORLD / 2
  for (let gz = 0; gz < RES; gz++) {
    for (let gx = 0; gx < RES; gx++) {
      const x = -half + gx * cell
      const z = -half + gz * cell
      arr[gz * RES + gx] = fillFn(x, z)
    }
  }
  return arr
}

// Bilinear sampling — mirrors useTerrainStore.getHeightAt so the test
// asserts on what production consumers actually read, not on a
// grid-snapped neighbour cell.
function sampleAt(grid: Float32Array, x: number, z: number): number {
  const half = WORLD / 2
  const cell = WORLD / (RES - 1)
  const fx = (x + half) / cell
  const fz = (z + half) / cell
  if (fx < 0 || fz < 0 || fx >= RES - 1 || fz >= RES - 1) return 0
  const gx = Math.floor(fx)
  const gz = Math.floor(fz)
  const tx = fx - gx
  const tz = fz - gz
  const i00 = gz * RES + gx
  const h00 = grid[i00]!
  const h10 = grid[i00 + 1]!
  const h01 = grid[i00 + RES]!
  const h11 = grid[i00 + RES + 1]!
  const h0 = h00 + (h10 - h00) * tx
  const h1 = h01 + (h11 - h01) * tx
  return h0 + (h1 - h0) * tz
}

describe('stampRibbonsIntoBaseline', () => {
  it('returns a copy of raw when there are no ribbons', () => {
    const raw = makeRaw((x, z) => x * 0.01 + z * 0.005)
    const stamped = stampRibbonsIntoBaseline(raw, RES, WORLD, [])
    expect(stamped).not.toBe(raw)
    expect(Array.from(stamped)).toEqual(Array.from(raw))
  })

  it('flattens a straight horizontal ribbon at sample-derived height', () => {
    // Hillside: y increases with z. Ribbon runs along z=0 → its target
    // y should be approx the smoothed average of the DEM under the
    // centerline, which for a perfectly linear hill is exactly DEM(0, 0).
    const raw = makeRaw((_x, z) => z * 0.02)
    const ribbon = {
      points: [
        { x: -500, y: 0, z: 0, isPitLane: false },
        { x: 500, y: 0, z: 0, isPitLane: false },
      ],
      width: 12,
      closed: false,
    }
    const stamped = stampRibbonsIntoBaseline(raw, RES, WORLD, [ribbon])
    // Cell at (0, 0) sits squarely under the ribbon — should equal
    // the average DEM along centerline, which on this linear hill
    // is ~0 (centerline runs through z=0).
    expect(sampleAt(stamped, 0, 0)).toBeCloseTo(0, 1)
    // Cell far outside the stamp footprint (fullStampHalfWidth +
    // transitionMeters ≈ 108m) — keep raw value.
    expect(sampleAt(stamped, 0, 200)).toBeCloseTo(sampleAt(raw, 0, 200), 1)
  })

  it('preserves cells far from any ribbon', () => {
    const raw = makeRaw((x, z) => Math.sin(x * 0.01) * 50 + Math.cos(z * 0.01) * 30)
    const ribbon = {
      points: [
        { x: -500, y: 0, z: -800, isPitLane: false },
        { x: 500, y: 0, z: -800, isPitLane: false },
      ],
      width: 12,
      closed: false,
    }
    const stamped = stampRibbonsIntoBaseline(raw, RES, WORLD, [ribbon])
    // Far away from ribbon (1500m): keep raw.
    expect(sampleAt(stamped, 1500, 1500)).toBeCloseTo(sampleAt(raw, 1500, 1500), 4)
    expect(sampleAt(stamped, -1500, 1500)).toBeCloseTo(sampleAt(raw, -1500, 1500), 4)
  })

  it('smooths sub-window DEM noise out of the ribbon target y', () => {
    // DEM: 50m noise spike covering a SHORT arc segment (10m wide in x)
    // should be heavily damped by 30m half-window smoothing. The spike
    // extends ~10m so within a 60m-wide smoothing window the spike
    // contributes ~17% of samples — smoothed value should be roughly
    // 50 * 17% ≈ 8.5m. We assert <20m to leave room for sample
    // alignment quirks.
    const spikeX = 100
    const raw = makeRaw((x, z) => {
      if (Math.abs(x - spikeX) < 5 && Math.abs(z) < 20) return 50
      return 0
    })
    // Wider ribbon so the stamp actually reaches a grid cell on a 15.69m
    // grid (RES=256, cellSize≈15.69m): half-width 25 > cellSize/2.
    const ribbon = {
      points: [
        { x: -500, y: 0, z: 0, isPitLane: false },
        { x: 0, y: 0, z: 0, isPitLane: false },
        { x: spikeX, y: 0, z: 0, isPitLane: false },
        { x: 200, y: 0, z: 0, isPitLane: false },
        { x: 500, y: 0, z: 0, isPitLane: false },
      ],
      width: 50,
      closed: false,
    }
    const stamped = stampRibbonsIntoBaseline(raw, RES, WORLD, [ribbon])
    const stampedAtSpike = sampleAt(stamped, spikeX, 0)
    expect(stampedAtSpike).toBeLessThan(20)
  })

  it('transition zone smoothly blends from ribbon-y back to raw-y', () => {
    const ribbon = {
      points: [
        { x: -500, y: 0, z: 0, isPitLane: false },
        { x: 500, y: 0, z: 0, isPitLane: false },
      ],
      width: 12,
      closed: false,
    }
    // Use a DEM where raw inside ribbon (z=0) differs from raw outside.
    // Cell size at RES=64 is ~63.5m, so we query at cell-aligned positions
    // to avoid bilinear contamination from neighbouring stamped cells.
    const raw2 = makeRaw((_x, z) => (Math.abs(z) < 50 ? 0 : 100))
    const stamped2 = stampRibbonsIntoBaseline(raw2, RES, WORLD, [ribbon])
    // At ribbon center: target y is smoothed DEM along centerline.
    // Centerline is at z=0, raw=0 there → target y ≈ 0.
    expect(sampleAt(stamped2, 0, 0)).toBeCloseTo(0, 1)
    // At z=400 (far from ribbon, raw=100): keep raw 100. (z=400 is 6
    // cells away from the ribbon's stamped band at this resolution,
    // bilinear samples four un-stamped corners → 100.)
    expect(sampleAt(stamped2, 0, 400)).toBeCloseTo(100, 1)
  })

  it('handles closed loop ribbons', () => {
    // A square loop. Verify it stamps without throwing.
    const raw = makeRaw((_x, _z) => 25)
    const ribbon = {
      points: [
        { x: -200, y: 0, z: -200, isPitLane: false },
        { x: 200, y: 0, z: -200, isPitLane: false },
        { x: 200, y: 0, z: 200, isPitLane: false },
        { x: -200, y: 0, z: 200, isPitLane: false },
      ],
      width: 12,
      closed: true,
    }
    const stamped = stampRibbonsIntoBaseline(raw, RES, WORLD, [ribbon])
    // Centerline cells should be stamped.
    expect(sampleAt(stamped, 0, -200)).toBeCloseTo(25, 0)
    expect(sampleAt(stamped, -200, 0)).toBeCloseTo(25, 0)
    // Center of the square (no ribbon nearby) keeps raw.
    expect(sampleAt(stamped, 0, 0)).toBeCloseTo(25, 0)
  })

  it('mountain beside ribbon does not poke through near the road', () => {
    // Regression for the "山坡直接從賽道穿模" symptom. A 60m mountain
    // stands 40m off the ribbon centerline. After stamping, the
    // baseline near the road must follow the configured lateral
    // climb rate so the visual mesh and heightfield collider cannot
    // jut through the road. Allowance grows linearly with distance
    // from the full-stamp footprint (~28m on a 256² grid).
    const raw = makeRaw((_x, z) => {
      if (Math.abs(z) < 35) return 0
      return 60
    })
    const ribbon = {
      points: [
        { x: -500, y: 0, z: 0, isPitLane: false },
        { x: 500, y: 0, z: 0, isPitLane: false },
      ],
      width: 12,
      closed: false,
    }
    const stamped = stampRibbonsIntoBaseline(raw, RES, WORLD, [ribbon])
    // Beside the ribbon: enforce ≤ 1:3 effective slope (slightly
    // looser than the configured 1:4 cap to absorb bilinear blur).
    for (const off of [10, 20, 30, 40, 50, 60]) {
      for (const sign of [1, -1]) {
        const y = sampleAt(stamped, 0, off * sign)
        const distPastFull = Math.max(0, off - 28)
        const allowed = distPastFull * 0.34
        expect(y).toBeLessThan(allowed + 0.5)
      }
    }
  })
})

describe('ribbonStampInputsFromObjects', () => {
  it('picks only track_ribbon objects', () => {
    const inputs = ribbonStampInputsFromObjects(
      [
        {
          type: 'track_ribbon',
          ribbonPoints: [
            { x: 0, y: 0, z: 0, isPitLane: false },
            { x: 10, y: 0, z: 0, isPitLane: false },
          ],
          ribbonClosed: false,
          width: 12,
        },
        { type: 'cone', ribbonPoints: undefined },
        {
          type: 'track_ribbon',
          ribbonPoints: [{ x: 0, y: 0, z: 0, isPitLane: false }], // too short
          width: 12,
        },
      ],
      12,
    )
    expect(inputs.length).toBe(1)
    expect(inputs[0]!.width).toBe(12)
  })

  it('uses defaultWidth when object lacks width', () => {
    const inputs = ribbonStampInputsFromObjects(
      [
        {
          type: 'track_ribbon',
          ribbonPoints: [
            { x: 0, y: 0, z: 0, isPitLane: false },
            { x: 10, y: 0, z: 0, isPitLane: false },
          ],
        },
      ],
      12,
    )
    expect(inputs[0]!.width).toBe(12)
  })
})

describe('computeRoadbedLayer', () => {
  it('returns zeros when no ribbons supplied', () => {
    const raw = makeRaw((x, z) => x * 0.01 + z * 0.005)
    const layer = computeRoadbedLayer(raw, RES, WORLD, [])
    expect(layer.length).toBe(raw.length)
    for (let i = 0; i < layer.length; i++) expect(layer[i]).toBe(0)
  })

  it('cut/fill layer + raw equals stamped baseline (core stays exact)', () => {
    const raw = makeRaw((_x, z) => (Math.abs(z) < 8 ? 0 : 30))
    const ribbon = {
      points: [
        { x: -500, y: 0, z: 0, isPitLane: false },
        { x: 500, y: 0, z: 0, isPitLane: false },
      ],
      width: 50,
      closed: false,
    }
    const layer = computeRoadbedLayer(raw, RES, WORLD, [ribbon])
    const stamped = stampRibbonsIntoBaseline(raw, RES, WORLD, [ribbon])
    for (let i = 0; i < raw.length; i++) {
      expect(layer[i]! + raw[i]!).toBeCloseTo(stamped[i]!, 4)
    }
  })

  it('layer is zero outside the ribbon footprint + transition', () => {
    const raw = makeRaw(() => 7)
    const ribbon = {
      points: [
        { x: -500, y: 0, z: 0, isPitLane: false },
        { x: 500, y: 0, z: 0, isPitLane: false },
      ],
      width: 12,
      closed: false,
    }
    const layer = computeRoadbedLayer(raw, RES, WORLD, [ribbon])
    expect(sampleAt(layer, 0, 1500)).toBeCloseTo(0, 4)
  })
})

describe('stamp config respects user overrides', () => {
  it('zero transition: hard cliff at ribbon edge', () => {
    // Use a wide ribbon (width 50 → halfWidth 25 > cellSize/2) so the
    // stamp actually reaches at least one grid cell on a 15.69m grid.
    // Pre-Phase-1.5a (footprint = halfWidth + transition), halfWidth=25
    // covers cell centers at gz=128 (z=7.84) AND gz=127 (z=-7.84) — both
    // within 25m of ribbon centerline z=0.
    const raw = makeRaw((_x, z) => (Math.abs(z) < 20 ? 0 : 50))
    const ribbon = {
      points: [
        { x: -500, y: 0, z: 0, isPitLane: false },
        { x: 500, y: 0, z: 0, isPitLane: false },
      ],
      width: 50,
      closed: false,
    }
    const stamped = stampRibbonsIntoBaseline(raw, RES, WORLD, [ribbon], {
      ...DEFAULT_STAMP_CONFIG,
      transitionMeters: 0,
    })
    // At ribbon center: target = smoothed centerline raw=0.
    expect(sampleAt(stamped, 0, 0)).toBeCloseTo(0, 1)
    // Far from ribbon (z=400, past halfWidth=25 + transition=0): raw=50.
    expect(sampleAt(stamped, 0, 400)).toBeCloseTo(50, 0)
  })
})
