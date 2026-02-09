use super::weight_transfer::WeightTransferResult;
use super::CAR_MASS;

const HANDBRAKE_REAR_GRIP: f32 = 0.2;
const THROTTLE_OVERSTEER_FACTOR: f32 = 0.90;

#[derive(Clone, Copy, Debug)]
pub struct PacejkaCoeffs {
    pub b: f32,
    pub c: f32,
    pub d: f32,
    pub e: f32,
}

impl PacejkaCoeffs {
    pub fn lateral_default() -> Self {
        Self { b: 10.0, c: 1.9, d: 1.0, e: 0.97 }
    }

    pub fn longitudinal_default() -> Self {
        Self { b: 20.0, c: 1.65, d: 1.0, e: 0.97 }
    }
}

pub fn pacejka_force(slip: f32, fz: f32, coeffs: &PacejkaCoeffs) -> f32 {
    let d = coeffs.d * fz;
    let bx = coeffs.b * slip;
    let inner = bx - coeffs.e * (bx - bx.atan());
    d * (coeffs.c * inner.atan()).sin()
}

pub fn pacejka_lateral(slip_angle_rad: f32, fz: f32, coeffs: &PacejkaCoeffs) -> f32 {
    pacejka_force(slip_angle_rad, fz, coeffs)
}

pub fn pacejka_longitudinal(slip_ratio: f32, fz: f32, coeffs: &PacejkaCoeffs) -> f32 {
    pacejka_force(slip_ratio, fz, coeffs)
}

pub fn combined_slip(fx_pure: f32, fy_pure: f32) -> (f32, f32) {
    let fx_abs = fx_pure.abs();
    let fy_abs = fy_pure.abs();

    if fx_abs < 0.001 && fy_abs < 0.001 {
        return (fx_pure, fy_pure);
    }

    let total_pure = (fx_abs * fx_abs + fy_abs * fy_abs).sqrt();
    let max_force = fx_abs.max(fy_abs);
    let scale = if total_pure > max_force {
        max_force / total_pure
    } else {
        1.0
    };

    (fx_pure * scale, fy_pure * scale)
}

#[derive(Clone, Copy, Debug, Default)]
pub struct WheelForces {
    pub fx: f32,
    pub fy: f32,
    pub fz: f32,
    pub slip_angle: f32,
    pub slip_ratio: f32,
}

pub fn calculate_per_wheel_forces(
    slip_angle_deg: f32,
    slip_ratio: f32,
    fz: f32,
    lat_coeffs: &PacejkaCoeffs,
    lon_coeffs: &PacejkaCoeffs,
    load_sensitivity: f32,
) -> WheelForces {
    let slip_angle_rad = slip_angle_deg.to_radians();

    let fz_nominal = CAR_MASS * 9.81 / 4.0;
    let load_factor = 1.0 - load_sensitivity * (fz / fz_nominal - 1.0).max(0.0);
    let effective_fz = fz * load_factor.clamp(0.7, 1.0);

    let fy_pure = pacejka_lateral(slip_angle_rad, effective_fz, lat_coeffs);
    let fx_pure = pacejka_longitudinal(slip_ratio, effective_fz, lon_coeffs);

    let (fx, fy) = combined_slip(fx_pure, fy_pure);

    WheelForces {
        fx,
        fy,
        fz,
        slip_angle: slip_angle_deg,
        slip_ratio,
    }
}

pub fn pacejka_grip_efficiency(slip_angle_deg: f32, fz: f32) -> f32 {
    let lat_coeffs = PacejkaCoeffs::lateral_default();
    let fz_nominal = CAR_MASS * 9.81 / 4.0;
    let load_factor = 1.0 - 0.015 * (fz / fz_nominal - 1.0).max(0.0);
    let effective_fz = fz * load_factor.clamp(0.7, 1.0);

    let peak_slip = 9.0f32.to_radians();
    let peak_force = pacejka_lateral(peak_slip, effective_fz, &lat_coeffs).abs();
    let peak_mu = peak_force / effective_fz.max(100.0);

    let abs_slip = slip_angle_deg.abs();
    if abs_slip < 0.5 {
        return peak_mu * 0.85;
    }

    let slip_rad = abs_slip.to_radians();
    let current_force = pacejka_lateral(slip_rad, effective_fz, &lat_coeffs).abs();
    let current_mu = current_force / effective_fz.max(100.0);

    current_mu.max(peak_mu * 0.5)
}

pub fn calculate_tire_grip(
    slip_angle: f32,
    total_load: f32,
    grip_coefficient: f32,
    handbrake: bool,
    throttle: bool,
    weight_transfer: &WeightTransferResult,
) -> (f32, f32) {
    let base_load_per_wheel = total_load / 4.0;

    let front_load = base_load_per_wheel + weight_transfer.front_load_change;
    let rear_load = base_load_per_wheel + weight_transfer.rear_load_change;

    let front_mu = pacejka_grip_efficiency(slip_angle, front_load);
    let front_grip = front_mu * grip_coefficient;

    let rear_mu = pacejka_grip_efficiency(slip_angle, rear_load);
    let mut rear_grip = rear_mu * grip_coefficient;

    if handbrake {
        rear_grip *= HANDBRAKE_REAR_GRIP;
    } else if throttle {
        rear_grip *= THROTTLE_OVERSTEER_FACTOR;
    }

    (front_grip, rear_grip)
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::weight_transfer::WeightTransferResult;

    const EPSILON: f32 = 0.01;
    const FZ_NOMINAL: f32 = CAR_MASS * 9.81 / 4.0;

    #[test]
    fn test_pacejka_lateral_peaks_at_correct_slip() {
        let coeffs = PacejkaCoeffs::lateral_default();
        let mut max_force = 0.0f32;
        let mut peak_slip = 0.0f32;
        for i in 0..300 {
            let slip_deg = i as f32 * 0.1;
            let slip_rad = slip_deg.to_radians();
            let force = pacejka_lateral(slip_rad, FZ_NOMINAL, &coeffs).abs();
            if force > max_force {
                max_force = force;
                peak_slip = slip_deg;
            }
        }
        assert!(
            peak_slip >= 7.0 && peak_slip <= 13.0,
            "Lateral peak should be 7-13 deg, got {} deg",
            peak_slip
        );
    }

    #[test]
    fn test_pacejka_longitudinal_peaks_at_correct_slip() {
        let coeffs = PacejkaCoeffs::longitudinal_default();
        let mut max_force = 0.0f32;
        let mut peak_ratio = 0.0f32;
        for i in 0..500 {
            let ratio = i as f32 * 0.001;
            let force = pacejka_longitudinal(ratio, FZ_NOMINAL, &coeffs).abs();
            if force > max_force {
                max_force = force;
                peak_ratio = ratio;
            }
        }
        assert!(
            peak_ratio >= 0.05 && peak_ratio <= 0.25,
            "Longitudinal peak should be 5-25% slip, got {}%",
            peak_ratio * 100.0
        );
    }

    #[test]
    fn test_combined_slip_within_friction_circle() {
        let lat_coeffs = PacejkaCoeffs::lateral_default();
        let lon_coeffs = PacejkaCoeffs::longitudinal_default();

        let fy_pure = pacejka_lateral(0.15, FZ_NOMINAL, &lat_coeffs).abs();
        let fx_pure = pacejka_longitudinal(0.1, FZ_NOMINAL, &lon_coeffs).abs();

        let (fx_c, fy_c) = combined_slip(fx_pure, fy_pure);
        let combined_total = (fx_c * fx_c + fy_c * fy_c).sqrt();
        let pure_max = fy_pure.max(fx_pure);

        assert!(
            combined_total <= pure_max * 1.05,
            "Combined force ({}) should not exceed friction circle ({})",
            combined_total, pure_max
        );
    }

    #[test]
    fn test_load_doubles_grip_less_than_doubles() {
        let coeffs = PacejkaCoeffs::lateral_default();
        let slip_rad = 10.0f32.to_radians();

        let force_1x = pacejka_lateral(slip_rad, FZ_NOMINAL, &coeffs).abs();

        let fz_2x = FZ_NOMINAL * 2.0;
        let load_factor = 1.0 - 0.015 * (fz_2x / FZ_NOMINAL - 1.0);
        let force_2x = pacejka_lateral(slip_rad, fz_2x * load_factor, &coeffs).abs();

        assert!(
            force_2x < force_1x * 2.0,
            "Doubling load ({}) should give < 2x grip ({})",
            force_2x, force_1x * 2.0
        );
        assert!(
            force_2x > force_1x * 1.3,
            "Doubling load ({}) should still increase grip significantly (>1.3x = {})",
            force_2x, force_1x * 1.3
        );
    }

    #[test]
    fn test_optimal_slip_angle() {
        let base_load = CAR_MASS * 9.81 / 4.0;
        let grip_low = calculate_single_tire_grip_legacy(2.0, base_load, 1.7);
        let grip_optimal = calculate_single_tire_grip_legacy(8.0, base_load, 1.7);
        let grip_high = calculate_single_tire_grip_legacy(15.0, base_load, 1.7);

        assert!(grip_optimal > grip_low);
        assert!(grip_optimal > grip_high);
    }

    #[test]
    fn test_grip_coefficient_scaling() {
        let base_load = CAR_MASS * 9.81 / 4.0;
        let grip_low_coeff = calculate_single_tire_grip_legacy(8.0, base_load, 1.0);
        let grip_high_coeff = calculate_single_tire_grip_legacy(8.0, base_load, 1.7);
        assert!(grip_high_coeff > grip_low_coeff);
    }

    #[test]
    fn test_handbrake_reduces_rear() {
        let weight = WeightTransferResult::default();
        let (_, rear_normal) = calculate_tire_grip(8.0, CAR_MASS * 9.81, 1.7, false, false, &weight);
        let (_, rear_handbrake) = calculate_tire_grip(8.0, CAR_MASS * 9.81, 1.7, true, false, &weight);
        assert!(rear_handbrake < rear_normal * 0.3);
    }

    #[test]
    fn test_throttle_oversteer() {
        let weight = WeightTransferResult::default();
        let (_, rear_coast) = calculate_tire_grip(8.0, CAR_MASS * 9.81, 1.7, false, false, &weight);
        let (_, rear_throttle) = calculate_tire_grip(8.0, CAR_MASS * 9.81, 1.7, false, true, &weight);
        assert!(rear_throttle < rear_coast);
        assert!(rear_throttle > rear_coast * 0.5);
    }

    #[test]
    fn test_front_rear_balance() {
        let weight = WeightTransferResult::default();
        let (front, rear) = calculate_tire_grip(8.0, CAR_MASS * 9.81, 1.7, false, false, &weight);
        assert!(front > 0.0);
        assert!(rear > 0.0);
    }

    #[test]
    fn test_per_wheel_forces() {
        let lat_coeffs = PacejkaCoeffs::lateral_default();
        let lon_coeffs = PacejkaCoeffs::longitudinal_default();
        let forces = calculate_per_wheel_forces(
            10.0, 0.05, FZ_NOMINAL, &lat_coeffs, &lon_coeffs, 0.015,
        );
        assert!(forces.fy.abs() > 0.0, "Should have lateral force");
        assert!(forces.fx.abs() > 0.0, "Should have longitudinal force");
    }

    fn calculate_single_tire_grip_legacy(slip_angle: f32, normal_load: f32, base_grip_coeff: f32) -> f32 {
        pacejka_grip_efficiency(slip_angle, normal_load) * base_grip_coeff
    }
}
