use crate::types::{AmbientConditions, EngineTemperature};

// Engine temperature constants (normalized: 0.0 = 20C, 1.0 = 160C).
// Rates scaled by 100/140 vs. legacy 120C-max so absolute deg-C-per-second is preserved.
const ENGINE_HEAT_RATE_THROTTLE: f32 = 0.0571; // Heat gain per second at full throttle
const ENGINE_HEAT_RATE_RPM: f32 = 0.0357; // Additional heat from high RPM
const ENGINE_COOLING_RATE_IDLE: f32 = 0.0214; // Cooling when idle
const ENGINE_COOLING_RATE_AIRFLOW: f32 = 0.0429; // Cooling from airflow (speed-based)
// Normalization: 0.0 = 20C, 1.0 = 160C. Real F1 V6 hybrid coolant runs 90-110C
// in normal use; teams warn lift-and-coast at ~115C; ECU begins automatic derate
// near ~125C; bearing/coolant failure risk above ~135C.
const OVERHEAT_THRESHOLD: f32 = 0.679; // ~115C - warn / lift-and-coast zone
const CRITICAL_THRESHOLD: f32 = 0.75; // ~125C - ECU derate begins
// Soft ceiling + failure: real PUs don't freeze at a hard ceiling. Past the
// derate point, overshoot is dampened (not clipped) and seize-risk
// accumulates — eventually the engine fails.
const ENGINE_TEMP_SOFT_CEILING: f32 = 1.4; // ~216C absolute (catastrophic)
const SEIZE_RISK_THRESHOLD: f32 = 0.857; // ~140C - bearing damage zone
const SEIZE_RISK_RATE: f32 = 0.45; // Risk units / sec at extreme overheat
const SEIZE_RISK_RECOVERY: f32 = 0.04; // Recovery rate when below threshold

#[derive(Debug, Default)]
pub struct EngineTemperatureState {
    current: EngineTemperature,
    seize_risk: f32, // 0.0 = healthy, 1.0 = catastrophic failure
    is_seized: bool,
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

        // Newton's law of cooling: hotter = sheds heat faster. Past the warn
        // threshold the radiator is past its design point and dissipation grows
        // non-linearly. This naturally pulls the engine back toward equilibrium
        // without a hard ceiling.
        let overheat_boost = (self.current.temperature - OVERHEAT_THRESHOLD).max(0.0) * 0.8;
        let cooling_rate = cooling_rate + overheat_boost;

        // Floor at ambient mapped to engine-temp normalized scale
        // (0 = 20 °C, span = 140 °C). Convective cooling can't drop
        // the coolant below the air around the radiator. Clamped to
        // [0, 1] so degenerate ambient inputs can't bypass the
        // soft-ceiling path.
        let ambient_normalized = ((ambient_celsius - 20.0) / 140.0).clamp(0.0, 1.0);

        // Net temperature change with soft ceiling.
        let net_change = (heat_rate - cooling_rate) * dt;
        let new_temp = self.current.temperature + net_change;
        self.current.temperature = if new_temp > 1.0 {
            // Soft-damp overshoot: more heat past 1.0 needs increasingly more
            // surplus heat input, but never freezes. Cap at SOFT_CEILING.
            let overshoot = new_temp - 1.0;
            let damped = overshoot / (1.0 + overshoot * 1.5);
            (1.0 + damped).min(ENGINE_TEMP_SOFT_CEILING)
        } else {
            new_temp.max(ambient_normalized)
        };

        // Seize-risk accumulation: bearing damage compounds over time at
        // extreme temps; once risk hits 1.0 the engine has effectively failed.
        if self.current.temperature > SEIZE_RISK_THRESHOLD {
            let excess = (self.current.temperature - SEIZE_RISK_THRESHOLD)
                / (ENGINE_TEMP_SOFT_CEILING - SEIZE_RISK_THRESHOLD);
            self.seize_risk = (self.seize_risk + SEIZE_RISK_RATE * excess * dt).min(1.0);
            if self.seize_risk >= 1.0 {
                self.is_seized = true;
            }
        } else {
            self.seize_risk = (self.seize_risk - SEIZE_RISK_RECOVERY * dt).max(0.0);
        }

        // Update overheating status and power multiplier
        self.current.is_overheating = self.current.temperature > OVERHEAT_THRESHOLD;

        self.current.power_multiplier = if self.is_seized {
            // Catastrophic failure: ~10% creeping power as engine effectively dies.
            0.1
        } else if self.current.temperature > CRITICAL_THRESHOLD {
            // Severe power loss above critical: scales with how far past derate.
            // At 1.0 (160C) → 50% loss. At 1.2 (188C) → near-cut.
            let excess =
                (self.current.temperature - CRITICAL_THRESHOLD) / (1.0 - CRITICAL_THRESHOLD);
            (1.0 - excess.min(2.0) * 0.4).max(0.1)
        } else if self.current.temperature > OVERHEAT_THRESHOLD {
            // Gradual power loss in overheat zone (max 15% loss)
            let excess = (self.current.temperature - OVERHEAT_THRESHOLD)
                / (CRITICAL_THRESHOLD - OVERHEAT_THRESHOLD);
            1.0 - excess * 0.15
        } else {
            1.0
        };
    }

    pub fn get_seize_risk(&self) -> f32 {
        self.seize_risk
    }

    pub fn is_seized(&self) -> bool {
        self.is_seized
    }

    /// Reset seize state (e.g. for testing or post-pit recovery).
    pub fn clear_seize(&mut self) {
        self.seize_risk = 0.0;
        self.is_seized = false;
    }

    pub fn get_state(&self) -> EngineTemperature {
        self.current
    }

    pub fn reset(&mut self) {
        self.current = EngineTemperature::default();
        self.seize_risk = 0.0;
        self.is_seized = false;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_temp_default() {
        let state = EngineTemperatureState::new();
        assert!((state.current.temperature - 0.429).abs() < 0.01);
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

    #[test]
    fn test_power_multiplier_affects_acceleration() {
        let normal = EngineTemperatureState::new();
        assert!((normal.get_state().power_multiplier - 1.0).abs() < 0.01);

        let mut overheated = EngineTemperatureState::new();
        overheated.current.temperature = 0.98;
        let ambient = AmbientConditions::default();
        overheated.update(0.0, false, 0.0, &ambient);

        assert!(overheated.get_state().power_multiplier < 0.95);
        assert!(overheated.get_state().power_multiplier > 0.0);
        assert!(overheated.get_state().power_multiplier < normal.get_state().power_multiplier);
    }
}
