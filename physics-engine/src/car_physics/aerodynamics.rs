use super::{BASE_DOWNFORCE_COEFFICIENT, BASE_DRAG_COEFFICIENT};

const AIR_DENSITY: f32 = 1.225; // kg/m³
const FRONTAL_AREA: f32 = 2.0;  // m²

/// Calculate engine force based on speed (power curve)
/// ers_boost: additional force from ERS deployment in Newtons
pub fn get_engine_force(speed_ms: f32, ers_boost: f32) -> f32 {
    let speed_kmh = speed_ms * 3.6;

    // Multi-stage power curve
    let base_force = if speed_kmh < 60.0 {
        // Full torque at low speed
        18000.0
    } else if speed_kmh < 150.0 {
        // Linear falloff mid-range
        let t = (speed_kmh - 60.0) / 90.0;
        18000.0 - t * 6000.0 // 18000 -> 12000
    } else if speed_kmh < 250.0 {
        // Continued falloff high-range
        let t = (speed_kmh - 150.0) / 100.0;
        12000.0 - t * 5000.0 // 12000 -> 7000
    } else {
        // Top speed range - smooth squared falloff
        let t = ((speed_kmh - 250.0) / 60.0).min(1.0);
        7000.0 - t * t * 3500.0 // 7000 -> 3500
    };

    base_force + ers_boost
}

/// Calculate aerodynamic drag force (proportional to v²)
/// active_aero_mult: multiplier from active aero system (0.65-1.0)
pub fn get_drag_force(speed_ms: f32, active_aero_mult: f32) -> f32 {
    // Apply active aero multiplier to drag coefficient
    let final_drag_coeff = BASE_DRAG_COEFFICIENT * active_aero_mult;

    // F = 0.5 * ρ * Cd * A * v²
    0.5 * AIR_DENSITY * final_drag_coeff * FRONTAL_AREA * speed_ms * speed_ms
}

/// Calculate aerodynamic downforce (proportional to v²)
/// active_aero_mult: multiplier from active aero system (0.55-1.0)
pub fn get_downforce(speed_ms: f32, active_aero_mult: f32) -> f32 {
    // Apply active aero multiplier to downforce coefficient
    let final_downforce_coeff = BASE_DOWNFORCE_COEFFICIENT * active_aero_mult;

    // F = 0.5 * ρ * Cl * A * v²
    0.5 * AIR_DENSITY * final_downforce_coeff * FRONTAL_AREA * speed_ms * speed_ms
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_force_low_speed() {
        let force = get_engine_force(10.0, 0.0); // ~36 km/h
        assert!((force - 18000.0).abs() < 100.0);
    }

    #[test]
    fn test_engine_force_mid_speed() {
        let force = get_engine_force(30.0, 0.0); // ~108 km/h
        assert!(force < 18000.0);
        assert!(force > 12000.0);
    }

    #[test]
    fn test_engine_force_high_speed() {
        let force = get_engine_force(70.0, 0.0); // ~252 km/h
        assert!(force < 8000.0);
        assert!(force > 5000.0);
    }

    #[test]
    fn test_ers_boost() {
        let force_no_ers = get_engine_force(50.0, 0.0);
        let ers_boost = 2000.0; // 2000 N from ERS
        let force_with_ers = get_engine_force(50.0, ers_boost);

        assert!((force_with_ers - force_no_ers - ers_boost).abs() < 0.1);
    }

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
