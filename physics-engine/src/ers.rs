use crate::constants::car::MGUK_PEAK_POWER_W;
use crate::types::{
    ErsMode, ErsState, HarvestSource, SemiAutoConfig, SemiAutoPreset, SemiAutoState,
};

// ============================================================================
// 2026 F1 ERS Constants
// ============================================================================

const BATTERY_CAPACITY_KJ: f32 = 4000.0; // 4 MJ = 4000 kJ
// FIA 2026 PU Technical Regs: deploy and recovery caps are asymmetric.
// Recovery (harvest under braking + on-throttle) ≤ 9.0 MJ/lap.
// Deploy (electrical energy delivered through MGU-K) ≤ 8.5 MJ/lap.
// The recovery > deploy asymmetry forces battery-management strategy:
// drivers harvest more than they can deploy, with surplus banking
// against next-lap usage limited by battery storage (~4 MJ).
// Sources: motorsport.tech FIA 2026 PU regs analysis; F1.com PU explainer.
pub const LAP_RECOVERY_CAP_MJ: f32 = 9.0;
pub const LAP_DEPLOY_CAP_MJ: f32 = 8.5;

// Deployment scheduler thresholds (pacing regulates deploy under throttle)
// so the battery no longer drains in seconds at full throttle in Balanced.
// Curves keep low-speed launch boost intact; the real control comes from
// the lap-budget tapering below.
const DEPLOY_MIN_SPEED_MS: f32 = 1.0; // ~3.6 km/h — preserves launch boost
const DEPLOY_FULL_SPEED_MS: f32 = 12.0; // ~43 km/h — fully engaged by the end of launch
const DEPLOY_MIN_THROTTLE: f32 = 0.3; // gate partial throttle; full throttle always deploys
const DEPLOY_FULL_THROTTLE: f32 = 0.7;
// Target deployment budget per lap (MJ). ~4 MJ is a typical race-lap use —
// above the 8.5 MJ regulation cap would be wasteful, below ~2 MJ underuses.
const LAP_DEPLOY_TARGET_MJ: f32 = 4.0;

// 2026 Power levels (350kW MGU-K, up from 120kW). Derive from the
// shared MGU-K cap so deploy and harvest can't drift apart.
const MAX_DEPLOY_POWER_KW: f32 = MGUK_PEAK_POWER_W / 1000.0;
const MAX_HARVEST_POWER_KW: f32 = MGUK_PEAK_POWER_W / 1000.0;
// MGU-K coast drag: real-world ~80–100 kW from rotor + driveshaft
// resistance when not motoring. FIA 2026 PU regs / Pat Symonds public
// commentary place the figure near 100 kW; the prior 200 kW was a
// placeholder roughly 2× reality.
const MAX_COAST_POWER_KW: f32 = 100.0;

// FIA 2026 PU regs: MGU-K deploy power tapers linearly from full at
// 290 km/h (80.5 m/s) to zero at 345 km/h (95.8 m/s). The taper is a
// hardware envelope (rotor speed × gearing × inverter limits), not a
// strategy choice, so it applies after the scheduler and is shared by
// Overtake Mode.
const DEPLOY_DERATE_START_MS: f32 = 80.5;
const DEPLOY_DERATE_END_MS: f32 = 95.8;

// Mode multipliers (deploy / harvest / coast)
// Harvest mode: maximum recovery, no deploy
const HARVEST_DEPLOY_MULT: f32 = 0.0;
const HARVEST_HARVEST_MULT: f32 = 1.0;
const HARVEST_COAST_MULT: f32 = 1.0;

// Balanced mode: moderate deploy with good recovery
const BALANCED_DEPLOY_MULT: f32 = 0.60;
const BALANCED_HARVEST_MULT: f32 = 0.95;
const BALANCED_COAST_MULT: f32 = 0.85;

// Attack mode: high deploy, some recovery
const ATTACK_DEPLOY_MULT: f32 = 0.85;
const ATTACK_HARVEST_MULT: f32 = 0.5;
const ATTACK_COAST_MULT: f32 = 0.4;

// Overtake mode: maximum deploy burst, zero harvest
const OVERTAKE_DEPLOY_MULT: f32 = 1.0;
const OVERTAKE_HARVEST_MULT: f32 = 0.0;
const OVERTAKE_COAST_MULT: f32 = 0.0;

// Efficiency
const DEPLOY_EFFICIENCY: f32 = 0.95;
const HARVEST_EFFICIENCY: f32 = 0.95;
const COAST_EFFICIENCY: f32 = 0.93;

// Speed thresholds (m/s)
const MIN_HARVEST_SPEED: f32 = 5.0; // ~18 km/h minimum for any harvest
const OPTIMAL_HARVEST_SPEED: f32 = 80.0; // ~288 km/h for max brake harvest

// ============================================================================
// Semi-Auto Mode Constants
// ============================================================================

// Critical battery protection
const CRITICAL_BATTERY_THRESHOLD: f32 = 0.10; // 10% critical
const CRITICAL_DEPLOY_MULT: f32 = 0.35; // 35% deploy when critical

// Speed efficiency curve for deploy (efficiency peaks at 40-70 m/s)
const DEPLOY_EFFICIENCY_MIN_SPEED: f32 = 10.0; // ~36 km/h
const DEPLOY_EFFICIENCY_OPTIMAL_MIN: f32 = 40.0; // ~144 km/h
const DEPLOY_EFFICIENCY_OPTIMAL_MAX: f32 = 70.0; // ~252 km/h
const DEPLOY_EFFICIENCY_MAX_SPEED: f32 = 90.0; // ~324 km/h

// Coast recommendation thresholds
const COAST_RECOMMEND_SPEED_MIN: f32 = 25.0; // ~90 km/h minimum for coast benefit

/// ERS Physics State Machine
#[derive(Debug)]
pub struct ErsPhysicsState {
    current: ErsState,
    /// Semi-Auto configuration
    semi_auto_config: SemiAutoConfig,
    /// Temporary overtake override (O key in SemiAuto mode)
    overtake_override: bool,
}

impl Default for ErsPhysicsState {
    fn default() -> Self {
        Self::new()
    }
}

impl ErsPhysicsState {
    pub fn new() -> Self {
        Self {
            current: ErsState {
                battery_charge: 1.0, // Start with full battery
                mode: ErsMode::Balanced,
                power_flow: 0.0,
                is_deploying: false,
                is_harvesting: false,
                super_clip_active: false,
                harvest_source: HarvestSource::None,
                overtake_available: false,
                semi_auto: SemiAutoState::default(),
                lap_recovered_mj: 0.0,
                lap_deployed_mj: 0.0,
                lap_recovery_cap_reached: false,
            },
            semi_auto_config: SemiAutoConfig::default(),
            overtake_override: false,
        }
    }

    // ========================================================================
    // Semi-Auto Helper Methods
    // ========================================================================

    /// Calculate speed-based deploy efficiency (0.0-1.0)
    /// Efficiency peaks at 40-70 m/s, lower at low speeds (wasted energy)
    /// and slightly reduced at very high speeds (aero dominates)
    fn calculate_deploy_efficiency(&self, speed_ms: f32) -> f32 {
        if speed_ms < DEPLOY_EFFICIENCY_MIN_SPEED {
            // Low speed: poor efficiency (wasted at low speed)
            return 0.3;
        }
        if speed_ms < DEPLOY_EFFICIENCY_OPTIMAL_MIN {
            // Ramp up to optimal range
            let t = (speed_ms - DEPLOY_EFFICIENCY_MIN_SPEED)
                / (DEPLOY_EFFICIENCY_OPTIMAL_MIN - DEPLOY_EFFICIENCY_MIN_SPEED);
            return 0.3 + t * 0.7;
        }
        if speed_ms <= DEPLOY_EFFICIENCY_OPTIMAL_MAX {
            // Optimal range: full efficiency
            return 1.0;
        }
        if speed_ms < DEPLOY_EFFICIENCY_MAX_SPEED {
            // Diminishing returns at very high speed
            let t = (speed_ms - DEPLOY_EFFICIENCY_OPTIMAL_MAX)
                / (DEPLOY_EFFICIENCY_MAX_SPEED - DEPLOY_EFFICIENCY_OPTIMAL_MAX);
            return 1.0 - t * 0.3;
        }
        // Very high speed: capped efficiency
        0.7
    }

    /// Calculate coast recommendation based on current state
    /// Returns (recommended, benefit_score)
    fn calculate_coast_recommendation(&self, speed_ms: f32, is_coasting: bool) -> (bool, f32) {
        let battery = self.current.battery_charge;

        // No recommendation if already coasting or at low speed
        if is_coasting || speed_ms < COAST_RECOMMEND_SPEED_MIN {
            return (false, 0.0);
        }

        // Calculate coast benefit score based on battery need
        let battery_need = if battery < self.semi_auto_config.target_min {
            // Below target: high benefit
            1.0 - (battery / self.semi_auto_config.target_min)
        } else if battery < self.semi_auto_config.target_max {
            // In target range: moderate benefit
            0.3
        } else {
            // Above target: low benefit
            0.1
        };

        // Speed factor: higher speed = more regen potential
        let speed_factor = ((speed_ms - COAST_RECOMMEND_SPEED_MIN) / 50.0).min(1.0);

        let benefit = battery_need * speed_factor;
        let recommended = benefit > 0.4 && battery < self.semi_auto_config.target_max;

        (recommended, benefit)
    }

    /// Calculate Semi-Auto multipliers based on battery state.
    /// Returns (deploy_mult, harvest_mult, coast_mult).
    fn calculate_semi_auto_multipliers(&self, _speed_ms: f32) -> (f32, f32, f32) {
        let battery = self.current.battery_charge;
        let target_min = self.semi_auto_config.target_min;
        let target_max = self.semi_auto_config.target_max;

        // Preset-specific deploy scaling (AGR deploys more, CON deploys less)
        let preset_deploy_scale = match self.semi_auto_config.preset {
            SemiAutoPreset::Aggressive => 1.4, // 40% more deploy
            SemiAutoPreset::Balanced => 1.0,
            SemiAutoPreset::Conservative => 0.7, // 30% less deploy
        };

        // Critical protection: minimal deploy, max harvest
        if battery < CRITICAL_BATTERY_THRESHOLD {
            return (CRITICAL_DEPLOY_MULT * preset_deploy_scale, 1.0, 1.0);
        }

        // Below minimum target: prioritize charging
        if battery < target_min {
            let urgency = 1.0 - (battery / target_min);
            let deploy = (0.25 + (1.0 - urgency) * 0.35) * preset_deploy_scale; // 25-60% * scale
            let harvest = 0.8 + urgency * 0.2; // 80-100% harvest
            return (deploy.min(1.0), harvest, harvest);
        }

        // In target range: balanced operation
        if battery <= target_max {
            let position = (battery - target_min) / (target_max - target_min);
            let deploy = (0.40 + position * 0.20) * preset_deploy_scale; // 40-60% * scale
            let harvest = 1.0 - position * 0.10; // 100-90% harvest (increased)
            return (deploy.min(1.0), harvest, harvest);
        }

        // Above maximum target: push deploy harder, maintain good harvest
        let excess = (battery - target_max) / (1.0 - target_max);
        let deploy = (0.65 + excess * 0.25) * preset_deploy_scale; // 65-90% * scale
        let harvest = 0.85 - excess * 0.15; // 85-70% harvest (maintain recovery)
        (deploy.min(1.0), harvest, harvest * 0.95)
    }

    // ========================================================================
    // Semi-Auto Public API
    // ========================================================================

    /// Set Semi-Auto configuration
    pub fn set_semi_auto_config(&mut self, config: SemiAutoConfig) {
        self.semi_auto_config = config;
    }

    /// Get Semi-Auto configuration
    pub fn get_semi_auto_config(&self) -> SemiAutoConfig {
        self.semi_auto_config
    }

    /// Set preset (updates target_min/target_max)
    pub fn set_semi_auto_preset(&mut self, preset: SemiAutoPreset) {
        self.semi_auto_config = SemiAutoConfig::for_preset(preset);
    }

    /// Set lap mode
    pub fn set_lap_mode(&mut self, enabled: bool) {
        self.semi_auto_config.lap_mode = enabled;
    }

    /// Set expert mode
    pub fn set_expert_mode(&mut self, enabled: bool) {
        self.semi_auto_config.expert_mode = enabled;
    }

    /// Activate overtake override (temporary 100% deploy)
    pub fn activate_overtake_override(&mut self) {
        self.overtake_override = true;
    }

    /// Deactivate overtake override
    pub fn deactivate_overtake_override(&mut self) {
        self.overtake_override = false;
    }

    /// Check if overtake override is active
    pub fn is_overtake_override(&self) -> bool {
        self.overtake_override
    }

    /// Update ERS state based on driving conditions (2026 F1 regulations)
    /// Returns the force boost in Newtons.
    ///
    /// 2026 recovery sources:
    /// - Braking: up to 350 kW when braking.
    /// - Coast: up to 100 kW when off throttle.
    ///
    /// 2026 PU has no MGU-H, so there is no on-throttle harvest path.
    pub fn update(
        &mut self,
        delta: f32,
        is_accelerating: bool,
        is_braking: bool,
        speed_ms: f32,
        throttle: f32,
    ) -> f32 {
        let dt = delta.min(0.05);
        let throttle = throttle.clamp(0.0, 1.0);

        let is_coasting = !is_accelerating && !is_braking;

        // Calculate Semi-Auto state for UI (even when not in SemiAuto mode)
        let deploy_efficiency = self.calculate_deploy_efficiency(speed_ms);
        let (coast_recommended, coast_benefit) =
            self.calculate_coast_recommendation(speed_ms, is_coasting);
        let is_critical = self.current.battery_charge < CRITICAL_BATTERY_THRESHOLD;

        // Get mode multipliers (deploy, harvest, coast)
        let (deploy_mult, harvest_mult, coast_mult) = match self.current.mode {
            ErsMode::Harvest => (
                HARVEST_DEPLOY_MULT,
                HARVEST_HARVEST_MULT,
                HARVEST_COAST_MULT,
            ),
            ErsMode::Balanced => (
                BALANCED_DEPLOY_MULT,
                BALANCED_HARVEST_MULT,
                BALANCED_COAST_MULT,
            ),
            ErsMode::Attack => (
                ATTACK_DEPLOY_MULT,
                ATTACK_HARVEST_MULT,
                ATTACK_COAST_MULT,
            ),
            ErsMode::Overtake => (
                OVERTAKE_DEPLOY_MULT,
                OVERTAKE_HARVEST_MULT,
                OVERTAKE_COAST_MULT,
            ),
            ErsMode::SemiAuto => {
                if self.overtake_override {
                    // Overtake override: full deploy, no harvest
                    (1.0, 0.0, 0.0)
                } else if self.semi_auto_config.expert_mode {
                    // Expert mode: use Balanced multipliers
                    (
                        BALANCED_DEPLOY_MULT,
                        BALANCED_HARVEST_MULT,
                        BALANCED_COAST_MULT,
                    )
                } else {
                    // Smart Semi-Auto multipliers based on battery state
                    self.calculate_semi_auto_multipliers(speed_ms)
                }
            }
        };

        // Apply speed efficiency gating to deploy in SemiAuto mode
        let effective_deploy_mult = if self.current.mode == ErsMode::SemiAuto
            && !self.overtake_override
            && !self.semi_auto_config.expert_mode
        {
            deploy_mult * deploy_efficiency
        } else {
            deploy_mult
        };

        let mut power_flow_kw = 0.0;
        let mut is_deploying = false;
        let mut is_harvesting = false;
        let mut harvest_source = HarvestSource::None;
        let mut force_boost = 0.0;
        let deploy_schedule = if is_accelerating && !is_braking {
            compute_deployment_schedule(
                speed_ms,
                throttle,
                self.current.mode,
                self.current.lap_deployed_mj,
                self.overtake_override,
            )
        } else {
            0.0
        };
        let anticipated_deploy_power = MAX_DEPLOY_POWER_KW
            * effective_deploy_mult
            * deploy_schedule
            * deploy_speed_derate(speed_ms);

        // ========================================================================
        // HARVESTING (multiple sources can contribute)
        // ========================================================================

        // 1. Braking harvest (highest priority, up to 350kW)
        if is_braking
            && speed_ms > MIN_HARVEST_SPEED
            && self.current.battery_charge < 1.0
            && !self.current.lap_recovery_cap_reached
        {
            let speed_factor = (speed_ms / OPTIMAL_HARVEST_SPEED).min(1.0);
            let harvest_power = MAX_HARVEST_POWER_KW * harvest_mult * speed_factor;

            let energy_harvested = harvest_power * HARVEST_EFFICIENCY * dt;
            let battery_change = energy_harvested / BATTERY_CAPACITY_KJ;
            self.current.battery_charge = (self.current.battery_charge + battery_change).min(1.0);
            self.accumulate_recovered(energy_harvested);

            power_flow_kw = -harvest_power;
            is_harvesting = true;
            harvest_source = HarvestSource::Braking;
        }

        // 2. Coast harvest (when off throttle, up to 100kW)
        if is_coasting
            && speed_ms > MIN_HARVEST_SPEED
            && self.current.battery_charge < 1.0
            && !self.current.lap_recovery_cap_reached
        {
            let speed_factor = (speed_ms / OPTIMAL_HARVEST_SPEED).min(1.0);
            let coast_power = MAX_COAST_POWER_KW * coast_mult * speed_factor;

            let energy_harvested = coast_power * COAST_EFFICIENCY * dt;
            let battery_change = energy_harvested / BATTERY_CAPACITY_KJ;
            self.current.battery_charge = (self.current.battery_charge + battery_change).min(1.0);
            self.accumulate_recovered(energy_harvested);

            power_flow_kw = -coast_power;
            is_harvesting = true;
            harvest_source = HarvestSource::Coast;
        }

        // 2026 PU has no MGU-H — there is no harvest path during
        // on-throttle acceleration. Braking and coast are the only
        // recovery sources.

        // ========================================================================
        // DEPLOYMENT
        // ========================================================================

        // 2026 F1 per-lap deploy cap: deploy stops once 9.0 MJ reached, until lap rollover.
        let deploy_cap_reached = self.current.lap_deployed_mj >= LAP_DEPLOY_CAP_MJ;
        if is_accelerating
            && !is_braking
            && self.current.battery_charge > 0.0
            && !deploy_cap_reached
        {
            let deploy_power = anticipated_deploy_power;

            if deploy_power > 1.0 {
                let energy_deployed = deploy_power * dt;
                let battery_needed = energy_deployed / BATTERY_CAPACITY_KJ;

                if battery_needed <= self.current.battery_charge {
                    self.current.battery_charge -= battery_needed;
                    self.current.lap_deployed_mj += energy_deployed / 1000.0;

                    // Electric-motor torque-limited force: F = min(F_max, P/v).
                    // Below the corner speed (P_max / F_max), peak torque
                    // binds; above it, constant power binds. Replaces the
                    // 40 m/s floor that made launch boost ~4× too low.
                    force_boost =
                        electric_force_boost(deploy_power, speed_ms) * DEPLOY_EFFICIENCY;

                    power_flow_kw += deploy_power;
                    is_deploying = true;
                }
            }
        }

        // Update state. `super_clip_active` is hard-wired off: 2026
        // PU has no MGU-H on-throttle harvest. Field retained for
        // TS-string / save-file compatibility.
        self.current.power_flow = power_flow_kw;
        self.current.is_deploying = is_deploying;
        self.current.is_harvesting = is_harvesting;
        self.current.super_clip_active = false;
        self.current.harvest_source = harvest_source;

        // Update Semi-Auto state (for UI feedback)
        self.current.semi_auto = SemiAutoState {
            coast_recommended,
            coast_benefit,
            deploy_efficiency,
            is_critical,
            effective_deploy_mult,
            effective_harvest_mult: harvest_mult,
        };

        force_boost
    }

    /// Accumulate kJ into this lap's recovered counter and set the cap
    /// flag when the 2026 per-lap regulation cap is reached.
    fn accumulate_recovered(&mut self, energy_harvested_kj: f32) {
        self.current.lap_recovered_mj += energy_harvested_kj / 1000.0;
        if self.current.lap_recovered_mj >= LAP_RECOVERY_CAP_MJ {
            self.current.lap_recovery_cap_reached = true;
        }
    }

    /// Reset per-lap recovery/deployment accounting. Called on a
    /// `lap_complete` event.
    pub fn reset_lap(&mut self) {
        self.current.lap_recovered_mj = 0.0;
        self.current.lap_deployed_mj = 0.0;
        self.current.lap_recovery_cap_reached = false;
    }

    /// Get current ERS state
    pub fn get_state(&self) -> ErsState {
        self.current
    }

    /// Set ERS mode
    pub fn set_mode(&mut self, mode: ErsMode) {
        self.current.mode = mode;
    }

    /// Get current mode
    pub fn get_mode(&self) -> ErsMode {
        self.current.mode
    }

    /// Get battery charge (0.0-1.0)
    pub fn get_battery_charge(&self) -> f32 {
        self.current.battery_charge
    }

    /// Set battery charge (for testing/debug)
    pub fn set_battery_charge(&mut self, charge: f32) {
        self.current.battery_charge = charge.clamp(0.0, 1.0);
    }

    /// Set overtake availability (for testing mode)
    pub fn set_overtake_available(&mut self, available: bool) {
        self.current.overtake_available = available;
    }

    /// Check if overtake mode is available
    pub fn is_overtake_available(&self) -> bool {
        self.current.overtake_available
    }

    pub fn is_harvesting(&self) -> bool {
        self.current.is_harvesting
    }

    pub fn get_harvest_power_watts(&self) -> f32 {
        if self.current.power_flow < 0.0 {
            self.current.power_flow.abs() * 1000.0
        } else {
            0.0
        }
    }

    /// Reset to default state
    pub fn reset(&mut self) {
        *self = Self::new();
    }
}

/// Deployment scheduler: returns a multiplier in [0.0, 1.0] applied to
/// deploy power before battery draw. Enforces three conditions:
///
/// 1. Speed gate — below `DEPLOY_MIN_SPEED_MS`, deploy is wasted
///    (engine torque dominates). Ramps up over [min, full].
/// 2. Throttle gate — below `DEPLOY_MIN_THROTTLE` the driver is
///    cruising, not demanding power. Ramps over [min, full].
/// 3. Lap-budget tapering — modes other than Attack/Overtake aim for
///    `LAP_DEPLOY_TARGET_MJ` per lap and taper to near-zero as the
///    target is approached, preventing full-throttle drain.
pub(crate) fn compute_deployment_schedule(
    speed_ms: f32,
    throttle: f32,
    mode: ErsMode,
    lap_deployed_mj: f32,
    overtake_override: bool,
) -> f32 {
    if overtake_override {
        return 1.0;
    }

    let speed_factor = smoothstep(DEPLOY_MIN_SPEED_MS, DEPLOY_FULL_SPEED_MS, speed_ms);
    let throttle_factor = smoothstep(DEPLOY_MIN_THROTTLE, DEPLOY_FULL_THROTTLE, throttle);

    let budget_factor = match mode {
        // Aggressive modes ignore per-lap pacing (still honor 8.5 MJ cap).
        ErsMode::Attack | ErsMode::Overtake => 1.0,
        _ => {
            // Ramp from 1.0 at 0 MJ used to 0.0 at 1.25× target.
            let limit = LAP_DEPLOY_TARGET_MJ * 1.25;
            (1.0 - (lap_deployed_mj / limit)).clamp(0.0, 1.0)
        }
    };

    speed_factor * throttle_factor * budget_factor
}

fn smoothstep(edge0: f32, edge1: f32, x: f32) -> f32 {
    let t = ((x - edge0) / (edge1 - edge0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// MGU-K deploy speed derate (FIA 2026). Returns 1.0 below
/// `DEPLOY_DERATE_START_MS`, ramps linearly to 0.0 at
/// `DEPLOY_DERATE_END_MS`, clamps at 0.0 above. Shared by the ERS
/// deploy stream and Overtake Mode so the +0.5 MJ push-to-pass budget
/// cannot bypass the hardware envelope.
pub(crate) fn deploy_speed_derate(speed_ms: f32) -> f32 {
    if speed_ms <= DEPLOY_DERATE_START_MS {
        1.0
    } else if speed_ms >= DEPLOY_DERATE_END_MS {
        0.0
    } else {
        1.0 - (speed_ms - DEPLOY_DERATE_START_MS)
            / (DEPLOY_DERATE_END_MS - DEPLOY_DERATE_START_MS)
    }
}

/// Electric-motor force at a given deploy power (kW) and car speed
/// (m/s). Below the corner speed `P_max / F_max` the motor is in the
/// constant-torque regime; above it, constant power.
fn electric_force_boost(deploy_power_kw: f32, speed_ms: f32) -> f32 {
    // Sits well above the ~6 kN/wheel μ·Fz envelope so the wheel-force
    // friction ellipse is the binding cap, not this sentinel — the
    // P/v branch dominates across the realistic speed envelope.
    const F_MAX_TORQUE_N: f32 = 15_000.0;
    const MIN_BOOST_SPEED_MS: f32 = 1.0;
    if speed_ms < MIN_BOOST_SPEED_MS {
        return F_MAX_TORQUE_N;
    }
    let constant_power_force = deploy_power_kw * 1000.0 / speed_ms;
    F_MAX_TORQUE_N.min(constant_power_force)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ers_default() {
        let state = ErsPhysicsState::new();
        assert!((state.current.battery_charge - 1.0).abs() < 0.01);
        assert_eq!(state.current.mode, ErsMode::Balanced);
        assert!(!state.current.is_deploying);
        assert!(!state.current.is_harvesting);
    }

    #[test]
    fn test_ers_deployment() {
        let mut state = ErsPhysicsState::new();

        // Simulate acceleration at moderate speed
        let boost = state.update(1.0 / 60.0, true, false, 50.0, 1.0);

        // Should deploy and provide boost
        assert!(boost > 0.0);
        assert!(state.current.is_deploying);
        assert!(state.current.battery_charge < 1.0);
        assert!(state.current.power_flow > 0.0);
    }

    #[test]
    fn test_ers_harvesting() {
        let mut state = ErsPhysicsState::new();
        state.current.battery_charge = 0.5; // Start at 50%

        let initial_charge = state.current.battery_charge;

        // Simulate braking at high speed
        for _ in 0..60 {
            state.update(1.0 / 60.0, false, true, 60.0, 0.0);
        }

        // Battery should have charged
        assert!(state.current.battery_charge > initial_charge);
    }

    #[test]
    fn test_ers_modes() {
        let mut state = ErsPhysicsState::new();

        // Attack mode
        state.set_mode(ErsMode::Attack);
        let attack_boost = state.update(1.0 / 60.0, true, false, 50.0, 1.0);

        // Reset for balanced
        state.reset();
        state.set_mode(ErsMode::Balanced);
        let balanced_boost = state.update(1.0 / 60.0, true, false, 50.0, 1.0);

        // Attack should provide more boost
        assert!(attack_boost > balanced_boost);

        // Harvest mode should not deploy
        state.reset();
        state.set_mode(ErsMode::Harvest);
        let harvest_boost = state.update(1.0 / 60.0, true, false, 50.0, 1.0);
        assert!((harvest_boost - 0.0).abs() < 0.01);
    }

    #[test]
    fn test_battery_depletion() {
        let mut state = ErsPhysicsState::new();
        state.set_mode(ErsMode::Overtake); // Use Overtake for 100% deploy

        // Deplete battery (Overtake mode at 100% deploy: 350kW, 4000kJ capacity)
        // Time to deplete: 4000/350 = ~11.4 seconds = ~685 frames at 60fps
        for _ in 0..800 {
            state.update(1.0 / 60.0, true, false, 50.0, 1.0);
        }

        // Battery should be depleted
        assert!(state.current.battery_charge < 0.01);
    }

    #[test]
    fn no_super_clip_harvest_during_acceleration_at_low_speed() {
        let mut state = ErsPhysicsState::new();
        state.set_mode(ErsMode::Balanced);
        state.set_battery_charge(0.5);

        state.update(1.0 / 60.0, true, false, 30.0, 1.0);

        assert!(!state.current.super_clip_active);
        assert_ne!(state.current.harvest_source, HarvestSource::SuperClip);
        assert!(state.current.is_deploying);
    }

    #[test]
    fn no_super_clip_harvest_during_acceleration_at_high_speed() {
        // 2026 PU has no MGU-H — high-speed on-throttle harvest must
        // not occur regardless of mode. Re-enabling the branch makes
        // this test fail.
        let mut state = ErsPhysicsState::new();
        state.set_mode(ErsMode::Balanced);
        state.set_battery_charge(0.5);

        state.update(1.0 / 60.0, true, false, 70.0, 1.0);

        assert!(!state.current.super_clip_active);
        assert_ne!(state.current.harvest_source, HarvestSource::SuperClip);
        assert!(state.current.power_flow > 0.0, "should be net deploy");
    }

    #[test]
    fn harvest_source_never_super_clip_under_typical_states() {
        let mut state = ErsPhysicsState::new();
        state.set_battery_charge(0.5);
        for (accel, brake, speed) in [
            (true, false, 30.0_f32),
            (true, false, 70.0_f32),
            (true, false, 88.0_f32),
            (false, true, 60.0_f32),
            (false, false, 60.0_f32),
        ] {
            state.update(1.0 / 60.0, accel, brake, speed, if accel { 1.0 } else { 0.0 });
            assert_ne!(
                state.current.harvest_source,
                HarvestSource::SuperClip,
                "harvest_source must never be SuperClip in 2026 PU",
            );
        }
    }

    #[test]
    fn test_overtake_mode() {
        let mut state = ErsPhysicsState::new();
        state.set_mode(ErsMode::Overtake);

        let overtake_boost = state.update(1.0 / 60.0, true, false, 50.0, 1.0);

        // Reset for Attack comparison
        state.reset();
        state.set_mode(ErsMode::Attack);
        let attack_boost = state.update(1.0 / 60.0, true, false, 50.0, 1.0);

        // Overtake should provide more boost than Attack (100% vs 85%)
        assert!(overtake_boost > attack_boost);
    }

    #[test]
    fn test_harvest_source_tracking() {
        let mut state = ErsPhysicsState::new();
        state.set_battery_charge(0.5);

        // Braking should set harvest source to Braking
        state.update(1.0 / 60.0, false, true, 60.0, 0.0);
        assert_eq!(state.current.harvest_source, HarvestSource::Braking);

        // Coasting should set harvest source to Coast
        state.reset();
        state.set_battery_charge(0.5);
        state.update(1.0 / 60.0, false, false, 60.0, 0.0);
        assert_eq!(state.current.harvest_source, HarvestSource::Coast);
    }

    #[test]
    fn test_coast_harvesting() {
        let mut state = ErsPhysicsState::new();
        state.current.battery_charge = 0.5; // Start at 50%

        let initial_charge = state.current.battery_charge;

        // Simulate coasting (no throttle, no brake) at high speed
        for _ in 0..60 {
            state.update(1.0 / 60.0, false, false, 60.0, 0.0);
        }

        // Battery should have charged from coast regen
        assert!(state.current.battery_charge > initial_charge);
    }

    #[test]
    fn test_no_harvest_at_low_speed() {
        let mut state = ErsPhysicsState::new();
        state.current.battery_charge = 0.5;

        let initial_charge = state.current.battery_charge;

        // Try to harvest at low speed
        state.update(1.0 / 60.0, false, true, 2.0, 0.0);

        // Should not harvest
        assert!(!state.current.is_harvesting);
        assert!((state.current.battery_charge - initial_charge).abs() < 0.001);
    }

    #[test]
    fn test_harvest_produces_deceleration() {
        let mut state = ErsPhysicsState::new();
        state.set_mode(ErsMode::Harvest);
        state.set_battery_charge(0.5);

        state.update(1.0 / 60.0, false, true, 60.0, 0.0);

        assert!(state.is_harvesting());
        assert!(state.current.power_flow < 0.0);
    }

    #[test]
    fn test_harvest_power_watts_conversion() {
        let mut state = ErsPhysicsState::new();
        state.set_mode(ErsMode::Harvest);
        state.set_battery_charge(0.5);

        state.update(1.0 / 60.0, false, true, 60.0, 0.0);

        let watts = state.get_harvest_power_watts();
        assert!(watts > 0.0);
        assert!((watts - state.current.power_flow.abs() * 1000.0).abs() < 0.1);
    }

    #[test]
    fn coast_power_capped_at_100kw() {
        // FIA 2026 calibration: Balanced coast at OPTIMAL_HARVEST_SPEED
        // (80 m/s) → BALANCED_COAST_MULT × MAX_COAST_POWER_KW = 0.85 ×
        // 100 = 85 kW. Sign is negative on `power_flow` (harvesting).
        let mut state = ErsPhysicsState::new();
        state.set_mode(ErsMode::Balanced);
        state.set_battery_charge(0.5);
        state.update(1.0 / 120.0, false, false, 80.0, 0.0);
        let pf = state.get_state().power_flow;
        assert!(
            pf < -80.0 && pf > -86.0,
            "expected coast power ≈ -85 kW, got {}",
            pf,
        );
    }

    #[test]
    fn deploy_speed_derate_full_below_290kmh() {
        assert!((deploy_speed_derate(0.0) - 1.0).abs() < 1e-6);
        assert!((deploy_speed_derate(50.0) - 1.0).abs() < 1e-6);
        assert!((deploy_speed_derate(80.0) - 1.0).abs() < 1e-6);
        assert!((deploy_speed_derate(80.5) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn deploy_speed_derate_half_at_88ms() {
        // Midpoint of [80.5, 95.8] = 88.15 m/s. At 88.0 m/s the derate
        // is 1 − (88 − 80.5) / (95.8 − 80.5) = 1 − 7.5/15.3 ≈ 0.5098.
        let d = deploy_speed_derate(88.0);
        assert!((d - 0.51).abs() < 0.02, "got {}", d);
    }

    #[test]
    fn deploy_speed_derate_zero_at_95p8ms() {
        assert!(deploy_speed_derate(95.8).abs() < 1e-6);
    }

    #[test]
    fn deploy_speed_derate_zero_above_345kmh() {
        assert_eq!(deploy_speed_derate(100.0), 0.0);
        assert_eq!(deploy_speed_derate(120.0), 0.0);
    }

    #[test]
    fn deploy_speed_derate_slows_drain_above_290kmh() {
        // Two Attack-mode runs (no scheduler budget tapering) at full
        // throttle from 1.0 charge. Run A below the derate band, Run B
        // mid-band where derate ≈ 0.51 — Run B must retain more charge.
        // Threshold is conservative because super-clip harvest at
        // 88 m/s narrows the gap; Phase 3 removes super-clip and the
        // gap widens. Direction is the load-bearing assertion.
        fn run(speed_ms: f32) -> f32 {
            let mut state = ErsPhysicsState::new();
            state.set_mode(ErsMode::Attack);
            state.set_battery_charge(1.0);
            for _ in 0..240 {
                state.update(1.0 / 120.0, true, false, speed_ms, 1.0);
            }
            state.get_state().battery_charge
        }
        let below = run(55.0);
        let mid = run(88.0);
        assert!(
            mid > below + 0.05,
            "high-speed run should retain more charge: below={:.3} mid={:.3}",
            below,
            mid,
        );
    }

    #[test]
    fn test_deploy_schedule_gated_by_low_throttle() {
        let low = compute_deployment_schedule(40.0, 0.1, ErsMode::Balanced, 0.0, false);
        let high = compute_deployment_schedule(40.0, 1.0, ErsMode::Balanced, 0.0, false);
        assert!(low < 0.05);
        assert!(high > 0.9);
    }

    #[test]
    fn test_deploy_schedule_tapers_near_lap_target() {
        let early = compute_deployment_schedule(40.0, 1.0, ErsMode::Balanced, 0.0, false);
        let mid = compute_deployment_schedule(40.0, 1.0, ErsMode::Balanced, 3.0, false);
        let late = compute_deployment_schedule(40.0, 1.0, ErsMode::Balanced, 5.0, false);
        assert!(early > mid);
        assert!(mid > late);
        assert!(late < 0.05);
    }

    #[test]
    fn test_deploy_schedule_attack_ignores_budget() {
        let early = compute_deployment_schedule(40.0, 1.0, ErsMode::Attack, 0.0, false);
        let late = compute_deployment_schedule(40.0, 1.0, ErsMode::Attack, 5.0, false);
        assert!((early - late).abs() < 0.01);
    }

    #[test]
    fn test_deploy_schedule_overtake_override_full_power() {
        let v = compute_deployment_schedule(40.0, 0.0, ErsMode::Balanced, 5.0, true);
        assert_eq!(v, 1.0);
    }

    #[test]
    fn test_balanced_mode_does_not_drain_in_seconds() {
        // Simulate 10 seconds of full throttle at cruise speed in Balanced.
        // Previously this would empty the battery; with the scheduler we
        // should still have charge left.
        let mut state = ErsPhysicsState::new();
        state.set_mode(ErsMode::Balanced);
        state.set_battery_charge(1.0);
        for _ in 0..600 {
            state.update(1.0 / 60.0, true, false, 55.0, 1.0);
        }
        assert!(
            state.current.battery_charge > 0.25,
            "Balanced should preserve a useful reserve after 10s; got {:.2}",
            state.current.battery_charge,
        );
    }

    #[test]
    fn test_semi_auto_low_battery_full_throttle_still_drains() {
        let mut state = ErsPhysicsState::new();
        state.set_mode(ErsMode::SemiAuto);
        state.set_semi_auto_preset(SemiAutoPreset::Aggressive);
        state.set_battery_charge(0.1);

        let initial_charge = state.current.battery_charge;

        for _ in 0..120 {
            state.update(1.0 / 60.0, true, false, 70.0, 1.0);
        }

        assert!(state.current.battery_charge < initial_charge);
        assert!(state.current.power_flow > 0.0);
    }

    /// 2026 F1 spec: once `lap_deployed_mj` reaches LAP_DEPLOY_CAP_MJ (8.5 MJ),
    /// deploy stops until lap reset.
    #[test]
    fn test_lap_deploy_cap_at_deploy_cap() {
        let mut state = ErsPhysicsState::new();
        state.set_mode(ErsMode::Attack);
        state.current.lap_deployed_mj = LAP_DEPLOY_CAP_MJ - 0.05;
        state.current.battery_charge = 1.0;
        for _ in 0..120 {
            state.update(1.0 / 120.0, true, false, 80.0, 1.0);
        }
        assert!(
            state.current.lap_deployed_mj <= LAP_DEPLOY_CAP_MJ + 0.1,
            "lap_deployed_mj exceeded cap: {} > {}",
            state.current.lap_deployed_mj,
            LAP_DEPLOY_CAP_MJ
        );
        state.current.lap_deployed_mj = LAP_DEPLOY_CAP_MJ;
        state.update(1.0 / 120.0, true, false, 80.0, 1.0);
        assert!(
            !state.current.is_deploying,
            "deploy should be inactive once lap cap reached"
        );
    }

    /// 2026 F1 spec: per-lap recovery cap is 9.0 MJ (raised from 8.5).
    #[test]
    fn test_lap_recovery_cap_at_9mj() {
        let mut state = ErsPhysicsState::new();
        state.current.battery_charge = 0.0;
        state.current.lap_recovered_mj = 8.95;
        state.update(1.0 / 60.0, false, true, 70.0, 0.0);
        assert!(!state.current.lap_recovery_cap_reached);

        state.current.lap_recovered_mj = LAP_RECOVERY_CAP_MJ + 0.1;
        state.accumulate_recovered(0.0);
        assert!(state.current.lap_recovery_cap_reached);
    }
}
