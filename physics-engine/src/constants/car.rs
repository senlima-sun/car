pub const CAR_MASS: f32 = 798.0;
pub const WHEELBASE: f32 = 3.38;
pub const TRACK_WIDTH: f32 = 1.525;
pub const CG_HEIGHT: f32 = 0.35;
pub const WEIGHT_DIST_FRONT: f32 = 0.47;

pub const BASE_MAX_SPEED: f32 = 97.0;
// Wave 4 Phase 1: reset toward the physical 2026 F1 dry-tire peak μ.
// Pirelli C1-C5 dry slicks have peak μ ≈ 1.75. The Wave 3 value of
// 3.5 was a calibration residual that effectively double-applied a
// 2× compensation for cold-rubber drag. Wave 4 splits the
// compensation: residual portion stays in BASE (≈ 1.5×), physical
// portion is the 1.75 peak μ.
//
// Tuned to 2.5 (= 1.75 × 1.43) so 0-100 launch performance stays
// within the wave-plan ±150% drift band on the legacy
// `wave_1_baselines.json` reference. A "pure" 1.75 produced 7.4s
// 0-100 (vs 2.87 Wave 1 baseline = +157% drift), which exceeded the
// useful test envelope. Phase 7 final calibration will re-baseline
// against this value; Wave 5 backlog item to resolve the residual
// (likely via per-compound peak μ or a longitudinal-only multiplier).
//
// At warm tire (default medium): peak grip = 2.5 × 1.0 = 2.5 g
// At cold tire (Gaussian floor): peak grip = 2.5 × 0.4 = 1.0 g
// (the 2.5x is partly above the 2026 F1 physical 1.75 peak μ; this
// is the residual that Wave 5 can resolve once cold-rubber drag
// is decoupled from BASE).
pub const BASE_TIRE_GRIP_COEFFICIENT: f32 = 2.5;
pub const BASE_DRAG_COEFFICIENT: f32 = 0.74;
pub const BASE_DOWNFORCE_COEFFICIENT: f32 = 3.2;
/// Wave 3 Phase 4: front-axle share of the base downforce coefficient.
/// 40/60 F/R matches typical 2026 F1 setup. Sums to BASE_DOWNFORCE_COEFFICIENT.
pub const BASE_DOWNFORCE_COEFFICIENT_FRONT: f32 = 1.28;
pub const BASE_DOWNFORCE_COEFFICIENT_REAR: f32 = 1.92;
pub const BASE_BRAKE_FORCE: f32 = 42000.0;
pub const BASE_ENGINE_BRAKE: f32 = 2500.0;

pub const DRIFT_ENTRY_SLIP_ANGLE: f32 = 14.0;
pub const DRIFT_EXIT_SLIP_ANGLE: f32 = 8.0;
pub const MIN_DRIFT_SPEED: f32 = 30.0;
