use crate::types::{AmbientConditions, WeatherModifiers};

/// Dynamic weather state - always uses continuous temperature/rain values
#[derive(Debug)]
pub struct WeatherState {
    current_modifiers: WeatherModifiers,
    current_ambient: AmbientConditions,
}

impl Default for WeatherState {
    fn default() -> Self {
        let ambient = AmbientConditions::from_celsius(25.0, 0.3);
        let mut state = Self {
            current_modifiers: WeatherModifiers::dry(),
            current_ambient: ambient,
        };
        state.current_modifiers = state.compute_modifiers();
        state
    }
}

impl WeatherState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Update is now a no-op since we don't have preset transitions
    pub fn update(&mut self, _delta_seconds: f32) {
        // No-op: modifiers are computed on-demand when ambient conditions change
    }

    pub fn get_modifiers(&self) -> &WeatherModifiers {
        &self.current_modifiers
    }

    /// Get decay rate for track temperature based on ambient conditions
    pub fn get_temperature_decay_rate(&self) -> f32 {
        let celsius = self.current_ambient.to_celsius();
        let rain = self.current_ambient.rain_intensity;

        // Base rate depends on temperature
        let temp_rate = if celsius < 5.0 {
            0.12 // Cold - fast decay
        } else if celsius > 35.0 {
            0.015 // Hot - slow decay
        } else {
            0.03 // Normal
        };

        // Rain increases decay rate
        temp_rate * (1.0 + rain * 1.5)
    }

    /// Check if it's currently raining (for wetness updates)
    pub fn is_raining(&self) -> bool {
        self.current_ambient.rain_intensity > 0.01
    }

    /// Get current ambient conditions (temperature and humidity)
    pub fn get_ambient_conditions(&self) -> AmbientConditions {
        self.current_ambient
    }

    /// Set ambient conditions (temperature in Celsius, humidity and rain 0-1)
    pub fn set_custom_ambient(&mut self, celsius: f32, humidity: f32, rain_intensity: f32) {
        self.current_ambient = AmbientConditions::new(celsius, humidity, rain_intensity);
        self.current_modifiers = self.compute_modifiers();
    }

    /// Get the current rain intensity (0-1)
    pub fn get_rain_intensity(&self) -> f32 {
        self.current_ambient.rain_intensity
    }

    /// Compute modifiers based on ambient conditions
    /// Temperature zones: cold (-10 to 5C), normal (5-35C), hot (35-50C)
    /// Rain intensity scales rain effects from 0% to 100%
    fn compute_modifiers(&self) -> WeatherModifiers {
        let celsius = self.current_ambient.to_celsius();
        let rain = self.current_ambient.rain_intensity;

        // Base modifiers from temperature
        let temp_modifiers = if celsius < 5.0 {
            // Cold zone: interpolate from cold to dry
            // At -10C: full cold modifiers, at 5C: dry modifiers
            // Using squared interpolation for stronger cold effect
            let t = ((celsius + 10.0) / 15.0).clamp(0.0, 1.0);
            let t_eased = t * t; // Square for stronger cold at low temps
            WeatherModifiers::cold().lerp(&WeatherModifiers::dry(), t_eased)
        } else if celsius > 35.0 {
            // Hot zone: interpolate from dry to hot
            // 35C = 0.0, 50C = 1.0
            let t = ((celsius - 35.0) / 15.0).clamp(0.0, 1.0);
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
        // Default is 25C, no rain
        let ambient = state.get_ambient_conditions();
        assert!((ambient.to_celsius() - 25.0).abs() < 1.0);
        assert!(ambient.rain_intensity < 0.01);
    }

    #[test]
    fn test_custom_weather() {
        let mut state = WeatherState::new();
        state.set_custom_ambient(15.0, 0.9, 1.0); // Rainy conditions

        let modifiers = state.get_modifiers();
        // Should be close to rain modifiers (friction ~0.5)
        assert!(modifiers.friction_slip_multiplier < 0.7);
    }

    #[test]
    fn test_temperature_zones() {
        let mut state = WeatherState::new();

        // Cold zone
        state.set_custom_ambient(-5.0, 0.5, 0.0);
        let modifiers = state.get_modifiers();
        assert!(modifiers.friction_slip_multiplier < 0.5);

        // Normal zone
        state.set_custom_ambient(20.0, 0.3, 0.0);
        let modifiers = state.get_modifiers();
        assert!((modifiers.friction_slip_multiplier - 1.0).abs() < 0.1);

        // Hot zone
        state.set_custom_ambient(45.0, 0.2, 0.0);
        let modifiers = state.get_modifiers();
        assert!(modifiers.friction_slip_multiplier > 1.0);
    }

    #[test]
    fn test_decay_rates() {
        let mut state = WeatherState::new();

        // Normal temp, no rain
        state.set_custom_ambient(25.0, 0.3, 0.0);
        assert!((state.get_temperature_decay_rate() - 0.03).abs() < 0.001);

        // Cold temp
        state.set_custom_ambient(-5.0, 0.5, 0.0);
        assert!((state.get_temperature_decay_rate() - 0.12).abs() < 0.001);

        // Normal temp + rain (decay increases)
        state.set_custom_ambient(25.0, 0.9, 1.0);
        assert!(state.get_temperature_decay_rate() > 0.05);
    }

    #[test]
    fn test_is_raining() {
        let mut state = WeatherState::new();

        state.set_custom_ambient(25.0, 0.3, 0.0);
        assert!(!state.is_raining());

        state.set_custom_ambient(15.0, 0.9, 0.5);
        assert!(state.is_raining());
    }
}
