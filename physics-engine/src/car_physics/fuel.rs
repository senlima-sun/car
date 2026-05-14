//! 2026-spec fuel system.
//!
//! State: residual fuel mass in the tank (kg).
//! Outputs:
//!   * `fuel_flow_factor ∈ [0, 1]` — multiplier on ICE torque. `1.0` when
//!     demanded fuel flow is below the FIA cap; below `1.0` when the cap
//!     bites (regulation-limited power).
//!   * Fuel mass decreases each step at the integrated mass-flow rate.
//!
//! FIA 2026 anchors (Article 5.4):
//!   * Total fuel-energy flow ≤ 3000 MJ/h (= 833 333 W) at any RPM.
//!   * Below 10,500 RPM: `EF(MJ/h) = 0.27 × N` → 75 W per RPM. At 10,500
//!     this gives 2835 MJ/h, then steps up to the flat 3000 MJ/h above.
//!   * Sustainable fuel energy density 38–41 MJ/kg; we use 40 MJ/kg.
//!   * Tank capacity ≤ 110 kg (race-day load typically 70–100 kg).
//!
//! Mix modes (lean / standard / rich) scale the *demanded* flow before
//! the FIA cap. Rich never exceeds the cap — it just saturates earlier.
//! This is the integration hook for the future engine-map component.

use crate::utils::sanitize;

pub const FUEL_ENERGY_DENSITY_J_PER_KG: f32 = 40.0e6;

// FIA 2026 PU Technical Regs Art 5.4: fuel-flow regulation switched
// from the 2014-era mass-based linear-below-10500-rpm scheme to a
// flat **energy-based** cap of 3000 MJ/h at all RPM. The old below-
// break linear ramp (0.27 MJ/h per RPM) was removed. The cap is now
// regime-independent — it binds whenever instantaneous demand
// exceeds 3000 MJ/h regardless of engine speed.
// Source: motorsport.tech 2026 PU regs analysis; F1.com PU explainer.
pub const FIA_FUEL_FLOW_FLAT_CAP_W: f32 = 3_000.0e6 / 3600.0;

pub const ICE_THERMAL_EFFICIENCY: f32 = 0.50;
pub const TANK_CAPACITY_KG: f32 = 110.0;
pub const DEFAULT_STARTING_FUEL_KG: f32 = 100.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FuelMixMode {
    Lean,
    Standard,
    Rich,
}

impl FuelMixMode {
    pub fn from_u8(value: u8) -> Self {
        match value {
            0 => Self::Lean,
            2 => Self::Rich,
            _ => Self::Standard,
        }
    }

    pub fn to_u8(self) -> u8 {
        match self {
            Self::Lean => 0,
            Self::Standard => 1,
            Self::Rich => 2,
        }
    }

    /// Demand-side multiplier on `engine_power_w` before the FIA cap.
    /// Lean burns less fuel and produces less power; rich burns more but
    /// is still clipped at the regulation ceiling.
    pub fn demand_multiplier(self) -> f32 {
        match self {
            Self::Lean => 0.85,
            Self::Standard => 1.0,
            Self::Rich => 1.15,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct FuelState {
    fuel_mass_kg: f32,
    mix: FuelMixMode,
}

impl Default for FuelState {
    fn default() -> Self {
        Self {
            fuel_mass_kg: DEFAULT_STARTING_FUEL_KG,
            mix: FuelMixMode::Standard,
        }
    }
}

impl FuelState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn fuel_mass_kg(&self) -> f32 {
        self.fuel_mass_kg
    }

    pub fn mix(&self) -> FuelMixMode {
        self.mix
    }

    pub fn set_fuel_mass_kg(&mut self, kg: f32) {
        self.fuel_mass_kg = sanitize(kg, 0.0).clamp(0.0, TANK_CAPACITY_KG);
    }

    pub fn set_mix(&mut self, mix: FuelMixMode) {
        self.mix = mix;
    }

    pub fn is_empty(&self) -> bool {
        self.fuel_mass_kg <= 0.0
    }

    /// Integrate one step. Given the engine's *demanded* mechanical power
    /// (W) and current RPM, compute the fuel-flow factor that would gate
    /// the next frame's torque, and deduct the fuel actually burned.
    ///
    /// Returns `(fuel_flow_factor, mass_burned_kg)`.
    pub fn update(&mut self, engine_power_w: f32, rpm: f32, dt: f32) -> (f32, f32) {
        if self.fuel_mass_kg <= 0.0 {
            return (0.0, 0.0);
        }

        let demand_mult = self.mix.demand_multiplier();
        let demanded_energy_w = (engine_power_w / ICE_THERMAL_EFFICIENCY) * demand_mult;
        let allowed_energy_w = fia_max_energy_flow_w(rpm);

        let factor = fuel_flow_factor(demanded_energy_w, allowed_energy_w);

        let actual_energy_w = demanded_energy_w.min(allowed_energy_w).max(0.0);
        let mass_flow_kg_s = actual_energy_w / FUEL_ENERGY_DENSITY_J_PER_KG;
        let burned = mass_flow_kg_s * dt.max(0.0);

        self.fuel_mass_kg = (self.fuel_mass_kg - burned).max(0.0);
        (factor, burned)
    }
}

/// FIA 2026 Art 5.4 max fuel-energy flow. The 2026 regs replaced the
/// 2014-era RPM-linear-below-10500 + flat-above scheme with a single
/// flat **energy-based** cap at all engine speeds. `rpm` is kept as a
/// parameter for API stability and so downstream code that derives
/// per-RPM heat or fuel demand can still query a regulation ceiling
/// — but the function is now regime-independent.
pub fn fia_max_energy_flow_w(rpm: f32) -> f32 {
    if !rpm.is_finite() || rpm <= 0.0 {
        return 0.0;
    }
    FIA_FUEL_FLOW_FLAT_CAP_W
}

/// Fraction of demanded energy the regulation allows through. `1.0` when
/// demand fits under the cap; less when the cap clips the demand.
pub fn fuel_flow_factor(demanded_w: f32, allowed_w: f32) -> f32 {
    if !demanded_w.is_finite() || demanded_w <= 0.0 {
        return 1.0;
    }
    if !allowed_w.is_finite() || allowed_w <= 0.0 {
        return 0.0;
    }
    (allowed_w / demanded_w).clamp(0.0, 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    const EPS: f32 = 1e-3;

    #[test]
    fn fia_max_is_flat_at_all_running_rpm() {
        // 2026 regs: regime-independent flat cap above zero RPM.
        let lo = fia_max_energy_flow_w(5_000.0);
        let mid = fia_max_energy_flow_w(10_500.0);
        let hi = fia_max_energy_flow_w(15_000.0);
        assert!((lo - FIA_FUEL_FLOW_FLAT_CAP_W).abs() < EPS);
        assert!((mid - FIA_FUEL_FLOW_FLAT_CAP_W).abs() < EPS);
        assert!((hi - FIA_FUEL_FLOW_FLAT_CAP_W).abs() < EPS);
    }

    #[test]
    fn fia_max_handles_invalid_rpm() {
        assert_eq!(fia_max_energy_flow_w(0.0), 0.0);
        assert_eq!(fia_max_energy_flow_w(-100.0), 0.0);
        assert_eq!(fia_max_energy_flow_w(f32::NAN), 0.0);
    }

    #[test]
    fn factor_under_cap_is_one() {
        assert!((fuel_flow_factor(500_000.0, 800_000.0) - 1.0).abs() < EPS);
    }

    #[test]
    fn factor_over_cap_is_clipped_ratio() {
        let f = fuel_flow_factor(1_000_000.0, 800_000.0);
        assert!((f - 0.8).abs() < EPS, "got {}", f);
    }

    #[test]
    fn factor_zero_demand_is_unity() {
        assert!((fuel_flow_factor(0.0, 800_000.0) - 1.0).abs() < EPS);
    }

    #[test]
    fn mix_modes_round_trip() {
        for v in 0u8..=2 {
            assert_eq!(FuelMixMode::from_u8(v).to_u8(), v);
        }
        assert_eq!(FuelMixMode::from_u8(99), FuelMixMode::Standard);
    }

    #[test]
    fn mix_demand_ordering() {
        let lean = FuelMixMode::Lean.demand_multiplier();
        let std = FuelMixMode::Standard.demand_multiplier();
        let rich = FuelMixMode::Rich.demand_multiplier();
        assert!(lean < std && std < rich);
    }

    #[test]
    fn fresh_state_starts_full() {
        let s = FuelState::new();
        assert!((s.fuel_mass_kg() - DEFAULT_STARTING_FUEL_KG).abs() < EPS);
        assert_eq!(s.mix(), FuelMixMode::Standard);
        assert!(!s.is_empty());
    }

    #[test]
    fn set_fuel_mass_clamps_to_tank_capacity() {
        let mut s = FuelState::new();
        s.set_fuel_mass_kg(500.0);
        assert!((s.fuel_mass_kg() - TANK_CAPACITY_KG).abs() < EPS);
        s.set_fuel_mass_kg(-10.0);
        assert_eq!(s.fuel_mass_kg(), 0.0);
        s.set_fuel_mass_kg(f32::NAN);
        assert_eq!(s.fuel_mass_kg(), 0.0);
    }

    #[test]
    fn empty_tank_returns_zero_factor() {
        let mut s = FuelState::new();
        s.set_fuel_mass_kg(0.0);
        let (f, burned) = s.update(300_000.0, 12_000.0, 1.0);
        assert_eq!(f, 0.0);
        assert_eq!(burned, 0.0);
        assert!(s.is_empty());
    }

    #[test]
    fn update_burns_fuel_proportional_to_dt() {
        let mut s = FuelState::new();
        let start = s.fuel_mass_kg();
        s.update(300_000.0, 12_000.0, 0.5);
        let mid = s.fuel_mass_kg();
        s.update(300_000.0, 12_000.0, 0.5);
        let end = s.fuel_mass_kg();
        let burn1 = start - mid;
        let burn2 = mid - end;
        assert!(burn1 > 0.0);
        assert!((burn1 - burn2).abs() < burn1 * 0.01);
    }

    #[test]
    fn update_below_cap_returns_unity_factor() {
        let mut s = FuelState::new();
        let (f, _) = s.update(50_000.0, 12_000.0, 1.0 / 120.0);
        assert!((f - 1.0).abs() < EPS, "got {}", f);
    }

    #[test]
    fn update_above_cap_returns_partial_factor() {
        let mut s = FuelState::new();
        // ICE power → /0.5 = mechanical-power-doubled energy demand.
        // 600 kW × 1/0.5 = 1.2 MW, well above the 833 kW flat cap.
        let (f, _) = s.update(600_000.0, 12_000.0, 1.0 / 120.0);
        assert!(f < 1.0, "expected clip, got {}", f);
        assert!(f > 0.0);
    }

    #[test]
    fn rich_mix_clips_earlier_than_standard() {
        // Same demand at same RPM; rich saturates first.
        let mut std_state = FuelState::new();
        let mut rich_state = FuelState::new();
        rich_state.set_mix(FuelMixMode::Rich);
        let (std_f, _) = std_state.update(450_000.0, 12_000.0, 1.0 / 120.0);
        let (rich_f, _) = rich_state.update(450_000.0, 12_000.0, 1.0 / 120.0);
        assert!(rich_f <= std_f, "rich {} should clip before std {}", rich_f, std_f);
    }

    #[test]
    fn lean_mix_burns_less_than_standard() {
        let mut std_state = FuelState::new();
        let mut lean_state = FuelState::new();
        lean_state.set_mix(FuelMixMode::Lean);
        let std_start = std_state.fuel_mass_kg();
        let lean_start = lean_state.fuel_mass_kg();
        std_state.update(300_000.0, 12_000.0, 1.0);
        lean_state.update(300_000.0, 12_000.0, 1.0);
        let std_burn = std_start - std_state.fuel_mass_kg();
        let lean_burn = lean_start - lean_state.fuel_mass_kg();
        assert!(lean_burn < std_burn, "lean {} should be < std {}", lean_burn, std_burn);
    }

    #[test]
    fn dt_zero_is_no_op_on_mass() {
        let mut s = FuelState::new();
        let start = s.fuel_mass_kg();
        s.update(500_000.0, 12_000.0, 0.0);
        assert!((s.fuel_mass_kg() - start).abs() < EPS);
    }

    #[test]
    fn rich_at_redline_clipped_at_fia_cap() {
        // At redline rpm the FIA cap is the flat 833 kW. A rich-multiplied
        // demand far above the cap should still mass-flow only at the cap,
        // not at rich-demand level.
        let mut s = FuelState::new();
        s.set_mix(FuelMixMode::Rich);
        let start = s.fuel_mass_kg();
        s.update(600_000.0, 15_000.0, 1.0);
        let burn = start - s.fuel_mass_kg();
        let max_possible = FIA_FUEL_FLOW_FLAT_CAP_W / FUEL_ENERGY_DENSITY_J_PER_KG;
        assert!(burn <= max_possible + EPS, "burn {} exceeds FIA mass-flow cap {}", burn, max_possible);
    }
}
