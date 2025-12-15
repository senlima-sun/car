use super::{BASE_DOWNFORCE_COEFFICIENT, BASE_DRAG_COEFFICIENT};

const AIR_DENSITY: f32 = 1.225; // kg/m³
const FRONTAL_AREA: f32 = 2.0;  // m²

// DRS Configuration
const DRS_ACTIVATION_SPEED: f32 = 200.0; // km/h
const DRS_DRAG_REDUCTION: f32 = 0.4;     // 40% drag reduction
const DRS_DOWNFORCE_REDUCTION: f32 = 0.4; // 40% downforce reduction

/// Calculate engine force based on speed (power curve)
pub fn get_engine_force(speed_ms: f32, drs_active: bool) -> f32 {
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

    // DRS boost
    let drs_boost = if drs_active && speed_kmh >= DRS_ACTIVATION_SPEED && speed_kmh < 300.0 {
        let t = (speed_kmh - 200.0) / 100.0;
        4000.0 + t * 4000.0 // 4000 -> 8000 N boost
    } else {
        0.0
    };

    base_force + drs_boost
}

/// Calculate aerodynamic drag force (proportional to v²)
pub fn get_drag_force(speed_ms: f32, drs_active: bool) -> f32 {
    let drag_coeff = if drs_active {
        BASE_DRAG_COEFFICIENT * (1.0 - DRS_DRAG_REDUCTION)
    } else {
        BASE_DRAG_COEFFICIENT
    };

    // F = 0.5 * ρ * Cd * A * v²
    0.5 * AIR_DENSITY * drag_coeff * FRONTAL_AREA * speed_ms * speed_ms
}

/// Calculate aerodynamic downforce (proportional to v²)
pub fn get_downforce(speed_ms: f32, drs_active: bool) -> f32 {
    let downforce_coeff = if drs_active {
        BASE_DOWNFORCE_COEFFICIENT * (1.0 - DRS_DOWNFORCE_REDUCTION)
    } else {
        BASE_DOWNFORCE_COEFFICIENT
    };

    // F = 0.5 * ρ * Cl * A * v²
    0.5 * AIR_DENSITY * downforce_coeff * FRONTAL_AREA * speed_ms * speed_ms
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_force_low_speed() {
        let force = get_engine_force(10.0, false); // ~36 km/h
        assert!((force - 18000.0).abs() < 100.0);
    }

    #[test]
    fn test_engine_force_mid_speed() {
        let force = get_engine_force(30.0, false); // ~108 km/h
        assert!(force < 18000.0);
        assert!(force > 12000.0);
    }

    #[test]
    fn test_engine_force_high_speed() {
        let force = get_engine_force(70.0, false); // ~252 km/h
        assert!(force < 8000.0);
        assert!(force > 5000.0);
    }

    #[test]
    fn test_drs_boost() {
        let force_no_drs = get_engine_force(60.0, false); // ~216 km/h
        let force_with_drs = get_engine_force(60.0, true);

        assert!(force_with_drs > force_no_drs);
    }

    #[test]
    fn test_drag_increases_with_speed() {
        let drag_slow = get_drag_force(10.0, false);
        let drag_fast = get_drag_force(30.0, false);

        // Drag should be ~9x higher at 3x speed (v²)
        assert!(drag_fast > drag_slow * 8.0);
    }

    #[test]
    fn test_drs_reduces_drag() {
        let drag_no_drs = get_drag_force(50.0, false);
        let drag_with_drs = get_drag_force(50.0, true);

        assert!(drag_with_drs < drag_no_drs);
        assert!((drag_with_drs / drag_no_drs - 0.6).abs() < 0.01);
    }

    #[test]
    fn test_downforce_increases_with_speed() {
        let df_slow = get_downforce(10.0, false);
        let df_fast = get_downforce(30.0, false);

        assert!(df_fast > df_slow * 8.0);
    }
}
