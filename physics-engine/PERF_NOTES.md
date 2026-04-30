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

## Wave 4 — 2026 F1 Spec Alignment + Real-Physics Grounding (complete)

### Outcome

Wave 4 closed with the new 8-scenario `wave_4_baselines.json` promoted
to the strict ±0.5% gate. Verification at wave-end:

- 461 lib + 8 strict_calibration + 9 calibration_drift + 5 soak (incl.
  Override-toggle stress) + 14 wheel_spin + ... all green
- 301 JS tests pass
- 92k-step NaN soak deterministic across 3 back-to-back runs
- WASM release build clean
- `code-reviewer` agent dispatched between every phase; findings
  logged. Wave 5 backlog updated.

Calibration drift contracts (post-Wave-4 vs. pre-Wave-4 baseline):
- 0-100 km/h          : 3.66 → 2.29 s   (-37%, F1-realistic launch)
- 50 m/s stop         : 38.45 → 48.65 m (+27%, BASE reset compounds)
- 80m lat-g           : 9.94 → 9.94      (essentially unchanged)
- DRS 200-300 km/h    : 6.32 → 4.85 s   (-23%, +PEAK_TORQUE bumps)
- 100 km/h stop       : 14.42 → 18.59 m (+29%)
- Wet 50 m/s stop     : 65.81 → 82.23 m (+25%)
- Wet 80m lat-g       : 8.34 → 8.83     (+6%)
- Oil 80m lat-g       : 8.37 → 8.59     (+3%)

2026 F1 spec alignment delivered:
- CAR_MASS 768 kg (was 798) — FIA Tech Regs 2026 minimum
- TRACK_WIDTH per-axle: 1.9 m front, 1.8 m rear
- TIRE_RADIUS 0.36 m (Pirelli 720mm OD spec)
- PEAK_TORQUE_NM 480 (was 380) — 1.6L V6 turbo hybrid
- BASE_TIRE_GRIP_COEFFICIENT 2.5 (was 3.5; physical peak μ ≈ 1.75 with documented residual)
- Override Mode (350 kW MGU-K, 0.5 MJ/lap budget) replaces DRS asymmetry
- LAP_RECOVERY_CAP_MJ + LAP_DEPLOY_CAP_MJ both 9.0 (FIA 2026)
- Pacejka coefficients verified vs published F1 telemetry (peak μ ≈ 1.0,
  peak slip ≈ 5-7° = racing slick range)
- JS ride-height swapped from suspension compression to true
  chassis-bottom-to-ground meters

### Wave 5 backlog (from Wave 4 reviews)

- Decouple cold-rubber drag from `BASE_TIRE_GRIP_COEFFICIENT` so the
  constant retains physical meaning (~1.75); per-compound peak μ or
  longitudinal-only multiplier candidate paths.
- Add `lat_transfer_front` / `lat_transfer_rear` fields to
  `WeightTransferResult` so the integrator can use per-axle lateral
  Fz transfer (currently aggregated, hides the per-axle physics).
- Add `lap_deploy_cap_reached: bool` field to `ErsState` so HUD can
  surface deploy-cap status (mirror of `lap_recovery_cap_reached`).
- Migrate AeroMode enum to ZMode/XMode (or fully remove the
  `Drs` variant); update legacy DRS WASM exports.
- BASE_MAX_SPEED hard-cap is doing physics work that aero drag
  should do; re-tune drag/downforce constants once peak torque
  settles.
- Promote `reset_powertrain_for_launch` to either `#[cfg(test)]` or
  define the full game-mode-transition reset contract.
- Wave 4 Phase 1 launch-RPM fix: gate fires at ~0.93 m/s in 1st gear;
  document speed equivalence in the comment.
- Tighten `phase_5_x_mode_symmetric_downforce` asymmetry bound from
  10% to ~2% (current setup produces near-zero asymmetry).
- Refactor `test_lap_recovery_cap_at_9mj` to exercise the actual guard
  path (not just the cap-flag assignment).
- Clamp `lap_deployed_mj` at the cap boundary (currently overshoots
  by ~15-20 kJ per tick).

### Phase scope and rebase contract

| Phase | Behaviour-change? | Notes |
| --- | --- | --- |
| Phase 0 | No (additive) | Captures pre-Wave-4 baselines; documents migration footprint. |
| Phase 1 | **Yes** — first deliberate behaviour change | Pacejka pure-slip coefficients re-derived to physical 2026 F1 dataset (peak μ ≈ 1.75); `material_grip_avg` normalised to warm-baseline (cold becomes a subtractive penalty); `BASE_TIRE_GRIP_COEFFICIENT` reset 3.5 → ~1.75 to match physical peak μ. |
| Phase 2 | Behaviour-equivalent on flat dry-rest, **drift expected** in cornering | `CAR_MASS` 798 → 768 kg (2026 minimum); `TRACK_WIDTH` split into per-axle `_FRONT` (1.9 m) / `_REAR` (1.8 m); migrate `weight_transfer` and downstream consumers. |
| Phase 3 | **Yes** — slip-ratio path | `TIRE_RADIUS` 0.33 → 0.36 m (Pirelli 2026 spec, 720mm OD); cascades into wheel-rpm, slip-ratio, drive-force, suspension geometry. |
| Phase 4 | **Yes** | `PEAK_TORQUE_NM` 380 → 480 (2026 ICE spec); top speed re-validates to 320-360 km/h envelope with Override Mode. |
| Phase 5 | **Yes** — additive aero + powertrain mode | DRS replaced by Override Mode (350 kW MGU-K boost, no zone gate); `AeroMode` renamed to Z-mode (Corner) / X-mode (both wings movable straight); legacy `Drs` enum alias for one wave. |
| Phase 6 | Gate-only | `LAP_RECOVERY_CAP_MJ` 8.5 → 9.0; new `LAP_DEPLOY_CAP_MJ` 9.0; cap-trigger test verifies budget exhaustion. |
| Phase 7 | Calibration gate | New 8-scenario `wave_4_baselines.json` becomes strict ±0.5% gate. JS `axleRideHeights` swap to true chassis-bottom-to-ground meters. |

### Calibration tolerance through Wave 4

- Phase 0: Wave 3 strict gate (±0.5%) preserved.
- Phase 1: relaxed to ±20% on dry (Pacejka coefficient overhaul).
- Phase 2-6: relaxed to ±25% on dry (cumulative drift through behaviour-change phases).
- Phase 7: tightens back to ±0.5% against new Wave 4 baseline.

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
