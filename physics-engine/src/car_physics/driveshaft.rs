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

/// Forward-Euler shaft step. Pure function.
///
/// Returns `(new_twist_rad, delivered_torque_nm)`.
///
/// `omega_engine_side` and `omega_wheel` are the angular velocities of
/// the two ends of the shaft, in rad/s. Twist accumulates the speed
/// mismatch; delivered torque is the spring-damper reaction the wheel
/// actually feels.
pub fn delivered_torque(
    twist_rad: f32,
    omega_engine_side: f32,
    omega_wheel: f32,
    cfg: &ShaftConfig,
    dt: f32,
) -> (f32, f32) {
    let dt = sanitize(dt, 0.0).max(0.0);
    let omega_e = sanitize(omega_engine_side, 0.0);
    let omega_w = sanitize(omega_wheel, 0.0);
    let twist = sanitize(twist_rad, 0.0);

    let delta_omega = omega_e - omega_w;
    let new_twist = twist + delta_omega * dt;
    let torque = cfg.stiffness_nm_rad() * new_twist + cfg.damping_nm_s_rad() * delta_omega;
    (new_twist, torque)
}

/// Exponential decay of accumulated twist when the drivetrain is
/// disengaged (clutch open / shifting / off-throttle). Prevents the
/// shaft from delivering a phantom engine-brake torque that would
/// double-count `pt_out.engine_brake_force`.
pub fn decay_twist(twist_rad: f32, dt: f32, tau_s: f32) -> f32 {
    let dt = sanitize(dt, 0.0).max(0.0);
    let tau = sanitize(tau_s, 0.05).max(1e-3);
    let alpha = dt / (tau + dt);
    sanitize(twist_rad, 0.0) * (1.0 - alpha)
}

#[cfg(test)]
mod tests {
    use super::*;

    const EPS: f32 = 1e-3;

    #[test]
    fn zero_delta_omega_produces_zero_torque_at_zero_twist() {
        let cfg = ShaftConfig::new();
        let (twist, t) = delivered_torque(0.0, 100.0, 100.0, &cfg, 1.0 / 120.0);
        assert!((twist).abs() < EPS);
        assert!(t.abs() < EPS);
    }

    #[test]
    fn step_input_builds_twist_and_torque() {
        let cfg = ShaftConfig::new();
        let (twist, t) = delivered_torque(0.0, 100.0, 0.0, &cfg, 1.0 / 120.0);
        assert!(twist > 0.0);
        assert!(t > 0.0, "torque must be positive when engine spins faster");
    }

    #[test]
    fn negative_delta_yields_negative_torque() {
        let cfg = ShaftConfig::new();
        let (_, t) = delivered_torque(0.0, 50.0, 80.0, &cfg, 1.0 / 120.0);
        assert!(t < 0.0);
    }

    #[test]
    fn stiffer_shaft_delivers_more_torque_for_same_twist() {
        let mut soft = ShaftConfig::new();
        soft.set_stiffness_nm_rad(5_000.0);
        let mut stiff = ShaftConfig::new();
        stiff.set_stiffness_nm_rad(40_000.0);
        let twist = 0.01;
        let (_, t_soft) = delivered_torque(twist, 0.0, 0.0, &soft, 0.0);
        let (_, t_stiff) = delivered_torque(twist, 0.0, 0.0, &stiff, 0.0);
        assert!(t_stiff > t_soft * 5.0);
    }

    #[test]
    fn damping_term_responds_to_velocity_only() {
        let mut cfg = ShaftConfig::new();
        cfg.set_stiffness_nm_rad(STIFFNESS_MIN_NM_RAD);
        cfg.set_damping_nm_s_rad(100.0);
        let (_, t_zero_dw) = delivered_torque(0.0, 50.0, 50.0, &cfg, 0.0);
        let (_, t_dw) = delivered_torque(0.0, 100.0, 50.0, &cfg, 0.0);
        assert!(t_dw > t_zero_dw);
    }

    #[test]
    fn nan_inputs_sanitise_to_zero() {
        let cfg = ShaftConfig::new();
        let (twist, t) = delivered_torque(f32::NAN, f32::NAN, f32::NAN, &cfg, f32::NAN);
        assert_eq!(twist, 0.0);
        assert_eq!(t, 0.0);
    }

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

        cfg.set_stiffness_for_test(STIFFNESS_TEST_CAP_NM_RAD);
        assert_eq!(cfg.stiffness_nm_rad(), STIFFNESS_TEST_CAP_NM_RAD);
    }

    #[test]
    fn twist_decays_toward_zero_when_disengaged() {
        let twist0 = 0.05;
        let mut twist = twist0;
        for _ in 0..30 {
            twist = decay_twist(twist, 1.0 / 120.0, 0.05);
        }
        assert!(twist.abs() < twist0 * 0.05, "decayed to {}", twist);
    }

    #[test]
    fn delivered_torque_grows_monotonically_under_constant_delta_omega() {
        // With constant Δω, twist grows linearly. Torque rises until the
        // damping term and the spring term match the input; for a constant
        // engine-side velocity vs locked wheel, torque grows without bound
        // — so this test checks the early transient is monotonic in time.
        let cfg = ShaftConfig::new();
        let mut twist = 0.0;
        let mut prev_t = 0.0;
        for _ in 0..10 {
            let (new_twist, t) = delivered_torque(twist, 50.0, 0.0, &cfg, 1.0 / 120.0);
            twist = new_twist;
            assert!(t >= prev_t - EPS, "torque non-monotone: {} → {}", prev_t, t);
            prev_t = t;
        }
    }
}
