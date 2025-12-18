use crate::types::{ErsMode, ErsState, HarvestSource};

// ============================================================================
// 2026 F1 ERS Constants
// ============================================================================

const BATTERY_CAPACITY_KJ: f32 = 4000.0; // 4 MJ = 4000 kJ

// 2026 Power levels (350kW MGU-K, up from 120kW)
const MAX_DEPLOY_POWER_KW: f32 = 350.0; // 2026: 350kW max deployment
const MAX_HARVEST_POWER_KW: f32 = 350.0; // 2026: 350kW max brake harvest
const MAX_COAST_POWER_KW: f32 = 120.0; // Increased coast regen (was 100)
const MAX_SUPER_CLIP_POWER_KW: f32 = 120.0; // 2026: Super clipping (was 50, now significant)

// Mode multipliers (deploy / harvest / coast / super_clip)
// Harvest mode: maximum recovery, no deploy
const HARVEST_DEPLOY_MULT: f32 = 0.0;
const HARVEST_HARVEST_MULT: f32 = 1.0;
const HARVEST_COAST_MULT: f32 = 1.0;
const HARVEST_CLIP_MULT: f32 = 1.0;

// Balanced mode: moderate deploy with good recovery
const BALANCED_DEPLOY_MULT: f32 = 0.35; // Reduced from 0.5 for better balance
const BALANCED_HARVEST_MULT: f32 = 0.9; // Increased from 0.8
const BALANCED_COAST_MULT: f32 = 0.8; // Increased from 0.6
const BALANCED_CLIP_MULT: f32 = 0.8; // Increased from 0.5

// Attack mode: high deploy, some recovery
const ATTACK_DEPLOY_MULT: f32 = 0.70; // Reduced from 0.85
const ATTACK_HARVEST_MULT: f32 = 0.5; // Increased from 0.4
const ATTACK_COAST_MULT: f32 = 0.4; // Increased from 0.3
const ATTACK_CLIP_MULT: f32 = 0.3; // Was 0.0, now some super clip even in attack

// Overtake mode: maximum deploy burst, zero harvest
const OVERTAKE_DEPLOY_MULT: f32 = 1.0;
const OVERTAKE_HARVEST_MULT: f32 = 0.0;
const OVERTAKE_COAST_MULT: f32 = 0.0;
const OVERTAKE_CLIP_MULT: f32 = 0.0;

// Efficiency
const DEPLOY_EFFICIENCY: f32 = 0.95;
const HARVEST_EFFICIENCY: f32 = 0.92;
const COAST_EFFICIENCY: f32 = 0.90; // Improved from 0.88
const SUPER_CLIP_EFFICIENCY: f32 = 0.85; // Improved from 0.70 for gameplay

// Speed thresholds (m/s)
const MIN_HARVEST_SPEED: f32 = 5.0; // ~18 km/h minimum for any harvest
const SUPER_CLIP_MIN_SPEED: f32 = 35.0; // ~126 km/h for super clipping (was 50/180)
const SUPER_CLIP_OPTIMAL_SPEED: f32 = 55.0; // ~198 km/h for max super clipping (was 70/250)
const OPTIMAL_HARVEST_SPEED: f32 = 80.0; // ~288 km/h for max brake harvest

/// ERS Physics State Machine
#[derive(Debug, Default)]
pub struct ErsPhysicsState {
    current: ErsState,
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
            },
        }
    }

    /// Update ERS state based on driving conditions (2026 F1 regulations)
    /// Returns the force boost in Newtons
    ///
    /// 2026 recovery sources:
    /// - Braking: up to 350kW when braking
    /// - Coast: up to 100kW when off throttle
    /// - Super clipping: up to 50kW at full throttle when speed > 180 km/h
    pub fn update(
        &mut self,
        delta: f32,
        is_accelerating: bool,
        is_braking: bool,
        speed_ms: f32,
    ) -> f32 {
        let dt = delta.min(0.05);

        // Get mode multipliers (deploy, harvest, coast, super_clip)
        let (deploy_mult, harvest_mult, coast_mult, clip_mult) = match self.current.mode {
            ErsMode::Harvest => (
                HARVEST_DEPLOY_MULT,
                HARVEST_HARVEST_MULT,
                HARVEST_COAST_MULT,
                HARVEST_CLIP_MULT,
            ),
            ErsMode::Balanced => (
                BALANCED_DEPLOY_MULT,
                BALANCED_HARVEST_MULT,
                BALANCED_COAST_MULT,
                BALANCED_CLIP_MULT,
            ),
            ErsMode::Attack => (
                ATTACK_DEPLOY_MULT,
                ATTACK_HARVEST_MULT,
                ATTACK_COAST_MULT,
                ATTACK_CLIP_MULT,
            ),
            ErsMode::Overtake => (
                OVERTAKE_DEPLOY_MULT,
                OVERTAKE_HARVEST_MULT,
                OVERTAKE_COAST_MULT,
                OVERTAKE_CLIP_MULT,
            ),
        };

        let mut power_flow_kw = 0.0;
        let mut is_deploying = false;
        let mut is_harvesting = false;
        let mut super_clip_active = false;
        let mut harvest_source = HarvestSource::None;
        let mut force_boost = 0.0;
        let is_coasting = !is_accelerating && !is_braking;

        // ========================================================================
        // HARVESTING (multiple sources can contribute)
        // ========================================================================

        // 1. Braking harvest (highest priority, up to 350kW)
        if is_braking && speed_ms > MIN_HARVEST_SPEED && self.current.battery_charge < 1.0 {
            let speed_factor = (speed_ms / OPTIMAL_HARVEST_SPEED).min(1.0);
            let harvest_power = MAX_HARVEST_POWER_KW * harvest_mult * speed_factor;

            let energy_harvested = harvest_power * HARVEST_EFFICIENCY * dt;
            let battery_change = energy_harvested / BATTERY_CAPACITY_KJ;
            self.current.battery_charge = (self.current.battery_charge + battery_change).min(1.0);

            power_flow_kw = -harvest_power;
            is_harvesting = true;
            harvest_source = HarvestSource::Braking;
        }

        // 2. Coast harvest (when off throttle, up to 100kW)
        if is_coasting && speed_ms > MIN_HARVEST_SPEED && self.current.battery_charge < 1.0 {
            let speed_factor = (speed_ms / OPTIMAL_HARVEST_SPEED).min(1.0);
            let coast_power = MAX_COAST_POWER_KW * coast_mult * speed_factor;

            let energy_harvested = coast_power * COAST_EFFICIENCY * dt;
            let battery_change = energy_harvested / BATTERY_CAPACITY_KJ;
            self.current.battery_charge = (self.current.battery_charge + battery_change).min(1.0);

            power_flow_kw = -coast_power;
            is_harvesting = true;
            harvest_source = HarvestSource::Coast;
        }

        // 3. Super clipping (2026: harvest at full throttle when engine has surplus)
        // Activates when accelerating at high speed where drag limits acceleration
        if is_accelerating
            && !is_braking
            && speed_ms > SUPER_CLIP_MIN_SPEED
            && self.current.battery_charge < 1.0
            && clip_mult > 0.0
        {
            // Calculate super clip intensity based on speed
            // Scales from 0 at 180 km/h to 1.0 at 250 km/h
            let clip_intensity = ((speed_ms - SUPER_CLIP_MIN_SPEED)
                / (SUPER_CLIP_OPTIMAL_SPEED - SUPER_CLIP_MIN_SPEED))
                .clamp(0.0, 1.0);

            if clip_intensity > 0.05 {
                let clip_power = MAX_SUPER_CLIP_POWER_KW * clip_mult * clip_intensity;

                let energy_harvested = clip_power * SUPER_CLIP_EFFICIENCY * dt;
                let battery_change = energy_harvested / BATTERY_CAPACITY_KJ;
                self.current.battery_charge =
                    (self.current.battery_charge + battery_change).min(1.0);

                // Super clip reduces net power flow (harvesting while deploying)
                power_flow_kw += -clip_power;
                is_harvesting = true;
                super_clip_active = true;
                harvest_source = HarvestSource::SuperClip;
            }
        }

        // ========================================================================
        // DEPLOYMENT (can happen simultaneously with super clipping)
        // ========================================================================

        if is_accelerating && !is_braking && self.current.battery_charge > 0.0 {
            let deploy_power = MAX_DEPLOY_POWER_KW * deploy_mult;

            let energy_deployed = deploy_power * dt;
            let battery_needed = energy_deployed / BATTERY_CAPACITY_KJ;

            if battery_needed <= self.current.battery_charge {
                self.current.battery_charge -= battery_needed;

                // Calculate force boost (Power = Force × Velocity)
                // At reference speed (50 m/s), 350 kW = 7000 N
                let reference_speed = 50.0;
                let effective_speed = speed_ms.max(reference_speed);

                force_boost = (deploy_power * 1000.0 / effective_speed) * DEPLOY_EFFICIENCY;

                power_flow_kw += deploy_power; // Net power (deploy - clip)
                is_deploying = true;
            }
        }

        // Update state
        self.current.power_flow = power_flow_kw;
        self.current.is_deploying = is_deploying;
        self.current.is_harvesting = is_harvesting;
        self.current.super_clip_active = super_clip_active;
        self.current.harvest_source = harvest_source;

        force_boost
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

    /// Reset to default state
    pub fn reset(&mut self) {
        *self = Self::new();
    }
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
        let boost = state.update(1.0 / 60.0, true, false, 50.0);

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
            state.update(1.0 / 60.0, false, true, 60.0);
        }

        // Battery should have charged
        assert!(state.current.battery_charge > initial_charge);
    }

    #[test]
    fn test_ers_modes() {
        let mut state = ErsPhysicsState::new();

        // Attack mode
        state.set_mode(ErsMode::Attack);
        let attack_boost = state.update(1.0 / 60.0, true, false, 50.0);

        // Reset for balanced
        state.reset();
        state.set_mode(ErsMode::Balanced);
        let balanced_boost = state.update(1.0 / 60.0, true, false, 50.0);

        // Attack should provide more boost
        assert!(attack_boost > balanced_boost);

        // Harvest mode should not deploy
        state.reset();
        state.set_mode(ErsMode::Harvest);
        let harvest_boost = state.update(1.0 / 60.0, true, false, 50.0);
        assert!((harvest_boost - 0.0).abs() < 0.01);
    }

    #[test]
    fn test_battery_depletion() {
        let mut state = ErsPhysicsState::new();
        state.set_mode(ErsMode::Overtake); // Use Overtake for 100% deploy

        // Deplete battery (Overtake mode at 100% deploy: 350kW, 4000kJ capacity)
        // Time to deplete: 4000/350 = ~11.4 seconds = ~685 frames at 60fps
        for _ in 0..800 {
            state.update(1.0 / 60.0, true, false, 50.0);
        }

        // Battery should be depleted
        assert!(state.current.battery_charge < 0.01);
    }

    #[test]
    fn test_super_clipping() {
        let mut state = ErsPhysicsState::new();
        state.set_mode(ErsMode::Balanced); // Balanced has 50% super clip
        state.set_battery_charge(0.5);

        let initial_charge = state.current.battery_charge;

        // Accelerate at high speed (above super clip threshold of 50 m/s)
        // At 70 m/s (~250 km/h), should get max super clipping
        for _ in 0..60 {
            state.update(1.0 / 60.0, true, false, 70.0);
        }

        // Battery should have net depletion (deploy > super clip)
        // but super_clip_active should be true during update
        assert!(state.current.is_deploying);
    }

    #[test]
    fn test_super_clipping_not_at_low_speed() {
        let mut state = ErsPhysicsState::new();
        state.set_mode(ErsMode::Balanced);
        state.set_battery_charge(0.5);

        // Accelerate at low speed (below super clip threshold)
        state.update(1.0 / 60.0, true, false, 30.0);

        // Super clipping should NOT be active
        assert!(!state.current.super_clip_active);
        assert!(state.current.is_deploying);
    }

    #[test]
    fn test_super_clipping_activates_at_high_speed() {
        let mut state = ErsPhysicsState::new();
        state.set_mode(ErsMode::Harvest); // Harvest has 100% super clip
        state.set_battery_charge(0.5);

        // Accelerate at very high speed
        state.update(1.0 / 60.0, true, false, 70.0);

        // Super clipping should be active (Harvest mode, high speed)
        assert!(state.current.super_clip_active);
        assert_eq!(state.current.harvest_source, HarvestSource::SuperClip);
    }

    #[test]
    fn test_overtake_mode() {
        let mut state = ErsPhysicsState::new();
        state.set_mode(ErsMode::Overtake);

        let overtake_boost = state.update(1.0 / 60.0, true, false, 50.0);

        // Reset for Attack comparison
        state.reset();
        state.set_mode(ErsMode::Attack);
        let attack_boost = state.update(1.0 / 60.0, true, false, 50.0);

        // Overtake should provide more boost than Attack (100% vs 85%)
        assert!(overtake_boost > attack_boost);
    }

    #[test]
    fn test_harvest_source_tracking() {
        let mut state = ErsPhysicsState::new();
        state.set_battery_charge(0.5);

        // Braking should set harvest source to Braking
        state.update(1.0 / 60.0, false, true, 60.0);
        assert_eq!(state.current.harvest_source, HarvestSource::Braking);

        // Coasting should set harvest source to Coast
        state.reset();
        state.set_battery_charge(0.5);
        state.update(1.0 / 60.0, false, false, 60.0);
        assert_eq!(state.current.harvest_source, HarvestSource::Coast);
    }

    #[test]
    fn test_coast_harvesting() {
        let mut state = ErsPhysicsState::new();
        state.current.battery_charge = 0.5; // Start at 50%

        let initial_charge = state.current.battery_charge;

        // Simulate coasting (no throttle, no brake) at high speed
        for _ in 0..60 {
            state.update(1.0 / 60.0, false, false, 60.0);
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
        state.update(1.0 / 60.0, false, true, 2.0);

        // Should not harvest
        assert!(!state.current.is_harvesting);
        assert!((state.current.battery_charge - initial_charge).abs() < 0.001);
    }
}
