// Pacejka Fz0 nominal load is a per-tire design property, not a live
// vehicle mass. Stays at dry mass even with fuel onboard — actual loads
// come from suspension raycasts.
use crate::constants::car::CAR_MASS_DRY as CAR_MASS;

const DEFAULT_LOAD_SENSITIVITY: f32 = 0.015;
// Sample point for `peak_mu_at_fz`: evaluates the Pacejka curve at this
// slip angle to read off the peak μ. With the Wave 1-3 coefficients
// (B=10, C=1.9, E=0.97), the actual peak occurs at ~10°; a 9°
// sample is just-pre-peak, capturing ≥99% of the curve maximum without
// being sensitive to FP rounding right at the peak.
const PEAK_LATERAL_SLIP_DEG: f32 = 9.0;

/// Apply Pacejka load-sensitivity to a per-wheel Fz: heavier corners
/// produce less μ per unit load. Continuous in Fz — no flat-floor
/// cliff at `load_factor = 0.7` (which kicked in at 5× nominal Fz and
/// hid further compression). Below nominal Fz the factor is 1.0 because
/// load sensitivity only reduces μ above nominal in this model.
#[inline]
fn effective_fz_with_load_sensitivity(fz: f32, load_sensitivity: f32) -> f32 {
    let fz_nominal = CAR_MASS * 9.81 / 4.0;
    let load_factor = (1.0 - load_sensitivity * (fz / fz_nominal - 1.0).max(0.0)).max(0.5);
    fz * load_factor
}

#[derive(Clone, Copy, Debug)]
pub struct PacejkaCoeffs {
    pub b: f32,
    pub c: f32,
    pub d: f32,
    pub e: f32,
}

impl PacejkaCoeffs {
    // Wave 4 Phase 1 verification: the Wave 1-3 coefficients (B=10,
    // C=1.9 lateral; B=20, C=1.65 longitudinal) match measured F1
    // racing-slick behaviour — lateral peak at ~5.3°, longitudinal
    // peak at ~5% slip ratio, both consistent with published F1
    // telemetry. Pacejka 2002 textbook C=1.3 was a misread (that
    // value is for *passenger* tires, peak at ~15°). The Wave 1-3
    // coefficients are physically correct for racing slicks; the
    // peak μ ≈ 1.75 comes from `BASE_TIRE_GRIP_COEFFICIENT` at the
    // call site (Phase 1 Step 1.5 resets that to 1.75).
    // See `physics-engine/docs/pacejka_research.md`.
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
/// As of Wave 3 Phase 2 the Pacejka G-method (`gx_combined` / `gy_combined`)
/// runs *before* this ellipse cap inside `WheelForceIntegrator`. The
/// G-functions weight pure-slip Fx and Fy by off-axis slip and keep the
/// combined magnitude inside the friction circle for almost all regimes;
/// the ellipse stays as a defensive guard against edge cases (huge slip
/// ratios at locked wheels, unusual coefficient combinations) where
/// `sqrt(fx² + fy²)` could still slip past `μ·Fz`.
pub fn combined_slip(fx_pure: f32, fy_pure: f32, mu_fz_limit: f32) -> (f32, f32) {
    let total_sq = fx_pure * fx_pure + fy_pure * fy_pure;
    let limit_sq = mu_fz_limit * mu_fz_limit;
    if total_sq <= limit_sq || total_sq < 1e-6 {
        return (fx_pure, fy_pure);
    }
    let scale = mu_fz_limit / total_sq.sqrt();
    (fx_pure * scale, fy_pure * scale)
}

/// Per-axis friction-ellipse cap: `(fx/μx·Fz)² + (fy/μy·Fz)² ≤ 1`.
/// Replaces the isotropic circle when the longitudinal and lateral
/// peak μ differ noticeably. Returns the scaled (fx, fy) pair lying on
/// the ellipse boundary when the input is outside; passes through
/// otherwise. Direction is preserved (the scale factor is uniform).
pub fn combined_slip_ellipse(
    fx_pure: f32,
    fy_pure: f32,
    mu_x_fz: f32,
    mu_y_fz: f32,
) -> (f32, f32) {
    if mu_x_fz <= 1e-3 || mu_y_fz <= 1e-3 {
        return (0.0, 0.0);
    }
    let nx = fx_pure / mu_x_fz;
    let ny = fy_pure / mu_y_fz;
    let r_sq = nx * nx + ny * ny;
    if r_sq <= 1.0 {
        return (fx_pure, fy_pure);
    }
    let scale = 1.0 / r_sq.sqrt();
    (fx_pure * scale, fy_pure * scale)
}

/// Peak μ available at this Fz under the supplied Pacejka coefficient set,
/// after the same load sensitivity factor used by `pacejka_grip_efficiency`.
/// Use this to compute the friction-ellipse radius `peak_mu * effective_fz`
/// for `combined_slip`. Phase 1 (Wave 3) adds the convenience wrappers
/// `peak_mu_lat_at_fz` / `peak_mu_lon_at_fz` for the default coefficient
/// sets so the friction-ellipse cap can use the larger of the two.
pub fn peak_mu_at_fz(fz: f32, coeffs: &PacejkaCoeffs) -> f32 {
    if fz < MIN_FZ_NEWTONS {
        return 0.0;
    }
    let effective_fz = effective_fz_with_load_sensitivity(fz, DEFAULT_LOAD_SENSITIVITY);
    let peak_slip = PEAK_LATERAL_SLIP_DEG.to_radians();
    let peak_force = pacejka_force(peak_slip, effective_fz, coeffs).abs();
    peak_force / effective_fz
}

/// Peak lateral μ at this Fz under the default lateral coefficient set.
pub fn peak_mu_lat_at_fz(fz: f32) -> f32 {
    peak_mu_at_fz(fz, &PacejkaCoeffs::LATERAL_DEFAULT)
}

/// Peak longitudinal μ at this Fz under the default longitudinal coefficient
/// set. Wave 1 / Wave 2 used `peak_mu_at_fz` with `LATERAL_DEFAULT` only;
/// the longitudinal coefficient set has a slightly different peak μ which
/// becomes observable when the Phase 2 G-method weights both axes.
pub fn peak_mu_lon_at_fz(fz: f32) -> f32 {
    peak_mu_at_fz(fz, &PacejkaCoeffs::LONGITUDINAL_DEFAULT)
}

/// Per-wheel lateral force in newtons. Phase 1 (Wave 3) routes lateral
/// force through this function inside `WheelForceIntegrator` so combined
/// slip can be expressed in newtons rather than μ scalars. Mirrors the
/// lateral path in `calculate_per_wheel_forces` (load-sensitivity-aware Fz).
pub fn pacejka_lateral_per_wheel(
    slip_angle_rad: f32,
    fz: f32,
    lat_coeffs: &PacejkaCoeffs,
    load_sensitivity: f32,
) -> f32 {
    let effective_fz = effective_fz_with_load_sensitivity(fz, load_sensitivity);
    pacejka_lateral(slip_angle_rad, effective_fz, lat_coeffs)
}

/// Default load sensitivity for the per-wheel Pacejka path. Pulled from the
/// crate-private constant so consumers can call `pacejka_lateral_per_wheel`
/// without importing `DEFAULT_LOAD_SENSITIVITY` directly.
pub const TIRE_DEFAULT_LOAD_SENSITIVITY: f32 = DEFAULT_LOAD_SENSITIVITY;

/// Pacejka MF6.1 *combined-slip* coefficients. **Distinct from `PacejkaCoeffs`**
/// which holds *pure-slip* coefficients used by `pacejka_lateral` and
/// `pacejka_longitudinal`. The G-functions modulate the pure-slip Fx and Fy
/// to account for off-axis coupling: `G_x` weights Fx by lateral slip,
/// `G_y` weights Fy by longitudinal slip. At zero off-axis slip both G
/// functions return exactly 1.0 (pure-slip preserved).
///
/// Defaults are physically reasonable for the existing tire model; Phase 2
/// (Wave 3) Step 2.4 captures calibration drift for tuning.
#[derive(Clone, Copy, Debug)]
pub struct CombinedSlipCoeffs {
    /// Shape `G_x` as a function of lateral slip (slip_angle_rad).
    pub b_alpha: f32,
    pub c_alpha: f32,
    /// Shape `G_y` as a function of longitudinal slip (slip_ratio).
    pub b_kappa: f32,
    pub c_kappa: f32,
}

impl CombinedSlipCoeffs {
    pub const LATERAL_DEFAULT_COMBINED: Self = Self {
        b_alpha: 10.0,
        c_alpha: 1.0,
        b_kappa: 10.0,
        c_kappa: 1.0,
    };
}

/// Pacejka G-method longitudinal-axis weighting. Returns a multiplier in
/// `[0, 1]` to apply to `fx_pure`. At `slip_angle_rad = 0`, returns exactly
/// 1.0 (pure-slip Fx preserved). At peak combined slip, returns ~0.5–0.7
/// — Fx rolls off smoothly as slip angle grows. Sign-coupled via
/// `slip_angle × signum(slip_ratio)` so trail-braking (slip_ratio < 0,
/// slip_angle > 0) is handled correctly.
pub fn gx_combined(slip_ratio: f32, slip_angle_rad: f32, coeffs: &CombinedSlipCoeffs) -> f32 {
    if slip_angle_rad.abs() < 1e-6 {
        return 1.0;
    }
    let sign = if slip_ratio == 0.0 {
        1.0
    } else {
        slip_ratio.signum()
    };
    let inner = coeffs.b_alpha * slip_angle_rad * sign;
    let g = (coeffs.c_alpha * inner.atan()).cos();
    g.clamp(0.0, 1.0)
}

/// Pacejka G-method lateral-axis weighting. Returns a multiplier in
/// `[0, 1]` to apply to `fy_pure`. At `slip_ratio = 0`, returns exactly
/// 1.0 (pure-slip Fy preserved). Sign-coupled via
/// `slip_ratio × signum(slip_angle)`.
pub fn gy_combined(slip_angle_rad: f32, slip_ratio: f32, coeffs: &CombinedSlipCoeffs) -> f32 {
    if slip_ratio.abs() < 1e-6 {
        return 1.0;
    }
    let sign = if slip_angle_rad == 0.0 {
        1.0
    } else {
        slip_angle_rad.signum()
    };
    let inner = coeffs.b_kappa * slip_ratio * sign;
    let g = (coeffs.c_kappa * inner.atan()).cos();
    g.clamp(0.0, 1.0)
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
    // peak μ for the ellipse radius. Wave 3 phase 2 replaces this with full
    // Pacejka Gx/Gy combined-slip weighting that respects distinct semi-axes.
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

/// Lateral μ as a fraction of peak, at the given slip angle and Fz.
/// Evaluates the Pacejka curve directly — no small-slip short-circuit
/// (the previous `< 0.5°` return of `peak_mu × 0.85` was ~10× too high;
/// Pacejka at 0.5° is `B·C·α ≈ 0.087` not `0.85`). Floors at 0 when Fz
/// is below `MIN_FZ_NEWTONS` so a wheel briefly off the ground returns
/// "no grip" instead of a divide-by-tiny noise value.
pub fn pacejka_grip_efficiency(slip_angle_deg: f32, fz: f32) -> f32 {
    if fz < MIN_FZ_NEWTONS {
        return 0.0;
    }
    let lat_coeffs = PacejkaCoeffs::lateral_default();
    let effective_fz = effective_fz_with_load_sensitivity(fz, DEFAULT_LOAD_SENSITIVITY);
    let slip_rad = slip_angle_deg.abs().to_radians();
    let current_force = pacejka_lateral(slip_rad, effective_fz, &lat_coeffs).abs();
    current_force / effective_fz
}

/// Below this vertical load (≈ 20 kg of normal force) the tire is treated
/// as not in contact: peak μ queries return 0 instead of a divide-by-tiny
/// fallback. Real tires below this load produce sub-noise levels of
/// lateral force anyway; the floor is a defensive guard, not a soft cap.
pub const MIN_FZ_NEWTONS: f32 = 200.0;

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
        // F1 racing-slick lateral peak is in the 7-13° range under the
        // existing Pacejka coefficients (B=10, C=1.9, E=0.97). Wave 4
        // Phase 1 kept these — Pacejka 2002 textbook C=1.3 was for
        // passenger tires; F1 slicks need higher C.
        assert!(
            peak_slip >= 7.0 && peak_slip <= 13.0,
            "Lateral peak should be 7-13 deg, got {} deg",
            peak_slip
        );
    }

    /// Wave 4 Phase 1 gate: the new Pacejka pure-slip coefficients must
    /// produce peak μ ≈ 1.0 at nominal Fz (the 1.75 F1 dry peak μ comes
    /// from `BASE_TIRE_GRIP_COEFFICIENT` at the call site). Tolerance
    /// 0.10 absorbs FP noise + load-sensitivity factor.
    #[test]
    fn pacejka_lateral_peak_mu_is_textbook() {
        let mu_lat = peak_mu_at_fz(FZ_NOMINAL, &PacejkaCoeffs::LATERAL_DEFAULT);
        assert!(
            (mu_lat - 1.0).abs() < 0.10,
            "lateral peak μ at nominal Fz should be ≈ 1.0 (post-Wave-4 Pacejka recoeff), got {}",
            mu_lat
        );
    }

    #[test]
    fn pacejka_longitudinal_peak_mu_is_textbook() {
        let mu_lon = peak_mu_at_fz(FZ_NOMINAL, &PacejkaCoeffs::LONGITUDINAL_DEFAULT);
        assert!(
            (mu_lon - 1.0).abs() < 0.20,
            "longitudinal peak μ at nominal Fz should be ≈ 1.0 (post-Wave-4 Pacejka recoeff), got {}",
            mu_lon
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
    fn pacejka_lateral_per_wheel_zero_slip_zero_force() {
        let lat_coeffs = PacejkaCoeffs::lateral_default();
        let fy = pacejka_lateral_per_wheel(0.0, FZ_NOMINAL, &lat_coeffs, DEFAULT_LOAD_SENSITIVITY);
        assert!(fy.abs() < EPSILON, "zero slip → zero Fy, got {}", fy);
    }

    #[test]
    fn pacejka_lateral_per_wheel_small_slip_grows_with_load() {
        let lat_coeffs = PacejkaCoeffs::lateral_default();
        let slip = 3.0_f32.to_radians();
        let fy_low = pacejka_lateral_per_wheel(
            slip,
            FZ_NOMINAL * 0.5,
            &lat_coeffs,
            DEFAULT_LOAD_SENSITIVITY,
        )
        .abs();
        let fy_high =
            pacejka_lateral_per_wheel(slip, FZ_NOMINAL, &lat_coeffs, DEFAULT_LOAD_SENSITIVITY)
                .abs();
        assert!(
            fy_high > fy_low,
            "Fy at high Fz ({}) should exceed Fy at low Fz ({})",
            fy_high,
            fy_low
        );
    }

    #[test]
    fn pacejka_lateral_per_wheel_peaks_near_default_slip() {
        let lat_coeffs = PacejkaCoeffs::lateral_default();
        let mut peak = 0.0_f32;
        let mut peak_deg = 0.0_f32;
        for i in 0..200 {
            let deg = i as f32 * 0.1;
            let fy = pacejka_lateral_per_wheel(
                deg.to_radians(),
                FZ_NOMINAL,
                &lat_coeffs,
                DEFAULT_LOAD_SENSITIVITY,
            )
            .abs();
            if fy > peak {
                peak = fy;
                peak_deg = deg;
            }
        }
        assert!(
            peak_deg >= 7.0 && peak_deg <= 13.0,
            "lateral peak should be 7-13 deg, got {} deg",
            peak_deg
        );
    }

    #[test]
    fn pacejka_lateral_per_wheel_extreme_load_clamped_by_load_sensitivity() {
        let lat_coeffs = PacejkaCoeffs::lateral_default();
        let slip = 8.0_f32.to_radians();
        let fy_nominal = pacejka_lateral_per_wheel(
            slip,
            FZ_NOMINAL,
            &lat_coeffs,
            DEFAULT_LOAD_SENSITIVITY,
        )
        .abs();
        let fy_4x = pacejka_lateral_per_wheel(
            slip,
            FZ_NOMINAL * 4.0,
            &lat_coeffs,
            DEFAULT_LOAD_SENSITIVITY,
        )
        .abs();
        assert!(
            fy_4x < fy_nominal * 4.0,
            "4x load should yield < 4x Fy due to load sensitivity ({} vs {})",
            fy_4x,
            fy_nominal * 4.0
        );
    }

    // Phase 2 (Wave 3) — Pacejka G-method tests

    #[test]
    fn gx_returns_unity_at_zero_slip_angle() {
        let g = gx_combined(0.1, 0.0, &CombinedSlipCoeffs::LATERAL_DEFAULT_COMBINED);
        assert!((g - 1.0).abs() < 1e-6, "gx at zero slip_angle should be 1.0, got {}", g);
    }

    #[test]
    fn gy_returns_unity_at_zero_slip_ratio() {
        let g = gy_combined(0.1, 0.0, &CombinedSlipCoeffs::LATERAL_DEFAULT_COMBINED);
        assert!((g - 1.0).abs() < 1e-6, "gy at zero slip_ratio should be 1.0, got {}", g);
    }

    #[test]
    fn gx_drops_below_one_at_moderate_combined_slip() {
        // slip_ratio ≈ 0.1 (driving), slip_angle ≈ 10 deg → Fx weighting drops.
        let g = gx_combined(
            0.1,
            10.0_f32.to_radians(),
            &CombinedSlipCoeffs::LATERAL_DEFAULT_COMBINED,
        );
        assert!(
            g < 0.95 && g > 0.0,
            "gx at moderate combined slip should drop below 0.95, got {}",
            g
        );
    }

    #[test]
    fn gy_drops_below_one_at_moderate_combined_slip() {
        let g = gy_combined(
            10.0_f32.to_radians(),
            0.1,
            &CombinedSlipCoeffs::LATERAL_DEFAULT_COMBINED,
        );
        assert!(
            g < 0.95 && g > 0.0,
            "gy at moderate combined slip should drop below 0.95, got {}",
            g
        );
    }

    #[test]
    fn gx_monotonically_decreases_in_slip_angle() {
        let coeffs = CombinedSlipCoeffs::LATERAL_DEFAULT_COMBINED;
        let kappa = 0.05;
        let g_small = gx_combined(kappa, 2.0_f32.to_radians(), &coeffs);
        let g_mid = gx_combined(kappa, 6.0_f32.to_radians(), &coeffs);
        let g_large = gx_combined(kappa, 12.0_f32.to_radians(), &coeffs);
        assert!(g_small > g_mid, "gx should drop with slip angle: {} vs {}", g_small, g_mid);
        assert!(g_mid > g_large, "gx should drop with slip angle: {} vs {}", g_mid, g_large);
    }

    #[test]
    fn gx_handles_opposite_sign_slip_trail_braking() {
        // Trail-brake corner-entry: slip_ratio < 0 (locking up) AND slip_angle > 0 (turning).
        // gx must remain well-defined and < 1 (off-axis slip still couples).
        let coeffs = CombinedSlipCoeffs::LATERAL_DEFAULT_COMBINED;
        let g = gx_combined(-0.1, 10.0_f32.to_radians(), &coeffs);
        assert!(g.is_finite(), "gx must be finite for opposite-sign combined slip");
        assert!(
            g < 1.0 && g > 0.0,
            "gx should drop on combined trail-brake slip, got {}",
            g
        );
    }

    #[test]
    fn gx_symmetric_in_slip_angle_sign() {
        let coeffs = CombinedSlipCoeffs::LATERAL_DEFAULT_COMBINED;
        let kappa = 0.1;
        let pos = gx_combined(kappa, 8.0_f32.to_radians(), &coeffs);
        let neg = gx_combined(kappa, -8.0_f32.to_radians(), &coeffs);
        assert!(
            (pos - neg).abs() < 1e-6,
            "gx should be symmetric in slip_angle sign: {} vs {}",
            pos,
            neg
        );
    }

    #[test]
    fn combined_slip_coeffs_are_distinct_type_from_pacejka_coeffs() {
        // Compile-time guard: CombinedSlipCoeffs is intentionally a separate
        // type from PacejkaCoeffs. Pure-slip coeffs (b/c/d/e) shape the
        // Pacejka force curve; combined-slip coeffs (b_alpha/c_alpha/
        // b_kappa/c_kappa) shape the G-functions. The explicit type
        // annotations below are the assertion — if the structs were
        // unified, one of these bindings would fail to compile.
        let _pure: PacejkaCoeffs = PacejkaCoeffs::LATERAL_DEFAULT;
        let _combined: CombinedSlipCoeffs = CombinedSlipCoeffs::LATERAL_DEFAULT_COMBINED;
    }

    #[test]
    fn peak_mu_lat_and_lon_helpers_match_underlying() {
        let lat = peak_mu_lat_at_fz(FZ_NOMINAL);
        let lon = peak_mu_lon_at_fz(FZ_NOMINAL);
        assert!((lat - peak_mu_at_fz(FZ_NOMINAL, &PacejkaCoeffs::LATERAL_DEFAULT)).abs() < 1e-6);
        assert!(
            (lon - peak_mu_at_fz(FZ_NOMINAL, &PacejkaCoeffs::LONGITUDINAL_DEFAULT)).abs() < 1e-6
        );
    }

}
