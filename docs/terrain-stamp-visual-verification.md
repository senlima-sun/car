# Terrain stamp — visual verification protocol

Phase 3 deliverable of the `terrain-conforms-to-ribbon` plan. This is
the human-runnable checklist for confirming the stamp model works in
the actual game canvas, since we don't have a deterministic 3D
screenshot diff harness inside this repo.

Run this on every meaningful change to:
- `terrainStamp.ts` (the algorithm)
- `terrainStampedSidecar.ts` (the orchestration)
- `ribbonGeometry.ts` (side-band y)
- `Checkpoint.tsx` (sensor y)
- `useTrackStore.ts` (sidecar wiring)

## Setup

```sh
pnpm --filter @car/game dev
```

Open the dev URL (Vite picks a port; usually `http://localhost:7235/`).

## Pass criteria (overall)

- The asphalt ribbon is **always visible** — never buried under
  terrain mesh.
- Side bands (edge lines / painted areas) sit **on the ribbon
  surface**, not floating at world y=0.
- Curbs sit on top of the ribbon at the correct edge.
- Checkpoints / start-finish line render with the ribbon and trigger
  lap detection when crossed.
- Sculpting a crater with the brush stays visible across preset
  switching back and forth (delta `preserve` policy on refresh).
- "Import Real Elevation" reapplies the stamped baseline cleanly
  (delta `reset` policy on the destructive action).

## Per-track checks

### 1. Spa-Francorchamps (`f1_spa`)

The headline test. Spa has Eau Rouge (~40m climb over 280m) and
Raidillon — the failure zone of the prior plan attempt.

- [ ] Load `f1_spa` from the track selector.
- [ ] Camera-orbit to view Eau Rouge: ribbon visibly canted along the
      hillside, asphalt on top of terrain, terrain mesh wraps up to
      meet the ribbon edge.
- [ ] Drive through Eau Rouge / Raidillon — car follows the ribbon
      smoothly without falling through terrain or popping up on
      buried geometry.
- [ ] Cross the start-finish line: lap timer triggers (checkpoint
      sensor catches the car at stamped y).
- [ ] Brush-sculpt a 5m crater near La Source. Release pointer; crater
      persists on the heightfield. Switch to Imola, then switch back to
      Spa — crater **still present** (`preserve` policy honoured).
- [ ] Click "Import Real Elevation": confirm the dialog, observe the
      crater **clears** (destructive `reset` policy) and the ribbon
      re-stamps to a fresh DEM baseline.

### 2. Imola (`f1_imola`)

Mid-elevation circuit; verifies stamp handles moderate slope.

- [ ] Load `f1_imola`. Ribbon sits flat-on-slope through the
      Variante Alta and Tamburello sections.
- [ ] Drive a full lap. No buried ribbon segments. Lap timer counts.
- [ ] Brush a hill outside the ribbon footprint (>30m from the
      centerline). The hill stamps the brush delta; the ribbon
      remains flat-on-slope nearby (smoothstep transition zone
      blends correctly).

### 3. Las Vegas (`f1_las_vegas`)

Nearly-flat circuit; verifies stamp doesn't add artifacts on flat
ground.

- [ ] Load `f1_las_vegas`. Ribbon and terrain are coplanar (no
      visible step or shadow at the ribbon edge).
- [ ] Drive the long straight. Car suspension stays steady (no
      micro-bounce from terrain noise inside the smoothing window).

### 4. Monaco (`f1_monaco`)

Known sidecar issue: 11,254 cells clipped to ±327m (sidecar audit).
Verify the stamp still produces a visually consistent ribbon
despite clipped DEM cells.

- [ ] Load `f1_monaco`. Ribbon doesn't visibly clip at clamped
      cells (clamping happens in raw DEM, smoothing in the stamp
      window absorbs it).
- [ ] Drive Casino Square hill. No catastrophic ribbon discontinuity.

## Regression catches

If any of these symptoms appear, halt and root-cause:

| Symptom | Likely cause |
| --- | --- |
| Asphalt strip buried beneath terrain mesh | Sidecar wiring missed `applyStampedSidecar` (Phase 2 audit failed) |
| Asphalt visible but side bands at y=0 | `buildSideBandFromBoundary` or `buildParentSideBandGeometry` regression on `p.y` reading |
| Checkpoint sensor doesn't trigger | `Checkpoint.tsx` not adding `terrainY` to `finalPosition[1]` |
| Curbs hover above or below ribbon | Curb segment terrain-sampling regression (not in this plan's scope; see `RibbonCurbSegment.tsx`) |
| Sculpt crater disappears on track switch | `deltaPolicy: 'preserve'` regressed to `'reset'` in matched-preset refresh |
| Sculpt crater survives "Import Real Elevation" | `deltaPolicy: 'reset'` regressed to `'preserve'` on the toolbar button |

## Automated coverage (complementary)

These tests catch the same failures programmatically and run in CI:

- `apps/game/src/utils/terrainStamp.realSpa.test.ts` — Spa centerline
  + edges within 5cm of stamped target across 48 waypoints (Eau
  Rouge / Raidillon densely sampled).
- `apps/game/src/utils/terrainStampedSidecar.test.ts` — orchestration
  behaviour incl. `deltaPolicy` enforcement.
- `apps/game/src/components/canvas/Car/hooks/useRaycastSuspension.tolerance.test.ts`
  — physics-vs-visual tolerance (set by Phase 4.1 from the
  measured probe error).
