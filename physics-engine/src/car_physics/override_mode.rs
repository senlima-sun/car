//! Overtake Mode — 2026 F1 DRS replacement.
//!
//! Per FIA 2026 PU & Sporting Regulations (renamed from "Manual Override"
//! to "Overtake Mode" in December 2025):
//!
//! - Power profile vs. car speed v (km/h):
//!     P(kW) = 7100 − 20·v        for v < 355 km/h
//!     P(kW) = 0                   for v ≥ 355 km/h
//!   Saturates at the 350 kW MGU-K cap, so 350 kW is sustained up to
//!   ~337 km/h and tapers to zero by 355 km/h.
//!
//! - Per-lap extra budget: +0.5 MJ above the standard 8.5 MJ deploy cap.
//!
//! - Activation: proximity-based — driver must be within 1.0 s of the
//!   car ahead at the detection point. Deactivates on brake or budget
//!   exhaustion.

use crate::constants::car::MGUK_PEAK_POWER_W;
use crate::utils::ms_to_kmh;

const OVERRIDE_LAP_BUDGET_MJ: f32 = 0.5;
const OVERRIDE_LAP_BUDGET_J: f32 = OVERRIDE_LAP_BUDGET_MJ * 1_000_000.0;
const POWER_PROFILE_INTERCEPT_KW: f32 = 7100.0;
const POWER_PROFILE_SLOPE_KW_PER_KMH: f32 = 20.0;

/// Overtake Mode additional power (W) at a given car speed. Saturates
/// at the 350 kW MGU-K cap and clamps to zero above the profile's
/// natural zero-crossing.
pub fn overtake_power_w(speed_ms: f32) -> f32 {
    let v_kmh = ms_to_kmh(speed_ms.max(0.0));
    let p_kw = POWER_PROFILE_INTERCEPT_KW - POWER_PROFILE_SLOPE_KW_PER_KMH * v_kmh;
    let p_w = p_kw.max(0.0) * 1000.0;
    p_w.min(MGUK_PEAK_POWER_W)
}

#[derive(Debug, Clone, Copy)]
pub struct OverrideInput {
    pub dt: f32,
    /// Driver pressed the Overtake Mode button this step.
    pub requested: bool,
    /// Driver is braking — auto-deactivates.
    pub is_braking: bool,
    /// Car speed (m/s) — drives the P(v) profile.
    pub speed_ms: f32,
    /// Proximity gate: car ahead within ≤ 1.0 s at the detection point.
    /// `true` allows activation; `false` blocks. Pass `true` from a
    /// single-car sim that doesn't track proximity.
    pub proximity_eligible: bool,
}

#[derive(Debug, Clone, Copy)]
pub struct OverrideOutput {
    pub active: bool,
    pub additional_power_w: f32,
}

#[derive(Debug, Clone, Copy, Default)]
pub struct OverrideModeState {
    energy_used_j: f32,
}

impl OverrideModeState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Update Overtake Mode for one step. Returns the additional power
    /// (watts) to add onto the existing ERS deploy stream. Deactivates
    /// on brake, exhausted budget, or proximity-gate denial.
    pub fn update(&mut self, input: OverrideInput) -> OverrideOutput {
        let OverrideInput {
            dt,
            requested,
            is_braking,
            speed_ms,
            proximity_eligible,
        } = input;
        let budget_remaining = OVERRIDE_LAP_BUDGET_J - self.energy_used_j;
        let blocked =
            !requested || is_braking || !proximity_eligible || budget_remaining <= 0.0;
        if blocked {
            return OverrideOutput {
                active: false,
                additional_power_w: 0.0,
            };
        }
        let nominal_power_w = overtake_power_w(speed_ms);
        let energy_this_step = nominal_power_w * dt;
        let energy_consumed = energy_this_step.min(budget_remaining);
        self.energy_used_j += energy_consumed;
        let power_w = if energy_consumed >= energy_this_step {
            nominal_power_w
        } else {
            // Partial step at budget-end — deliver proportional power.
            energy_consumed / dt.max(1e-6)
        };
        OverrideOutput {
            active: true,
            additional_power_w: power_w,
        }
    }

    /// Reset the per-lap energy budget. Called on lap rollover.
    pub fn reset_lap(&mut self) {
        self.energy_used_j = 0.0;
    }

    /// Energy used this lap, normalized to the budget [0..1].
    pub fn energy_used_pct(&self) -> f32 {
        (self.energy_used_j / OVERRIDE_LAP_BUDGET_J).clamp(0.0, 1.0)
    }
}

#[cfg(test)]
impl OverrideInput {
    /// Test fixture: a fully-activated request with no brake, full
    /// proximity, at the given `dt` and `speed_ms`. The two
    /// non-defaultable physical fields stay explicit.
    pub(crate) fn for_test(dt: f32, speed_ms: f32) -> Self {
        Self {
            dt,
            requested: true,
            is_braking: false,
            speed_ms,
            proximity_eligible: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn override_inactive_when_not_requested() {
        let mut s = OverrideModeState::new();
        let out = s.update(OverrideInput {
            requested: false,
            ..OverrideInput::for_test(1.0 / 120.0, 80.0)
        });
        assert!(!out.active);
        assert_eq!(out.additional_power_w, 0.0);
    }

    #[test]
    fn override_inactive_without_proximity() {
        let mut s = OverrideModeState::new();
        let out = s.update(OverrideInput {
            proximity_eligible: false,
            ..OverrideInput::for_test(1.0 / 120.0, 80.0)
        });
        assert!(!out.active);
        assert_eq!(out.additional_power_w, 0.0);
    }

    #[test]
    fn power_profile_saturates_at_mgu_k_cap_low_speed() {
        assert!((overtake_power_w(0.0) - MGUK_PEAK_POWER_W).abs() < 1.0);
        assert!((overtake_power_w(90.0) - MGUK_PEAK_POWER_W).abs() < 1.0);
    }

    #[test]
    fn power_profile_tapers_above_337kmh() {
        let p = overtake_power_w(95.0);
        assert!(p > 200_000.0 && p < 280_000.0, "got {}", p);
    }

    #[test]
    fn power_profile_zero_above_355kmh() {
        assert_eq!(overtake_power_w(100.0), 0.0);
    }

    #[test]
    fn override_burns_budget_correctly() {
        // 350 kW × 1 s = 0.35 MJ; budget 0.5 MJ → ~1.43 s of full burst.
        let mut s = OverrideModeState::new();
        let dt = 1.0 / 120.0;
        let mut active_steps = 0;
        for _ in 0..(2 * 120) {
            let out = s.update(OverrideInput::for_test(dt, 80.0));
            if out.active {
                active_steps += 1;
            }
        }
        assert!(
            (160..=180).contains(&active_steps),
            "expected ~171 active steps, got {}",
            active_steps
        );
    }

    #[test]
    fn override_disables_on_brake() {
        let mut s = OverrideModeState::new();
        let dt = 1.0 / 120.0;
        let out = s.update(OverrideInput {
            is_braking: true,
            ..OverrideInput::for_test(dt, 80.0)
        });
        assert!(!out.active);
        assert_eq!(out.additional_power_w, 0.0);
    }

    #[test]
    fn reset_lap_restores_budget() {
        let mut s = OverrideModeState::new();
        let dt = 1.0 / 120.0;
        for _ in 0..200 {
            s.update(OverrideInput::for_test(dt, 80.0));
        }
        let used_before = s.energy_used_pct();
        assert!(used_before > 0.5);
        s.reset_lap();
        assert_eq!(s.energy_used_pct(), 0.0);
        let out = s.update(OverrideInput::for_test(dt, 80.0));
        assert!(out.active, "after reset, override should re-activate");
    }
}
