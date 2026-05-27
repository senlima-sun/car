// FIA 2026 chassis spec.
pub const CAR_MASS_DRY: f32 = 768.0;
#[deprecated(note = "use CAR_MASS_DRY + live fuel mass via CarPhysicsState::live_mass_kg()")]
pub const CAR_MASS: f32 = CAR_MASS_DRY;
pub const WHEELBASE: f32 = 3.40;
pub const TRACK_WIDTH_FRONT: f32 = 1.9;
pub const TRACK_WIDTH_REAR: f32 = 1.8;

/// Visual wheel half-widths (front 381mm, rear 400mm in client `dimensions.ts`).
/// Pirelli's 2026 contact patches are narrower (280/375mm) but a user
/// reading the screen sees the *visual rim + sidewall*, so the off-track
/// trigger must match what they see — otherwise the snapshot shows a
/// tire still on the line while the engine reports off-track.
/// Mirrors apps/game/src/constants/dimensions.ts WHEEL_WIDTH_FRONT/REAR.
pub const TIRE_HALF_WIDTH_FRONT: f32 = 0.1905;
pub const TIRE_HALF_WIDTH_REAR: f32 = 0.200;
#[deprecated(note = "use TRACK_WIDTH_FRONT or TRACK_WIDTH_REAR")]
pub const TRACK_WIDTH: f32 = TRACK_WIDTH_FRONT;
pub const CG_HEIGHT: f32 = 0.35;
pub const WEIGHT_DIST_FRONT: f32 = 0.47;

pub const BASE_MAX_SPEED: f32 = 97.0;

// Pirelli C1-C5 dry-slick peak μ ≈ 1.75 (published datasheets).
pub const PHYSICAL_PEAK_TIRE_MU: f32 = 1.75;
// Residual calibration gain compensating for missing physics (cold-
// rubber drag double-application, camber thrust, Mz, ...). Drive
// this toward 1.0 as missing physics lands. Private — downstream
// code must use `BASE_TIRE_GRIP_COEFFICIENT` to avoid double-applying.
const MODEL_RESIDUAL_GAIN: f32 = 1.43;
pub const BASE_TIRE_GRIP_COEFFICIENT: f32 = PHYSICAL_PEAK_TIRE_MU * MODEL_RESIDUAL_GAIN;

/// Audit hook for the residual calibration gain. Telemetry and tests
/// can inspect this; runtime physics should keep using
/// `BASE_TIRE_GRIP_COEFFICIENT` so the residual is applied exactly once.
pub const fn model_residual_gain_audit() -> f32 {
    MODEL_RESIDUAL_GAIN
}

pub const BASE_DRAG_COEFFICIENT: f32 = 0.74;
pub const BASE_DOWNFORCE_COEFFICIENT: f32 = 3.2;
/// Front-axle share of the base downforce coefficient. 40/60 F/R
/// matches typical 2026 F1 setup. Sums to `BASE_DOWNFORCE_COEFFICIENT`.
pub const BASE_DOWNFORCE_COEFFICIENT_FRONT: f32 = 1.28;
pub const BASE_DOWNFORCE_COEFFICIENT_REAR: f32 = 1.92;
pub const BASE_BRAKE_FORCE: f32 = 42000.0;
pub const BASE_ENGINE_BRAKE: f32 = 2500.0;

/// 2026 FIA PU reg: MGU-K peak output. Single source of truth shared
/// by the ERS deploy stream and the Overtake Mode boost so the two
/// can't desync.
pub const MGUK_PEAK_POWER_W: f32 = 350_000.0;

pub const DRIFT_ENTRY_SLIP_ANGLE: f32 = 14.0;
pub const DRIFT_EXIT_SLIP_ANGLE: f32 = 8.0;
pub const MIN_DRIFT_SPEED: f32 = 30.0;
