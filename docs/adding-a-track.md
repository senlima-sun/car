# Adding a Track

This guide covers how to ingest a new circuit from OpenStreetMap and validate the resulting source geometry. For real-world terrain elevation, see [adding-elevation.md](./adding-elevation.md).

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
  "expectedStartHeadingDegrees": 170.0
}
```

Run `pnpm -w run track:ingest spa` after creating this file. Adjust `wayNameDenyList` if non-GP ways appear in the output.

---

### Monaco (UNSUPPORTED)

Monaco is not supported by the OSM ingest pipeline.

The Monaco Formula 1 circuit runs on public roads through the principality. OSM tags those roads as `highway=primary`, `highway=secondary`, etc. — not `highway=raceway`. The `["highway"="raceway"]` Overpass filter returns zero ways for Monaco.

Even if you construct a manual Overpass query without the raceway filter, the road topology is extremely complex (tunnels, elevation changes, public-road junctions) and the result would require heavy manual curation.

**Workaround**: draw Monaco manually in the in-app track editor and export the source JSON, then create a `scripts/circuits/monaco.config.json` with `provenance: "manual"`. The pipeline will validate the manually-drawn source without attempting OSM ingest.

---

## Known Limitations

### Shanghai start-finish placement

`src/constants/tracks/sources/shanghai.json` has its start-finish checkpoint at `segmentIndex: 0`. This was added programmatically when the source had no start-finish checkpoint at all (validation surfaced the omission). OSM `highway=raceway` traces conventionally begin at the real start-finish line — Suzuka follows this convention and lands correctly at segmentIndex 0 — but Shanghai's trace has not been verified visually. If lap timing on Shanghai records laps relative to an unexpected point on the circuit, the SF checkpoint needs to be relocated in the in-app track editor.

### Shanghai sector checkpoints

`shanghai.json` has no `kind: "sector"` checkpoints. The in-app lap counter requires sectors to produce per-sector times. Add two sector checkpoints in the editor before exposing Shanghai as a playable circuit.

---

## End-to-End Workflow

The following commands take you from a blank config to a committed, validated circuit. Spa-Francorchamps is the worked example throughout; substitute the actual circuit name for any real use.

### Step 1 — Write the circuit config

Create `scripts/circuits/spa.config.json` following the schema in `scripts/circuits/_schema.ts`. Populate the BBox and query filters using the OSM guide above. For OSM-provenance circuits, include `overpass`, `centerLat`, `centerLon`. For circuits drawn in the track editor, use `provenance: "manual"` and omit those fields.

### Step 2 — Ingest from OSM (OSM circuits only)

```bash
pnpm -w run track:ingest spa
```

This fetches the Overpass QL response, chains the ways into a closed polyline, simplifies it, converts GPS to world coordinates, writes `src/constants/tracks/sources/spa.json`, and runs the structural validator inline. If the validator finds a critical issue the file is written for inspection but the process exits 1 — do NOT commit the output until all critical issues are resolved.

For `provenance: "manual"` circuits, skip this step — the source is the canonical artefact.

### Step 3 — Inspect the output

Open the track JSON in the in-app editor (`pnpm dev`, then load the circuit) and verify the layout visually. Check that the start-finish checkpoint is at the correct position and the two sector checkpoints divide the circuit into meaningful thirds.

### Step 4 — Run the source validator

```bash
pnpm -w run track:validate-source spa
```

Runs all structural checks and writes a JSON report to `.cache/track-validation/spa.json`. Fix any CRITICAL issues before continuing. WARNING-level issues may be informational and are non-blocking.

### Step 5 — Commit

Once validation passes, commit `scripts/circuits/spa.config.json` and `src/constants/tracks/sources/spa.json`. If you have installed the pre-commit hook (`scripts/git-hooks/pre-commit`), the source validator runs automatically at commit time.

### One-command shortcut

```bash
pnpm -w run track:add spa
```

Runs ingest (for OSM) or validate-source (for manual). Exits 0 on success, 1 on any sub-step failure.

---

## Validation Thresholds

Every source JSON is checked against the following bands. These were derived from first principles and then calibrated against the four existing circuits.

### Source-side checks (run by `track:validate-source` and inline in `track:ingest`)

| Check | Threshold | Rationale |
|-------|-----------|-----------|
| **Track length** | `\|actual − expected\| / expected ≤ 0.03` (±3 %) | Real F1 circuits are quoted at km-level precision; OSM tracing is not metrologically-grade. Tighter than 3 % would produce false failures on correctly-traced real circuits. |
| **Turn count** | `\|actual − expected\| ≤ 2` | FIA turn-naming ambiguity: some sources count Becketts at Silverstone as 1 corner, others as 3. A tolerance of 2 absorbs this without masking gross errors. |
| **Start heading** | Within 15° of `expectedStartHeadingDegrees` | Captures wrong-way orientation bugs (the `reverseDirection` flag is the fix) without false-negatives from minor anchor placement drift. |
| **Closure gap** | ≤ 5 m | Matches the existing `isClosed` constant in `convert-osm-track.ts` to avoid two competing definitions of "closed". |
| **Zero-length segments** | Every road segment ≥ 1 m | Zero-length segments produce NaN in the physics engine's raycast suspension. Upper bound of 60 m (MAX_SEGMENT_LENGTH) remains unchanged. |
| **Curvature spikes** | No single segment's Menger curvature > 0.20 (radius < 5 m) | Below F1 wheelbase + suspension stroke; produces un-survivable kinks. Uses the same `computeCurvature` function as the converter. |

---

## Common Gotchas

### Wrong-way circuits (`reverseDirection`)

OSM way ordering follows the digitising order of the original contributor, which is not always the race direction. If the start-finish checkpoint points the wrong way after ingest (fast straight becomes a hairpin approach, or the car spawns facing backwards), set `reverseDirection: true` in the config and re-run `track:ingest`.

To detect the correct direction: open the written source in the in-app editor and observe the checkpoint arrows — they should point in the lap direction.

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

The in-app lap counter requires at least two `kind: "sector"` checkpoints in addition to the `kind: "start-finish"` checkpoint. The converter auto-places sector checkpoints at `sectorSplits` fractions along the polyline.

Check the sector positions in the editor. Drag them to the closest straight section for reliable checkpoint crossing. Update `sectorSplits` in the config to a manual override if the auto-detected value is consistently wrong.

### `provenance: "manual"` escape hatch

See the next section.

---

## Manual Provenance Circuits

`provenance: "manual"` in a circuit config means the source JSON in `src/constants/tracks/sources/<name>.json` was created by a means other than the OSM ingest pipeline — typically hand-drawn in the in-app track editor and exported.

**When to use it**: when the circuit is not in OSM with `highway=raceway` tagging (e.g. Monaco, or a fictional circuit), or when a committed source already exists and re-running OSM ingest would produce a different (potentially worse) result.

**What it means**:

- `pnpm -w run track:ingest <name>` skips the OSM fetch and exits 0 with a "skipped: manual provenance" message. It does not overwrite the source file.
- `pnpm -w run track:validate-source <name>` still runs the full structural validator against the existing source JSON. Manual provenance does not exempt a circuit from validation.
- `pnpm -w run track:add <name>` runs `track:validate-source` instead of `track:ingest`.

**Current manual-provenance circuits**: Silverstone, Monza, Shanghai. Their sources are the canonical artefacts. Modifying them requires going through the in-app editor, not re-running `track:ingest`.

**Limitation**: manual circuits cannot be regenerated from OSM. If you need to update the circuit layout, edit the source JSON in the editor and re-export. The `expectedTrackLengthMeters` and `expectedTurns` fields in the config must be updated to match the new source.

---

## FastF1 / Real-F1 Telemetry Research Appendix

This appendix documents the real-F1 data sources that could be used to calibrate the pipeline in the future. None of these integrations are implemented. Each suggestion is explicitly marked **NOT IMPLEMENTED**.

---

### FastF1 (Python library)

**Source**: [https://github.com/theOehrly/Fast-F1](https://github.com/theOehrly/Fast-F1)  
**Install**: `pip install fastf1`

FastF1 is a community-maintained Python library that wraps the official F1 timing API. It provides per-driver, per-session telemetry for every race weekend since 2018.

Available channels per lap sample:

| Channel | Unit | Notes |
|---------|------|-------|
| `X`, `Y` | metres (track-frame) | 2D position in a circuit-specific coordinate frame, NOT lat/lon |
| `Speed` | km/h | GPS-derived; typically 50 Hz |
| `Throttle` | 0–100 % | |
| `Brake` | 0/1 (boolean) | |
| `nGear` | 0–8 | |
| `RPM` | rev/min | |
| `DRS` | 0/1/10/12/14 | State machine; 10/12 = eligible, 14 = active |
| `SessionTime` | timedelta | Elapsed time since session start |

**Caveats**:

- Position (`X`, `Y`) is in a track-frame coordinate system that differs per circuit and is not documented by F1. Mapping it onto our world coordinate system requires a per-circuit affine calibration. The calibration is not trivial (rotation + scale + translation) and must be derived from matching known GPS anchor points to the track-frame points.
- The F1 timing API enforces rate limits and a rolling data embargo: race data is typically unavailable for ~2 hours after session end.
- Not all sessions are public. Pre-season testing and some practice sessions are gated behind the F1 TV subscription.
- FastF1 caches responses to disk; cache must be initialised: `fastf1.Cache.enable_cache('/path/to/cache')`.

---

### Official F1 Timing API (`livetiming.formula1.com`)

**Source**: [https://livetiming.formula1.com](https://livetiming.formula1.com)

This is the upstream data source that FastF1 consumes. Direct access requires reverse-engineering a SignalR-based WebSocket protocol. The protocol has changed multiple times across seasons, breaking existing clients.

**Not recommended for hobby use.** Use FastF1 or OpenF1.org as stable abstraction layers.

---

### F1 Game UDP Telemetry (Codemasters F1 23 / F1 24)

Codemasters' official F1 titles broadcast a structured UDP packet stream on the local network while driving. The packet specification is published annually:  
**F1 24**: [https://answers.ea.com/t5/General-Discussion/F1-24-UDP-Specification/td-p/13745220](https://answers.ea.com/t5/General-Discussion/F1-24-UDP-Specification/td-p/13745220)

Available channels (~60 total), including:

- Suspension travel (FL/FR/RL/RR)
- Tyre surface and inner temperatures per corner
- Brake temperatures
- Car damage state

This is useful as an **OEM-grade reference for what a full telemetry surface looks like**, and as a benchmark for what our own WASM telemetry channels should eventually cover. It is not real-F1 data — it reflects the game's physics simulation, not actual on-track measurements.

---

### OpenF1.org

**Source**: [https://openf1.org](https://openf1.org)  
**Docs**: [https://openf1.org/#introduction](https://openf1.org/#introduction)

OpenF1 provides a REST API and GraphQL endpoint over the F1 timing data, with lower overhead than FastF1 for simple one-shot queries. It is particularly useful for fetching a single driver's position trace for a specific session without pulling the full FastF1 session object.

Example: fetch Hamilton's position for lap 12 of the 2024 British GP:

```
GET https://api.openf1.org/v1/position?session_key=9158&driver_number=44&lap_number=12
```

The position data is in track-frame coordinates (same caveats as FastF1 re: calibration).

---

### MotoGP Equivalents

Out of scope. MotoGP does not use the same circuits and has different circuit geometries. Mentioned here only as a pointer: [https://www.motogp.com/en/stats](https://www.motogp.com/en/stats).

---

### How We Could Use This in the Future

All suggestions below are **NOT IMPLEMENTED** in the current pipeline.

**1. Reference racing line** (NOT IMPLEMENTED)

Sample the `X`, `Y` position trace from FastF1 at 5 m spacing. Apply the affine calibration (once computed) to convert from track-frame to our world coordinate system. Overlay the result as a debug line in the in-app track editor to visually compare against the centerline.

**2. Reference braking points** (NOT IMPLEMENTED)

Sample the `Brake` channel against `X`, `Y` position. Identify the lap-fraction at which heavy braking begins on each long straight. Use those fractions to inform placement of future barrier objects — long straights currently have no barriers because the physics engine does not enforce run-off zones. Real braking points would identify where barriers matter most.
