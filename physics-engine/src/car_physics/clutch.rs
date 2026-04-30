//! Minimum-viable clutch model. Wave 3 Phase 5.
//!
//! `ClutchState` tracks engagement on `[0, 1]`. At low engine RPM the
//! clutch slips (engagement ≈ 0.1) — this both reduces transmitted drive
//! torque and reduces the reflected engine inertia at the driven wheels
//! so the wheel-spin ODE doesn't see infinite mass at standstill.
//!
//! Engagement curve:
//!   engine_rpm ≤ THRESHOLD_FACTOR × FULL_RPM → engagement = SLIP_FLOOR (slipping)
//!   engine_rpm ≥ FULL_RPM                    → engagement = 1.0 (locked)
//!   in between                               → smoothstep
//!
//! The actual integrated value follows the target via a first-order
//! lowpass with `CLUTCH_TIME_CONSTANT_S` so engagement doesn't snap
//! when the engine crosses the threshold during a shift.

use crate::utils::smoothstep;

pub const CLUTCH_FULL_ENGAGEMENT_RPM: f32 = 4500.0;
const CLUTCH_SLIP_FLOOR: f32 = 0.4;
const CLUTCH_SLIP_THRESHOLD_FACTOR: f32 = 0.5;
const CLUTCH_TIME_CONSTANT_S: f32 = 0.05;

#[derive(Debug, Clone, Copy)]
pub struct ClutchState {
    engagement: f32,
}

impl Default for ClutchState {
    fn default() -> Self {
        Self::new()
    }
}

impl ClutchState {
    pub fn new() -> Self {
        Self {
            engagement: CLUTCH_SLIP_FLOOR,
        }
    }

    /// Compute the target engagement for a given engine RPM (no smoothing).
    /// Pure function used by the integrator and tests.
    pub fn target_engagement(engine_rpm: f32) -> f32 {
        let slip_threshold = CLUTCH_FULL_ENGAGEMENT_RPM * CLUTCH_SLIP_THRESHOLD_FACTOR;
        if engine_rpm <= slip_threshold {
            CLUTCH_SLIP_FLOOR
        } else if engine_rpm >= CLUTCH_FULL_ENGAGEMENT_RPM {
            1.0
        } else {
            let t = (engine_rpm - slip_threshold)
                / (CLUTCH_FULL_ENGAGEMENT_RPM - slip_threshold);
            CLUTCH_SLIP_FLOOR + (1.0 - CLUTCH_SLIP_FLOOR) * smoothstep(t)
        }
    }

    /// Integrate engagement toward the target over `dt`. Lowpass time
    /// constant `CLUTCH_TIME_CONSTANT_S` ensures the engagement doesn't
    /// snap during an upshift/downshift. Returns the post-update value.
    pub fn engagement_for(&mut self, engine_rpm: f32, dt: f32) -> f32 {
        let target = Self::target_engagement(engine_rpm);
        let alpha = (dt / (CLUTCH_TIME_CONSTANT_S + dt)).clamp(0.0, 1.0);
        self.engagement += (target - self.engagement) * alpha;
        self.engagement
    }

    pub fn engagement(&self) -> f32 {
        self.engagement
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const EPS: f32 = 1e-3;

    #[test]
    fn target_at_zero_rpm_floors_to_slip() {
        assert!((ClutchState::target_engagement(0.0) - CLUTCH_SLIP_FLOOR).abs() < EPS);
    }

    #[test]
    fn target_at_full_engagement_rpm_locks() {
        assert!((ClutchState::target_engagement(CLUTCH_FULL_ENGAGEMENT_RPM) - 1.0).abs() < EPS);
        assert!((ClutchState::target_engagement(15_000.0) - 1.0).abs() < EPS);
    }

    #[test]
    fn target_in_transition_zone_is_monotone() {
        let slip_threshold = CLUTCH_FULL_ENGAGEMENT_RPM * CLUTCH_SLIP_THRESHOLD_FACTOR;
        let mid = (slip_threshold + CLUTCH_FULL_ENGAGEMENT_RPM) * 0.5;
        let lo = ClutchState::target_engagement(slip_threshold + 1.0);
        let m = ClutchState::target_engagement(mid);
        let hi = ClutchState::target_engagement(CLUTCH_FULL_ENGAGEMENT_RPM - 1.0);
        assert!(lo < m && m < hi, "monotone: {} < {} < {}", lo, m, hi);
        assert!(lo > CLUTCH_SLIP_FLOOR);
        assert!(hi < 1.0);
    }

    #[test]
    fn engagement_for_tracks_step_change_via_lowpass() {
        let mut clutch = ClutchState::new();
        // Start at slip floor; jump engine to full rpm and integrate
        // long enough (~6τ) for engagement to settle within 5% of target.
        // τ = CLUTCH_TIME_CONSTANT_S = 50ms; 40 frames × (1/120) ≈ 333ms ≈ 6.7τ.
        let dt = 1.0 / 120.0;
        let target_rpm = 12_000.0;
        for _ in 0..40 {
            clutch.engagement_for(target_rpm, dt);
        }
        let final_eng = clutch.engagement();
        assert!(
            (final_eng - 1.0).abs() < 0.05,
            "engagement should converge to ~1.0, got {}",
            final_eng
        );
    }
}
