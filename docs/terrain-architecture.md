# Terrain architecture — track stamping

Architectural decision record for how F1 circuits and underlying
terrain coexist in the simulator. Supersedes the previous
`ribbon-derives-y-from-terrain` direction.

## TL;DR

The asphalt ribbon defines the local target elevation. The terrain
baseline is **mutated** (stamped) at sidecar-load time so the cells
inside the ribbon footprint sit at the ribbon's smoothed centerline
y, with a smoothstep transition zone blending back to the raw DEM
beyond the ribbon edge. Visual mesh, suspension raycasts, and side
bands then all read the same stamped heightfield via
`useTerrainStore.getHeightAt(x, z)` — no per-consumer y-derivation
plumbing.

## Why this direction

F1 circuits are flat asphalt strips **cut into** the landscape. The
geometry is "land conforms to road", not "road drapes over every
terrain wrinkle". The earlier ribbon-derives-y-from-terrain plan
implemented the wrong direction — it tried to lift the ribbon
mesh to follow every DEM cell, which:

- Visually buried the ribbon under terrain at Spa Eau Rouge (DEM
  features at 50m elevation that the ribbon's bilinear edge
  samples couldn't lift the mesh up over).
- Required tracing ribbon-y through six surface consumers (mesh,
  curbs, side bands, checkpoints, sensors, derived layers), each
  with their own approximation budget.
- Inverted the conceptual model: real circuits modify terrain to
  serve the road, not the other way around.

The stamp approach instead makes ribbon authoritative at the
**baseline-write** moment (one-shot per sidecar load) and leaves
every downstream y reader unchanged.

## Module layout

```
apps/game/src/utils/
├── terrainStamp.ts             # Pure algorithm. No store/React deps.
│   - stampRibbonsIntoBaseline()
│   - ribbonStampInputsFromObjects()
│   - DEFAULT_STAMP_CONFIG
│
├── terrainStampedSidecar.ts    # Orchestration. Imports store + fetch.
│   - applyStampedSidecar(presetId, objects, { deltaPolicy })
│
├── terrainStamp.test.ts        # Unit tests (synthetic DEM)
├── terrainStamp.realSpa.test.ts # Real Spa probe (regression gate)
├── terrainStamp.bench.ts       # Perf bench (default-off)
└── terrainStampedSidecar.test.ts
```

## The stamp algorithm

Input: raw DEM `Float32Array`, ribbons (centerline + width per
ribbon), config (smoothing window, transition zone).

For each ribbon:

1. **Smooth centerline target y** — for each input ribbon point,
   sample the raw DEM densely (1m steps) along the ribbon
   centerline within `±smoothHalfWindowMeters` (default 30m).
   Moving-average smoothes sub-window DEM noise; preserves
   large-scale elevation features like Eau Rouge.
2. **Mark segments** — connect adjacent ribbon points into linear
   segments with start/end arc lengths and target y values.
3. **Stamp each grid cell** — for each cell in the baseline grid:
   - Find the closest ribbon segment via AABB early-out + per-cell
     closest-point math.
   - If `dist <= halfWidth + cellSize * SQRT2`: full stamp to the
     interpolated target y at the closest point. The
     `cellSize * SQRT2` expansion guarantees all four bilinear
     corners around any in-footprint `getHeightAt(x, z)` query
     are stamped.
   - If `halfWidth + cellSize * SQRT2 < dist <= halfWidth + cellSize * SQRT2 + transitionMeters`:
     smoothstep blend from target y back to raw DEM y.
   - Otherwise: keep raw DEM.

Output: new `Float32Array`, same dimensions as input. The input is
NEVER mutated (pure function).

## Delta policy

The stamp lives in `useTerrainStore.baseline`. User sculpting writes
to `useTerrainStore.delta`. `getHeightAt` returns `baseline + delta`.

When stamping, the orchestration helper accepts a `deltaPolicy`:

- **`preserve`** (matched-preset refresh, library finalize): keeps
  user sculpt across re-stamping. Use this when re-applying the
  baseline for the SAME track (e.g. switching presets and back).
- **`reset`** (first-time preset load, "Import Real Elevation"
  button, deterministic test fixtures): clears `delta` after stamp.
  Use this when starting a fresh track row or when the user
  explicitly asked for a clean reset.

## Precision floor

Phase 1.5b real-Spa probe measured the worst-case
`getHeightAt`-vs-targetY error at **0.1592m**, observed on the
Eau Rouge / Raidillon arc fractions.

The error comes from **arc-vs-grid linearity divergence**: the
stamp algorithm assigns `targetY` per closest segment, but bilinear
interpolation between adjacent stamped cells creates per-cell
linear interpolation, which differs from arc-linear interpolation
on curved ribbon sections. This is the precision floor at 256²
grid resolution.

Tolerance test (`useRaycastSuspension.tolerance.test.ts`) uses
**`TOLERANCE_M = 0.30m`** — 88% safety margin over the measured
0.16m floor. Tightening below this requires either:

- Higher heightfield resolution (e.g. 512² quadruples memory and
  stamp time), OR
- Multi-sample stamp (e.g. per-cell super-sampling) — adds inner
  loop cost.

Neither is in v1's scope.

## Performance

`stampRibbonsIntoBaseline` is one-shot per sidecar load — **not**
per-frame. Bench (`terrainStamp.bench.ts`) on Apple Silicon shows
~92ms median for a Spa-class circuit (256² grid, 450-segment
closed loop). The 100ms budget is comfortable; AABB early-out
reduces full-grid work to ~10% of cells.

If profiling ever shows stamp time as a bottleneck:

- Pre-sample the raw DEM along an arc-resolved polyline once per
  ribbon (instead of repeated bilinear calls inside the smoothing
  window). Estimated 20–35% speedup.
- Binary search in `pointAtArc` instead of linear scan.
  Estimated additional 25% if combined with the above.

Both are out of scope for v1.

## Sidecar consumers (all five funnel through `applyStampedSidecar`)

| Site | File:line | deltaPolicy |
| --- | --- | --- |
| First-time preset load | `useTrackStore.ts:loadPresetTrack` | `reset` |
| Matched-preset refresh | `useTrackStore.ts:loadPresetTrack` | `preserve` |
| Library boot finalize | `useTrackStore.ts:loadLibrary` | `preserve` |
| "Import Real Elevation" button | `TerrainControls.tsx` | `reset` |
| Suspension tolerance test fixture | `useRaycastSuspension.tolerance.test.ts` | `reset` |

`grep -rn 'getTerrainHeightmapForPreset' apps/game/src/` should
return exactly two matches: the export in `terrainSidecar.ts` and
the import in `terrainStampedSidecar.ts`. Any other match is a
missed wiring site.

## Rejected alternative

`.claude/plans/ribbon-terrain-rewrite.md` — the prior plan that
made the ribbon mesh derive y from the raw DEM. Failed empirically
(ribbon buried at Spa Eau Rouge) because that direction inverts how
real circuits relate to landscape. Kept on file as a footnote so
future agents don't re-litigate the direction question.

## See also

- `docs/terrain-stamp-visual-verification.md` — manual visual
  checklist per circuit.
- `docs/sidecar-clamp-audit.md` — sidecar quality audit (Monaco
  and Red Bull Ring have known clipped DEM cells).
- `apps/game/src/utils/terrainStamp.bench.ts` — perf bench.
