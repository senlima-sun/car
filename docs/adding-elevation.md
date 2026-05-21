# Adding Real-World Elevation

Every circuit can carry a terrain heightmap sidecar so the car drives over real-world elevation instead of a flat plane. This guide covers how the elevation pipeline works and how to (re-)ingest a sidecar for a circuit.

---

## How it Works

The pipeline lives entirely outside the game runtime:

1. **Source**: Copernicus GLO-30 DEM via the OpenTopography REST API (when `OPENTOPO_API_KEY` is set), or Open-Elevation (SRTM-derived) as fallback. Single-source-per-circuit — never mix.
2. **Fetch**: `scripts/fetch-track-elevation.ts` reads `scripts/circuits/<name>.config.json`, resolves the GPS bounding box, fetches a 128×128 source raster, and stores a SHA-1-keyed cache at `scripts/.cache/elevation/` (gitignored).
3. **Resample**: bilinearly samples the source raster onto a 256×256 grid covering the runtime terrain `worldSize=4000m`, with cell-corner indexing matching `useTerrainStore.getHeightAt`. Source is always over-fetched to ≥2100m half-extent so target cells never fall outside the DEM bbox.
4. **Track-relative**: subtracts the DEM elevation at the circuit's geometric center (`verticalOriginMeters`) so stored heights are local. Monaco (sea-level cliffs) and Mexico City (~2240m above sea level) both store cells near 0m.
5. **Encode**: quantizes to Int16 cm precision (±327m range) and base64-encodes. Cells beyond ±327m are clamped (cliffs etc.). Sidecar written to `apps/game/src/constants/tracks/sources/_terrain/<name>.heightmap.json` (~175KB per circuit).
6. **Runtime**: `apps/game/src/utils/terrainSidecar.ts` lazy-loads the sidecar via Vite `import.meta.glob` — each circuit ships as its own chunk; only the active preset's sidecar is fetched at runtime.

Sidecars are **committed to git** as build inputs. The cache directory is gitignored. CI never touches the network — sidecars are the build input.

---

## Adding Elevation to an Existing Circuit

### OSM-sourced circuits (`provenance: "osm"`)

The config already has `centerLat` / `centerLon` from the polyline ingest. Add a `terrainBBox` field:

```json
{
  "name": "spa",
  ...
  "terrainBBox": {
    "halfExtentMeters": 1300
  }
}
```

The half-extent rule: start with the circuit's world-space bbox (printed by `track:ingest`), round up to the next 100m, add `min(200, 2000 - halfExtent)` margin so it stays within the runtime `worldSize/2 = 2000m`. The source bbox is automatically over-fetched to 2100m for edge safety.

Then:

```bash
OPENTOPO_API_KEY=... ELEVATION_ALLOW_NETWORK=1 pnpm -w run track:elevation:fetch spa
# or, without an API key (uses Open-Elevation fallback):
ELEVATION_ALLOW_NETWORK=1 pnpm -w run track:elevation:fetch spa
```

Commit the resulting `apps/game/src/constants/tracks/sources/_terrain/<name>.heightmap.json`.

### Manual circuits (`provenance: "manual"`)

Editor-drawn polylines have no GPS frame. Two choices:

**Flat** (no real terrain):

```json
"terrainGeoref": { "mode": "flat" }
```

The sidecar is written all-zero with `provider: "none"`. Runtime treats this exactly like an OSM track with empty terrain.

**Georef** (real DEM with rotation + scale):

```json
"terrainGeoref": {
  "mode": "georef",
  "centerLat": 52.0786,
  "centerLon": -1.0169,
  "headingDeg": 0,
  "scaleMetersPerUnit": 1.0,
  "halfExtentMeters": 1300
}
```

- `centerLat/Lon`: GPS coordinates of the real-world circuit's geometric center
- `headingDeg`: compass bearing the editor's local `+Y` axis points to in the real world (0=north, 90=east)
- `scaleMetersPerUnit`: how many real-world meters one local-Cartesian unit represents (1.0 for metric editor coords)
- `halfExtentMeters`: same rule as the OSM `terrainBBox`

Run `pnpm -w run track:elevation:fetch <name>`. The resampler applies the affine before each DEM sample so the heightmap aligns under the editor-drawn polyline.

---

## Adding a Brand-New Circuit

`pnpm -w run track:add <name>` will:

1. Run `track:ingest` (OSM) or `track:validate-source` (manual)
2. Automatically invoke `track:elevation:fetch <name>` if the config has `terrainBBox` (OSM) or `terrainGeoref` (manual)

Failure of the elevation step is non-fatal — the track is still usable without a sidecar.

---

## Validator Thresholds (Why They Are What They Are)

`scripts/lib/elevation/validate.ts` runs sanity checks against the resampled heightmap:

- **Range tolerance**: observed range must be within `[0.25×, 10×]` of `expectedRangeMeters` from the per-circuit table in `scripts/fetch-track-elevation.ts`. The wide multiplier catches gross failures (all-zero, NaN, swapped lat/lon) but allows for real DEM variance — F1 circuit bboxes pull in 1–2km of surrounding terrain, and that terrain varies wildly across the calendar (Spa hills vs Yas Marina flats).
- **Neighbour delta ≤ 150m**: catches DEM corruption / sentinel-value adjacency (e.g. -32768 nodata next to valid 200m cells). 150m at a 15.7m cell is a 956% grade — no real terrain hits this, only data errors.
- **Landmark check** (optional, unused so far): per-circuit `{worldX, worldZ, expectedHeight, toleranceM}[]` entries can pin specific points (e.g. Spa Eau Rouge bottom + Raidillon top).

The `EXPECTATIONS` table values in `scripts/fetch-track-elevation.ts` were initially calibrated from observed Open-Elevation ingestion runs. When swapping to GLO-30 via OpenTopography, re-baseline the table values to match.

---

## Source Notes

**Open-Elevation public instance**: free, no key, SRTM-backed (~±10m vertical). Sequential POSTs at 200 points/batch = 82 batches × ~30s per circuit. Be polite; cache the GeoTIFF responses (the disk cache handles this).

**Copernicus GLO-30 via OpenTopography**: requires a free `OPENTOPO_API_KEY` (https://portal.opentopography.org). 500 calls/day free tier — we use 23. ~±2-5m real-world over open terrain. Single GeoTIFF GET per circuit.

**Attribution**: When shipping the game UI, credit "OpenTopography + Copernicus Programme" (for GLO-30) or "Open-Elevation + SRTM" (NASA/USGS) in the about/credits screen.

**Datum**: Both providers return EGM2008 geoid heights. Since the game only uses per-circuit-relative heights (subtracting `verticalOriginMeters` at ingest), absolute datum reconciliation is unnecessary.

---

## The Editor "Import Real Elevation" Button

`TrackEditor → TerrainControls → "Import Real Elevation"` re-applies the bundled sidecar for the currently-active preset. Useful after a user has manually edited terrain and wants to revert to the real-world data. Does NOT make network calls — only reads the committed sidecar.
