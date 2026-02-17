use crate::constants::aero::{DEFAULT_AIR_DENSITY, FRONTAL_AREA};
use crate::constants::car::{BASE_DOWNFORCE_COEFFICIENT, BASE_DRAG_COEFFICIENT};

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
}
