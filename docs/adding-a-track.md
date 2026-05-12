# Adding a Track

This guide covers how to ingest a new circuit from OpenStreetMap and configure it for the pipeline. Phases 2 and 3 of the pipeline (geometry validation and AI drive validation) are documented here when those phases ship.

---

## Finding the BBox and Overpass Query

Every OSM-provenance circuit config requires a bounding box (`bbox`) and a set of Overpass query filters. This section walks you through deriving both.

### 1. Locate the circuit on OpenStreetMap

Open [openstreetmap.org](https://www.openstreetmap.org) and search for the circuit name. Example:

```
https://www.openstreetmap.org/search?query=spa-francorchamps
```

Zoom until the full circuit is visible. Switch to **Map Data** view (the layers icon → "Map Data") to see the underlying OSM way objects overlaid on the map.

### 2. Identify the `highway=raceway` ways

Click on a way that traces the racing line. In the way inspector panel on the right, confirm the tags include:

```
highway = raceway
sport   = motor
```

These are the two tag predicates used by the Overpass query. Every major F1 circuit in OSM uses this tagging. If the ways are tagged differently (e.g. public roads with `highway=primary`), the circuit is unsupported — see the Monaco note below.

### 3. Copy the four corner coordinates as `[south, west, north, east]`

Pan the map so the full circuit fits in the viewport. The Overpass bbox format is `[south, west, north, east]` — i.e. `[min_lat, min_lon, max_lat, max_lon]`.

To read the coordinates: use the **Export** tab on the left sidebar and read the four coordinate fields labelled "left", "right", "top", "bottom" — these correspond to `west`, `east`, `north`, `south` respectively.

Add a margin of ~0.01 degrees (~1 km) on each side so that all the circuit's OSM ways fall inside the bbox.

Example for Silverstone:

```json
"bbox": [52.05, -1.05, 52.09, -0.98]
```

### 4. Choose `startWayName` from the way name tag at the main straight

Click on the way that covers the pit straight (the longest straight with the start/finish line). Read the `name` tag in the OSM inspector. That value becomes `startWayName` in the config. The converter chains ways starting from this one, so choosing the pit straight gives the correct orientation.

If no named way covers the pit straight, omit `startWayName` — the converter falls back to the longest way.

### 5. Build `wayNameDenyList` to scrub non-GP ways

Most circuits have a karting track, club circuit, or pit lane access roads sharing the same OSM area. Identify them by clicking on ways inside the bbox that are **not** part of the GP circuit and reading their `name` tags.

Add each name (exact match; substring-matched) to `wayNameDenyList`. The converter will exclude any OSM way whose `name` tag contains any of these strings.

If all non-GP ways inside the bbox are unnamed (no `name` tag), you can omit `wayNameDenyList`.

---

## Worked Examples

### Silverstone (answer key)

The existing config at `scripts/circuits/silverstone.config.json` is the reference implementation. Key choices:

- `bbox: [52.05, -1.05, 52.09, -0.98]` — adds ~1 km margin around the GP circuit
- `startWayName: "National Pit Straight"` — the named OSM way at the start/finish line
- `wayNameDenyList` includes `"Stowe Circuit"`, `"International pit lane"`, and `"Ice Hill"` — the club track and support-race venues that share the Silverstone complex
- `reverseDirection: true` — the default OSM way order is clockwise; F1 Silverstone runs anti-clockwise

The query filters `["\"highway\"=\"raceway\"", "\"sport\"=\"motor\""]` match the standard F1 circuit tagging.

---

### Spa-Francorchamps (follow these steps)

1. Search `https://www.openstreetmap.org/search?query=circuit+de+spa-francorchamps`
2. Enable Map Data; click on the Kemmel Straight — confirm `highway=raceway`, `sport=motor`
3. Read the bbox from the Export tab:
   - Approximate bbox: `[50.42, 5.95, 50.47, 6.02]`
4. The pit straight way is named `"Circuit de Spa-Francorchamps"`; use that as `startWayName`
5. Inside the bbox you will find karting and club circuit ways — their names typically include `"karting"` or the venue name; add those to `wayNameDenyList`
6. Spa runs clockwise in F1; set `reverseDirection: false` (or omit it)

Expected config skeleton:

```json
{
  "name": "spa",
  "displayName": "Circuit de Spa-Francorchamps",
  "provenance": "osm",
  "overpass": {
    "bbox": [50.42, 5.95, 50.47, 6.02],
    "queryFilters": ["\"highway\"=\"raceway\"", "\"sport\"=\"motor\""]
  },
  "centerLat": 50.4372,
  "centerLon": 5.9713,
  "startWayName": "Circuit de Spa-Francorchamps",
  "wayNameDenyList": ["karting"],
  "reverseDirection": false,
  "startFinishFraction": 0.0,
  "expectedTrackLengthMeters": 7004,
  "expectedTurns": 20,
  "expectedStartHeadingDegrees": 170.0,
  "aiDriveLapTimeWindowSeconds": [240, 480]
}
```

Run `bun run track:ingest spa` after creating this file. Adjust `wayNameDenyList` if non-GP ways appear in the output.

---

### Monaco (UNSUPPORTED)

Monaco is not supported by the OSM ingest pipeline.

The Monaco Formula 1 circuit runs on public roads through the principality. OSM tags those roads as `highway=primary`, `highway=secondary`, etc. — not `highway=raceway`. The `["highway"="raceway"]` Overpass filter returns zero ways for Monaco.

Even if you construct a manual Overpass query without the raceway filter, the road topology is extremely complex (tunnels, elevation changes, public-road junctions) and the result would require heavy manual curation.

**Workaround**: draw Monaco manually in the in-app track editor and export the source JSON, then create a `scripts/circuits/monaco.config.json` with `provenance: "manual"`. The pipeline will validate and AI-drive the manually-drawn source without attempting OSM ingest.

---

## Known Limitations

### Shanghai start-finish placement

`src/constants/tracks/sources/shanghai.json` has its start-finish checkpoint at `segmentIndex: 0`. This was added programmatically when the source had no start-finish checkpoint at all (Phase 2 validation surfaced the omission). OSM `highway=raceway` traces conventionally begin at the real start-finish line — Suzuka follows this convention and lands correctly at segmentIndex 0 — but Shanghai's trace has not been verified visually. If lap timing or AI-drive on Shanghai records laps relative to an unexpected point on the circuit, the SF checkpoint needs to be relocated in the in-app track editor.

### Shanghai sector checkpoints

`shanghai.json` has no `kind: "sector"` checkpoints. The in-app lap counter requires sectors to produce per-sector times. Add two sector checkpoints in the editor before exposing Shanghai as a playable circuit.

---

## End-to-End Workflow

The following five commands take you from a blank config to a committed, fully-validated circuit. Spa-Francorchamps is the worked example throughout; substitute the actual circuit name for any real use.

### Step 1 — Write the circuit config

Create `scripts/circuits/spa.config.json` following the schema in `scripts/circuits/_schema.ts`. Populate the BBox and query filters using the OSM guide above. For OSM-provenance circuits, include `overpass`, `centerLat`, `centerLon`. For circuits drawn in the track editor, use `provenance: "manual"` and omit those fields.

### Step 2 — Ingest from OSM (OSM circuits only)

```bash
bun run track:ingest spa
```

This fetches the Overpass QL response, chains the ways into a closed polyline, simplifies it, converts GPS to world coordinates, writes `src/constants/tracks/sources/spa.json`, and runs the structural validator inline. If the validator finds a critical issue the file is written for inspection but the process exits 1 — do NOT commit the output until all critical issues are resolved.

For `provenance: "manual"` circuits, skip this step — the source is the canonical artefact.

### Step 3 — Inspect the output

Open the track JSON in the in-app editor (`bun run dev`, then load the circuit) and verify the layout visually. Check that the start-finish checkpoint is at the correct position and the two sector checkpoints divide the circuit into meaningful thirds.

### Step 4 — Run the source validator

```bash
bun run track:validate-source spa
```

Runs all structural checks and writes a JSON report to `.cache/track-validation/spa.json`. Fix any CRITICAL issues before continuing. WARNING-level issues may be informational and are non-blocking.

### Step 5 — Run AI drive validation

```bash
bun run track:ai-drive spa
```

Requires the dev server to be running (`bun run dev` in a separate shell). The browser agent opens the circuit in validation-drive mode, waits for the AI driver to complete one lap, and asserts the result. See "AI-drive failure triage" below if this step fails.

### Step 6 — Commit

Once all three phases pass, commit `scripts/circuits/spa.config.json` and `src/constants/tracks/sources/spa.json`. If you have installed the pre-commit hook (`scripts/git-hooks/pre-commit`), the source validator runs automatically at commit time.

### One-command shortcut

```bash
bun run track:add spa
```

Sequences steps 2/4 (ingest for OSM, validate-source for manual) → dev-server preflight → AI drive. Exits 0 on full success, 1 on any sub-step failure, 2 if the dev server is not running.

**Note on cold starts**: `bun run dev` compiles WASM on first run, which can take several minutes. Run `bun run build:wasm` to pre-warm the WASM cache before running `track:add` on a fresh checkout.

---

## Validation Thresholds

Every source JSON and AI drive run is checked against the following bands. These were derived from first principles and then calibrated against the four existing circuits.

### Source-side checks (run by `track:validate-source` and inline in `track:ingest`)

| Check | Threshold | Rationale |
|-------|-----------|-----------|
| **Track length** | `\|actual − expected\| / expected ≤ 0.03` (±3 %) | Real F1 circuits are quoted at km-level precision; OSM tracing is not metrologically-grade. Tighter than 3 % would produce false failures on correctly-traced real circuits. |
| **Turn count** | `\|actual − expected\| ≤ 2` | FIA turn-naming ambiguity: some sources count Becketts at Silverstone as 1 corner, others as 3. A tolerance of 2 absorbs this without masking gross errors. |
| **Start heading** | Within 15° of `expectedStartHeadingDegrees` | Captures wrong-way orientation bugs (the `reverseDirection` flag is the fix) without false-negatives from minor anchor placement drift. |
| **Closure gap** | ≤ 5 m | Matches the existing `isClosed` constant in `convert-osm-track.ts` to avoid two competing definitions of "closed". |
| **Zero-length segments** | Every road segment ≥ 1 m | Zero-length segments produce NaN in the physics engine's raycast suspension. Upper bound of 60 m (MAX_SEGMENT_LENGTH) remains unchanged. |
| **Curvature spikes** | No single segment's Menger curvature > 0.20 (radius < 5 m) | Below F1 wheelbase + suspension stroke; produces un-survivable kinks. Uses the same `computeCurvature` function as the converter. |

### AI-drive checks (run by `track:ai-drive`)

| Check | Threshold | Rationale |
|-------|-----------|-----------|
| **Lap completion** | Must cross start-finish once within 600 s (`MAX_VALIDATION_DRIVE_SECONDS`) | Tracks up to 7 km at conservative AI pace (~25–35 m/s) need this headroom. |
| **Off-track budget** | Cumulative time with all 4 wheels off-track ≤ 10 s | Detects broken edge polylines without false-positives from grass-cutting at apexes. |
| **Collision kill** | Zero `crashed` transitions in `useGameStore.gameStatus` | The Rapier contact callback for barriers resets the game state; any reset is a failure. |
| **Lap time window** | Within `config.aiDriveLapTimeWindowSeconds = [floor, ceiling]` | Per-circuit, hand-set. Initial guidance: real F1 race pace × 2.0 (floor) and × 4.0 (ceiling). The AI driver is intentionally conservative; this slack band is correct. |

---

## AI-Drive Failure Triage

When `bun run track:ai-drive <name>` exits 1, the `failureReason` field in the printed summary indicates the root cause. Use this table:

| `failureReason` | Likely root cause | First diagnostic step |
|-----------------|-------------------|----------------------|
| `off_track_budget_exceeded` | Edge polyline has a large gap or mis-traced section that the AI crosses repeatedly | Open the track in the editor; check for abrupt direction changes or single-node gaps in the road mesh. Compare the failing screenshot at `.cache/track-validation/<name>-failure.png` against the map. |
| `timeout` | AI driver is stuck in a very tight hairpin or the centreline has a self-intersection | Check `.cache/track-validation/<name>-timeout.png`. Look for 180° reversals in the simplified polyline. Consider adding a `reverseDirection: true` if the AI is consistently heading the wrong way. |
| `stuck_at_<x>_<z>` | Speed dropped below 5 m/s for > 5 s at the given world coordinates | The coordinate identifies the problem location precisely. Load the track, drive to that coordinate manually, and identify the geometric issue (tight kink, broken segment, overlapping road objects). |
| `phase is "failed"` | Internal validation drive store transitioned to `failed` for a reason not listed above | Inspect `window.__VALIDATION_DRIVE_RESULT__` in the browser console for the full summary object including `offTrackSeconds` and `lapTimeSeconds`. |
| `lapTimeSeconds outside window` | Lap time is outside `[floor, ceiling]` in the config | If the lap time is *above* the ceiling: the AI is driving too slowly — check for very tight sectors or a missing sector checkpoint that causes the driver to re-loop. If *below* the floor: the start-finish checkpoint may be mis-placed, causing the lap to register after only a partial lap. |

---

## Common Gotchas

### Wrong-way circuits (`reverseDirection`)

OSM way ordering follows the digitising order of the original contributor, which is not always the race direction. If the AI consistently drives the circuit in the wrong direction (fast straight becomes a hairpin approach, or the car goes counter-clockwise on a clockwise circuit), set `reverseDirection: true` in the config and re-run `track:ingest`.

To detect the correct direction before running AI drive: open the written source in the in-app editor and observe the checkpoint arrows — they should point in the lap direction.

### Karting tracks sharing the OSM area (`wayNameDenyList`)

Most major F1 venues host a karting circuit or club track on the same site. OSM contributors tag those inner tracks with their own `name` tags. Without a deny list, the converter chains those ways into the GP circuit polyline, producing bizarre routing.

Identify unwanted ways by enabling Map Data view in OSM and clicking every way inside your bbox. Any way that is not part of the GP circuit layout gets its `name` added to `wayNameDenyList`. Substring matching is used, so `"Karting"` blocks any way whose name contains that string.

### Elevation overpasses (Suzuka 130R / overpass example)

Suzuka's figure-of-eight layout passes over itself at the 130R overpass. OSM traces this as two separate sets of ways at the same ground-projected position but different actual elevations. Without intervention, the way-chaining algorithm may try to connect the wrong pair of endpoints.

The fix is `elevationZones` in the config: declare the fraction range where the overpass occurs and assign an elevation offset. This lifts the overpass road segment above the underpass in the Y axis, preventing the physics engine from treating them as co-planar.

Example from `scripts/circuits/suzuka.config.json`:

```json
"elevationZones": [
  { "startFraction": 0.55, "endFraction": 0.62, "elevation": 6.0 }
]
```

If chaining still fails despite elevation zones, use `maxChainGap` to tighten the gap tolerance (Suzuka uses `50` instead of the default `100`).

### Missing sector checkpoints

The in-app lap counter requires at least two `kind: "sector"` checkpoints in addition to the `kind: "start-finish"` checkpoint. The converter auto-places sector checkpoints at `sectorSplits` fractions along the polyline. If the auto-detected splits produce a sector that is only a few road objects long, the AI driver may not register it correctly.

Check the sector positions in the editor. Drag them to the closest straight section for reliable checkpoint crossing. Update `sectorSplits` in the config to a manual override if the auto-detected value is consistently wrong.

### `provenance: "manual"` escape hatch

See the next section.

---

## Manual Provenance Circuits

`provenance: "manual"` in a circuit config means the source JSON in `src/constants/tracks/sources/<name>.json` was created by a means other than the OSM ingest pipeline — typically hand-drawn in the in-app track editor and exported, or converted from CSV data by `scripts/convert-csv-track.ts`.

**When to use it**: when the circuit is not in OSM with `highway=raceway` tagging (e.g. Monaco, or a fictional circuit), or when a committed source already exists and re-running OSM ingest would produce a different (potentially worse) result.

**What it means**:

- `bun run track:ingest <name>` skips the OSM fetch and exits 0 with a "skipped: manual provenance" message. It does not overwrite the source file.
- `bun run track:validate-source <name>` still runs the full structural validator against the existing source JSON. Manual provenance does not exempt a circuit from validation.
- `bun run track:ai-drive <name>` works normally — the AI driver validates playability regardless of how the source was produced.
- `bun run track:add <name>` runs `track:validate-source` instead of `track:ingest`, then proceeds to `track:ai-drive`.

**Current manual-provenance circuits**: Silverstone, Monza, Shanghai. Their sources are the canonical artefacts. Modifying them requires going through the in-app editor, not re-running `track:ingest`.

**Limitation**: manual circuits cannot be regenerated from OSM. If you need to update the circuit layout, edit the source JSON in the editor and re-export. The `expectedTrackLengthMeters` and `expectedTurns` fields in the config must be updated to match the new source.

---

## FastF1 / Real-F1 Telemetry Research Appendix

See the next section.
