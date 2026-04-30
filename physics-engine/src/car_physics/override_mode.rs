//! Override Mode — 2026 F1 DRS replacement.
//!
//! Wave 4 Phase 5. Per 2026 FIA regs, DRS (the rear-wing-only flap) is
//! replaced by "Override Mode": a driver-activated 350 kW MGU-K boost
//! usable on any straight (no zone gate). Limited to a 0.5 MJ per-lap
//! budget, separate from the 9 MJ ERS deploy cap. Auto-deactivates on
//! brake input or budget exhaustion.
//!
//! Burst characteristics:
//!   - 350 kW × 1 s = 0.35 MJ
//!   - 0.5 MJ budget = ~1.43 s of full Override per lap
//!
//! This is intentionally limited per the regs — it's an overtaking
//! aid, not a continuous boost.

const OVERRIDE_BURST_POWER_W: f32 = 350_000.0;
const OVERRIDE_LAP_BUDGET_MJ: f32 = 0.5;
const OVERRIDE_LAP_BUDGET_J: f32 = OVERRIDE_LAP_BUDGET_MJ * 1_000_000.0;

#[derive(Debug, Clone, Copy)]
pub struct OverrideOutput {
    pub active: bool,
    pub additional_power_w: f32,
}

#[derive(Debug, Clone, Copy)]
pub struct OverrideModeState {
    /// Energy used this lap (joules).
    energy_used_j: f32,
}

impl Default for OverrideModeState {
    fn default() -> Self {
        Self::new()
    }
}

impl OverrideModeState {
    pub fn new() -> Self {
        Self { energy_used_j: 0.0 }
    }

    /// Update Override Mode for one step. Returns the additional power
    /// (in watts) to add onto the existing ERS deploy stream. When the
    /// per-lap budget is exhausted or the driver is braking, the mode
    /// deactivates and returns 0 W. The `active` flag in the output is
    /// the player-facing activation state.
    pub fn update(&mut self, dt: f32, requested: bool, is_braking: bool) -> OverrideOutput {
        let budget_remaining = OVERRIDE_LAP_BUDGET_J - self.energy_used_j;
        if !requested || is_braking || budget_remaining <= 0.0 {
            return OverrideOutput {
                active: false,
                additional_power_w: 0.0,
            };
        }
        // Burn the energy. A fractional dt at end-of-budget partially
        // covers the step.
        let energy_this_step = OVERRIDE_BURST_POWER_W * dt;
        let energy_consumed = energy_this_step.min(budget_remaining);
        self.energy_used_j += energy_consumed;
        // If we partially covered the step, scale power down accordingly
        // so the returned power reflects what was actually delivered.
        let power_w = if energy_consumed >= energy_this_step {
            OVERRIDE_BURST_POWER_W
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

    #[test]
    fn override_inactive_when_not_requested() {
        let mut s = OverrideModeState::new();
        let out = s.update(1.0 / 120.0, false, false);
        assert!(!out.active);
        assert_eq!(out.additional_power_w, 0.0);
    }

    #[test]
    fn override_burns_budget_correctly() {
        // 350 kW × 1 s = 0.35 MJ; budget 0.5 MJ → ~1.43 s of full burst.
        let mut s = OverrideModeState::new();
        let dt = 1.0 / 120.0;
        let mut active_steps = 0;
        for _ in 0..(2 * 120) {
            let out = s.update(dt, true, false);
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
        let out = s.update(dt, true, true);
        assert!(!out.active);
        assert_eq!(out.additional_power_w, 0.0);
    }

    #[test]
    fn reset_lap_restores_budget() {
        let mut s = OverrideModeState::new();
        let dt = 1.0 / 120.0;
        for _ in 0..200 {
            s.update(dt, true, false);
        }
        let used_before = s.energy_used_pct();
        assert!(used_before > 0.5);
        s.reset_lap();
        assert_eq!(s.energy_used_pct(), 0.0);
        let out = s.update(dt, true, false);
        assert!(out.active, "after reset, override should re-activate");
    }
}
