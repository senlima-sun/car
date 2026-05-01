//! Salisbury-type limited-slip differential.
//!
//! Stateless per-step constraint between RL and RR drive torque. Given a
//! total rear-axle drive torque and the live wheel speed differential,
//! computes how much torque each rear wheel actually receives.
//!
//! Salisbury physics:
//!   `T_lock = |T_input| × cot(θ) / 2 + preload`
//! where θ is the ramp angle. F1 LSDs are homologated with fixed ramps
//! (75° power / 60° coast); only `preload` is tunable between sessions.
//!
//! Behaviour:
//!   * Open diff (preload = 0, ramp ≥ 89°): cot ≈ 0 → 50/50 split, no
//!     transfer, fast wheel just spins.
//!   * Locked diff (small ramp): large lock torque → nearly equal wheel
//!     torques despite Δω, traction recovered at the cost of inducing
//!     understeer.
//!   * Asymmetric: power ramp tighter (75° default) so the diff opens
//!     under power; coast ramp wider (60° default) so it locks more on
//!     overrun, stabilising corner entry.

const DELTA_OMEGA_DEADBAND_RAD_S: f32 = 0.01;
const DEFAULT_PRELOAD_NM: f32 = 60.0;
const DEFAULT_POWER_RAMP_DEG: f32 = 75.0;
const DEFAULT_COAST_RAMP_DEG: f32 = 60.0;
const RAMP_MIN_DEG: f32 = 5.0;
const RAMP_MAX_DEG: f32 = 89.0;
const PRELOAD_MIN_NM: f32 = 0.0;
const PRELOAD_MAX_NM: f32 = 300.0;

#[derive(Debug, Clone, Copy)]
pub struct DifferentialConfig {
    preload_nm: f32,
    power_ramp_deg: f32,
    coast_ramp_deg: f32,
}

impl Default for DifferentialConfig {
    fn default() -> Self {
        Self {
            preload_nm: DEFAULT_PRELOAD_NM,
            power_ramp_deg: DEFAULT_POWER_RAMP_DEG,
            coast_ramp_deg: DEFAULT_COAST_RAMP_DEG,
        }
    }
}

impl DifferentialConfig {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn preload_nm(&self) -> f32 {
        self.preload_nm
    }

    pub fn power_ramp_deg(&self) -> f32 {
        self.power_ramp_deg
    }

    pub fn coast_ramp_deg(&self) -> f32 {
        self.coast_ramp_deg
    }

    pub fn set_preload_nm(&mut self, nm: f32) {
        if nm.is_finite() {
            self.preload_nm = nm.clamp(PRELOAD_MIN_NM, PRELOAD_MAX_NM);
        }
    }

    pub fn set_power_ramp_deg(&mut self, deg: f32) {
        if deg.is_finite() {
            self.power_ramp_deg = deg.clamp(RAMP_MIN_DEG, RAMP_MAX_DEG);
        }
    }

    pub fn set_coast_ramp_deg(&mut self, deg: f32) {
        if deg.is_finite() {
            self.coast_ramp_deg = deg.clamp(RAMP_MIN_DEG, RAMP_MAX_DEG);
        }
    }

    /// Distribute total rear-axle drive torque between RL and RR wheels.
    /// Positive `axle_torque_nm` = drive (uses power ramp); negative =
    /// engine-braking through the diff (uses coast ramp). `omega_*` are
    /// rear-wheel angular velocities (rad/s).
    pub fn distribute_axle_torque(
        &self,
        axle_torque_nm: f32,
        omega_rl: f32,
        omega_rr: f32,
    ) -> (f32, f32) {
        let baseline = axle_torque_nm * 0.5;
        let delta_omega = omega_rl - omega_rr;
        if delta_omega.abs() < DELTA_OMEGA_DEADBAND_RAD_S {
            return (baseline, baseline);
        }

        let ramp_deg = if axle_torque_nm >= 0.0 {
            self.power_ramp_deg
        } else {
            self.coast_ramp_deg
        };
        let lock = salisbury_lock_torque(axle_torque_nm, self.preload_nm, ramp_deg);

        // Cap transfer at half the input torque so the slow wheel never
        // gets more than the fast wheel was *trying* to deliver.
        let transfer_cap = (axle_torque_nm.abs() * 0.5).max(self.preload_nm);
        let transfer = lock.min(transfer_cap);

        // Lock opposes Δω: faster wheel loses torque, slower wheel gains.
        let signed = transfer * delta_omega.signum();
        (baseline - signed, baseline + signed)
    }
}

/// Salisbury lock torque magnitude (Nm). Pure function.
pub fn salisbury_lock_torque(input_torque_nm: f32, preload_nm: f32, ramp_deg: f32) -> f32 {
    let ramp = ramp_deg.clamp(RAMP_MIN_DEG, RAMP_MAX_DEG).to_radians();
    let cot = ramp.tan().recip().max(0.0);
    (input_torque_nm.abs() * cot * 0.5) + preload_nm.max(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    const EPS: f32 = 1e-3;

    #[test]
    fn open_diff_with_no_preload_yields_near_5050_split() {
        let mut diff = DifferentialConfig::new();
        diff.set_preload_nm(0.0);
        diff.set_power_ramp_deg(RAMP_MAX_DEG);
        diff.set_coast_ramp_deg(RAMP_MAX_DEG);
        let (rl, rr) = diff.distribute_axle_torque(1000.0, 50.0, 30.0);
        // At the maximum 89° ramp, cot ≈ 0.017 → ~8.7 Nm transfer.
        // Conservation holds; per-wheel deviation is bounded by that.
        assert!((rl + rr - 1000.0).abs() < EPS);
        assert!((rl - 500.0).abs() < 15.0, "rl {}", rl);
        assert!((rr - 500.0).abs() < 15.0, "rr {}", rr);
    }

    #[test]
    fn deadband_at_zero_delta_omega_returns_baseline() {
        let diff = DifferentialConfig::new();
        let (rl, rr) = diff.distribute_axle_torque(1000.0, 50.0, 50.0);
        assert!((rl - 500.0).abs() < EPS);
        assert!((rr - 500.0).abs() < EPS);
    }

    #[test]
    fn locked_diff_drives_slow_wheel_harder() {
        let mut diff = DifferentialConfig::new();
        diff.set_power_ramp_deg(15.0);
        let (rl, rr) = diff.distribute_axle_torque(1000.0, 80.0, 20.0);
        assert!(rr > rl, "slow (RR) should get more: rl {}, rr {}", rl, rr);
        // Conservation: always sum to input.
        assert!((rl + rr - 1000.0).abs() < EPS);
    }

    #[test]
    fn power_ramp_used_when_torque_positive() {
        let mut diff = DifferentialConfig::new();
        diff.set_preload_nm(0.0);
        diff.set_power_ramp_deg(15.0);
        diff.set_coast_ramp_deg(80.0);
        let (rl, rr) = diff.distribute_axle_torque(1000.0, 80.0, 20.0);
        let split = (rr - rl).abs();
        assert!(split > 100.0, "tight power ramp should transfer significant torque, got {}", split);
    }

    #[test]
    fn coast_ramp_used_when_torque_negative() {
        let mut diff = DifferentialConfig::new();
        diff.set_preload_nm(0.0);
        diff.set_power_ramp_deg(80.0);
        diff.set_coast_ramp_deg(15.0);
        let (rl, rr) = diff.distribute_axle_torque(-1000.0, 80.0, 20.0);
        let split = (rr - rl).abs();
        assert!(split > 100.0, "tight coast ramp on overrun should transfer torque, got {}", split);
    }

    #[test]
    fn preload_resists_delta_omega_at_zero_input_torque() {
        let mut diff = DifferentialConfig::new();
        diff.set_preload_nm(50.0);
        let (rl, rr) = diff.distribute_axle_torque(0.0, 80.0, 20.0);
        // Both wheels still get net torque from the preload, opposing the spin gradient.
        assert!(rl < 0.0 && rr > 0.0, "preload should brake fast wheel, drive slow: rl {}, rr {}", rl, rr);
        assert!((rl + rr).abs() < EPS, "preload conserves: rl + rr = 0");
    }

    #[test]
    fn transfer_capped_at_half_input_torque() {
        let mut diff = DifferentialConfig::new();
        diff.set_preload_nm(0.0);
        diff.set_power_ramp_deg(5.0);
        let (rl, rr) = diff.distribute_axle_torque(1000.0, 100.0, 0.0);
        assert!(rl >= 0.0 - EPS, "fast wheel cannot drive backwards: rl {}", rl);
        assert!(rr <= 1000.0 + EPS, "slow wheel cannot exceed total: rr {}", rr);
    }

    #[test]
    fn salisbury_lock_zero_at_open_ramp() {
        let lock = salisbury_lock_torque(1000.0, 0.0, 89.0);
        assert!(lock < 10.0, "open ramp should give near-zero lock, got {}", lock);
    }

    #[test]
    fn salisbury_lock_grows_with_input_torque() {
        let lo = salisbury_lock_torque(500.0, 0.0, 30.0);
        let hi = salisbury_lock_torque(1500.0, 0.0, 30.0);
        assert!(hi > lo);
        assert!((hi / lo - 3.0).abs() < 0.01, "linear in torque");
    }

    #[test]
    fn salisbury_lock_grows_as_ramp_tightens() {
        let wide = salisbury_lock_torque(1000.0, 0.0, 80.0);
        let narrow = salisbury_lock_torque(1000.0, 0.0, 20.0);
        assert!(narrow > wide * 5.0, "narrow ramp should lock far more; wide {}, narrow {}", wide, narrow);
    }

    #[test]
    fn salisbury_lock_includes_preload_at_zero_input() {
        let lock = salisbury_lock_torque(0.0, 80.0, 30.0);
        assert!((lock - 80.0).abs() < EPS);
    }

    #[test]
    fn config_setters_clamp_invalid_inputs() {
        let mut diff = DifferentialConfig::new();
        diff.set_preload_nm(f32::NAN);
        assert_eq!(diff.preload_nm(), DEFAULT_PRELOAD_NM);
        diff.set_preload_nm(99999.0);
        assert_eq!(diff.preload_nm(), PRELOAD_MAX_NM);
        diff.set_preload_nm(-50.0);
        assert_eq!(diff.preload_nm(), PRELOAD_MIN_NM);

        diff.set_power_ramp_deg(0.0);
        assert_eq!(diff.power_ramp_deg(), RAMP_MIN_DEG);
        diff.set_power_ramp_deg(180.0);
        assert_eq!(diff.power_ramp_deg(), RAMP_MAX_DEG);
    }

    #[test]
    fn negative_delta_omega_inverts_redistribution() {
        let mut diff = DifferentialConfig::new();
        diff.set_power_ramp_deg(15.0);
        // RR faster than RL — RL should now gain torque.
        let (rl, rr) = diff.distribute_axle_torque(1000.0, 20.0, 80.0);
        assert!(rl > rr, "rl should now be the slow/gripping wheel: rl {}, rr {}", rl, rr);
        assert!((rl + rr - 1000.0).abs() < EPS);
    }

    #[test]
    fn conservation_holds_under_arbitrary_inputs() {
        let mut diff = DifferentialConfig::new();
        diff.set_preload_nm(40.0);
        diff.set_power_ramp_deg(45.0);
        for &(t, w_rl, w_rr) in &[
            (0.0, 100.0, 50.0),
            (500.0, 30.0, 60.0),
            (-800.0, 70.0, 20.0),
            (1500.0, 40.0, 40.001),
        ] {
            let (rl, rr) = diff.distribute_axle_torque(t, w_rl, w_rr);
            assert!((rl + rr - t).abs() < EPS, "conservation breaks for t={}: rl+rr={}", t, rl + rr);
        }
    }
}
