use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// ============================================================================
// Weather Types
// ============================================================================

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum WeatherCondition {
    #[default]
    Dry,
    Hot,
    Rain,
    Cold,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, Default)]
pub struct WeatherModifiers {
    pub friction_slip_multiplier: f32,
    pub drag_multiplier: f32,
    pub downforce_multiplier: f32,
    pub engine_efficiency_multiplier: f32,
    pub brake_efficiency_multiplier: f32,
    pub steer_response_multiplier: f32,
    pub max_steer_angle_multiplier: f32,
    pub drift_entry_slip_angle_multiplier: f32,
    pub drift_lateral_correction_multiplier: f32,
    pub max_speed_multiplier: f32,
}

impl WeatherModifiers {
    pub fn dry() -> Self {
        Self {
            friction_slip_multiplier: 1.0,
            drag_multiplier: 1.0,
            downforce_multiplier: 1.0,
            engine_efficiency_multiplier: 1.0,
            brake_efficiency_multiplier: 1.0,
            steer_response_multiplier: 1.0,
            max_steer_angle_multiplier: 1.0,
            drift_entry_slip_angle_multiplier: 1.0,
            drift_lateral_correction_multiplier: 1.0,
            max_speed_multiplier: 1.0,
        }
    }

    pub fn hot() -> Self {
        Self {
            friction_slip_multiplier: 1.1,
            drag_multiplier: 0.98,
            downforce_multiplier: 0.98,
            engine_efficiency_multiplier: 1.0,
            brake_efficiency_multiplier: 0.92,
            steer_response_multiplier: 1.0,
            max_steer_angle_multiplier: 1.0,
            drift_entry_slip_angle_multiplier: 1.1,
            drift_lateral_correction_multiplier: 1.05,
            max_speed_multiplier: 1.0,
        }
    }

    pub fn rain() -> Self {
        Self {
            friction_slip_multiplier: 0.5,
            drag_multiplier: 1.1,
            downforce_multiplier: 0.9,
            engine_efficiency_multiplier: 1.0,
            brake_efficiency_multiplier: 0.55,
            steer_response_multiplier: 0.8,
            max_steer_angle_multiplier: 1.0,
            drift_entry_slip_angle_multiplier: 0.5,
            drift_lateral_correction_multiplier: 0.5,
            max_speed_multiplier: 1.0,
        }
    }

    pub fn cold() -> Self {
        Self {
            friction_slip_multiplier: 0.25,
            drag_multiplier: 1.05,
            downforce_multiplier: 1.05,
            engine_efficiency_multiplier: 1.0,
            brake_efficiency_multiplier: 0.35,
            steer_response_multiplier: 0.7,
            max_steer_angle_multiplier: 1.0,
            drift_entry_slip_angle_multiplier: 0.3,
            drift_lateral_correction_multiplier: 0.35,
            max_speed_multiplier: 1.0,
        }
    }

    pub fn for_condition(condition: WeatherCondition) -> Self {
        match condition {
            WeatherCondition::Dry => Self::dry(),
            WeatherCondition::Hot => Self::hot(),
            WeatherCondition::Rain => Self::rain(),
            WeatherCondition::Cold => Self::cold(),
        }
    }

    pub fn lerp(&self, other: &Self, t: f32) -> Self {
        Self {
            friction_slip_multiplier: lerp(self.friction_slip_multiplier, other.friction_slip_multiplier, t),
            drag_multiplier: lerp(self.drag_multiplier, other.drag_multiplier, t),
            downforce_multiplier: lerp(self.downforce_multiplier, other.downforce_multiplier, t),
            engine_efficiency_multiplier: lerp(self.engine_efficiency_multiplier, other.engine_efficiency_multiplier, t),
            brake_efficiency_multiplier: lerp(self.brake_efficiency_multiplier, other.brake_efficiency_multiplier, t),
            steer_response_multiplier: lerp(self.steer_response_multiplier, other.steer_response_multiplier, t),
            max_steer_angle_multiplier: lerp(self.max_steer_angle_multiplier, other.max_steer_angle_multiplier, t),
            drift_entry_slip_angle_multiplier: lerp(self.drift_entry_slip_angle_multiplier, other.drift_entry_slip_angle_multiplier, t),
            drift_lateral_correction_multiplier: lerp(self.drift_lateral_correction_multiplier, other.drift_lateral_correction_multiplier, t),
            max_speed_multiplier: lerp(self.max_speed_multiplier, other.max_speed_multiplier, t),
        }
    }
}

// ============================================================================
// Tire Types
// ============================================================================

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum TireCompound {
    Soft,
    #[default]
    Medium,
    Hard,
    Wet,
    Intermediate,
}

#[derive(Clone, Copy, Debug)]
pub struct TireConfig {
    pub grip_multiplier: f32,
    pub degradation_rate: f32,
    pub optimal_weather: &'static [WeatherCondition],
    pub wrong_weather_penalty: f32,
}

impl TireConfig {
    pub fn for_compound(compound: TireCompound) -> Self {
        match compound {
            TireCompound::Soft => Self {
                grip_multiplier: 1.15,
                degradation_rate: 0.0015,
                optimal_weather: &[WeatherCondition::Dry, WeatherCondition::Hot],
                wrong_weather_penalty: 0.25,
            },
            TireCompound::Medium => Self {
                grip_multiplier: 1.0,
                degradation_rate: 0.0008,
                optimal_weather: &[WeatherCondition::Dry, WeatherCondition::Hot],
                wrong_weather_penalty: 0.3,
            },
            TireCompound::Hard => Self {
                grip_multiplier: 0.92,
                degradation_rate: 0.0004,
                optimal_weather: &[WeatherCondition::Dry, WeatherCondition::Hot],
                wrong_weather_penalty: 0.35,
            },
            TireCompound::Wet => Self {
                grip_multiplier: 0.75,
                degradation_rate: 0.0008,
                optimal_weather: &[WeatherCondition::Rain],
                wrong_weather_penalty: 0.5,
            },
            TireCompound::Intermediate => Self {
                grip_multiplier: 0.88,
                degradation_rate: 0.0006,
                optimal_weather: &[WeatherCondition::Rain, WeatherCondition::Cold],
                wrong_weather_penalty: 0.7,
            },
        }
    }
}

// ============================================================================
// Car Input/Output Types
// ============================================================================

#[derive(Clone, Copy, Debug, Serialize, Deserialize, Default)]
pub struct CarInput {
    pub forward: bool,
    pub backward: bool,
    pub left: bool,
    pub right: bool,
    pub brake: bool,
    pub handbrake: bool,
    pub drs: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct CarPhysicsOutput {
    pub linear_velocity: [f32; 3],
    pub angular_velocity: [f32; 3],
    pub speed_kmh: f32,
    pub gear: i8,
    pub slip_angle: f32,
    pub is_drifting: bool,
    pub effective_grip: f32,
    pub lateral_g: f32,
    pub longitudinal_g: f32,
    pub skid_intensity: f32,
}

// ============================================================================
// Track Temperature Types
// ============================================================================

#[derive(Clone, Copy, Debug, Default)]
pub struct GridCell {
    pub temperature: f32,
    pub wetness: f32,
    pub last_updated: f32,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct TrackBounds {
    pub min_x: f32,
    pub max_x: f32,
    pub min_z: f32,
    pub max_z: f32,
}

impl Default for TrackBounds {
    fn default() -> Self {
        Self {
            min_x: -500.0,
            max_x: 500.0,
            min_z: -500.0,
            max_z: 500.0,
        }
    }
}

// ============================================================================
// Curb Types
// ============================================================================

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct CurbModifiers {
    pub speed_multiplier: f32,
    pub grip_multiplier: f32,
    pub lateral_stability: f32,
    pub drag_multiplier: f32,
}

impl Default for CurbModifiers {
    fn default() -> Self {
        Self {
            speed_multiplier: 0.92,
            grip_multiplier: 1.15,
            lateral_stability: 1.1,
            drag_multiplier: 1.5,
        }
    }
}

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum CurbSide {
    Left,
    Right,
}

// ============================================================================
// Utility Functions
// ============================================================================

#[inline]
pub fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}

#[inline]
pub fn smoothstep(t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

#[inline]
pub fn clamp(value: f32, min: f32, max: f32) -> f32 {
    value.max(min).min(max)
}
