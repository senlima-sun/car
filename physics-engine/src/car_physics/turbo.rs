//! 2026-spec turbocharger / boost-pressure model.
//!
//! Output: a `boost_multiplier ∈ [0.5, 1.0]` that scales ICE torque inside
//! `powertrain.rs`. State: a single boost-pressure value in bar absolute,
//! integrated by a first-order lowpass toward an exhaust-flow-driven target.
//!
//! Physics anchors (FIA 2026 PU regs, Article 5.5):
//!   * single-stage, single-sided, single-inlet compressor
//!   * variable geometry forbidden (wastegates only)
//!   * intake pressure ceiling = 4.8 bar absolute
//!   * MGU-H removed → real spool-up window returns
//!
//! Time constant τ = 0.20 s sits mid-band of the rotor-inertia +
//! exhaust-mass-flow envelope (0.15-0.25 s) for a 150,000-rpm-class shaft;
//! upper end of the band corresponds to the no-MGU-H 2026 spec.
//!
//! Multiplier endpoints `[0.5, 1.0]`:
//!   * 1.0 ceiling — `PEAK_TORQUE_NM = 480 Nm` is the FIA-spec full-boost
//!     figure, so the calibrated torque curve already represents the
//!     fully-spooled state. The multiplier therefore caps at 1.0 and only
//!     subtracts during spool-up; at saturation it is a no-op.
//!   * 0.5 floor — naturally-aspirated 1.6 L V6 BMEP at zero relative boost
//!     is roughly half of the boosted spec.

use crate::utils::smoothstep;

pub const ATMOSPHERIC_BAR: f32 = 1.0;
pub const MAX_BOOST_BAR: f32 = 4.8;

const TURBO_LOWPASS_TAU_S: f32 = 0.20;

// RPM band over which exhaust enthalpy ramps from "can't sustain boost"
// to "saturates target boost". Mirrors `IDLE_RPM` and `PEAK_TORQUE_RPM`
// in `powertrain.rs`; redeclared here so the turbo module stays
// independent of powertrain internals.
const TURBO_SPOOL_RPM_LOW: f32 = 4000.0;
const TURBO_SPOOL_RPM_HIGH: f32 = 10500.0;

const ANTI_LAG_THROTTLE_THRESHOLD: f32 = 0.05;
const ANTI_LAG_FLOOR_FRACTION: f32 = 0.4;

pub const MULTIPLIER_FLOOR: f32 = 0.5;
pub const MULTIPLIER_CEILING: f32 = 1.0;

#[derive(Debug, Clone, Copy)]
pub struct TurboState {
    boost_bar: f32,
    anti_lag_strength: f32,
}

impl Default for TurboState {
    fn default() -> Self {
        Self {
            boost_bar: ATMOSPHERIC_BAR,
            anti_lag_strength: 0.0,
        }
    }
}

impl TurboState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_anti_lag_strength(&mut self, strength: f32) {
        self.anti_lag_strength = strength.clamp(0.0, 1.0);
    }

    pub fn boost_bar(&self) -> f32 {
        self.boost_bar
    }

    pub fn boost_multiplier(&self) -> f32 {
        boost_to_multiplier(self.boost_bar)
    }

    /// Integrate boost toward the exhaust-flow-driven target. Returns
    /// `(boost_bar, boost_multiplier)` so callers can route the multiplier
    /// into `powertrain.update` without re-deriving it.
    pub fn update(&mut self, throttle: f32, rpm: f32, dt: f32) -> (f32, f32) {
        let target = target_boost_bar(throttle, rpm, self.anti_lag_strength);
        let alpha = (dt / (TURBO_LOWPASS_TAU_S + dt)).clamp(0.0, 1.0);
        self.boost_bar += (target - self.boost_bar) * alpha;
        (self.boost_bar, boost_to_multiplier(self.boost_bar))
    }
}

/// Steady-state boost target as a function of throttle, RPM, and the
/// anti-lag strength setting. Pure function — no state.
pub fn target_boost_bar(throttle: f32, rpm: f32, anti_lag: f32) -> f32 {
    let throttle = throttle.clamp(0.0, 1.0);
    let anti_lag = anti_lag.clamp(0.0, 1.0);

    let rpm_ratio = ((rpm - TURBO_SPOOL_RPM_LOW)
        / (TURBO_SPOOL_RPM_HIGH - TURBO_SPOOL_RPM_LOW))
        .clamp(0.0, 1.0);
    let rpm_factor = smoothstep(rpm_ratio);

    let span = MAX_BOOST_BAR - ATMOSPHERIC_BAR;
    let direct_target = ATMOSPHERIC_BAR + span * throttle * rpm_factor;

    if anti_lag == 0.0 || throttle >= ANTI_LAG_THROTTLE_THRESHOLD || rpm <= TURBO_SPOOL_RPM_LOW {
        return direct_target;
    }

    // Models overrun fuelling without simulating combustion.
    let full_throttle_target = ATMOSPHERIC_BAR + span * rpm_factor;
    let anti_lag_floor =
        ATMOSPHERIC_BAR + (full_throttle_target - ATMOSPHERIC_BAR) * anti_lag * ANTI_LAG_FLOOR_FRACTION;
    direct_target.max(anti_lag_floor)
}

/// Linear BMEP-vs-pressure map from boost (bar absolute) to the torque
/// multiplier consumed by `powertrain.rs`. Pure function.
pub fn boost_to_multiplier(boost_bar: f32) -> f32 {
    let span = MAX_BOOST_BAR - ATMOSPHERIC_BAR;
    let t = ((boost_bar - ATMOSPHERIC_BAR) / span).clamp(0.0, 1.0);
    MULTIPLIER_FLOOR + (MULTIPLIER_CEILING - MULTIPLIER_FLOOR) * t
}

#[cfg(test)]
mod tests {
    use super::*;

    const EPS: f32 = 1e-3;

    #[test]
    fn target_at_zero_throttle_is_atmospheric() {
        assert!((target_boost_bar(0.0, 12_000.0, 0.0) - ATMOSPHERIC_BAR).abs() < EPS);
    }

    #[test]
    fn target_below_idle_rpm_is_atmospheric_even_full_throttle() {
        assert!((target_boost_bar(1.0, 3_000.0, 0.0) - ATMOSPHERIC_BAR).abs() < EPS);
    }

    #[test]
    fn target_at_full_throttle_full_rpm_hits_max() {
        let t = target_boost_bar(1.0, 12_000.0, 0.0);
        assert!((t - MAX_BOOST_BAR).abs() < EPS, "got {}", t);
    }

    #[test]
    fn target_above_peak_rpm_saturates() {
        let mid = target_boost_bar(1.0, 12_000.0, 0.0);
        let high = target_boost_bar(1.0, 14_000.0, 0.0);
        assert!((mid - high).abs() < EPS, "{} vs {}", mid, high);
    }

    #[test]
    fn target_monotonic_in_throttle() {
        let a = target_boost_bar(0.2, 9_000.0, 0.0);
        let b = target_boost_bar(0.5, 9_000.0, 0.0);
        let c = target_boost_bar(1.0, 9_000.0, 0.0);
        assert!(a < b && b < c, "{} < {} < {}", a, b, c);
    }

    #[test]
    fn wastegate_caps_at_max_boost() {
        for rpm in [8_000.0, 10_500.0, 14_000.0, 18_000.0] {
            let t = target_boost_bar(1.0, rpm, 1.0);
            assert!(t <= MAX_BOOST_BAR + EPS, "rpm={} target={}", rpm, t);
        }
    }

    #[test]
    fn multiplier_endpoints_match_spec() {
        assert!((boost_to_multiplier(ATMOSPHERIC_BAR) - MULTIPLIER_FLOOR).abs() < EPS);
        assert!((boost_to_multiplier(MAX_BOOST_BAR) - MULTIPLIER_CEILING).abs() < EPS);
        let mid = boost_to_multiplier((ATMOSPHERIC_BAR + MAX_BOOST_BAR) * 0.5);
        let expected_mid = (MULTIPLIER_FLOOR + MULTIPLIER_CEILING) * 0.5;
        assert!((mid - expected_mid).abs() < EPS);
    }

    #[test]
    fn multiplier_clamped_outside_range() {
        assert!((boost_to_multiplier(0.5) - MULTIPLIER_FLOOR).abs() < EPS);
        assert!((boost_to_multiplier(10.0) - MULTIPLIER_CEILING).abs() < EPS);
    }

    #[test]
    fn anti_lag_lifts_floor_on_overrun() {
        let no_assist = target_boost_bar(0.0, 12_000.0, 0.0);
        let assisted = target_boost_bar(0.0, 12_000.0, 1.0);
        assert!(assisted > no_assist, "{} should exceed {}", assisted, no_assist);
    }

    #[test]
    fn boost_settles_to_target_in_about_5tau() {
        let mut turbo = TurboState::new();
        let dt = 1.0 / 120.0;
        for _ in 0..120 {
            turbo.update(1.0, 12_000.0, dt);
        }
        let final_boost = turbo.boost_bar();
        let err = (final_boost - MAX_BOOST_BAR).abs() / MAX_BOOST_BAR;
        assert!(err < 0.01, "settled at {} after 1s, want ~{}", final_boost, MAX_BOOST_BAR);
    }

    #[test]
    fn boost_does_not_overshoot_after_step() {
        let mut turbo = TurboState::new();
        let dt = 1.0 / 120.0;
        for _ in 0..240 {
            let (b, _) = turbo.update(1.0, 12_000.0, dt);
            assert!(b <= MAX_BOOST_BAR + 1e-3, "overshoot: {}", b);
        }
    }

    #[test]
    fn boost_decays_toward_atmospheric_on_lift() {
        let mut turbo = TurboState::new();
        turbo.boost_bar = MAX_BOOST_BAR;
        let dt = 1.0 / 120.0;
        for _ in 0..180 {
            turbo.update(0.0, 12_000.0, dt);
        }
        let err = (turbo.boost_bar() - ATMOSPHERIC_BAR).abs() / ATMOSPHERIC_BAR;
        assert!(err < 0.05, "decayed to {}, want near {}", turbo.boost_bar(), ATMOSPHERIC_BAR);
    }

    #[test]
    fn boost_holds_above_atmospheric_with_anti_lag() {
        let mut turbo = TurboState::new();
        turbo.boost_bar = MAX_BOOST_BAR;
        turbo.set_anti_lag_strength(1.0);
        let dt = 1.0 / 120.0;
        for _ in 0..180 {
            turbo.update(0.0, 12_000.0, dt);
        }
        let held = turbo.boost_bar();
        assert!(held > ATMOSPHERIC_BAR + 0.2, "anti-lag held only {}", held);
        assert!(held < MAX_BOOST_BAR, "anti-lag should not reach full boost ({})", held);
    }

    #[test]
    fn update_returns_consistent_multiplier() {
        let mut turbo = TurboState::new();
        let dt = 1.0 / 120.0;
        for i in 0..60 {
            let throttle = if i % 2 == 0 { 1.0 } else { 0.0 };
            let (boost, mult) = turbo.update(throttle, 9_000.0, dt);
            assert!((mult - boost_to_multiplier(boost)).abs() < EPS);
        }
    }

    #[test]
    fn single_step_dt_zero_is_no_op() {
        let mut turbo = TurboState::new();
        turbo.boost_bar = 2.5;
        turbo.update(1.0, 12_000.0, 0.0);
        assert!((turbo.boost_bar() - 2.5).abs() < EPS);
    }
}
