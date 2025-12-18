use crate::types::{ErsMode, ErsState};

// ERS Constants
const BATTERY_CAPACITY_KJ: f32 = 4000.0; // 4 MJ = 4000 kJ
const MAX_DEPLOY_POWER_KW: f32 = 120.0; // Max deployment power in kW
const MAX_HARVEST_POWER_KW: f32 = 120.0; // Max harvest power in kW

// Mode multipliers (deploy / harvest)
const ATTACK_DEPLOY_MULT: f32 = 1.0; // 100% deploy
const ATTACK_HARVEST_MULT: f32 = 0.3; // 30% harvest
const BALANCED_DEPLOY_MULT: f32 = 0.6; // 60% deploy
const BALANCED_HARVEST_MULT: f32 = 0.7; // 70% harvest
const HARVEST_DEPLOY_MULT: f32 = 0.0; // 0% deploy
const HARVEST_HARVEST_MULT: f32 = 1.0; // 100% harvest

// Efficiency
const DEPLOY_EFFICIENCY: f32 = 0.95; // 95% efficient when deploying
const HARVEST_EFFICIENCY: f32 = 0.90; // 90% efficient when harvesting

// Minimum speed for harvest (m/s)
const MIN_HARVEST_SPEED: f32 = 5.0; // ~18 km/h

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
            },
        }
    }

    /// Update ERS state based on driving conditions
    /// Returns the force boost in Newtons
    pub fn update(
        &mut self,
        delta: f32,
        is_accelerating: bool,
        is_braking: bool,
        speed_ms: f32,
    ) -> f32 {
        let dt = delta.min(0.05);

        // Get mode multipliers
        let (deploy_mult, harvest_mult) = match self.current.mode {
            ErsMode::Attack => (ATTACK_DEPLOY_MULT, ATTACK_HARVEST_MULT),
            ErsMode::Balanced => (BALANCED_DEPLOY_MULT, BALANCED_HARVEST_MULT),
            ErsMode::Harvest => (HARVEST_DEPLOY_MULT, HARVEST_HARVEST_MULT),
        };

        let mut power_flow_kw = 0.0;
        let mut is_deploying = false;
        let mut is_harvesting = false;
        let mut force_boost = 0.0;

        // Harvesting during braking
        if is_braking && speed_ms > MIN_HARVEST_SPEED && self.current.battery_charge < 1.0 {
            // Calculate harvest power based on speed (more harvest at higher speed)
            let speed_factor = (speed_ms / 80.0).min(1.0); // Max harvest at 80 m/s (~288 km/h)
            let harvest_power = MAX_HARVEST_POWER_KW * harvest_mult * speed_factor;

            // Convert power to energy (kJ = kW * seconds)
            let energy_harvested = harvest_power * HARVEST_EFFICIENCY * dt;

            // Add to battery (normalized 0-1)
            let battery_change = energy_harvested / BATTERY_CAPACITY_KJ;
            self.current.battery_charge = (self.current.battery_charge + battery_change).min(1.0);

            power_flow_kw = -harvest_power; // Negative = harvesting
            is_harvesting = true;
        }

        // Deployment during acceleration
        if is_accelerating && !is_braking && self.current.battery_charge > 0.0 {
            // Calculate deploy power
            let deploy_power = MAX_DEPLOY_POWER_KW * deploy_mult;

            // Convert power to energy
            let energy_deployed = deploy_power * dt;

            // Check if we have enough battery
            let battery_needed = energy_deployed / BATTERY_CAPACITY_KJ;

            if battery_needed <= self.current.battery_charge {
                // Deplete battery
                self.current.battery_charge -= battery_needed;

                // Calculate force boost
                // Power = Force × Velocity, so Force = Power / Velocity
                // At reference speed (50 m/s), 120 kW = 2400 N
                // We scale force inversely with speed to maintain power delivery
                let reference_speed = 50.0; // m/s (~180 km/h)
                let effective_speed = speed_ms.max(reference_speed);

                // Convert kW to Watts, then divide by speed to get Newtons
                // Apply deploy efficiency to force output
                force_boost = (deploy_power * 1000.0 / effective_speed) * DEPLOY_EFFICIENCY;

                power_flow_kw = deploy_power; // Positive = deploying
                is_deploying = true;
            }
        }

        // Update state
        self.current.power_flow = power_flow_kw;
        self.current.is_deploying = is_deploying;
        self.current.is_harvesting = is_harvesting;

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
        state.set_mode(ErsMode::Attack);

        // Deplete battery
        for _ in 0..1000 {
            state.update(1.0 / 60.0, true, false, 50.0);
        }

        // Battery should be depleted
        assert!(state.current.battery_charge < 0.01);
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
