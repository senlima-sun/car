use crate::types::{WeatherCondition, WeatherModifiers};
use crate::utils::smoothstep;

const WEATHER_TRANSITION_DURATION: f32 = 3.0; // seconds

#[derive(Debug)]
pub struct WeatherState {
    current: WeatherCondition,
    target: WeatherCondition,
    transition_progress: f32,
    current_modifiers: WeatherModifiers,
}

impl Default for WeatherState {
    fn default() -> Self {
        Self {
            current: WeatherCondition::Dry,
            target: WeatherCondition::Dry,
            transition_progress: 1.0,
            current_modifiers: WeatherModifiers::dry(),
        }
    }
}

impl WeatherState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_weather(&mut self, weather: WeatherCondition) {
        if weather != self.target {
            self.current = self.target;
            self.target = weather;
            self.transition_progress = 0.0;
        }
    }

    pub fn get_weather(&self) -> WeatherCondition {
        self.target
    }

    pub fn get_current_weather(&self) -> WeatherCondition {
        if self.transition_progress >= 1.0 {
            self.target
        } else {
            self.current
        }
    }

    pub fn update(&mut self, delta_seconds: f32) {
        if self.transition_progress < 1.0 {
            self.transition_progress += delta_seconds / WEATHER_TRANSITION_DURATION;
            self.transition_progress = self.transition_progress.min(1.0);

            let eased_progress = smoothstep(self.transition_progress);
            let from_modifiers = WeatherModifiers::for_condition(self.current);
            let to_modifiers = WeatherModifiers::for_condition(self.target);
            self.current_modifiers = from_modifiers.lerp(&to_modifiers, eased_progress);
        }
    }

    pub fn get_modifiers(&self) -> &WeatherModifiers {
        &self.current_modifiers
    }

    pub fn is_transitioning(&self) -> bool {
        self.transition_progress < 1.0
    }

    pub fn get_transition_progress(&self) -> f32 {
        self.transition_progress
    }

    /// Get decay rate for track temperature based on weather
    pub fn get_temperature_decay_rate(&self) -> f32 {
        match self.target {
            WeatherCondition::Dry => 0.03,
            WeatherCondition::Hot => 0.015,
            WeatherCondition::Rain => 0.08,
            WeatherCondition::Cold => 0.12,
        }
    }

    /// Check if it's currently raining (for wetness updates)
    pub fn is_raining(&self) -> bool {
        self.target == WeatherCondition::Rain
            || (self.current == WeatherCondition::Rain && self.transition_progress < 0.5)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_weather_default() {
        let state = WeatherState::new();
        assert_eq!(state.get_weather(), WeatherCondition::Dry);
        assert!(!state.is_transitioning());
    }

    #[test]
    fn test_weather_transition() {
        let mut state = WeatherState::new();
        state.set_weather(WeatherCondition::Rain);

        assert!(state.is_transitioning());
        assert_eq!(state.get_weather(), WeatherCondition::Rain);

        // Simulate 1.5 seconds (halfway)
        for _ in 0..90 {
            state.update(1.0 / 60.0);
        }

        let modifiers = state.get_modifiers();
        // Should be between dry (1.0) and rain (0.5)
        assert!(modifiers.friction_slip_multiplier < 1.0);
        assert!(modifiers.friction_slip_multiplier > 0.5);
    }

    #[test]
    fn test_weather_transition_complete() {
        let mut state = WeatherState::new();
        state.set_weather(WeatherCondition::Rain);

        // Simulate 3+ seconds
        for _ in 0..200 {
            state.update(1.0 / 60.0);
        }

        assert!(!state.is_transitioning());
        let modifiers = state.get_modifiers();
        assert!((modifiers.friction_slip_multiplier - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_decay_rates() {
        let mut state = WeatherState::new();
        assert!((state.get_temperature_decay_rate() - 0.03).abs() < 0.001);

        state.set_weather(WeatherCondition::Cold);
        // Complete transition
        for _ in 0..200 {
            state.update(1.0 / 60.0);
        }
        assert!((state.get_temperature_decay_rate() - 0.12).abs() < 0.001);
    }
}
