# Zandvoort Curb Calibration

## Target

Use Circuit Zandvoort as the first curb alignment pilot. The current preset source is `apps/game/src/constants/tracks/sources/zandvoort.json`; it has one centerline path, checkpoints, and a first-pass `curbs` array derived from PDOK 2025 aerial imagery.

## Primary Sources

1. PDOK Luchtfoto RGB Open
   - Best source for curb placement.
   - Public RGB aerial imagery from Dutch public authorities.
   - Summer imagery is 25 cm resolution; winter imagery is 8 cm and partly 5 cm resolution.
   - WMTS: `https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0?request=GetCapabilities&service=WMTS`
   - WMS: `https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0?request=GetCapabilities&service=WMS`
   - License: CC BY per PDOK 2025 publication note.

2. FIA licensed circuit list
   - Validation reference, not curb geometry.
   - Zandvoort is listed as FIA Grade 1, 4.259 km, left pole, 10 m reference width.

3. OpenStreetMap
   - Existing source provenance and useful centerline seed.
   - Not precise enough for curb start and end positions.

4. Mapbox Satellite
   - Secondary visual cross-check.
   - Use as fallback where PDOK imagery has seasonal shadowing or stale construction state.

## Calibration Gates

1. Georeference
   - Center: `52.3889, 4.5408` from `scripts/circuits/zandvoort.config.json`.
   - Use start-finish, pit entry, pit exit, Tarzanbocht, Hugenholtzbocht, Scheivlak, Audi S, and Arie Luyendykbocht as control regions.
   - Reject alignment if stable control points drift more than 1 m after transform.

2. Scale
   - FIA lap distance target: 4259 m.
   - Current source length: 4242 m.
   - Acceptable pilot target: within 1% before curb placement; within 0.5% after path correction.

3. Curb Placement
   - Store curbs in `zandvoort.json` as `CurbMarker[]`.
   - Use `pathStart` and `pathEnd` in editor path coordinates.
   - Include required `id` and `pathId` fields.
   - Use `edge: "left" | "right"` relative to the path tangent/ribbon side, not `raceDirection`.
   - Use `variant`:
     - `apex` for raised attack curbs.
     - `exit` for exit curbs with larger runoff transition.
     - `flat` for painted or low-profile strips.

4. Confidence
   - `0.9`: visible on 5-8 cm PDOK imagery and confirmed against Mapbox or recent race footage.
   - `0.8`: visible on 25 cm PDOK imagery.
   - `0.65`: only visible on Mapbox or imagery date is uncertain.
   - `0.4`: inferred from corner geometry.

## Implementation Plan

1. Add a geospatial overlay mode for the editor or a one-off import script that can display PDOK WMTS under the existing path.
2. Convert sampled PDOK/WebMercator click coordinates to the local track coordinate frame used by `zandvoort.json`.
3. Digitize curb intervals per corner as source-space polylines or start/end clicks.
4. Project each curb click onto the current path and emit full `CurbMarker` intervals with `id`, `pathId`, `pathStart`, `pathEnd`, `edge`, and `variant`.
5. Add `curbs` to `zandvoort.json`.
6. Run `pnpm -w run track:validate-source zandvoort`.
7. Preview `/track-preview/f1_zandvoort` and verify no curb intervals jump sides or wrap across start-finish.

## First Pass Corners

Prioritize visually distinctive curb zones:

1. Tarzanbocht
2. Hugenholtzbocht
3. Hunserug into Rob Slotemakerbocht
4. Scheivlak
5. Mastersbocht
6. Audi S
7. Kumhobocht
8. Arie Luyendykbocht

## Validation Note

The Zandvoort validation reference has been aligned before curb application:

- FIA 2025 reference length: 4259 m.
- Current source length: 4242 m.
- Start heading reference: `-22.5°`, matching the current source checkpoint heading.
