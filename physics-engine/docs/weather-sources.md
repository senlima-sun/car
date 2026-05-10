# Weather Source Field

## What it is

A sparse 2D field of moving "weather sources" used to make the sky and rain
state spatially non-uniform across a track. Each source is a 2D point on the
ground plane (X/Z) with a radius, intensity (0..1), and velocity vector.

Defined in `physics-engine/src/weather.rs`:

- `WeatherSource { position: (f32, f32), radius: f32, intensity: f32, velocity: (f32, f32) }`
- `WeatherSourceField { sources: Vec<WeatherSource>, max_sources: usize }`
- `MAX_WEATHER_SOURCES = 8`
- `WEATHER_SOURCE_BOUND = 2000.0` (meters)

## What it does

The field is integrated each `WeatherState::update(dt)` call. Sources drift
with their velocity vector. A source whose position exceeds the bound is
respawned at the opposite edge along its velocity direction (so a front
moving east leaves the east edge and re-enters from the west, preserving
direction).

`sample_intensity(x, z)` returns the summed contribution of all sources at
the given world point:

```
intensity_at(p) = clamp(Σ_i source_i.intensity * smoothstep(r*0.7, r, dist), 0, 1)
```

Inside `radius * 0.7` of a source the contribution is full strength; between
`r * 0.7` and `r` it tapers smoothly to 0; outside `r` it is 0.

## What it does NOT do (v1)

- Sources are **render-only** in v1. The global `rainIntensity` /
  `precipitation_rate_mmh` are still authoritative for tire grip,
  track wetness, brake dampness, etc. (`weather.rs::update_surface_state`,
  `weather.rs::compute_modifiers_from_physics`).
- They do not influence `track_temperature` rubber/water cells.
- They do not couple to wind direction; sources have their own velocity.

## TS API

`src/wasm/PhysicsBridge.ts`:

```ts
interface WeatherSource { x; z; radius; intensity; vx; vz }
addWeatherSource(s: WeatherSource): boolean
clearWeatherSources(): void
replaceWeatherSources(sources: WeatherSource[]): void
getWeatherSources(): WeatherSource[]
getWeatherSourceCount(): number
sampleWeatherIntensity(x: number, z: number): number
getWeatherSourceMax(): number
```

All functions are mirrored on `usePhysics()` via `PhysicsContextValue`.

## TS state mirror

`src/stores/useWeatherSourcesStore.ts` holds the latest sources array.
`src/components/canvas/Weather/WeatherSourcesProvider.tsx` polls
`physics.getWeatherSources()` at 10 Hz with shallow-equal guard and writes
into the store. Shaders and UI subscribe to the store, never call WASM
directly per-frame.

## Sky shader sampling

`src/shaders/volumetricClouds.ts` declares `uWeatherSources[MAX_WEATHER_SOURCES]`
(vec4 per source: x, z, radius, intensity) and `uWeatherSourceCount`.
`sampleSourceField(worldXZ)` reproduces the Rust math exactly — the
raymarcher samples it inside `cloudDensity()` to thicken cloud coverage
locally where weather sources exist.

The procedural `src/shaders/skyDome.ts` does NOT consume sources directly;
the cloud raymarcher is the layer that visualizes them.

## UI authoring

`src/components/ui/WeatherPanel/`:

- `RadarMinimap`: canvas overlay drawing live sources as radial-gradient
  blobs over the track bounds.
- `WeatherFrontEditor`: pointer-driven polyline drawer that arc-length
  resamples user paths to N sources via `frontPath.ts::pathToSources`.
  Velocity defaults to perpendicular-to-path × speed knob.
- `WeatherPanel`: F7 toggle, side-by-side radar + editor.

Mounted in HUD under the existing testing-mode gate.
