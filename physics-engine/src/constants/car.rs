// FIA 2026 minimum mass without fuel: 768 kg (with driver).
// Live in-race mass = CAR_MASS_DRY + fuel_mass_kg (see fuel.rs).
pub const CAR_MASS_DRY: f32 = 768.0;
#[deprecated(note = "use CAR_MASS_DRY + live fuel mass via CarPhysicsState::live_mass_kg()")]
pub const CAR_MASS: f32 = CAR_MASS_DRY;
// FIA 2026 Technical Regulations Article 3: maximum wheelbase 3400 mm
// (down from 3600 mm in 2022-2025 regs). Sources:
// https://www.fia.com/sites/default/files/fia_2026_formula_1_technical_regulations_issue_8_-_2024-06-24.pdf
pub const WHEELBASE: f32 = 3.40;

// Wave 4 Phase 2: 2026 F1 widened track per FIA Technical Regs.
// Front axle 1.9 m, rear 1.8 m (2025 was a single 1.525 m). Lateral
// roll-moment arms differ per axle, so weight_transfer.rs splits the
// computation. The single `TRACK_WIDTH` constant stays for one wave
// as a backwards-compat alias (= front gauge) for any external WASM
// caller; Wave 5 removes it after the deprecation window.
pub const TRACK_WIDTH_FRONT: f32 = 1.9;
pub const TRACK_WIDTH_REAR: f32 = 1.8;
#[deprecated(note = "use TRACK_WIDTH_FRONT or TRACK_WIDTH_REAR (Wave 4 Phase 2)")]
pub const TRACK_WIDTH: f32 = TRACK_WIDTH_FRONT;
pub const CG_HEIGHT: f32 = 0.35;
pub const WEIGHT_DIST_FRONT: f32 = 0.47;

pub const BASE_MAX_SPEED: f32 = 97.0;

// Pirelli C1-C5 dry-slick peak μ ≈ 1.75 (published datasheets).
pub const PHYSICAL_PEAK_TIRE_MU: f32 = 1.75;
// Residual calibration multiplier compensating for missing physics:
// cold-rubber drag double-application, missing camber thrust,
// missing Mz, etc. Goal: drive this toward 1.0 as the missing
// physics lands (tracked across waves). Auditable via this name.
pub const MODEL_RESIDUAL_GAIN: f32 = 1.43;
// Combined coefficient used by Pacejka cap and yaw-path grip
// scaling. Identical numeric value to the previous 2.5 magic to
// preserve calibration; the split makes the residual auditable.
pub const BASE_TIRE_GRIP_COEFFICIENT: f32 = PHYSICAL_PEAK_TIRE_MU * MODEL_RESIDUAL_GAIN;
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
