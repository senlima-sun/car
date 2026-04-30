# Physics Engine — Performance & Behaviour Notes

This file tracks deliberate behaviour and performance contracts across
waves. Each wave records its scope, what was deliberately rebaselined,
and what was held bit-equivalent.

## Wave 2 — FFI flat-array refactor + lifecycle cleanups

- `step_and_sync_packed` (Float32Array(25) + u32 input bits) replaces six
  `serde_wasm_bindgen::from_value` calls per frame.
- `WheelSpinIntegrator` extracted as a pure struct in
  `physics-engine/src/car_physics/wheel_spin.rs`.
- Three NaN root causes closed (acos/asin clamps, sigma_sq guard).
- `environmental_grip_modifier` plumbed into the longitudinal grip path;
  `combined_grip` (full chain) feeds the lateral path. The deliberate
  split protected launch performance from double-applying the material
  and thermal-shock multipliers — Wave 3 collapses the split (see
  Phase 6 below).
- Cargo profile tightened (LTO, codegen units, opt-level).
- Calibration: `tests/calibration_strict.rs` enforces ±0.5% on the
  three Wave 1 dry baselines.

## Wave 3 — Vehicle Dynamics Depth (complete)

### Phase scope and rebase contract

| Phase | Behaviour-change? | Notes |
| --- | --- | --- |
| Phase 0 | No (additive) | Captures pre-Wave-3 baselines + adds `PerWheelForces` telemetry surface (zero-default). |
| Phase 1 | No (refactor) | Renames `WheelSpinIntegrator` → `WheelForceIntegrator`; promotes per-wheel Fy as a telemetry-only observable. Friction-ellipse cap stays as `(fx, 0)` to preserve bit-equivalence on Fx. |
| Phase 2 | **Yes** — first deliberate behaviour change | Pacejka Gx/Gy combined-slip weighting replaces the friction-ellipse-only cap. Ellipse stays as a defensive guard. New baselines captured. |
| Phase 3 | No (read-only) when ride-height ≈ optimal; **drift expected** at extreme ride heights | Adds `ground_effect_multiplier(ride_height_m)` curve and per-axle ride-height EMA smoother. JS forwards suspension-derived per-axle ride heights via the FFI payload (extends 25 → 27 floats, backward-compatible). |
| Phase 4 | **Yes** | Splits downforce into front/rear with asymmetric DRS (rear unloads only). Lateral g on DRS-active sections drops 5–10% (intended). |
| Phase 5 | **Yes** | Engine inertia reflected through gear ratio² with minimum-viable clutch; implicit-Euler integration for driven wheels; ERS power-limited (`P/v`) and routed through rear-axle drive torque (grip-limited). |
| Phase 6 | **Yes** | Lateral grip-stack unification — `environmental_grip_modifier` removed; longitudinal and lateral both multiply the same `combined_grip` chain. Wet/cold longitudinal becomes more aggressive (intended). |
| Phase 7 | Calibration gate | New 8-scenario `wave_3_baselines.json` becomes the strict ±0.5% gate. Wet/oil contract is intentional-drift from Phase 0. |

### Calibration tolerance through Wave 3

- Phase 0 / Phase 1: Wave 2 strict gate (±0.5% on dry) preserved.
- Phase 2 – Phase 6: relaxed to ±10% on dry against the Wave 2 baseline
  (each phase deliberately shifts behaviour). Wet/oil drift is observed
  but not gated until Phase 7.
- Phase 7: tightens back to ±0.5% against the new Wave 3 baseline.

### Behaviour contracts

- Phase 4 DRS-active scenarios: 5–10% lateral g drop versus Corner mode
  on the same speed/radius is the contract. Below 3% means the split is
  too weak; above 15% means too strong. Tune `DRS_REAR_MULT` (default
  0.42).
- Phase 5 0–100 km/h time: 10–20% slowing versus Phase 0 baseline is
  expected (engine inertia adds rotating mass; ERS becomes grip-limited).
- Phase 5 ERS: at v < 5 m/s a body-frame fallback at 30% of
  `MAX_ERS_BOOST_N` keeps launches responsive; above 5 m/s ERS routes
  through the rear-axle drive torque.
- Phase 6 launch-on-cold-rubber: longitudinal grip now sees the full
  material × thermal-shock chain. Calibration tuning lives in
  `BASE_TIRE_GRIP_COEFFICIENT`; do not re-introduce the Wave 2 split.

### Performance budget

- Wave 3 adds: 2 floats to the FFI payload (per-axle ride-height); EMA
  smoother; G-method math (4 trig calls per wheel per step); clutch
  state; reflected engine inertia; per-axle downforce split; unified
  grip stack.
- Phase 7 perf snapshot allows up to +5% versus the Wave 2 final p50.
  Hard-fail blocks merge if exceeded; profile the G-method math first.

### Wave 4 migration footprint (Phase 0 Step 0.3)

#### `TRACK_WIDTH` (car axle gauge — Phase 2 split into front/rear)

Note: JS-side `TRACK_WIDTH` (12 m, in `src/constants/dimensions.ts`) is the
**road surface width**, NOT the car axle gauge — leave untouched. The car
axle gauge in JS is `TRACK_GAUGE_FRONT` / `TRACK_GAUGE_REAR` (already
split at 1.52 / 1.53 m); update those values to 2026 spec (1.9 / 1.8 m)
in Phase 2.

Rust touchpoints (must split into `TRACK_WIDTH_FRONT` / `_REAR`):
- `physics-engine/src/constants/car.rs` — declaration
- `physics-engine/src/car_physics/weight_transfer.rs` — `lat_transfer` formula uses single `TRACK_WIDTH`
- `physics-engine/src/engine.rs:1050` — `half_track = TRACK_WIDTH / 2.0`

JS touchpoints (update gauge constants to 2026 spec only):
- `src/constants/dimensions.ts` — `TRACK_GAUGE_FRONT`, `TRACK_GAUGE_REAR`, `TRACK_GAUGE` alias

#### `TIRE_RADIUS` (Phase 3 cascade 0.33 → 0.36 m)

Rust touchpoints:
- `physics-engine/src/car_physics/powertrain.rs` — declaration + 4 `wheel_rpm` / `drive_force` / `max_speed_in_gear` callers
- `physics-engine/src/car_physics/mod.rs:342` — `pt_out.drive_force * TIRE_RADIUS * AXLE_TO_CORNER_SPLIT`
- `physics-engine/src/car_physics/wheel_force.rs` — 8 callers in `step` + 4 callers in tests
  (`omega_cap`, kinematic ω, brake torque, tire reaction, slip ratio, target ω in tests)

JS touchpoints (already at 0.37; bump to 0.36 to align with Rust 2026 spec):
- `src/constants/dimensions.ts:8` — `WHEEL_RADIUS` declaration
- `src/components/canvas/Car/Car.tsx` — 4 `BallCollider` `args={[WHEEL_RADIUS]}` consumers
- `src/components/canvas/Car/hooks/useCarTelemetryLogging.ts` — `wheelRadius` local
- `src/components/canvas/Car/hooks/useRaycastSuspension.ts` — `REST_LENGTH` + `wheelBottomY`
- `src/components/canvas/Preview/PreviewScene.tsx` — preview placement Y
- `src/components/canvas/TrackObjects/StartGrid.tsx` — if present

### Outcome

Wave 3 closed with the new strict ±0.5% gate against the post-Phase-7
baseline (`tests/fixtures/wave_3_baselines.json`, 8 scenarios).
Verification at wave-end:

- 453 lib + 8 strict_calibration + 9 calibration_drift + 4 soak
  (incl. 10k combined-slip-stress) + 14 wheel_spin + 12 stability +
  remaining suites all green
- 301 JS tests pass
- 82k-step NaN soak deterministic across 3 back-to-back runs
- WASM release build clean
- Wave-end review (`code-reviewer` agent) findings addressed; final
  `/simplify` pass clean

Calibration drift contracts (post-Wave-3 vs. pre-Wave-3 baseline):
- 0-100 km/h          : 2.87 → 3.66 s   (+27%, engine inertia)
- 50 m/s stop         : 40.16 → 38.45 m (-4%, engine braking via clutch)
- 80m lat-g           : 9.92 → 9.94      (essentially unchanged)
- DRS 200-300 km/h    : 4.94 → 6.32 s   (+28%, engine inertia in low gears)
- 100 km/h stop       : 16.80 → 14.42 m (-14%)
- Wet 50 m/s stop     : 70.23 → 65.81 m (-6%)
- Wet 80m lat-g       : 7.54 → 8.34     (+11%, peer-load-grip interplay)
- Oil 80m lat-g       : 7.40 → 8.37     (+13%)

Wave 4 backlog (from Phase 7 wave-end review):
- Normalise `material_grip_avg` to start at 1.0 (warm) so
  `BASE_TIRE_GRIP_COEFFICIENT` retains physical meaning (currently
  3.5, absorbs both baseline μ and inverse cold-rubber compensation).
- Swap JS `axleRideHeights` from suspension compression to true
  chassis-bottom-to-ground meters once the suspension model exposes
  the absolute ride height.
- G-method sign-coupling smoothness near `slip_ratio = 0` zero-cross.
- DRS `drs_enabled` flag gating on actual rear-wing-angle threshold
  vs. zone+mode flag.
- Force-shaped `calculate_turn_dynamics_from_lateral_force` consumer
  switch — needs chassis dynamics re-architecture to solve the
  bootstrap chicken-and-egg.
