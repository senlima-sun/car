//! Per-half-axle driveshaft torsional compliance.
//!
//! Each rear shaft is a 1-DOF torsional spring-damper between the
//! gearbox output and the wheel hub. Twist θ is integrated each step;
//! the delivered torque is `T = k · θ + c · Δω` where Δω is the speed
//! mismatch between gearbox-side and wheel-side angular velocities.
//!
//! Defaults (k=15 kNm/rad, c=20 Nm·s/rad) sit at f_n ≈ 6.9 Hz with a
//! reflected-inertia of ~8 kg·m² → ω_n·dt ≈ 0.36 at 120 Hz, well inside
//! the explicit-Euler stability envelope.

use crate::utils::sanitize;

pub const DEFAULT_STIFFNESS_NM_RAD: f32 = 15_000.0;
pub const DEFAULT_DAMPING_NM_S_RAD: f32 = 20.0;
pub const STIFFNESS_MIN_NM_RAD: f32 = 1_000.0;
pub const STIFFNESS_MAX_NM_RAD: f32 = 50_000.0;
pub const DAMPING_MIN_NM_S_RAD: f32 = 0.0;
pub const DAMPING_MAX_NM_S_RAD: f32 = 500.0;

/// Cap above the production range, used only by the bit-equivalence test
/// in `wheel_force.rs` (extreme stiffness ≈ rigid shaft baseline).
pub(crate) const STIFFNESS_TEST_CAP_NM_RAD: f32 = 200_000.0;

#[derive(Debug, Clone, Copy)]
pub struct ShaftConfig {
    stiffness_nm_rad: f32,
    damping_nm_s_rad: f32,
}

impl Default for ShaftConfig {
    fn default() -> Self {
        Self {
            stiffness_nm_rad: DEFAULT_STIFFNESS_NM_RAD,
            damping_nm_s_rad: DEFAULT_DAMPING_NM_S_RAD,
        }
    }
}

impl ShaftConfig {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn stiffness_nm_rad(&self) -> f32 {
        self.stiffness_nm_rad
    }

    pub fn damping_nm_s_rad(&self) -> f32 {
        self.damping_nm_s_rad
    }

    pub fn set_stiffness_nm_rad(&mut self, k: f32) {
        if k.is_finite() {
            self.stiffness_nm_rad = k.clamp(STIFFNESS_MIN_NM_RAD, STIFFNESS_MAX_NM_RAD);
        }
    }

    #[cfg(test)]
    pub(crate) fn set_stiffness_for_test(&mut self, k: f32) {
        self.stiffness_nm_rad = k.clamp(STIFFNESS_MIN_NM_RAD, STIFFNESS_TEST_CAP_NM_RAD);
    }

    pub fn set_damping_nm_s_rad(&mut self, c: f32) {
        if c.is_finite() {
            self.damping_nm_s_rad = c.clamp(DAMPING_MIN_NM_S_RAD, DAMPING_MAX_NM_S_RAD);
        }
    }
}

/// First-order exponential decay toward zero. Used by the integrator
/// when the drivetrain is disengaged (clutch open / shifting /
/// off-throttle) to bleed off the delivered shaft torque so the shaft
/// can't add a phantom engine-brake on top of the powertrain's own
/// engine-brake force.
pub fn decay_first_order(value: f32, dt: f32, tau_s: f32) -> f32 {
    let dt = sanitize(dt, 0.0).max(0.0);
    let tau = sanitize(tau_s, 0.05).max(1e-3);
    let alpha = dt / (tau + dt);
    sanitize(value, 0.0) * (1.0 - alpha)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_setters_clamp_to_range() {
        let mut cfg = ShaftConfig::new();
        cfg.set_stiffness_nm_rad(0.0);
        assert_eq!(cfg.stiffness_nm_rad(), STIFFNESS_MIN_NM_RAD);
        cfg.set_stiffness_nm_rad(1_000_000.0);
        assert_eq!(cfg.stiffness_nm_rad(), STIFFNESS_MAX_NM_RAD);
        cfg.set_stiffness_nm_rad(f32::NAN);
        assert_eq!(cfg.stiffness_nm_rad(), STIFFNESS_MAX_NM_RAD);
        cfg.set_damping_nm_s_rad(-50.0);
        assert_eq!(cfg.damping_nm_s_rad(), DAMPING_MIN_NM_S_RAD);
        cfg.set_damping_nm_s_rad(99999.0);
        assert_eq!(cfg.damping_nm_s_rad(), DAMPING_MAX_NM_S_RAD);

        cfg.set_stiffness_for_test(STIFFNESS_TEST_CAP_NM_RAD);
        assert_eq!(cfg.stiffness_nm_rad(), STIFFNESS_TEST_CAP_NM_RAD);
    }

    #[test]
    fn decay_pulls_value_toward_zero() {
        let v0 = 1000.0;
        let mut v = v0;
        for _ in 0..30 {
            v = decay_first_order(v, 1.0 / 120.0, 0.05);
        }
        assert!(v.abs() < v0 * 0.05, "decayed to {}", v);
    }

    #[test]
    fn decay_handles_nan_dt_and_value() {
        let v = decay_first_order(f32::NAN, f32::NAN, 0.05);
        assert_eq!(v, 0.0);
    }

    #[test]
    fn decay_short_dt_barely_changes_value() {
        let v = decay_first_order(100.0, 1e-6, 0.05);
        assert!((v - 100.0).abs() < 0.01, "expected ~100, got {}", v);
    }
}
