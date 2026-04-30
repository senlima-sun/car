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

## Wave 3 — Vehicle Dynamics Depth (in progress)

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
  state; implicit Euler.
- Phase 7 perf snapshot allows up to +5% versus the Wave 2 final p50.
  Hard-fail blocks merge if exceeded; profile the G-method math first.
