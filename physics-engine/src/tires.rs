use crate::car_physics::weight_transfer::WeightTransferResult;
use crate::types::{PerWheelWear, TireCompound, TireConfig, TireDegradationModifiers, WeatherCondition};

/// Wheel position indices
pub const FL: usize = 0; // Front Left
pub const FR: usize = 1; // Front Right
pub const RL: usize = 2; // Rear Left
pub const RR: usize = 3; // Rear Right

/// Input parameters for per-wheel wear calculation
#[derive(Debug, Clone, Copy, Default)]
pub struct WearInput {
    pub delta_seconds: f32,
    pub speed_ms: f32,
    pub steer_angle: f32,        // Radians, negative = left, positive = right
    pub is_braking: bool,
    pub is_throttle: bool,
    pub is_drifting: bool,
    pub is_handbrake: bool,
    pub weather: WeatherCondition,
    pub track_temperature: f32,  // 0.0 to 1.0 normalized
    pub weight_transfer: WeightTransferResult,
}

#[derive(Debug)]
pub struct TireState {
    compound: TireCompound,
    config: TireConfig,
    wheels: [f32; 4], // Wear for each wheel [FL, FR, RL, RR], 0.0 to 1.0
}

impl Default for TireState {
    fn default() -> Self {
        let compound = TireCompound::Medium;
        Self {
            compound,
            config: TireConfig::for_compound(compound),
            wheels: [0.0; 4],
        }
    }
}

impl TireState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_compound(&mut self, compound: TireCompound) {
        self.compound = compound;
        self.config = TireConfig::for_compound(compound);
        // Reset all wheel wear on compound change
        self.wheels = [0.0; 4];
    }

    pub fn get_compound(&self) -> TireCompound {
        self.compound
    }

    /// Get per-wheel wear data
    pub fn get_per_wheel_wear(&self) -> PerWheelWear {
        PerWheelWear {
            front_left: self.wheels[FL],
            front_right: self.wheels[FR],
            rear_left: self.wheels[RL],
            rear_right: self.wheels[RR],
        }
    }

    /// Get average wear across all wheels (legacy compatibility)
    pub fn get_wear(&self) -> f32 {
        (self.wheels[FL] + self.wheels[FR] + self.wheels[RL] + self.wheels[RR]) / 4.0
    }

    pub fn reset_wear(&mut self) {
        self.wheels = [0.0; 4];
    }

    /// Update per-wheel tire wear based on driving conditions
    pub fn update_wear_per_wheel(&mut self, input: &WearInput) {
        // Skip wear calculation if not moving
        if input.speed_ms < 0.5 {
            return;
        }

        let base_rate = self.config.degradation_rate;

        // Speed factor - normalized around 30 m/s (108 km/h)
        let speed_factor = (input.speed_ms / 30.0).clamp(0.2, 2.0);

        // Weather compatibility penalty
        let weather_penalty = if self.is_optimal_weather(input.weather) {
            1.0
        } else {
            1.5
        };

        // Track temperature effect (0.5 = neutral)
        // Range: 0.8 (cold) to 1.2 (hot)
        let track_temp_factor = 0.8 + input.track_temperature * 0.4;

        // Common multiplier for all wheels
        let common_factor = base_rate * speed_factor * weather_penalty * track_temp_factor;

        // Steering effects
        let steer_abs = input.steer_angle.abs();
        let is_turning_left = input.steer_angle < -0.02;
        let is_turning_right = input.steer_angle > 0.02;

        // Front wheels wear more when steering (up to 3x at max steer ~0.5 rad)
        let front_steer_mult = 1.0 + (steer_abs / 0.5).min(1.0) * 2.0;

        // Outer wheel bias during cornering (up to 50% extra wear)
        let outer_bias = (steer_abs / 0.5).min(1.0) * 0.5;

        // Weight transfer factors - loaded wheels wear more
        // Base load is ~1/4 of car weight (600kg * 9.81 / 4)
        let base_load = 1471.5;
        let load_sensitivity = 0.3;

        let fl_load_mult = 1.0
            + (input.weight_transfer.front_load_change + input.weight_transfer.left_load_change)
                / base_load
                * load_sensitivity;
        let fr_load_mult = 1.0
            + (input.weight_transfer.front_load_change + input.weight_transfer.right_load_change)
                / base_load
                * load_sensitivity;
        let rl_load_mult = 1.0
            + (input.weight_transfer.rear_load_change + input.weight_transfer.left_load_change)
                / base_load
                * load_sensitivity;
        let rr_load_mult = 1.0
            + (input.weight_transfer.rear_load_change + input.weight_transfer.right_load_change)
                / base_load
                * load_sensitivity;

        // Braking: front wheels wear 40% more
        let brake_front_mult = if input.is_braking { 1.4 } else { 1.0 };

        // Throttle: rear wheels wear 20% more under power
        let throttle_rear_mult = if input.is_throttle && !input.is_drifting {
            1.2
        } else {
            1.0
        };

        // Drift/handbrake: rear wheels wear 3x more
        let drift_rear_mult = if input.is_drifting || input.is_handbrake {
            3.0
        } else {
            1.0
        };

        // Calculate individual wheel wear rates
        // Front Left
        let fl_outer_mult = if is_turning_right {
            1.0 + outer_bias
        } else {
            1.0
        };
        let fl_rate = common_factor
            * front_steer_mult
            * fl_load_mult.max(0.5)
            * fl_outer_mult
            * brake_front_mult;

        // Front Right
        let fr_outer_mult = if is_turning_left {
            1.0 + outer_bias
        } else {
            1.0
        };
        let fr_rate = common_factor
            * front_steer_mult
            * fr_load_mult.max(0.5)
            * fr_outer_mult
            * brake_front_mult;

        // Rear Left - affected by drift and throttle, slight outer bias
        let rl_outer_mult = if is_turning_right {
            1.0 + outer_bias * 0.3
        } else {
            1.0
        };
        let rl_rate = common_factor
            * rl_load_mult.max(0.5)
            * rl_outer_mult
            * drift_rear_mult
            * throttle_rear_mult;

        // Rear Right
        let rr_outer_mult = if is_turning_left {
            1.0 + outer_bias * 0.3
        } else {
            1.0
        };
        let rr_rate = common_factor
            * rr_load_mult.max(0.5)
            * rr_outer_mult
            * drift_rear_mult
            * throttle_rear_mult;

        // Apply wear (clamped to 0.0-1.0)
        self.wheels[FL] = (self.wheels[FL] + fl_rate * input.delta_seconds).min(1.0);
        self.wheels[FR] = (self.wheels[FR] + fr_rate * input.delta_seconds).min(1.0);
        self.wheels[RL] = (self.wheels[RL] + rl_rate * input.delta_seconds).min(1.0);
        self.wheels[RR] = (self.wheels[RR] + rr_rate * input.delta_seconds).min(1.0);
    }

    /// Check if current weather is optimal for this tire compound
    pub fn is_optimal_weather(&self, weather: WeatherCondition) -> bool {
        self.config.optimal_weather.contains(&weather)
    }

    /// Calculate effective grip considering compound, weather, and average wear
    pub fn calculate_effective_grip(&self, weather: WeatherCondition) -> f32 {
        let base_grip = self.config.grip_multiplier;

        // Weather compatibility factor
        let weather_factor = if self.is_optimal_weather(weather) {
            1.0
        } else {
            self.config.wrong_weather_penalty
        };

        // Use progressive "cliff" formula for grip degradation
        let avg_wear = self.get_wear();
        let wear_factor = Self::calculate_progressive_degradation(avg_wear, 0.30);

        base_grip * weather_factor * wear_factor
    }

    /// Calculate progressive degradation with "cliff" effect
    /// - 0-40% wear: Slight degradation (1.0 → 0.90)
    /// - 40-70% wear: Noticeable degradation (0.90 → 0.55)
    /// - 70-100% wear: Severe cliff (0.55 → min_value)
    fn calculate_progressive_degradation(wear: f32, min_value: f32) -> f32 {
        if wear < 0.4 {
            // 0-40% wear: Slight degradation starts earlier
            1.0 - wear * 0.25
        } else if wear < 0.7 {
            // 40-70% wear: Noticeable degradation (steeper middle section)
            let t = (wear - 0.4) / 0.3;
            0.90 - t * 0.35
        } else {
            // 70-100% wear: Severe cliff (extended cliff zone)
            let t = (wear - 0.7) / 0.3;
            let t_curved = t * t;
            0.55 - t_curved * (0.55 - min_value)
        }
    }

    /// Calculate all degradation modifiers based on current tire wear
    pub fn calculate_degradation_modifiers(&self, weather: WeatherCondition) -> TireDegradationModifiers {
        let avg_wear = self.get_wear();

        // Calculate grip with weather factored in
        let base_grip = self.config.grip_multiplier;
        let weather_factor = if self.is_optimal_weather(weather) {
            1.0
        } else {
            self.config.wrong_weather_penalty
        };
        let grip_wear_factor = Self::calculate_progressive_degradation(avg_wear, 0.30);

        TireDegradationModifiers {
            grip_multiplier: base_grip * weather_factor * grip_wear_factor,
            brake_efficiency: Self::calculate_progressive_degradation(avg_wear, 0.40),
            max_steer_multiplier: Self::calculate_progressive_degradation(avg_wear, 0.70),
            steer_instability: if avg_wear > 0.6 {
                // Instability starts at 60% wear, maxes at 15%
                ((avg_wear - 0.6) / 0.4) * 0.15
            } else {
                0.0
            },
            drift_entry_multiplier: Self::calculate_progressive_degradation(avg_wear, 0.50),
            drift_exit_multiplier: Self::calculate_progressive_degradation(avg_wear, 0.60),
            max_speed_multiplier: Self::calculate_progressive_degradation(avg_wear, 0.85),
            lateral_correction_penalty: Self::calculate_progressive_degradation(avg_wear, 0.70),
        }
    }

    /// Get the base grip multiplier for the compound
    pub fn get_grip_multiplier(&self) -> f32 {
        self.config.grip_multiplier
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tire_default() {
        let state = TireState::new();
        assert_eq!(state.get_compound(), TireCompound::Medium);
        assert!((state.get_wear() - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_tire_compound_change_resets_all_wheels() {
        let mut state = TireState::new();
        // Simulate some wear
        state.wheels = [0.1, 0.2, 0.15, 0.25];

        state.set_compound(TireCompound::Soft);

        assert_eq!(state.get_compound(), TireCompound::Soft);
        let wear = state.get_per_wheel_wear();
        assert!((wear.front_left - 0.0).abs() < 0.001);
        assert!((wear.front_right - 0.0).abs() < 0.001);
        assert!((wear.rear_left - 0.0).abs() < 0.001);
        assert!((wear.rear_right - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_per_wheel_wear_basic() {
        let mut state = TireState::new();
        state.set_compound(TireCompound::Soft);

        let input = WearInput {
            delta_seconds: 1.0,
            speed_ms: 30.0,
            steer_angle: 0.0,
            is_braking: false,
            is_throttle: false,
            is_drifting: false,
            is_handbrake: false,
            weather: WeatherCondition::Dry,
            track_temperature: 0.5,
            weight_transfer: WeightTransferResult::default(),
        };

        // Run for 60 seconds
        for _ in 0..60 {
            state.update_wear_per_wheel(&input);
        }

        let wear = state.get_per_wheel_wear();
        assert!(wear.front_left > 0.0);
        assert!(wear.front_right > 0.0);
        assert!(wear.rear_left > 0.0);
        assert!(wear.rear_right > 0.0);
        assert!(wear.average() < 1.0);
    }

    #[test]
    fn test_steering_wears_front_more() {
        let mut state1 = TireState::new();
        let mut state2 = TireState::new();

        let straight_input = WearInput {
            delta_seconds: 1.0,
            speed_ms: 30.0,
            steer_angle: 0.0,
            is_braking: false,
            is_throttle: false,
            is_drifting: false,
            is_handbrake: false,
            weather: WeatherCondition::Dry,
            track_temperature: 0.5,
            weight_transfer: WeightTransferResult::default(),
        };

        let turning_input = WearInput {
            steer_angle: 0.3, // Moderate turn
            ..straight_input
        };

        for _ in 0..30 {
            state1.update_wear_per_wheel(&straight_input);
            state2.update_wear_per_wheel(&turning_input);
        }

        let wear1 = state1.get_per_wheel_wear();
        let wear2 = state2.get_per_wheel_wear();

        // Front wheels should wear more when turning
        let front_avg_turning = (wear2.front_left + wear2.front_right) / 2.0;
        let front_avg_straight = (wear1.front_left + wear1.front_right) / 2.0;
        assert!(front_avg_turning > front_avg_straight * 1.5);
    }

    #[test]
    fn test_turning_right_wears_left_outer_more() {
        let mut state = TireState::new();

        let input = WearInput {
            delta_seconds: 1.0,
            speed_ms: 30.0,
            steer_angle: 0.4, // Turning right
            is_braking: false,
            is_throttle: false,
            is_drifting: false,
            is_handbrake: false,
            weather: WeatherCondition::Dry,
            track_temperature: 0.5,
            weight_transfer: WeightTransferResult::default(),
        };

        for _ in 0..30 {
            state.update_wear_per_wheel(&input);
        }

        let wear = state.get_per_wheel_wear();
        // When turning right, left (outer) wheels should wear more
        assert!(wear.front_left > wear.front_right);
    }

    #[test]
    fn test_drift_wears_rear_more() {
        let mut state = TireState::new();

        let input = WearInput {
            delta_seconds: 1.0,
            speed_ms: 30.0,
            steer_angle: 0.0,
            is_braking: false,
            is_throttle: false,
            is_drifting: true,
            is_handbrake: false,
            weather: WeatherCondition::Dry,
            track_temperature: 0.5,
            weight_transfer: WeightTransferResult::default(),
        };

        for _ in 0..30 {
            state.update_wear_per_wheel(&input);
        }

        let wear = state.get_per_wheel_wear();
        let front_avg = (wear.front_left + wear.front_right) / 2.0;
        let rear_avg = (wear.rear_left + wear.rear_right) / 2.0;

        // Rear should wear ~3x more when drifting
        assert!(rear_avg > front_avg * 2.5);
    }

    #[test]
    fn test_braking_wears_front_more() {
        let mut state = TireState::new();

        let input = WearInput {
            delta_seconds: 1.0,
            speed_ms: 30.0,
            steer_angle: 0.0,
            is_braking: true,
            is_throttle: false,
            is_drifting: false,
            is_handbrake: false,
            weather: WeatherCondition::Dry,
            track_temperature: 0.5,
            weight_transfer: WeightTransferResult::default(),
        };

        for _ in 0..30 {
            state.update_wear_per_wheel(&input);
        }

        let wear = state.get_per_wheel_wear();
        let front_avg = (wear.front_left + wear.front_right) / 2.0;
        let rear_avg = (wear.rear_left + wear.rear_right) / 2.0;

        // Front should wear 40% more when braking
        assert!(front_avg > rear_avg * 1.3);
    }

    #[test]
    fn test_wrong_weather_increases_wear() {
        let mut state1 = TireState::new();
        let mut state2 = TireState::new();
        state1.set_compound(TireCompound::Soft); // Optimal for dry
        state2.set_compound(TireCompound::Soft);

        let dry_input = WearInput {
            delta_seconds: 1.0,
            speed_ms: 30.0,
            steer_angle: 0.0,
            is_braking: false,
            is_throttle: false,
            is_drifting: false,
            is_handbrake: false,
            weather: WeatherCondition::Dry,
            track_temperature: 0.5,
            weight_transfer: WeightTransferResult::default(),
        };

        let rain_input = WearInput {
            weather: WeatherCondition::Rain,
            ..dry_input
        };

        for _ in 0..30 {
            state1.update_wear_per_wheel(&dry_input);
            state2.update_wear_per_wheel(&rain_input);
        }

        // Wrong weather should cause 1.5x wear
        assert!(state2.get_wear() > state1.get_wear() * 1.4);
    }

    #[test]
    fn test_effective_grip_optimal_weather() {
        let state = TireState::new(); // Medium, dry-optimal
        let grip = state.calculate_effective_grip(WeatherCondition::Dry);
        assert!((grip - 1.0).abs() < 0.01); // Medium = 1.0 grip, no penalties
    }

    #[test]
    fn test_effective_grip_wrong_weather() {
        let mut state = TireState::new();
        state.set_compound(TireCompound::Soft); // Optimal for dry

        let dry_grip = state.calculate_effective_grip(WeatherCondition::Dry);
        let rain_grip = state.calculate_effective_grip(WeatherCondition::Rain);

        // Rain should apply wrong weather penalty (0.25 for soft)
        assert!(rain_grip < dry_grip * 0.3);
    }

    #[test]
    fn test_wear_grip_degradation() {
        let mut state = TireState::new();

        let fresh_grip = state.calculate_effective_grip(WeatherCondition::Dry);

        // Manually set high wear on all wheels
        state.wheels = [1.0, 1.0, 1.0, 1.0];

        let worn_grip = state.calculate_effective_grip(WeatherCondition::Dry);

        // At 100% wear, grip should be ~30% (severe degradation)
        assert!((worn_grip / fresh_grip - 0.30).abs() < 0.05);
    }

    #[test]
    fn test_progressive_degradation_curve() {
        // Test the progressive degradation formula at key points
        let d = TireState::calculate_progressive_degradation;

        // 0% wear: Should be 1.0
        assert!((d(0.0, 0.30) - 1.0).abs() < 0.01);

        // 40% wear: Should be ~0.90 (earlier degradation start)
        assert!((d(0.4, 0.30) - 0.90).abs() < 0.01);

        // 70% wear: Should be ~0.55 (steeper middle section)
        assert!((d(0.7, 0.30) - 0.55).abs() < 0.01);

        // 100% wear: Should be min_value (0.30)
        assert!((d(1.0, 0.30) - 0.30).abs() < 0.01);
    }

    #[test]
    fn test_degradation_modifiers() {
        let mut state = TireState::new();

        // Fresh tires - all modifiers should be near 1.0
        let fresh = state.calculate_degradation_modifiers(WeatherCondition::Dry);
        assert!((fresh.brake_efficiency - 1.0).abs() < 0.01);
        assert!((fresh.max_steer_multiplier - 1.0).abs() < 0.01);
        assert!((fresh.steer_instability - 0.0).abs() < 0.01);

        // Worn tires - modifiers should be degraded
        state.wheels = [1.0, 1.0, 1.0, 1.0];
        let worn = state.calculate_degradation_modifiers(WeatherCondition::Dry);
        assert!(worn.brake_efficiency < 0.5);
        assert!(worn.max_steer_multiplier < 0.8);
        assert!(worn.steer_instability > 0.1);
        assert!(worn.drift_entry_multiplier < 0.6);
    }
}
