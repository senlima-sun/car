# Baseline Fixture Strategy

Circuits are sourced directly from the track JSON files under
`apps/game/src/constants/tracks/sources/<track>.json`, which already conform
to the `Path` type (each JSON `paths[0]` entry has `id`, `anchors`, `closed`,
`stroke`, `strokeWidth`, `fill`, and each anchor has `id`, `point`,
`inHandle`, `outHandle`, `handleType`).

The baseline test casts the JSON directly to `TrackSource` (typed locally
as `{ id: string; paths: Path[] }`) and passes `paths[0]` to `pathToRibbon`.
This avoids constructing synthetic hand-built fixtures because the real track
data already satisfies the `Path` interface without transformation.

`useTerrainStore.getHeightAt` is stubbed to `() => 0` in `beforeEach` so
height sampling does not introduce environmental variance into the snapshots.

Snapshot file: `__snapshots__/pathToRibbon.baseline.test.ts.snap`
Metrics captured per circuit: `count`, `meanSpacing`, `maxSpacing`, `minSpacing`.
Per-vertex coordinates are intentionally excluded to keep snapshots small.
