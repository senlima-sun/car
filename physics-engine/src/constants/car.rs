pub const CAR_MASS: f32 = 798.0;
pub const WHEELBASE: f32 = 3.38;
pub const TRACK_WIDTH: f32 = 1.525;
pub const CG_HEIGHT: f32 = 0.35;
pub const WEIGHT_DIST_FRONT: f32 = 0.47;

pub const BASE_MAX_SPEED: f32 = 97.0;
// Wave 3 Phase 6 calibration tuning: lateral grip-stack unification
// pushed material_grip_avg (cold rubber, ~0.5-0.7 dry) into the
// longitudinal path as well as the lateral. Without compensating
// `BASE_TIRE_GRIP_COEFFICIENT`, 0-100 km/h launches collapsed by ~140%.
// Bumped from 1.85 → 3.5 to restore launch performance within the
// wave-plan ±30% drift band on dry. Single-knob calibration adjustment
// per the wave plan; no model change.
pub const BASE_TIRE_GRIP_COEFFICIENT: f32 = 3.5;
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
