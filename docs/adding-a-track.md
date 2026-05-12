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

To read the coordinates: in the OSM URL bar you will see `#map=<zoom>/<lat>/<lon>`. Use the **Export** tab on the left sidebar and read the four coordinate fields labelled "left", "right", "top", "bottom" — these correspond to `west`, `east`, `north`, `south` respectively.

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
