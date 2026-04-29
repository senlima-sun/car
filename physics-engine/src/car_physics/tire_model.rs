use crate::constants::car::CAR_MASS;

const HANDBRAKE_REAR_GRIP: f32 = 0.2;
const THROTTLE_OVERSTEER_FACTOR: f32 = 0.90;
const DEFAULT_LOAD_SENSITIVITY: f32 = 0.015;
const PEAK_LATERAL_SLIP_DEG: f32 = 9.0;

/// Apply Pacejka load-sensitivity to a per-wheel Fz: heavier corners produce
/// less μ per unit load. Mirrors the inline formula used in
/// `pacejka_grip_efficiency`, `peak_mu_at_fz`, and `calculate_per_wheel_forces`
/// so all three see the same effective Fz.
#[inline]
fn effective_fz_with_load_sensitivity(fz: f32, load_sensitivity: f32) -> f32 {
    let fz_nominal = CAR_MASS * 9.81 / 4.0;
    let load_factor = 1.0 - load_sensitivity * (fz / fz_nominal - 1.0).max(0.0);
    fz * load_factor.clamp(0.7, 1.0)
}

#[derive(Clone, Copy, Debug)]
pub struct PacejkaCoeffs {
    pub b: f32,
    pub c: f32,
    pub d: f32,
    pub e: f32,
}

impl PacejkaCoeffs {
    pub const LATERAL_DEFAULT: Self = Self {
        b: 10.0,
        c: 1.9,
        d: 1.0,
        e: 0.97,
    };

    pub const LONGITUDINAL_DEFAULT: Self = Self {
        b: 20.0,
        c: 1.65,
        d: 1.0,
        e: 0.97,
    };

    pub fn lateral_default() -> Self {
        Self::LATERAL_DEFAULT
    }

    pub fn longitudinal_default() -> Self {
        Self::LONGITUDINAL_DEFAULT
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

/// Friction-ellipse limiting: if `sqrt(fx² + fy²) > mu_fz_limit`, scale both
/// components proportionally so the total is exactly the limit. Direction is
/// preserved. `mu_fz_limit` should be `peak_μ × Fz` for the wheel.
///
/// TODO(wave-3): replace with full Pacejka `Gx`/`Gy` combined-slip weighting.
pub fn combined_slip(fx_pure: f32, fy_pure: f32, mu_fz_limit: f32) -> (f32, f32) {
    let total_sq = fx_pure * fx_pure + fy_pure * fy_pure;
    let limit_sq = mu_fz_limit * mu_fz_limit;
    if total_sq <= limit_sq || total_sq < 1e-6 {
        return (fx_pure, fy_pure);
    }
    let scale = mu_fz_limit / total_sq.sqrt();
    (fx_pure * scale, fy_pure * scale)
}

/// Peak longitudinal/lateral μ available at this Fz, after the same load
/// sensitivity factor used by `pacejka_grip_efficiency`. Use this to compute
/// the friction-ellipse radius `peak_mu * effective_fz` for `combined_slip`.
pub fn peak_mu_at_fz(fz: f32, coeffs: &PacejkaCoeffs) -> f32 {
    let effective_fz = effective_fz_with_load_sensitivity(fz, DEFAULT_LOAD_SENSITIVITY);
    let peak_slip = PEAK_LATERAL_SLIP_DEG.to_radians();
    let peak_force = pacejka_force(peak_slip, effective_fz, coeffs).abs();
    peak_force / effective_fz.max(100.0)
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
    let effective_fz = effective_fz_with_load_sensitivity(fz, load_sensitivity);

    let fy_pure = pacejka_lateral(slip_angle_rad, effective_fz, lat_coeffs);
    let fx_pure = pacejka_longitudinal(slip_ratio, effective_fz, lon_coeffs);

    // Conservative-permissive cap: use the larger of lateral / longitudinal
    // peak μ for the ellipse radius. Wave 3 will replace with full Pacejka
    // Gx/Gy combined-slip weighting that respects distinct semi-axes.
    let mu_fz_limit =
        peak_mu_at_fz(fz, lat_coeffs).max(peak_mu_at_fz(fz, lon_coeffs)) * effective_fz;
    let (fx, fy) = combined_slip(fx_pure, fy_pure, mu_fz_limit);

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
    let effective_fz = effective_fz_with_load_sensitivity(fz, DEFAULT_LOAD_SENSITIVITY);

    let peak_slip = PEAK_LATERAL_SLIP_DEG.to_radians();
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
    wheel_loads: [f32; 4],
    grip_coefficient: f32,
    handbrake: bool,
    throttle: bool,
) -> (f32, f32) {
    let [fl, fr, rl, rr] = wheel_loads;
    let front_load = (fl + fr) * 0.5;
    let rear_load = (rl + rr) * 0.5;

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

        let mu_peak =
            peak_mu_at_fz(FZ_NOMINAL, &lat_coeffs).max(peak_mu_at_fz(FZ_NOMINAL, &lon_coeffs));
        // At nominal Fz the load-sensitivity factor reduces to 1.0.
        let mu_fz_limit = mu_peak * FZ_NOMINAL;

        let (fx_c, fy_c) = combined_slip(fx_pure, fy_pure, mu_fz_limit);
        let combined_total = (fx_c * fx_c + fy_c * fy_c).sqrt();

        assert!(
            combined_total <= mu_fz_limit * 1.001,
            "Combined force ({}) should be capped by μ_peak·Fz ({})",
            combined_total,
            mu_fz_limit
        );
    }

    #[test]
    fn test_combined_slip_unchanged_within_circle() {
        let mu_fz_limit = 5000.0_f32;
        let (fx, fy) = combined_slip(1000.0, 800.0, mu_fz_limit);
        assert!((fx - 1000.0).abs() < 0.001);
        assert!((fy - 800.0).abs() < 0.001);
    }

    #[test]
    fn test_combined_slip_pure_long_capped_at_limit() {
        let mu_fz_limit = 3000.0_f32;
        let (fx, fy) = combined_slip(5000.0, 0.0, mu_fz_limit);
        assert!(
            (fx - mu_fz_limit).abs() < 0.01,
            "pure-longitudinal should clamp to mu_fz_limit, got {}",
            fx
        );
        assert!(fy.abs() < 0.001);
    }

    #[test]
    fn test_combined_slip_pure_lat_capped_at_limit() {
        let mu_fz_limit = 3000.0_f32;
        let (fx, fy) = combined_slip(0.0, -5000.0, mu_fz_limit);
        assert!(fx.abs() < 0.001);
        assert!(
            (fy + mu_fz_limit).abs() < 0.01,
            "pure-lateral negative should clamp to -mu_fz_limit, got {}",
            fy
        );
    }

    #[test]
    fn test_combined_slip_preserves_direction() {
        let mu_fz_limit = 1000.0_f32;
        let (fx, fy) = combined_slip(3000.0, 4000.0, mu_fz_limit);
        let total = (fx * fx + fy * fy).sqrt();
        assert!((total - mu_fz_limit).abs() < 0.01);
        // Direction (3,4) → magnitude 5; scaled to 1000 → fx=600, fy=800.
        assert!((fx - 600.0).abs() < 0.5);
        assert!((fy - 800.0).abs() < 0.5);
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
            force_2x,
            force_1x * 2.0
        );
        assert!(
            force_2x > force_1x * 1.3,
            "Doubling load ({}) should still increase grip significantly (>1.3x = {})",
            force_2x,
            force_1x * 1.3
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

    fn uniform_loads() -> [f32; 4] {
        [FZ_NOMINAL; 4]
    }

    #[test]
    fn test_handbrake_reduces_rear() {
        let (_, rear_normal) = calculate_tire_grip(8.0, uniform_loads(), 1.7, false, false);
        let (_, rear_handbrake) = calculate_tire_grip(8.0, uniform_loads(), 1.7, true, false);
        assert!(rear_handbrake < rear_normal * 0.3);
    }

    #[test]
    fn test_throttle_oversteer() {
        let (_, rear_coast) = calculate_tire_grip(8.0, uniform_loads(), 1.7, false, false);
        let (_, rear_throttle) = calculate_tire_grip(8.0, uniform_loads(), 1.7, false, true);
        assert!(rear_throttle < rear_coast);
        assert!(rear_throttle > rear_coast * 0.5);
    }

    #[test]
    fn test_front_rear_balance() {
        let (front, rear) = calculate_tire_grip(8.0, uniform_loads(), 1.7, false, false);
        assert!(front > 0.0);
        assert!(rear > 0.0);
    }

    #[test]
    fn test_per_wheel_forces() {
        let lat_coeffs = PacejkaCoeffs::lateral_default();
        let lon_coeffs = PacejkaCoeffs::longitudinal_default();
        let forces =
            calculate_per_wheel_forces(10.0, 0.05, FZ_NOMINAL, &lat_coeffs, &lon_coeffs, 0.015);
        assert!(forces.fy.abs() > 0.0, "Should have lateral force");
        assert!(forces.fx.abs() > 0.0, "Should have longitudinal force");
    }

    fn calculate_single_tire_grip_legacy(
        slip_angle: f32,
        normal_load: f32,
        base_grip_coeff: f32,
    ) -> f32 {
        pacejka_grip_efficiency(slip_angle, normal_load) * base_grip_coeff
    }

    #[test]
    fn test_calculate_tire_grip_routes_fl_fr_to_front_axle() {
        let symmetric = [
            FZ_NOMINAL * 1.5,
            FZ_NOMINAL * 1.5,
            FZ_NOMINAL * 0.5,
            FZ_NOMINAL * 0.5,
        ];
        let swapped_axles = [
            FZ_NOMINAL * 0.5,
            FZ_NOMINAL * 0.5,
            FZ_NOMINAL * 1.5,
            FZ_NOMINAL * 1.5,
        ];

        let (front_a, rear_a) = calculate_tire_grip(8.0, symmetric, 1.7, false, false);
        let (front_b, rear_b) = calculate_tire_grip(8.0, swapped_axles, 1.7, false, false);

        assert!(
            (front_a - rear_b).abs() < 1e-4,
            "front from heavy-front == rear from heavy-rear: {} vs {}",
            front_a,
            rear_b
        );
        assert!(
            (rear_a - front_b).abs() < 1e-4,
            "rear from heavy-front == front from heavy-rear: {} vs {}",
            rear_a,
            front_b
        );
    }
}
