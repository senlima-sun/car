use crate::types::{AmbientConditions, EngineTemperature};

// Engine temperature constants
const ENGINE_HEAT_RATE_THROTTLE: f32 = 0.08; // Heat gain per second at full throttle
const ENGINE_HEAT_RATE_RPM: f32 = 0.05; // Additional heat from high RPM
const ENGINE_COOLING_RATE_IDLE: f32 = 0.03; // Cooling when idle
const ENGINE_COOLING_RATE_AIRFLOW: f32 = 0.06; // Cooling from airflow (speed-based)
const OVERHEAT_THRESHOLD: f32 = 0.85; // ~105C - start power reduction
const CRITICAL_THRESHOLD: f32 = 0.95; // ~115C - severe power loss

#[derive(Debug, Default)]
pub struct EngineTemperatureState {
    current: EngineTemperature,
}

impl EngineTemperatureState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Update engine temperature based on driving conditions
    pub fn update(
        &mut self,
        delta: f32,
        throttle: bool,
        speed_ms: f32,
        ambient: &AmbientConditions,
    ) {
        let dt = delta.min(0.05);

        // Heat generation
        let mut heat_rate = 0.0;

        if throttle {
            // Base heat from throttle
            heat_rate += ENGINE_HEAT_RATE_THROTTLE;

            // Additional heat at high speed (simulates high RPM)
            let rpm_factor = (speed_ms / 80.0).min(1.0); // Max at ~288 km/h
            heat_rate += ENGINE_HEAT_RATE_RPM * rpm_factor;
        }

        // Cooling
        let mut cooling_rate = ENGINE_COOLING_RATE_IDLE;

        // Airflow cooling increases with speed
        let airflow_factor = (speed_ms / 40.0).min(1.0); // Max at ~144 km/h
        cooling_rate += ENGINE_COOLING_RATE_AIRFLOW * airflow_factor;

        // Ambient temperature affects equilibrium
        // Hot ambient = less effective cooling
        // Cold ambient = more effective cooling
        let ambient_celsius = ambient.to_celsius();
        let ambient_modifier = if ambient_celsius > 30.0 {
            // Hot weather: reduced cooling (max 30% reduction at 50C)
            1.0 - ((ambient_celsius - 30.0) / 20.0).min(1.0) * 0.3
        } else if ambient_celsius < 15.0 {
            // Cold weather: enhanced cooling (max 30% boost at -20C)
            1.0 + ((15.0 - ambient_celsius) / 35.0).min(1.0) * 0.3
        } else {
            1.0
        };

        cooling_rate *= ambient_modifier;

        // Net temperature change
        let net_change = (heat_rate - cooling_rate) * dt;
        self.current.temperature = (self.current.temperature + net_change).clamp(0.0, 1.0);

        // Update overheating status and power multiplier
        self.current.is_overheating = self.current.temperature > OVERHEAT_THRESHOLD;

        self.current.power_multiplier = if self.current.temperature > CRITICAL_THRESHOLD {
            // Severe power loss above critical (50% at max temp)
            let excess =
                (self.current.temperature - CRITICAL_THRESHOLD) / (1.0 - CRITICAL_THRESHOLD);
            1.0 - excess * 0.5
        } else if self.current.temperature > OVERHEAT_THRESHOLD {
            // Gradual power loss in overheat zone (max 15% loss)
            let excess = (self.current.temperature - OVERHEAT_THRESHOLD)
                / (CRITICAL_THRESHOLD - OVERHEAT_THRESHOLD);
            1.0 - excess * 0.15
        } else {
            1.0
        };
    }

    pub fn get_state(&self) -> EngineTemperature {
        self.current
    }

    pub fn reset(&mut self) {
        self.current = EngineTemperature::default();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_temp_default() {
        let state = EngineTemperatureState::new();
        assert!((state.current.temperature - 0.3).abs() < 0.01);
        assert!(!state.current.is_overheating);
        assert!((state.current.power_multiplier - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_engine_heats_up_with_throttle() {
        let mut state = EngineTemperatureState::new();
        let ambient = AmbientConditions::default();
        let initial_temp = state.current.temperature;

        // Simulate driving at high speed with throttle
        for _ in 0..100 {
            state.update(1.0 / 60.0, true, 60.0, &ambient);
        }

        assert!(state.current.temperature > initial_temp);
    }

    #[test]
    fn test_engine_cools_down_when_idle() {
        let mut state = EngineTemperatureState::new();
        state.current.temperature = 0.8; // Start hot
        let ambient = AmbientConditions::default();

        // Simulate idling
        for _ in 0..100 {
            state.update(1.0 / 60.0, false, 0.0, &ambient);
        }

        assert!(state.current.temperature < 0.8);
    }

    #[test]
    fn test_power_reduction_when_overheating() {
        let mut state = EngineTemperatureState::new();
        state.current.temperature = 0.90; // Above overheat threshold
        let ambient = AmbientConditions::default();

        state.update(0.0, false, 0.0, &ambient);

        assert!(state.current.is_overheating);
        assert!(state.current.power_multiplier < 1.0);
    }
}
