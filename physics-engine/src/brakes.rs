use crate::types::{BrakeConfig, BrakeState, EngineBrakingLevel};

// ============================================================================
// Brake Constants
// ============================================================================

/// Default front brake bias (58%)
pub const DEFAULT_FRONT_BIAS: f32 = 0.58;

/// Minimum front brake bias (50%)
pub const MIN_FRONT_BIAS: f32 = 0.50;

/// Maximum front brake bias (70%)
pub const MAX_FRONT_BIAS: f32 = 0.70;

/// Brake bias adjustment step (2%)
pub const BIAS_ADJUSTMENT_STEP: f32 = 0.02;

/// Engine braking force at Low level (N)
pub const ENGINE_BRAKE_LOW: f32 = 1500.0;

/// Engine braking force at Medium level (N)
pub const ENGINE_BRAKE_MEDIUM: f32 = 2500.0;

/// Engine braking force at High level (N)
pub const ENGINE_BRAKE_HIGH: f32 = 4000.0;

// ============================================================================
// Brake Physics State
// ============================================================================

#[derive(Debug)]
pub struct BrakePhysicsState {
    config: BrakeConfig,
}

impl Default for BrakePhysicsState {
    fn default() -> Self {
        Self::new()
    }
}

impl BrakePhysicsState {
    pub fn new() -> Self {
        Self {
            config: BrakeConfig {
                front_bias: DEFAULT_FRONT_BIAS,
                engine_braking: EngineBrakingLevel::Medium,
            },
        }
    }

    // ========================================================================
    // Configuration API
    // ========================================================================

    /// Set front brake bias (clamped to 0.50-0.70)
    pub fn set_brake_bias(&mut self, bias: f32) {
        self.config.front_bias = bias.clamp(MIN_FRONT_BIAS, MAX_FRONT_BIAS);
    }

    /// Get current front brake bias
    pub fn get_brake_bias(&self) -> f32 {
        self.config.front_bias
    }

    /// Increase brake bias by 2% (clamped to max)
    pub fn increase_brake_bias(&mut self) {
        self.config.front_bias = (self.config.front_bias + BIAS_ADJUSTMENT_STEP).min(MAX_FRONT_BIAS);
    }

    /// Decrease brake bias by 2% (clamped to min)
    pub fn decrease_brake_bias(&mut self) {
        self.config.front_bias = (self.config.front_bias - BIAS_ADJUSTMENT_STEP).max(MIN_FRONT_BIAS);
    }

    /// Set engine braking level
    pub fn set_engine_braking_level(&mut self, level: EngineBrakingLevel) {
        self.config.engine_braking = level;
    }

    /// Get current engine braking level
    pub fn get_engine_braking_level(&self) -> EngineBrakingLevel {
        self.config.engine_braking
    }

    /// Cycle through engine braking levels (Low -> Medium -> High -> Low)
    pub fn cycle_engine_braking_level(&mut self) {
        self.config.engine_braking = match self.config.engine_braking {
            EngineBrakingLevel::Low => EngineBrakingLevel::Medium,
            EngineBrakingLevel::Medium => EngineBrakingLevel::High,
            EngineBrakingLevel::High => EngineBrakingLevel::Low,
        };
    }

    // ========================================================================
    // Physics Calculations
    // ========================================================================

    /// Calculate front and rear brake forces from total brake force
    pub fn calculate_forces(&self, total_brake_force: f32) -> (f32, f32) {
        let front_force = total_brake_force * self.config.front_bias;
        let rear_force = total_brake_force * (1.0 - self.config.front_bias);
        (front_force, rear_force)
    }

    /// Get engine braking force for current level
    pub fn get_engine_braking_force(&self) -> f32 {
        match self.config.engine_braking {
            EngineBrakingLevel::Low => ENGINE_BRAKE_LOW,
            EngineBrakingLevel::Medium => ENGINE_BRAKE_MEDIUM,
            EngineBrakingLevel::High => ENGINE_BRAKE_HIGH,
        }
    }

    /// Get current brake state
    pub fn get_state(&self) -> BrakeState {
        BrakeState {
            front_bias: self.config.front_bias,
            engine_braking: self.config.engine_braking,
            front_brake_force: 0.0,  // Will be set during physics step
            rear_brake_force: 0.0,   // Will be set during physics step
        }
    }

    /// Get current brake state with calculated forces
    pub fn get_state_with_forces(&self, total_brake_force: f32) -> BrakeState {
        let (front_force, rear_force) = self.calculate_forces(total_brake_force);
        BrakeState {
            front_bias: self.config.front_bias,
            engine_braking: self.config.engine_braking,
            front_brake_force: front_force,
            rear_brake_force: rear_force,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let brakes = BrakePhysicsState::new();
        assert_eq!(brakes.get_brake_bias(), DEFAULT_FRONT_BIAS);
        assert_eq!(brakes.get_engine_braking_level(), EngineBrakingLevel::Medium);
    }

    #[test]
    fn test_brake_bias_clamping() {
        let mut brakes = BrakePhysicsState::new();

        // Test setting below minimum
        brakes.set_brake_bias(0.4);
        assert_eq!(brakes.get_brake_bias(), MIN_FRONT_BIAS);

        // Test setting above maximum
        brakes.set_brake_bias(0.8);
        assert_eq!(brakes.get_brake_bias(), MAX_FRONT_BIAS);

        // Test valid value
        brakes.set_brake_bias(0.6);
        assert_eq!(brakes.get_brake_bias(), 0.6);
    }

    #[test]
    fn test_brake_bias_adjustment() {
        let mut brakes = BrakePhysicsState::new();

        // Test increase
        brakes.set_brake_bias(0.58);
        brakes.increase_brake_bias();
        assert!((brakes.get_brake_bias() - 0.60).abs() < 0.001);

        // Test decrease
        brakes.decrease_brake_bias();
        assert!((brakes.get_brake_bias() - 0.58).abs() < 0.001);

        // Test clamping at max
        brakes.set_brake_bias(0.70);
        brakes.increase_brake_bias();
        assert_eq!(brakes.get_brake_bias(), MAX_FRONT_BIAS);

        // Test clamping at min
        brakes.set_brake_bias(0.50);
        brakes.decrease_brake_bias();
        assert_eq!(brakes.get_brake_bias(), MIN_FRONT_BIAS);
    }

    #[test]
    fn test_engine_braking_cycle() {
        let mut brakes = BrakePhysicsState::new();

        // Start at Medium
        assert_eq!(brakes.get_engine_braking_level(), EngineBrakingLevel::Medium);

        // Cycle to High
        brakes.cycle_engine_braking_level();
        assert_eq!(brakes.get_engine_braking_level(), EngineBrakingLevel::High);

        // Cycle to Low
        brakes.cycle_engine_braking_level();
        assert_eq!(brakes.get_engine_braking_level(), EngineBrakingLevel::Low);

        // Cycle back to Medium
        brakes.cycle_engine_braking_level();
        assert_eq!(brakes.get_engine_braking_level(), EngineBrakingLevel::Medium);
    }

    #[test]
    fn test_force_calculation() {
        let brakes = BrakePhysicsState::new();
        let total_force = 10000.0;

        let (front, rear) = brakes.calculate_forces(total_force);

        // Check bias is applied correctly
        assert!((front - 5800.0).abs() < 0.1); // 58% of 10000
        assert!((rear - 4200.0).abs() < 0.1);  // 42% of 10000
        assert!((front + rear - total_force).abs() < 0.1); // Forces sum to total
    }

    #[test]
    fn test_engine_braking_forces() {
        let mut brakes = BrakePhysicsState::new();

        brakes.set_engine_braking_level(EngineBrakingLevel::Low);
        assert_eq!(brakes.get_engine_braking_force(), ENGINE_BRAKE_LOW);

        brakes.set_engine_braking_level(EngineBrakingLevel::Medium);
        assert_eq!(brakes.get_engine_braking_force(), ENGINE_BRAKE_MEDIUM);

        brakes.set_engine_braking_level(EngineBrakingLevel::High);
        assert_eq!(brakes.get_engine_braking_force(), ENGINE_BRAKE_HIGH);
    }

    #[test]
    fn test_state_with_forces() {
        let brakes = BrakePhysicsState::new();
        let total_force = 20000.0;

        let state = brakes.get_state_with_forces(total_force);

        assert_eq!(state.front_bias, DEFAULT_FRONT_BIAS);
        assert_eq!(state.engine_braking, EngineBrakingLevel::Medium);
        assert!((state.front_brake_force - 11600.0).abs() < 0.1); // 58% of 20000
        assert!((state.rear_brake_force - 8400.0).abs() < 0.1);   // 42% of 20000
    }

    #[test]
    fn test_brake_bias_affects_total_force() {
        let total = 35000.0;

        let biases = [0.50, 0.55, 0.58, 0.65, 0.70];
        for bias in biases {
            let mut brakes = BrakePhysicsState::new();
            brakes.set_brake_bias(bias);
            let (front, rear) = brakes.calculate_forces(total);

            assert!(
                (front + rear - total).abs() < 0.01,
                "Front + rear ({} + {} = {}) should equal total force ({}) at bias {}",
                front, rear, front + rear, total, bias
            );
            assert!(
                (front / total - bias).abs() < 0.001,
                "Front ratio {} should match bias {} at bias {}",
                front / total, bias, bias
            );
        }
    }
}
