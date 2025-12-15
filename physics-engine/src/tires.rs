use crate::types::{TireCompound, TireConfig, WeatherCondition};

#[derive(Debug)]
pub struct TireState {
    compound: TireCompound,
    config: TireConfig,
    wear: f32, // 0.0 to 1.0
}

impl Default for TireState {
    fn default() -> Self {
        let compound = TireCompound::Medium;
        Self {
            compound,
            config: TireConfig::for_compound(compound),
            wear: 0.0,
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
        self.wear = 0.0;
    }

    pub fn get_compound(&self) -> TireCompound {
        self.compound
    }

    pub fn get_wear(&self) -> f32 {
        self.wear
    }

    pub fn reset_wear(&mut self) {
        self.wear = 0.0;
    }

    /// Update tire wear based on driving conditions
    pub fn update_wear(
        &mut self,
        delta_seconds: f32,
        speed_ms: f32,
        is_drifting: bool,
        weather: WeatherCondition,
    ) {
        let speed_factor = (speed_ms / 30.0).max(0.2); // ~100 km/h = factor 1.0
        let drift_multiplier = if is_drifting { 3.0 } else { 1.0 };
        let weather_penalty = if self.is_optimal_weather(weather) { 1.0 } else { 1.5 };

        let wear_rate = self.config.degradation_rate
            * speed_factor
            * drift_multiplier
            * weather_penalty;

        self.wear = (self.wear + wear_rate * delta_seconds).min(1.0);
    }

    /// Check if current weather is optimal for this tire compound
    pub fn is_optimal_weather(&self, weather: WeatherCondition) -> bool {
        self.config.optimal_weather.contains(&weather)
    }

    /// Calculate effective grip considering compound, weather, and wear
    pub fn calculate_effective_grip(&self, weather: WeatherCondition) -> f32 {
        let base_grip = self.config.grip_multiplier;

        // Weather compatibility factor
        let weather_factor = if self.is_optimal_weather(weather) {
            1.0
        } else {
            self.config.wrong_weather_penalty
        };

        // Wear degradation (quadratic falloff)
        // 0% wear = 1.0, 50% wear = 0.9375, 100% wear = 0.75
        let wear_factor = 1.0 - (self.wear * self.wear * 0.25);

        base_grip * weather_factor * wear_factor
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
    fn test_tire_compound_change() {
        let mut state = TireState::new();
        state.set_compound(TireCompound::Soft);
        assert_eq!(state.get_compound(), TireCompound::Soft);
        assert!((state.get_wear() - 0.0).abs() < 0.001); // Wear reset on change
    }

    #[test]
    fn test_tire_wear() {
        let mut state = TireState::new();
        state.set_compound(TireCompound::Soft);

        // Simulate 60 seconds at 30 m/s, not drifting
        for _ in 0..3600 {
            state.update_wear(1.0 / 60.0, 30.0, false, WeatherCondition::Dry);
        }

        assert!(state.get_wear() > 0.0);
        assert!(state.get_wear() < 1.0);
    }

    #[test]
    fn test_drift_wear_multiplier() {
        let mut state1 = TireState::new();
        let mut state2 = TireState::new();
        state1.set_compound(TireCompound::Medium);
        state2.set_compound(TireCompound::Medium);

        // Same conditions, one drifting
        for _ in 0..600 {
            state1.update_wear(1.0 / 60.0, 30.0, false, WeatherCondition::Dry);
            state2.update_wear(1.0 / 60.0, 30.0, true, WeatherCondition::Dry);
        }

        // Drifting should wear 3x faster
        assert!(state2.get_wear() > state1.get_wear() * 2.5);
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

        // Manually set high wear
        state.wear = 1.0;

        let worn_grip = state.calculate_effective_grip(WeatherCondition::Dry);

        // At 100% wear, grip should be 75% (1 - 1*1*0.25)
        assert!((worn_grip / fresh_grip - 0.75).abs() < 0.01);
    }
}
