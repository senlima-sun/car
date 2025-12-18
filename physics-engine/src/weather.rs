use crate::types::{AmbientConditions, WeatherCondition, WeatherModifiers};
use crate::utils::smoothstep;

const WEATHER_TRANSITION_DURATION: f32 = 3.0; // seconds

/// Get default ambient conditions for a weather type
fn ambient_for_weather(weather: WeatherCondition) -> AmbientConditions {
    match weather {
        WeatherCondition::Dry => AmbientConditions::from_celsius(25.0, 0.3),
        WeatherCondition::Hot => AmbientConditions::from_celsius(38.0, 0.2),
        WeatherCondition::Rain => {
            let mut cond = AmbientConditions::from_celsius(15.0, 0.9);
            cond.rain_intensity = 1.0;
            cond
        }
        WeatherCondition::Cold => AmbientConditions::from_celsius(-5.0, 0.6),
    }
}

#[derive(Debug)]
pub struct WeatherState {
    current: WeatherCondition,
    target: WeatherCondition,
    transition_progress: f32,
    current_modifiers: WeatherModifiers,
    current_ambient: AmbientConditions,
    /// Whether using custom/granular weather control
    custom_mode: bool,
}

impl Default for WeatherState {
    fn default() -> Self {
        Self {
            current: WeatherCondition::Dry,
            target: WeatherCondition::Dry,
            transition_progress: 1.0,
            current_modifiers: WeatherModifiers::dry(),
            current_ambient: ambient_for_weather(WeatherCondition::Dry),
            custom_mode: false,
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

            // Interpolate ambient conditions
            let from_ambient = ambient_for_weather(self.current);
            let to_ambient = ambient_for_weather(self.target);
            self.current_ambient = AmbientConditions {
                temperature: from_ambient.temperature
                    + (to_ambient.temperature - from_ambient.temperature) * eased_progress,
                humidity: from_ambient.humidity
                    + (to_ambient.humidity - from_ambient.humidity) * eased_progress,
                rain_intensity: from_ambient.rain_intensity
                    + (to_ambient.rain_intensity - from_ambient.rain_intensity) * eased_progress,
            };
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

    /// Get current ambient conditions (temperature and humidity)
    pub fn get_ambient_conditions(&self) -> AmbientConditions {
        self.current_ambient
    }

    /// Check if in custom mode
    pub fn is_custom_mode(&self) -> bool {
        self.custom_mode
    }

    /// Set custom ambient conditions (temperature in Celsius, humidity and rain 0-1)
    /// This switches to custom mode and bypasses weather presets
    pub fn set_custom_ambient(&mut self, celsius: f32, humidity: f32, rain_intensity: f32) {
        self.custom_mode = true;
        self.current_ambient = AmbientConditions::new(celsius, humidity, rain_intensity);
        self.current_modifiers = self.compute_custom_modifiers();
    }

    /// Get the current rain intensity (0-1)
    pub fn get_rain_intensity(&self) -> f32 {
        self.current_ambient.rain_intensity
    }

    /// Exit custom mode and return to preset-based weather
    pub fn exit_custom_mode(&mut self) {
        self.custom_mode = false;
        self.current_ambient = ambient_for_weather(self.target);
        self.current_modifiers = WeatherModifiers::for_condition(self.target);
    }

    /// Compute modifiers based on custom ambient conditions
    /// Temperature zones: cold (-10 to 5C), normal (5-30C), hot (30-50C)
    /// Rain intensity scales rain effects from 0% to 100%
    fn compute_custom_modifiers(&self) -> WeatherModifiers {
        let celsius = self.current_ambient.to_celsius();
        let rain = self.current_ambient.rain_intensity;

        // Base modifiers from temperature
        let temp_modifiers = if celsius < 5.0 {
            // Cold zone: interpolate from cold to dry
            // -10C = 0.0, 5C = 1.0
            let t = ((celsius + 10.0) / 15.0).clamp(0.0, 1.0);
            WeatherModifiers::cold().lerp(&WeatherModifiers::dry(), t)
        } else if celsius > 30.0 {
            // Hot zone: interpolate from dry to hot
            // 30C = 0.0, 50C = 1.0
            let t = ((celsius - 30.0) / 20.0).clamp(0.0, 1.0);
            WeatherModifiers::dry().lerp(&WeatherModifiers::hot(), t)
        } else {
            // Normal zone: use dry baseline
            WeatherModifiers::dry()
        };

        // Apply rain intensity on top
        if rain > 0.0 {
            let rain_modifiers = WeatherModifiers::rain();
            // Blend in rain effects based on intensity
            temp_modifiers.lerp(&rain_modifiers, rain)
        } else {
            temp_modifiers
        }
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
