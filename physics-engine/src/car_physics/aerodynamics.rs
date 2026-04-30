use crate::constants::aero::{DEFAULT_AIR_DENSITY, FRONTAL_AREA};
use crate::constants::car::{BASE_DOWNFORCE_COEFFICIENT, BASE_DRAG_COEFFICIENT};

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

#[inline]
fn smoothstep(t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

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

pub fn get_downforce_with_density(speed_ms: f32, active_aero_mult: f32, air_density: f32) -> f32 {
    let final_downforce_coeff = BASE_DOWNFORCE_COEFFICIENT * active_aero_mult;
    0.5 * air_density * final_downforce_coeff * FRONTAL_AREA * speed_ms * speed_ms
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
