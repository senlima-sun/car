//! Overtake Mode — 2026 F1 DRS replacement.
//!
//! Per FIA 2026 PU & Sporting Regulations (renamed from "Manual Override"
//! to "Overtake Mode" in December 2025):
//!
//! - Power profile vs. car speed v (km/h):
//!     P(kW) = 7100 − 20·v        for v < 355 km/h
//!     P(kW) = 0                   for v ≥ 355 km/h
//!   Saturates at the 350 kW MGU-K cap, so 350 kW is sustained up to
//!   ~337 km/h and tapers to zero by 355 km/h. This is a power profile,
//!   not a fixed-burst — at low speed the cap binds, at high speed the
//!   formula binds.
//!
//! - Per-lap extra budget: +0.5 MJ above the standard 8.5 MJ deploy cap.
//!
//! - Activation: PROXIMITY-based — driver must be within 1.0 s of car
//!   ahead at the detection point. Deactivates on brake or budget
//!   exhaustion (driver-discretion lift is the previous behaviour and
//!   stays).
//!
//! Sources:
//! - F1.com glossary (2026 key terms)
//! - RaceFans Dec-2025 terminology rename
//! - FIA 2026 Sporting Regs Section B Issue 5

const MGU_K_PEAK_POWER_W: f32 = 350_000.0;
const OVERRIDE_LAP_BUDGET_MJ: f32 = 0.5;
const OVERRIDE_LAP_BUDGET_J: f32 = OVERRIDE_LAP_BUDGET_MJ * 1_000_000.0;
/// Linear power profile: P(kW) = 7100 − 20·v[km/h]. Goes to zero at
/// 355 km/h; saturates against the 350 kW cap up to 337.5 km/h.
const POWER_PROFILE_INTERCEPT_KW: f32 = 7100.0;
const POWER_PROFILE_SLOPE_KW_PER_KMH: f32 = 20.0;
const MS_TO_KMH: f32 = 3.6;

/// Compute the Overtake Mode additional power (watts) at a given car
/// speed. Saturates at the 350 kW MGU-K cap and clamps to zero above
/// the profile's natural zero-crossing.
pub fn overtake_power_w(speed_ms: f32) -> f32 {
    let v_kmh = speed_ms.max(0.0) * MS_TO_KMH;
    let p_kw = POWER_PROFILE_INTERCEPT_KW - POWER_PROFILE_SLOPE_KW_PER_KMH * v_kmh;
    let p_w = p_kw.max(0.0) * 1000.0;
    p_w.min(MGU_K_PEAK_POWER_W)
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
    /// Proximity gate: car ahead is within the FIA-defined activation
    /// window (≤ 1.0 s at the detection point). `true` allows activation;
    /// `false` blocks it. When no proximity tracking is wired (single-
    /// car sim or testing), pass `true` to fall back to legacy behavior.
    pub proximity_eligible: bool,
}

#[derive(Debug, Clone, Copy)]
pub struct OverrideOutput {
    pub active: bool,
    pub additional_power_w: f32,
}

#[derive(Debug, Clone, Copy, Default)]
pub struct OverrideModeState {
    /// Energy used this lap (joules).
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
        // Power varies with speed via the FIA P(v) profile. Energy
        // burn this step caps against the budget so a partial step at
        // budget-end delivers proportional power.
        let nominal_power_w = overtake_power_w(speed_ms);
        let energy_this_step = nominal_power_w * dt;
        let energy_consumed = energy_this_step.min(budget_remaining);
        self.energy_used_j += energy_consumed;
        let power_w = if energy_consumed >= energy_this_step {
            nominal_power_w
        } else {
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
mod tests {
    use super::*;

    fn req(dt: f32, speed_ms: f32) -> OverrideInput {
        OverrideInput {
            dt,
            requested: true,
            is_braking: false,
            speed_ms,
            proximity_eligible: true,
        }
    }

    #[test]
    fn override_inactive_when_not_requested() {
        let mut s = OverrideModeState::new();
        let out = s.update(OverrideInput {
            requested: false,
            ..req(1.0 / 120.0, 80.0)
        });
        assert!(!out.active);
        assert_eq!(out.additional_power_w, 0.0);
    }

    #[test]
    fn override_inactive_without_proximity() {
        let mut s = OverrideModeState::new();
        let out = s.update(OverrideInput {
            proximity_eligible: false,
            ..req(1.0 / 120.0, 80.0)
        });
        assert!(!out.active);
        assert_eq!(out.additional_power_w, 0.0);
    }

    #[test]
    fn power_profile_saturates_at_mgu_k_cap_low_speed() {
        // At standstill, formula gives 7100 kW which saturates at 350 kW.
        assert!((overtake_power_w(0.0) - MGU_K_PEAK_POWER_W).abs() < 1.0);
        // At ~90 m/s (324 km/h) → 7100 - 20*324 = 620 kW → still capped.
        assert!((overtake_power_w(90.0) - MGU_K_PEAK_POWER_W).abs() < 1.0);
    }

    #[test]
    fn power_profile_tapers_above_337kmh() {
        // 95 m/s ≈ 342 km/h → 7100 − 20·342 = 260 kW (below cap, in taper)
        let p = overtake_power_w(95.0);
        assert!(p > 200_000.0 && p < 280_000.0, "got {}", p);
    }

    #[test]
    fn power_profile_zero_above_355kmh() {
        // 100 m/s = 360 km/h → 7100 − 20·360 = -100 kW → clamped to 0.
        assert_eq!(overtake_power_w(100.0), 0.0);
    }

    #[test]
    fn override_burns_budget_correctly() {
        // 350 kW × 1 s = 0.35 MJ; budget 0.5 MJ → ~1.43 s of full burst.
        let mut s = OverrideModeState::new();
        let dt = 1.0 / 120.0;
        let mut active_steps = 0;
        for _ in 0..(2 * 120) {
            let out = s.update(req(dt, 80.0));
            if out.active {
                active_steps += 1;
            }
        }
        // ~1.43 s × 120 Hz ≈ 171 steps
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
            ..req(dt, 80.0)
        });
        assert!(!out.active);
        assert_eq!(out.additional_power_w, 0.0);
    }

    #[test]
    fn reset_lap_restores_budget() {
        let mut s = OverrideModeState::new();
        let dt = 1.0 / 120.0;
        for _ in 0..200 {
            s.update(req(dt, 80.0));
        }
        let used_before = s.energy_used_pct();
        assert!(used_before > 0.5);
        s.reset_lap();
        assert_eq!(s.energy_used_pct(), 0.0);
        let out = s.update(req(dt, 80.0));
        assert!(out.active, "after reset, override should re-activate");
    }
}
