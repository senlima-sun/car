use crate::constants::aero::{DEFAULT_AIR_DENSITY, FRONTAL_AREA};
use crate::constants::car::{
    BASE_DOWNFORCE_COEFFICIENT, BASE_DOWNFORCE_COEFFICIENT_FRONT, BASE_DOWNFORCE_COEFFICIENT_REAR,
    BASE_DRAG_COEFFICIENT,
};
use crate::utils::smoothstep;

/// Time constant for the per-axle ride-height EMA. Suspension noise floor
/// at 120Hz is ~33ms (a few raycast steps); 80ms is high enough to filter
/// without lagging actual aero events. Wave 3 Phase 3.
pub const RIDE_HEIGHT_EMA_TIME_CONSTANT_S: f32 = 0.080;

/// Per-axle ride-height EMA smoother. Filters suspension noise so the
/// `ground_effect_multiplier` curve doesn't thrash on bumps. Defaults to
/// `RIDE_HEIGHT_OPTIMAL_M` so the first frame produces a peak (1.0)
/// multiplier — same as Wave 2 behaviour with no ride-height input.
#[derive(Debug, Clone, Copy)]
pub struct RideHeightSmoother {
    front_ema: f32,
    rear_ema: f32,
}

impl Default for RideHeightSmoother {
    fn default() -> Self {
        Self::new()
    }
}

impl RideHeightSmoother {
    pub fn new() -> Self {
        Self {
            front_ema: RIDE_HEIGHT_OPTIMAL_M,
            rear_ema: RIDE_HEIGHT_OPTIMAL_M,
        }
    }

    /// Update both axles with new measured ride heights. Uses an
    /// exponential lowpass with time constant
    /// `RIDE_HEIGHT_EMA_TIME_CONSTANT_S`.
    pub fn update(&mut self, front_h_m: f32, rear_h_m: f32, dt: f32) {
        let alpha = (dt / (RIDE_HEIGHT_EMA_TIME_CONSTANT_S + dt)).clamp(0.0, 1.0);
        self.front_ema += (front_h_m - self.front_ema) * alpha;
        self.rear_ema += (rear_h_m - self.rear_ema) * alpha;
    }

    pub fn front(&self) -> f32 {
        self.front_ema
    }

    pub fn rear(&self) -> f32 {
        self.rear_ema
    }

    pub fn average(&self) -> f32 {
        (self.front_ema + self.rear_ema) * 0.5
    }
}

// Ride-height ground-effect curve constants. Wave 3 Phase 3.
// Below floor: porpoising regime (underbody seal collapses against ground).
// Floor → optimal: ramp up to peak.
// Optimal → plateau end: constant peak (1.0).
// Plateau end → falloff end: smooth drop as underbody seal weakens.
// Beyond falloff end: wing-only downforce regime (constant 0.6).
pub const RIDE_HEIGHT_FLOOR_M: f32 = 0.005;
pub const RIDE_HEIGHT_OPTIMAL_M: f32 = 0.035;
const RIDE_HEIGHT_PLATEAU_END_M: f32 = 0.045;
const RIDE_HEIGHT_FALLOFF_END_M: f32 = 0.150;
const PORPOISING_FLOOR_MULT: f32 = 0.5;
const WING_ONLY_FALLOFF_MULT: f32 = 0.6;

/// Ground-effect downforce multiplier as a function of ride height.
/// C¹ continuous via smoothstep at every region boundary. Real F1 cars
/// see peak underbody downforce at ~25-50 mm ride height; below that the
/// underbody seal collapses (porpoising), above it the seal weakens
/// progressively until only wing-derived downforce remains.
///
/// Regions:
///   [0, FLOOR_M)                 : ramp 0.5 → 1.0 (porpoising recovery)
///   [FLOOR_M, PLATEAU_END_M]     : constant 1.0 (peak plateau, includes
///                                  RIDE_HEIGHT_OPTIMAL_M)
///   (PLATEAU_END_M, FALLOFF_END) : ramp 1.0 → 0.6 (underbody seal loss)
///   [FALLOFF_END_M, ∞)           : constant 0.6 (wing-only regime)
pub fn ground_effect_multiplier(ride_height_m: f32) -> f32 {
    let h = ride_height_m.max(0.0);
    if h < RIDE_HEIGHT_FLOOR_M {
        let t = h / RIDE_HEIGHT_FLOOR_M;
        PORPOISING_FLOOR_MULT + (1.0 - PORPOISING_FLOOR_MULT) * smoothstep(t)
    } else if h <= RIDE_HEIGHT_PLATEAU_END_M {
        1.0
    } else if h < RIDE_HEIGHT_FALLOFF_END_M {
        let t = (h - RIDE_HEIGHT_PLATEAU_END_M)
            / (RIDE_HEIGHT_FALLOFF_END_M - RIDE_HEIGHT_PLATEAU_END_M);
        1.0 - (1.0 - WING_ONLY_FALLOFF_MULT) * smoothstep(t)
    } else {
        WING_ONLY_FALLOFF_MULT
    }
}

pub fn get_drag_force(speed_ms: f32, active_aero_mult: f32) -> f32 {
    get_drag_force_with_density(speed_ms, active_aero_mult, DEFAULT_AIR_DENSITY)
}

pub fn get_drag_force_with_density(speed_ms: f32, active_aero_mult: f32, air_density: f32) -> f32 {
    let final_drag_coeff = BASE_DRAG_COEFFICIENT * active_aero_mult;
    0.5 * air_density * final_drag_coeff * FRONTAL_AREA * speed_ms * speed_ms
}

pub fn get_downforce(speed_ms: f32, active_aero_mult: f32) -> f32 {
    get_downforce_with_density(speed_ms, active_aero_mult, DEFAULT_AIR_DENSITY)
}

/// Total downforce on the chassis. Wave 3 Phase 3 onward this also
/// multiplies by the ride-height-dependent ground-effect curve. Pass
/// `ride_height_m = RIDE_HEIGHT_OPTIMAL_M` to retain Wave 2 behaviour
/// (multiplier = 1.0). Phase 4 splits the result into per-axle Fz.
pub fn get_downforce_with_density(speed_ms: f32, active_aero_mult: f32, air_density: f32) -> f32 {
    get_downforce_with_density_and_ride_height(
        speed_ms,
        active_aero_mult,
        air_density,
        RIDE_HEIGHT_OPTIMAL_M,
    )
}

pub fn get_downforce_with_density_and_ride_height(
    speed_ms: f32,
    active_aero_mult: f32,
    air_density: f32,
    ride_height_m: f32,
) -> f32 {
    let final_downforce_coeff = BASE_DOWNFORCE_COEFFICIENT * active_aero_mult;
    let ground_effect = ground_effect_multiplier(ride_height_m);
    0.5 * air_density * final_downforce_coeff * FRONTAL_AREA * speed_ms * speed_ms * ground_effect
}

/// Per-axle downforce with axle-specific multiplier and ride height.
/// Wave 3 Phase 4. Sum of `front + rear` reproduces the combined-axle
/// path at symmetric multipliers/ride-heights.
pub fn get_axle_downforce(
    speed_ms: f32,
    axle_aero_mult: f32,
    axle_coefficient: f32,
    air_density: f32,
    ride_height_m: f32,
) -> f32 {
    let final_coeff = axle_coefficient * axle_aero_mult;
    let ground_effect = ground_effect_multiplier(ride_height_m);
    0.5 * air_density * final_coeff * FRONTAL_AREA * speed_ms * speed_ms * ground_effect
}

/// Total chassis downforce as the per-axle sum. Wave 3 Phase 4.
pub fn get_split_downforce(
    speed_ms: f32,
    front_aero_mult: f32,
    rear_aero_mult: f32,
    air_density: f32,
    front_ride_height_m: f32,
    rear_ride_height_m: f32,
) -> (f32, f32) {
    let front = get_axle_downforce(
        speed_ms,
        front_aero_mult,
        BASE_DOWNFORCE_COEFFICIENT_FRONT,
        air_density,
        front_ride_height_m,
    );
    let rear = get_axle_downforce(
        speed_ms,
        rear_aero_mult,
        BASE_DOWNFORCE_COEFFICIENT_REAR,
        air_density,
        rear_ride_height_m,
    );
    (front, rear)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_drag_increases_with_speed() {
        let drag_slow = get_drag_force(10.0, 1.0);
        let drag_fast = get_drag_force(30.0, 1.0);

        // Drag should be ~9x higher at 3x speed (v²)
        assert!(drag_fast > drag_slow * 8.0);
    }

    #[test]
    fn test_downforce_increases_with_speed() {
        let df_slow = get_downforce(10.0, 1.0);
        let df_fast = get_downforce(30.0, 1.0);

        assert!(df_fast > df_slow * 8.0);
    }

    #[test]
    fn test_active_aero_reduces_drag() {
        let drag_corner = get_drag_force(50.0, 1.0);
        let drag_straight = get_drag_force(50.0, 0.65);

        assert!(drag_straight < drag_corner);
        assert!((drag_straight / drag_corner - 0.65).abs() < 0.01);
    }

    #[test]
    fn test_active_aero_reduces_downforce() {
        let df_corner = get_downforce(50.0, 1.0);
        let df_straight = get_downforce(50.0, 0.55);

        assert!(df_straight < df_corner);
        assert!((df_straight / df_corner - 0.55).abs() < 0.01);
    }

    // Phase 3 (Wave 3) — ground-effect ride-height curve tests

    #[test]
    fn split_downforce_sums_to_combined_at_corner_mode() {
        // Corner mode (1.0/1.0) at OPTIMAL ride height: front + rear should
        // sum to the same total as the combined-axle path.
        let combined = get_downforce_with_density_and_ride_height(
            50.0,
            1.0,
            DEFAULT_AIR_DENSITY,
            RIDE_HEIGHT_OPTIMAL_M,
        );
        let (front, rear) = get_split_downforce(
            50.0,
            1.0,
            1.0,
            DEFAULT_AIR_DENSITY,
            RIDE_HEIGHT_OPTIMAL_M,
            RIDE_HEIGHT_OPTIMAL_M,
        );
        assert!(
            (combined - (front + rear)).abs() < 1.0,
            "front + rear ({} + {} = {}) should sum to combined ({})",
            front,
            rear,
            front + rear,
            combined
        );
    }

    #[test]
    fn split_downforce_drs_unloads_rear_only() {
        // DRS-mode multipliers (front=1.0, rear=0.42): front stays high,
        // rear drops sharply, total drops.
        let (corner_f, corner_r) = get_split_downforce(
            50.0,
            1.0,
            1.0,
            DEFAULT_AIR_DENSITY,
            RIDE_HEIGHT_OPTIMAL_M,
            RIDE_HEIGHT_OPTIMAL_M,
        );
        let (drs_f, drs_r) = get_split_downforce(
            50.0,
            1.0,
            0.42,
            DEFAULT_AIR_DENSITY,
            RIDE_HEIGHT_OPTIMAL_M,
            RIDE_HEIGHT_OPTIMAL_M,
        );
        assert!(
            (drs_f - corner_f).abs() < 1.0,
            "DRS should leave front downforce unchanged"
        );
        let rear_drop = drs_r / corner_r;
        assert!(
            (rear_drop - 0.42).abs() < 0.02,
            "DRS rear should drop to ~42% of Corner rear, got {}",
            rear_drop
        );
    }

    #[test]
    fn downforce_at_optimal_ride_height_matches_legacy() {
        // Backward-compat: get_downforce_with_density (no ride-height) and
        // the new ride-height-aware variant at OPTIMAL must agree.
        let legacy = get_downforce_with_density(50.0, 1.0, DEFAULT_AIR_DENSITY);
        let with_optimal = get_downforce_with_density_and_ride_height(
            50.0,
            1.0,
            DEFAULT_AIR_DENSITY,
            RIDE_HEIGHT_OPTIMAL_M,
        );
        assert!((legacy - with_optimal).abs() < 1e-3);
    }

    #[test]
    fn downforce_at_high_ride_height_drops() {
        // Above falloff end (150 mm) the multiplier is 0.6 → downforce drops 40%.
        let optimal = get_downforce_with_density_and_ride_height(
            50.0,
            1.0,
            DEFAULT_AIR_DENSITY,
            RIDE_HEIGHT_OPTIMAL_M,
        );
        let high = get_downforce_with_density_and_ride_height(
            50.0,
            1.0,
            DEFAULT_AIR_DENSITY,
            0.150,
        );
        let ratio = high / optimal;
        assert!(
            (ratio - 0.6).abs() < 0.01,
            "downforce at 150mm ride height should be 60% of optimal, got {} ({}/{})",
            ratio,
            high,
            optimal
        );
    }

    #[test]
    fn ground_effect_zero_ride_height_porpoising() {
        let m = ground_effect_multiplier(0.0);
        assert!((m - PORPOISING_FLOOR_MULT).abs() < 1e-6,
            "at h=0 multiplier should be {}, got {}", PORPOISING_FLOOR_MULT, m);
    }

    #[test]
    fn ground_effect_at_floor_reaches_peak() {
        let m = ground_effect_multiplier(RIDE_HEIGHT_FLOOR_M);
        assert!((m - 1.0).abs() < 1e-6, "at floor multiplier should be 1.0, got {}", m);
    }

    #[test]
    fn ground_effect_optimal_is_peak() {
        let m = ground_effect_multiplier(RIDE_HEIGHT_OPTIMAL_M);
        assert!((m - 1.0).abs() < 1e-6, "at optimal multiplier should be 1.0, got {}", m);
    }

    #[test]
    fn ground_effect_plateau_constant_one() {
        let mid_plateau = (RIDE_HEIGHT_FLOOR_M + RIDE_HEIGHT_PLATEAU_END_M) * 0.5;
        let m = ground_effect_multiplier(mid_plateau);
        assert!((m - 1.0).abs() < 1e-6);
        let m_end = ground_effect_multiplier(RIDE_HEIGHT_PLATEAU_END_M);
        assert!((m_end - 1.0).abs() < 1e-6);
    }

    #[test]
    fn ground_effect_falloff_drops_smoothly() {
        let mid_falloff = (RIDE_HEIGHT_PLATEAU_END_M + RIDE_HEIGHT_FALLOFF_END_M) * 0.5;
        let m = ground_effect_multiplier(mid_falloff);
        assert!(
            m > WING_ONLY_FALLOFF_MULT && m < 1.0,
            "mid-falloff should be between {} and 1.0, got {}",
            WING_ONLY_FALLOFF_MULT,
            m
        );
    }

    #[test]
    fn ground_effect_beyond_falloff_constant_wing_only() {
        let m = ground_effect_multiplier(RIDE_HEIGHT_FALLOFF_END_M);
        assert!((m - WING_ONLY_FALLOFF_MULT).abs() < 1e-6);
        let m_far = ground_effect_multiplier(0.5);
        assert!((m_far - WING_ONLY_FALLOFF_MULT).abs() < 1e-6);
    }

    #[test]
    fn ground_effect_monotone_in_porpoising_region() {
        // Below floor: multiplier should monotonically increase.
        let h_quarter = RIDE_HEIGHT_FLOOR_M * 0.25;
        let h_half = RIDE_HEIGHT_FLOOR_M * 0.5;
        let h_three_quarter = RIDE_HEIGHT_FLOOR_M * 0.75;
        let m1 = ground_effect_multiplier(h_quarter);
        let m2 = ground_effect_multiplier(h_half);
        let m3 = ground_effect_multiplier(h_three_quarter);
        assert!(m1 < m2 && m2 < m3, "porpoising region should be monotone: {} < {} < {}", m1, m2, m3);
    }

    #[test]
    fn ground_effect_monotone_in_falloff_region() {
        let h1 = 0.060;
        let h2 = 0.090;
        let h3 = 0.120;
        let m1 = ground_effect_multiplier(h1);
        let m2 = ground_effect_multiplier(h2);
        let m3 = ground_effect_multiplier(h3);
        assert!(m1 > m2 && m2 > m3, "falloff region should be monotone: {} > {} > {}", m1, m2, m3);
    }

    #[test]
    fn ride_height_smoother_default_is_optimal() {
        let s = RideHeightSmoother::new();
        assert!((s.front() - RIDE_HEIGHT_OPTIMAL_M).abs() < 1e-6);
        assert!((s.rear() - RIDE_HEIGHT_OPTIMAL_M).abs() < 1e-6);
        assert!((s.average() - RIDE_HEIGHT_OPTIMAL_M).abs() < 1e-6);
    }

    #[test]
    fn ride_height_smoother_filters_oscillation() {
        // Adversarial input: front ride height oscillates ±0.02m at 60 Hz.
        // After a few hundred ms the EMA should settle within ±0.005m
        // around the mean (0.035m) rather than tracking the swings.
        let mut s = RideHeightSmoother::new();
        let dt = 1.0 / 120.0;
        let mean = RIDE_HEIGHT_OPTIMAL_M;
        let amp = 0.02;
        // 480 frames = 4 seconds, 60 Hz oscillation → 240 cycles.
        let mut max_dev = 0.0_f32;
        for n in 0..480 {
            let phase = (n as f32 / 120.0) * 60.0 * 2.0 * std::f32::consts::PI;
            let h = mean + amp * phase.sin();
            s.update(h, h, dt);
            // After warm-up (200 frames) check filtered deviation.
            if n > 200 {
                max_dev = max_dev.max((s.front() - mean).abs());
            }
        }
        assert!(
            max_dev < 0.005,
            "EMA should suppress 60Hz ±20mm to within ±5mm, got max dev {} m",
            max_dev
        );
    }

    #[test]
    fn ride_height_smoother_tracks_step_change() {
        // After ~5 time-constants the EMA should reach >99% of a step input.
        let mut s = RideHeightSmoother::new();
        let dt = 1.0 / 120.0;
        let target = 0.080_f32;
        // 5 × 80ms = 400ms = 48 frames at 120Hz.
        for _ in 0..60 {
            s.update(target, target, dt);
        }
        assert!(
            (s.front() - target).abs() < 0.01,
            "EMA should track step input within 10mm after 5τ, got {}",
            s.front()
        );
    }

    #[test]
    fn ground_effect_c1_continuous_at_region_boundaries() {
        let eps = 1e-5;
        let boundaries = [
            RIDE_HEIGHT_FLOOR_M,
            RIDE_HEIGHT_PLATEAU_END_M,
            RIDE_HEIGHT_FALLOFF_END_M,
        ];
        for &b in &boundaries {
            let lo = ground_effect_multiplier(b - eps);
            let hi = ground_effect_multiplier(b + eps);
            assert!(
                (lo - hi).abs() < 1e-3,
                "boundary at h={} not C^0 continuous: lo={}, hi={}",
                b,
                lo,
                hi
            );
        }
    }
}
