use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// ============================================================================
// Weather Types
// ============================================================================

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum PrecipitationType {
    #[default]
    None,
    Rain,
    Snow,
    Hail,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, Default)]
pub struct AmbientEnvironment {
    pub temperature_celsius: f32,
    pub humidity: f32,
    pub precipitation_rate_mmh: f32,
    pub precipitation_type: PrecipitationType,
    pub atmospheric_pressure_hpa: f32,
    pub cloud_cover: f32,
}

impl AmbientEnvironment {
    pub fn new(celsius: f32, humidity: f32, precipitation_rate_mmh: f32) -> Self {
        let precip_type = if precipitation_rate_mmh < 0.1 {
            PrecipitationType::None
        } else if celsius < 0.0 {
            PrecipitationType::Snow
        } else if celsius < 2.0 {
            if precipitation_rate_mmh > 10.0 { PrecipitationType::Snow } else { PrecipitationType::Rain }
        } else {
            PrecipitationType::Rain
        };
        Self {
            temperature_celsius: celsius,
            humidity: humidity.clamp(0.0, 1.0),
            precipitation_rate_mmh: precipitation_rate_mmh.max(0.0),
            precipitation_type: precip_type,
            atmospheric_pressure_hpa: 1013.25,
            cloud_cover: if precipitation_rate_mmh > 0.1 { 0.8 } else { 0.2 },
        }
    }

    pub fn with_pressure(mut self, hpa: f32) -> Self {
        self.atmospheric_pressure_hpa = hpa;
        self
    }

    pub fn with_cloud_cover(mut self, cover: f32) -> Self {
        self.cloud_cover = cover.clamp(0.0, 1.0);
        self
    }

    pub fn default_dry() -> Self {
        Self::new(25.0, 0.3, 0.0)
    }

    pub fn is_precipitating(&self) -> bool {
        self.precipitation_rate_mmh > 0.1
    }

    pub fn is_freezing(&self) -> bool {
        self.temperature_celsius < 0.0
    }

    pub fn to_legacy_ambient(&self) -> AmbientConditions {
        let rain_01 = (self.precipitation_rate_mmh / 50.0).clamp(0.0, 1.0);
        AmbientConditions::new(self.temperature_celsius, self.humidity, rain_01)
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, Default)]
pub struct SurfaceFrictionBreakdown {
    pub water_film_mm: f32,
    pub ice_thickness: f32,
    pub snow_depth: f32,
    pub base_mu: f32,
    pub effective_mu: f32,
}

/// Internal weather condition for modifier blending (not exposed to JS)
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
// Wind Types
// ============================================================================

/// Wind state for dynamic wind simulation
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct WindState {
    /// Wind direction in radians (0 = +X axis, π/2 = +Z axis)
    pub direction: f32,
    /// Base wind speed in m/s (player-set value)
    pub base_speed: f32,
    /// Current wind speed with gusts applied
    pub current_speed: f32,
    /// Gust intensity multiplier (0.0 to 1.0)
    pub gust_intensity: f32,
    /// Internal timer for gust calculations
    pub gust_timer: f32,
    /// Whether wind system is enabled
    pub enabled: bool,
}

impl Default for WindState {
    fn default() -> Self {
        Self {
            direction: 0.0,
            base_speed: 0.0,
            current_speed: 0.0,
            gust_intensity: 0.0,
            gust_timer: 0.0,
            enabled: false,
        }
    }
}

/// Physics modifiers calculated from wind relative to car heading
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct WindModifiers {
    /// Drag modifier based on headwind/tailwind (>1 = more drag, <1 = less drag)
    pub drag_modifier: f32,
    /// Lateral force from crosswind in Newtons
    pub lateral_force: f32,
    /// Steering difficulty multiplier (0.0-1.0, lower = harder to steer)
    pub steering_difficulty: f32,
    /// Cooling multiplier for heat dissipation (>1 = faster cooling)
    pub cooling_multiplier: f32,
    /// Headwind component in m/s (positive = against car)
    pub headwind_component: f32,
    /// Crosswind component in m/s (positive = from right)
    pub crosswind_component: f32,
}

impl Default for WindModifiers {
    fn default() -> Self {
        Self {
            drag_modifier: 1.0,
            lateral_force: 0.0,
            steering_difficulty: 1.0,
            cooling_multiplier: 1.0,
            headwind_component: 0.0,
            crosswind_component: 0.0,
        }
    }
}

// ============================================================================
// Brake Types
// ============================================================================

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum EngineBrakingLevel {
    Low,
    #[default]
    Medium,
    High,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, Default)]
pub struct BrakeConfig {
    pub front_bias: f32,           // 0.50-0.70 (50-70% front)
    pub engine_braking: EngineBrakingLevel,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, Default)]
pub struct BrakeState {
    pub front_bias: f32,
    pub engine_braking: EngineBrakingLevel,
    pub front_brake_force: f32,    // Current front brake force (N)
    pub rear_brake_force: f32,     // Current rear brake force (N)
}

// ============================================================================
// ERS Types
// ============================================================================

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum ErsMode {
    #[default]
    Balanced,
    Attack,
    Harvest,
    Overtake, // 2026: Max deploy burst, testing mode only
    SemiAuto, // Smart automatic battery management
}

/// Source of energy harvesting (2026 ERS)
#[wasm_bindgen]
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum HarvestSource {
    #[default]
    None,
    Braking,
    Coast,
    SuperClip, // 2026: Harvesting at full throttle when engine has surplus
}

/// Semi-Auto ERS preset profiles
#[wasm_bindgen]
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum SemiAutoPreset {
    #[default]
    Balanced,     // 40-70% target range
    Aggressive,   // 25-50% target range (more deploy)
    Conservative, // 60-85% target range (more harvest)
}

/// Semi-Auto configuration for target-based battery management
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct SemiAutoConfig {
    /// Minimum target battery level (0.0-1.0)
    pub target_min: f32,
    /// Maximum target battery level (0.0-1.0)
    pub target_max: f32,
    /// Current preset
    pub preset: SemiAutoPreset,
    /// Lap mode enabled (race-aware strategy)
    pub lap_mode: bool,
    /// Expert mode (disables semi-auto, full manual)
    pub expert_mode: bool,
}

impl Default for SemiAutoConfig {
    fn default() -> Self {
        Self {
            target_min: 0.40,
            target_max: 0.70,
            preset: SemiAutoPreset::Balanced,
            lap_mode: false,
            expert_mode: false,
        }
    }
}

impl SemiAutoConfig {
    /// Create config for a specific preset
    pub fn for_preset(preset: SemiAutoPreset) -> Self {
        match preset {
            SemiAutoPreset::Balanced => Self {
                target_min: 0.40,
                target_max: 0.70,
                preset,
                ..Default::default()
            },
            SemiAutoPreset::Aggressive => Self {
                target_min: 0.25,
                target_max: 0.50,
                preset,
                ..Default::default()
            },
            SemiAutoPreset::Conservative => Self {
                target_min: 0.60,
                target_max: 0.85,
                preset,
                ..Default::default()
            },
        }
    }
}

/// Semi-Auto output state (for UI feedback)
#[derive(Clone, Copy, Debug, Serialize, Deserialize, Default)]
pub struct SemiAutoState {
    /// Whether coast regeneration is recommended right now
    pub coast_recommended: bool,
    /// Coast benefit score (0.0-1.0, how beneficial lifting would be)
    pub coast_benefit: f32,
    /// Current deploy efficiency based on speed (0.0-1.0)
    pub deploy_efficiency: f32,
    /// Is battery in critical state (<15%)
    pub is_critical: bool,
    /// Active deploy multiplier being applied
    pub effective_deploy_mult: f32,
    /// Active harvest multiplier being applied
    pub effective_harvest_mult: f32,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, Default)]
pub struct ErsState {
    pub battery_charge: f32,       // 0.0-1.0
    pub mode: ErsMode,
    pub power_flow: f32,           // kW (positive=deploy, negative=harvest)
    pub is_deploying: bool,
    pub is_harvesting: bool,
    // 2026 ERS fields
    pub super_clip_active: bool,   // True when harvesting at full throttle
    pub harvest_source: HarvestSource,
    pub overtake_available: bool,  // True when in testing mode
    // Semi-Auto mode state
    pub semi_auto: SemiAutoState,
}

// ============================================================================
// Active Aero Types
// ============================================================================

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum AeroMode {
    #[default]
    Corner,   // Max downforce, high drag
    Straight, // Low drag, reduced downforce
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, Default)]
pub struct ActiveAeroState {
    pub mode: AeroMode,
    pub front_wing_angle: f32,    // 0.0 = closed, 1.0 = open
    pub rear_wing_angle: f32,     // 0.0 = closed, 1.0 = open
    pub drag_multiplier: f32,
    pub downforce_multiplier: f32,
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

/// Per-wheel tire wear data (0.0 to 1.0 for each wheel)
#[derive(Clone, Copy, Debug, Serialize, Deserialize, Default)]
pub struct PerWheelWear {
    pub front_left: f32,
    pub front_right: f32,
    pub rear_left: f32,
    pub rear_right: f32,
}

impl PerWheelWear {
    pub fn average(&self) -> f32 {
        (self.front_left + self.front_right + self.rear_left + self.rear_right) / 4.0
    }

    pub fn reset(&mut self) {
        self.front_left = 0.0;
        self.front_right = 0.0;
        self.rear_left = 0.0;
        self.rear_right = 0.0;
    }
}

#[derive(Clone, Copy, Debug)]
pub struct TireConfig {
    pub grip_multiplier: f32,
    pub degradation_rate: f32,
    /// Optimal temperature range in Celsius (min, max)
    pub optimal_temp_range: (f32, f32),
    /// How well this tire handles rain (0.0 = terrible, 1.0 = excellent)
    pub rain_suitability: f32,
    /// Penalty when outside optimal conditions
    pub wrong_conditions_penalty: f32,
    pub temp_window: TireTemperatureWindow,
    /// Rubber deposit multiplier - softer tires leave more marks
    pub rubber_deposit_multiplier: f32,
}

impl TireConfig {
    pub fn for_compound(compound: TireCompound) -> Self {
        match compound {
            TireCompound::Soft => Self {
                grip_multiplier: 1.15,
                degradation_rate: 0.0015,
                optimal_temp_range: (15.0, 50.0), // Good in warm/hot conditions
                rain_suitability: 0.3,            // Poor in rain
                wrong_conditions_penalty: 0.25,
                temp_window: TireTemperatureWindow {
                    min_optimal: 0.50,  // 85C
                    max_optimal: 0.70,  // 111C
                    cold_grip_penalty: 0.75,
                    hot_grip_penalty: 0.85,
                },
                rubber_deposit_multiplier: 1.4, // Soft tires leave 40% more rubber
            },
            TireCompound::Medium => Self {
                grip_multiplier: 1.0,
                degradation_rate: 0.0008,
                optimal_temp_range: (10.0, 45.0), // Wide temperature range
                rain_suitability: 0.4,            // Moderate in rain
                wrong_conditions_penalty: 0.3,
                temp_window: TireTemperatureWindow {
                    min_optimal: 0.45,  // 78C
                    max_optimal: 0.75,  // 117C
                    cold_grip_penalty: 0.80,
                    hot_grip_penalty: 0.88,
                },
                rubber_deposit_multiplier: 1.0, // Medium tires - baseline
            },
            TireCompound::Hard => Self {
                grip_multiplier: 0.92,
                degradation_rate: 0.0004,
                optimal_temp_range: (20.0, 50.0), // Needs heat to work
                rain_suitability: 0.35,           // Poor in rain
                wrong_conditions_penalty: 0.35,
                temp_window: TireTemperatureWindow {
                    min_optimal: 0.55,  // 91C
                    max_optimal: 0.85,  // 130C
                    cold_grip_penalty: 0.70, // Hard tires need more heat
                    hot_grip_penalty: 0.92,
                },
                rubber_deposit_multiplier: 0.7, // Hard tires leave 30% less rubber
            },
            TireCompound::Wet => Self {
                grip_multiplier: 0.75,
                degradation_rate: 0.0008,
                optimal_temp_range: (5.0, 30.0),  // Works in cooler temps
                rain_suitability: 1.0,            // Excellent in rain
                wrong_conditions_penalty: 0.5,
                temp_window: TireTemperatureWindow {
                    min_optimal: 0.25,  // 52C (lower operating temp)
                    max_optimal: 0.50,  // 85C
                    cold_grip_penalty: 0.90,
                    hot_grip_penalty: 0.70, // Overheats easily
                },
                rubber_deposit_multiplier: 0.3, // Wet tires designed to minimize marks
            },
            TireCompound::Intermediate => Self {
                grip_multiplier: 0.88,
                degradation_rate: 0.0006,
                optimal_temp_range: (0.0, 25.0),  // Works in cold/wet conditions
                rain_suitability: 0.8,            // Good in rain
                wrong_conditions_penalty: 0.7,
                temp_window: TireTemperatureWindow {
                    min_optimal: 0.35,  // 65C
                    max_optimal: 0.60,  // 98C
                    cold_grip_penalty: 0.85,
                    hot_grip_penalty: 0.80,
                },
                rubber_deposit_multiplier: 0.5, // Intermediate - between wet and dry compounds
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
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct GripBreakdown {
    pub base_compound_grip: f32,
    pub weather_friction_mult: f32,
    pub tire_wear_grip_mult: f32,
    pub surface_grip_mult: f32,
    pub curb_turn_grip_mult: f32,
    pub tire_temp_grip_mult: f32,
    pub aquaplaning_grip_mult: f32,
    pub thermal_shock_grip_mult: f32,
    pub final_effective_grip: f32,
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
    pub tire_wear: PerWheelWear,
    pub steer_angle: f32,
    pub temperature: TemperatureOutput,
    pub aquaplaning: AquaplaningState,
    pub tire_thermal_shock: TireThermalShock,
    pub ers: ErsState,
    pub active_aero: ActiveAeroState,
    pub grip_breakdown: GripBreakdown,
}

// ============================================================================
// Track Temperature Types
// ============================================================================

#[derive(Clone, Copy, Debug, Default)]
pub struct GridCell {
    pub temperature: f32,
    pub wetness: f32,
    pub rubber_buildup: f32,
    pub ice_formation: f32,
    pub last_updated: f32,
    /// Rain exposure factor (0.0 = fully sheltered, 1.0 = open sky)
    pub rain_exposure: f32,
    /// Standing water depth (0.0-1.0)
    pub water_depth: f32,
    /// Drainage rate multiplier (slope-based, 0.0-2.0)
    pub drainage_rate: f32,
    /// Whether this cell is part of a road surface (retains heat better)
    pub is_road: bool,
}

impl GridCell {
    /// Create a new cell with default rain exposure (open sky)
    pub fn new() -> Self {
        Self {
            rain_exposure: 1.0,
            drainage_rate: 1.0,
            ..Default::default()
        }
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct AmbientConditions {
    /// Temperature in Celsius, normalized: 0.0 = -20C, 1.0 = 50C
    pub temperature: f32,
    /// Humidity 0.0 to 1.0 (0% to 100%)
    pub humidity: f32,
    /// Rain intensity 0.0 to 1.0 (0% to 100%)
    pub rain_intensity: f32,
}

impl Default for AmbientConditions {
    fn default() -> Self {
        Self {
            temperature: 0.643, // ~25C (dry weather default)
            humidity: 0.3,
            rain_intensity: 0.0,
        }
    }
}

impl AmbientConditions {
    /// Convert normalized temperature (0-1) to Celsius
    pub fn to_celsius(&self) -> f32 {
        self.temperature * 70.0 - 20.0 // 0.0 = -20C, 1.0 = 50C
    }

    /// Create from Celsius temperature
    pub fn from_celsius(celsius: f32, humidity: f32) -> Self {
        Self {
            temperature: (celsius + 20.0) / 70.0,
            humidity: humidity.clamp(0.0, 1.0),
            rain_intensity: 0.0,
        }
    }

    /// Create with all parameters
    pub fn new(celsius: f32, humidity: f32, rain_intensity: f32) -> Self {
        Self {
            temperature: (celsius + 20.0) / 70.0,
            humidity: humidity.clamp(0.0, 1.0),
            rain_intensity: rain_intensity.clamp(0.0, 1.0),
        }
    }
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
// Tire Degradation Types
// ============================================================================

/// Modifiers applied based on tire wear level
#[derive(Clone, Copy, Debug)]
pub struct TireDegradationModifiers {
    /// Grip multiplier (1.0 → 0.30 at 100% wear)
    pub grip_multiplier: f32,
    /// Brake efficiency (1.0 → 0.40 at 100% wear)
    pub brake_efficiency: f32,
    /// Maximum steering angle multiplier (1.0 → 0.70 at 100% wear)
    pub max_steer_multiplier: f32,
    /// Steering instability/wobble (0.0 → 0.15 at 100% wear)
    pub steer_instability: f32,
    /// Drift entry threshold multiplier (1.0 → 0.50 at 100% wear, lower = easier to drift)
    pub drift_entry_multiplier: f32,
    /// Drift exit threshold multiplier (1.0 → 0.60 at 100% wear, lower = harder to recover)
    pub drift_exit_multiplier: f32,
    /// Maximum speed multiplier (1.0 → 0.85 at 100% wear)
    pub max_speed_multiplier: f32,
    /// Lateral correction penalty (1.0 → 0.70 at 100% wear, more sliding)
    pub lateral_correction_penalty: f32,
}

impl Default for TireDegradationModifiers {
    fn default() -> Self {
        Self {
            grip_multiplier: 1.0,
            brake_efficiency: 1.0,
            max_steer_multiplier: 1.0,
            steer_instability: 0.0,
            drift_entry_multiplier: 1.0,
            drift_exit_multiplier: 1.0,
            max_speed_multiplier: 1.0,
            lateral_correction_penalty: 1.0,
        }
    }
}

// ============================================================================
// Surface Types
// ============================================================================

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum SurfaceType {
    #[default]
    Grass,
    Road,
    Curb,
}

/// Modifiers applied based on surface type
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct SurfaceModifiers {
    /// Grip multiplier (1.0 = normal road grip)
    pub grip_multiplier: f32,
    /// Speed/acceleration multiplier
    pub speed_multiplier: f32,
    /// Tire wear rate multiplier
    pub tire_wear_multiplier: f32,
    /// Drag multiplier
    pub drag_multiplier: f32,
    /// Brake efficiency multiplier
    pub brake_efficiency: f32,
    /// Steering response multiplier
    pub steer_response: f32,
}

impl Default for SurfaceModifiers {
    fn default() -> Self {
        Self::road()
    }
}

impl SurfaceModifiers {
    /// Road surface - optimal driving conditions
    pub fn road() -> Self {
        Self {
            grip_multiplier: 1.0,
            speed_multiplier: 1.0,
            tire_wear_multiplier: 1.0,
            drag_multiplier: 1.0,
            brake_efficiency: 1.0,
            steer_response: 1.0,
        }
    }

    /// Grass surface - major penalty for going off track
    pub fn grass() -> Self {
        Self {
            grip_multiplier: 0.35,
            speed_multiplier: 0.7,
            tire_wear_multiplier: 0.5, // Less wear on soft surface
            drag_multiplier: 1.5,
            brake_efficiency: 0.4,
            steer_response: 0.5,
        }
    }

    /// Curb surface - racing curbs provide slight advantage
    pub fn curb() -> Self {
        Self {
            grip_multiplier: 1.15,
            speed_multiplier: 0.92,
            tire_wear_multiplier: 1.1,
            drag_multiplier: 1.5,
            brake_efficiency: 1.0,
            steer_response: 1.0,
        }
    }

    pub fn for_surface(surface: SurfaceType) -> Self {
        match surface {
            SurfaceType::Grass => Self::grass(),
            SurfaceType::Road => Self::road(),
            SurfaceType::Curb => Self::curb(),
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
// Temperature Types
// ============================================================================

/// Per-wheel tire temperature data (inner and outer edge)
/// All temperatures normalized 0.0 to 1.0 (0 = 20C, 1.0 = 150C)
#[derive(Clone, Copy, Debug, Serialize, Deserialize, Default)]
pub struct PerWheelTemperature {
    pub front_left_inner: f32,
    pub front_left_outer: f32,
    pub front_right_inner: f32,
    pub front_right_outer: f32,
    pub rear_left_inner: f32,
    pub rear_left_outer: f32,
    pub rear_right_inner: f32,
    pub rear_right_outer: f32,
}

impl PerWheelTemperature {
    /// Get average temperature for a single wheel
    pub fn wheel_avg(&self, wheel: usize) -> f32 {
        match wheel {
            0 => (self.front_left_inner + self.front_left_outer) / 2.0,
            1 => (self.front_right_inner + self.front_right_outer) / 2.0,
            2 => (self.rear_left_inner + self.rear_left_outer) / 2.0,
            3 => (self.rear_right_inner + self.rear_right_outer) / 2.0,
            _ => 0.5,
        }
    }

    /// Convert normalized temp to Celsius (20C - 150C range)
    pub fn to_celsius(normalized: f32) -> f32 {
        normalized * 130.0 + 20.0
    }
}

/// Engine temperature state
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct EngineTemperature {
    /// Current engine temperature (0.0 = cold/20C, 1.0 = critical/120C)
    pub temperature: f32,
    /// Is engine in overheating state (above 0.85)
    pub is_overheating: bool,
    /// Power reduction due to temperature (1.0 = full power, 0.5 = 50% power)
    pub power_multiplier: f32,
}

impl Default for EngineTemperature {
    fn default() -> Self {
        Self {
            temperature: 0.3, // Start at ~50C (warm idle)
            is_overheating: false,
            power_multiplier: 1.0,
        }
    }
}

impl EngineTemperature {
    /// Convert normalized temp to Celsius (20C - 120C range)
    pub fn to_celsius(&self) -> f32 {
        self.temperature * 100.0 + 20.0
    }
}

/// Optimal temperature window per tire compound
#[derive(Clone, Copy, Debug)]
pub struct TireTemperatureWindow {
    /// Minimum optimal temp (normalized)
    pub min_optimal: f32,
    /// Maximum optimal temp (normalized)
    pub max_optimal: f32,
    /// Grip multiplier when cold (below min_optimal)
    pub cold_grip_penalty: f32,
    /// Grip multiplier when hot (above max_optimal)
    pub hot_grip_penalty: f32,
}

impl Default for TireTemperatureWindow {
    fn default() -> Self {
        // Default to medium compound window
        Self {
            min_optimal: 0.45,
            max_optimal: 0.75,
            cold_grip_penalty: 0.80,
            hot_grip_penalty: 0.88,
        }
    }
}

/// Full temperature output for UI
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct TemperatureOutput {
    pub engine: EngineTemperature,
    pub tires: PerWheelTemperature,
    /// Per-wheel grip multiplier from temperature (0.0-1.0)
    pub tire_temp_grip: [f32; 4],
    /// Per-wheel "in optimal window" status
    pub tire_in_window: [bool; 4],
}

// ============================================================================
// Aquaplaning Types
// ============================================================================

/// State of aquaplaning for the vehicle
#[derive(Clone, Copy, Debug, Serialize, Deserialize, Default)]
pub struct AquaplaningState {
    /// Whether the car is currently aquaplaning
    pub is_aquaplaning: bool,
    /// Intensity of aquaplaning (0.0-1.0)
    pub intensity: f32,
    /// Which wheels are affected [FL, FR, RL, RR]
    pub affected_wheels: [bool; 4],
}

/// Tire thermal shock state (from sudden cooling in puddles)
#[derive(Clone, Copy, Debug, Serialize, Deserialize, Default)]
pub struct TireThermalShock {
    /// Whether the tire is in thermal shock
    pub is_shocked: bool,
    /// Grip penalty multiplier (0.0-1.0, where 0.3 = 30% grip loss)
    pub grip_penalty: f32,
    /// Time remaining for recovery (seconds)
    pub recovery_time: f32,
}

/// Per-wheel thermal shock state
#[derive(Clone, Copy, Debug, Default)]
pub struct PerWheelThermalShock {
    pub front_left: TireThermalShock,
    pub front_right: TireThermalShock,
    pub rear_left: TireThermalShock,
    pub rear_right: TireThermalShock,
}

impl PerWheelThermalShock {
    /// Get the worst grip penalty across all wheels
    pub fn max_grip_penalty(&self) -> f32 {
        self.front_left.grip_penalty
            .max(self.front_right.grip_penalty)
            .max(self.rear_left.grip_penalty)
            .max(self.rear_right.grip_penalty)
    }

    /// Check if any wheel is in thermal shock
    pub fn any_shocked(&self) -> bool {
        self.front_left.is_shocked
            || self.front_right.is_shocked
            || self.rear_left.is_shocked
            || self.rear_right.is_shocked
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    const EPSILON: f32 = 1e-5;

    fn assert_approx(a: f32, b: f32) {
        assert!(
            (a - b).abs() < EPSILON,
            "expected {} to be approximately {}, diff = {}",
            a,
            b,
            (a - b).abs()
        );
    }

    #[test]
    fn lerp_returns_start_at_t_zero() {
        assert_approx(lerp(10.0, 20.0, 0.0), 10.0);
    }

    #[test]
    fn lerp_returns_end_at_t_one() {
        assert_approx(lerp(10.0, 20.0, 1.0), 20.0);
    }

    #[test]
    fn lerp_returns_midpoint_at_t_half() {
        assert_approx(lerp(10.0, 20.0, 0.5), 15.0);
    }

    #[test]
    fn smoothstep_returns_zero_at_zero() {
        assert_approx(smoothstep(0.0), 0.0);
    }

    #[test]
    fn smoothstep_returns_one_at_one() {
        assert_approx(smoothstep(1.0), 1.0);
    }

    #[test]
    fn smoothstep_returns_half_at_half() {
        assert_approx(smoothstep(0.5), 0.5);
    }

    #[test]
    fn smoothstep_clamps_below_zero() {
        assert_approx(smoothstep(-1.0), 0.0);
    }

    #[test]
    fn smoothstep_clamps_above_one() {
        assert_approx(smoothstep(2.0), 1.0);
    }

    #[test]
    fn clamp_returns_value_in_range() {
        assert_approx(clamp(5.0, 0.0, 10.0), 5.0);
    }

    #[test]
    fn clamp_returns_min_when_below() {
        assert_approx(clamp(-5.0, 0.0, 10.0), 0.0);
    }

    #[test]
    fn clamp_returns_max_when_above() {
        assert_approx(clamp(15.0, 0.0, 10.0), 10.0);
    }

    #[test]
    fn weather_modifiers_lerp_at_t_zero_returns_self() {
        let dry = WeatherModifiers::dry();
        let rain = WeatherModifiers::rain();
        let result = dry.lerp(&rain, 0.0);
        assert_approx(result.friction_slip_multiplier, dry.friction_slip_multiplier);
        assert_approx(result.drag_multiplier, dry.drag_multiplier);
        assert_approx(result.downforce_multiplier, dry.downforce_multiplier);
        assert_approx(result.engine_efficiency_multiplier, dry.engine_efficiency_multiplier);
        assert_approx(result.brake_efficiency_multiplier, dry.brake_efficiency_multiplier);
        assert_approx(result.steer_response_multiplier, dry.steer_response_multiplier);
        assert_approx(result.max_steer_angle_multiplier, dry.max_steer_angle_multiplier);
        assert_approx(result.drift_entry_slip_angle_multiplier, dry.drift_entry_slip_angle_multiplier);
        assert_approx(result.drift_lateral_correction_multiplier, dry.drift_lateral_correction_multiplier);
        assert_approx(result.max_speed_multiplier, dry.max_speed_multiplier);
    }

    #[test]
    fn weather_modifiers_lerp_at_t_one_returns_other() {
        let dry = WeatherModifiers::dry();
        let rain = WeatherModifiers::rain();
        let result = dry.lerp(&rain, 1.0);
        assert_approx(result.friction_slip_multiplier, rain.friction_slip_multiplier);
        assert_approx(result.drag_multiplier, rain.drag_multiplier);
        assert_approx(result.downforce_multiplier, rain.downforce_multiplier);
        assert_approx(result.brake_efficiency_multiplier, rain.brake_efficiency_multiplier);
        assert_approx(result.steer_response_multiplier, rain.steer_response_multiplier);
        assert_approx(result.drift_entry_slip_angle_multiplier, rain.drift_entry_slip_angle_multiplier);
        assert_approx(result.drift_lateral_correction_multiplier, rain.drift_lateral_correction_multiplier);
    }

    #[test]
    fn weather_modifiers_lerp_at_t_half_returns_midpoint() {
        let dry = WeatherModifiers::dry();
        let rain = WeatherModifiers::rain();
        let result = dry.lerp(&rain, 0.5);
        let expected_friction = (dry.friction_slip_multiplier + rain.friction_slip_multiplier) / 2.0;
        let expected_drag = (dry.drag_multiplier + rain.drag_multiplier) / 2.0;
        let expected_brake = (dry.brake_efficiency_multiplier + rain.brake_efficiency_multiplier) / 2.0;
        assert_approx(result.friction_slip_multiplier, expected_friction);
        assert_approx(result.drag_multiplier, expected_drag);
        assert_approx(result.brake_efficiency_multiplier, expected_brake);
    }

    #[test]
    fn weather_modifiers_dry_all_ones() {
        let dry = WeatherModifiers::dry();
        assert_approx(dry.friction_slip_multiplier, 1.0);
        assert_approx(dry.drag_multiplier, 1.0);
        assert_approx(dry.downforce_multiplier, 1.0);
        assert_approx(dry.engine_efficiency_multiplier, 1.0);
        assert_approx(dry.brake_efficiency_multiplier, 1.0);
        assert_approx(dry.steer_response_multiplier, 1.0);
        assert_approx(dry.max_steer_angle_multiplier, 1.0);
        assert_approx(dry.drift_entry_slip_angle_multiplier, 1.0);
        assert_approx(dry.drift_lateral_correction_multiplier, 1.0);
        assert_approx(dry.max_speed_multiplier, 1.0);
    }

    #[test]
    fn weather_modifiers_rain_reduces_friction_and_braking() {
        let rain = WeatherModifiers::rain();
        assert!(rain.friction_slip_multiplier < 1.0);
        assert!(rain.brake_efficiency_multiplier < 1.0);
        assert!(rain.steer_response_multiplier < 1.0);
    }

    #[test]
    fn weather_modifiers_cold_has_lowest_friction() {
        let cold = WeatherModifiers::cold();
        let rain = WeatherModifiers::rain();
        assert!(cold.friction_slip_multiplier < rain.friction_slip_multiplier);
        assert!(cold.brake_efficiency_multiplier < rain.brake_efficiency_multiplier);
    }

    #[test]
    fn weather_modifiers_hot_increases_friction() {
        let hot = WeatherModifiers::hot();
        assert!(hot.friction_slip_multiplier > 1.0);
    }

    #[test]
    fn weather_modifiers_for_condition_matches_named_constructors() {
        let dry_direct = WeatherModifiers::dry();
        let dry_via = WeatherModifiers::for_condition(WeatherCondition::Dry);
        assert_approx(dry_direct.friction_slip_multiplier, dry_via.friction_slip_multiplier);
        assert_approx(dry_direct.drag_multiplier, dry_via.drag_multiplier);

        let hot_direct = WeatherModifiers::hot();
        let hot_via = WeatherModifiers::for_condition(WeatherCondition::Hot);
        assert_approx(hot_direct.friction_slip_multiplier, hot_via.friction_slip_multiplier);

        let rain_direct = WeatherModifiers::rain();
        let rain_via = WeatherModifiers::for_condition(WeatherCondition::Rain);
        assert_approx(rain_direct.friction_slip_multiplier, rain_via.friction_slip_multiplier);

        let cold_direct = WeatherModifiers::cold();
        let cold_via = WeatherModifiers::for_condition(WeatherCondition::Cold);
        assert_approx(cold_direct.friction_slip_multiplier, cold_via.friction_slip_multiplier);
    }

    #[test]
    fn weather_modifiers_default_is_all_zeros() {
        let def = WeatherModifiers::default();
        assert_approx(def.friction_slip_multiplier, 0.0);
        assert_approx(def.drag_multiplier, 0.0);
        assert_approx(def.max_speed_multiplier, 0.0);
    }

    #[test]
    fn weather_condition_default_is_dry() {
        assert_eq!(WeatherCondition::default(), WeatherCondition::Dry);
    }

    #[test]
    fn ambient_conditions_from_celsius_to_celsius_round_trip() {
        for celsius in [-20.0_f32, 0.0, 25.0, 50.0] {
            let conditions = AmbientConditions::from_celsius(celsius, 0.5);
            assert_approx(conditions.to_celsius(), celsius);
        }
    }

    #[test]
    fn ambient_conditions_boundary_minus_20_maps_to_zero() {
        let conditions = AmbientConditions::from_celsius(-20.0, 0.5);
        assert_approx(conditions.temperature, 0.0);
    }

    #[test]
    fn ambient_conditions_boundary_50_maps_to_one() {
        let conditions = AmbientConditions::from_celsius(50.0, 0.5);
        assert_approx(conditions.temperature, 1.0);
    }

    #[test]
    fn ambient_conditions_zero_celsius_normalized() {
        let conditions = AmbientConditions::from_celsius(0.0, 0.5);
        assert_approx(conditions.temperature, 20.0 / 70.0);
    }

    #[test]
    fn ambient_conditions_from_celsius_clamps_humidity() {
        let clamped_low = AmbientConditions::from_celsius(25.0, -0.5);
        assert_approx(clamped_low.humidity, 0.0);

        let clamped_high = AmbientConditions::from_celsius(25.0, 1.5);
        assert_approx(clamped_high.humidity, 1.0);
    }

    #[test]
    fn ambient_conditions_from_celsius_sets_rain_to_zero() {
        let conditions = AmbientConditions::from_celsius(25.0, 0.5);
        assert_approx(conditions.rain_intensity, 0.0);
    }

    #[test]
    fn ambient_conditions_new_sets_all_fields() {
        let conditions = AmbientConditions::new(30.0, 0.6, 0.8);
        assert_approx(conditions.to_celsius(), 30.0);
        assert_approx(conditions.humidity, 0.6);
        assert_approx(conditions.rain_intensity, 0.8);
    }

    #[test]
    fn ambient_conditions_new_clamps_humidity_and_rain() {
        let conditions = AmbientConditions::new(25.0, 2.0, -1.0);
        assert_approx(conditions.humidity, 1.0);
        assert_approx(conditions.rain_intensity, 0.0);
    }

    #[test]
    fn ambient_conditions_default_is_about_25c() {
        let def = AmbientConditions::default();
        let celsius = def.to_celsius();
        assert!((celsius - 25.0).abs() < 1.0);
        assert_approx(def.humidity, 0.3);
        assert_approx(def.rain_intensity, 0.0);
    }

    #[test]
    fn per_wheel_wear_average_uniform() {
        let wear = PerWheelWear {
            front_left: 0.5,
            front_right: 0.5,
            rear_left: 0.5,
            rear_right: 0.5,
        };
        assert_approx(wear.average(), 0.5);
    }

    #[test]
    fn per_wheel_wear_average_varied() {
        let wear = PerWheelWear {
            front_left: 0.1,
            front_right: 0.2,
            rear_left: 0.3,
            rear_right: 0.4,
        };
        assert_approx(wear.average(), 0.25);
    }

    #[test]
    fn per_wheel_wear_default_all_zeros() {
        let wear = PerWheelWear::default();
        assert_approx(wear.front_left, 0.0);
        assert_approx(wear.front_right, 0.0);
        assert_approx(wear.rear_left, 0.0);
        assert_approx(wear.rear_right, 0.0);
        assert_approx(wear.average(), 0.0);
    }

    #[test]
    fn per_wheel_wear_reset_clears_all() {
        let mut wear = PerWheelWear {
            front_left: 0.8,
            front_right: 0.7,
            rear_left: 0.6,
            rear_right: 0.5,
        };
        wear.reset();
        assert_approx(wear.front_left, 0.0);
        assert_approx(wear.front_right, 0.0);
        assert_approx(wear.rear_left, 0.0);
        assert_approx(wear.rear_right, 0.0);
    }

    #[test]
    fn per_wheel_temperature_wheel_avg_front_left() {
        let temps = PerWheelTemperature {
            front_left_inner: 0.4,
            front_left_outer: 0.6,
            ..Default::default()
        };
        assert_approx(temps.wheel_avg(0), 0.5);
    }

    #[test]
    fn per_wheel_temperature_wheel_avg_front_right() {
        let temps = PerWheelTemperature {
            front_right_inner: 0.3,
            front_right_outer: 0.7,
            ..Default::default()
        };
        assert_approx(temps.wheel_avg(1), 0.5);
    }

    #[test]
    fn per_wheel_temperature_wheel_avg_rear_left() {
        let temps = PerWheelTemperature {
            rear_left_inner: 0.2,
            rear_left_outer: 0.8,
            ..Default::default()
        };
        assert_approx(temps.wheel_avg(2), 0.5);
    }

    #[test]
    fn per_wheel_temperature_wheel_avg_rear_right() {
        let temps = PerWheelTemperature {
            rear_right_inner: 0.1,
            rear_right_outer: 0.9,
            ..Default::default()
        };
        assert_approx(temps.wheel_avg(3), 0.5);
    }

    #[test]
    fn per_wheel_temperature_wheel_avg_invalid_index_returns_half() {
        let temps = PerWheelTemperature::default();
        assert_approx(temps.wheel_avg(4), 0.5);
        assert_approx(temps.wheel_avg(99), 0.5);
    }

    #[test]
    fn per_wheel_temperature_default_all_zeros() {
        let temps = PerWheelTemperature::default();
        assert_approx(temps.front_left_inner, 0.0);
        assert_approx(temps.front_left_outer, 0.0);
        assert_approx(temps.front_right_inner, 0.0);
        assert_approx(temps.front_right_outer, 0.0);
        assert_approx(temps.rear_left_inner, 0.0);
        assert_approx(temps.rear_left_outer, 0.0);
        assert_approx(temps.rear_right_inner, 0.0);
        assert_approx(temps.rear_right_outer, 0.0);
    }

    #[test]
    fn per_wheel_temperature_to_celsius_at_zero() {
        assert_approx(PerWheelTemperature::to_celsius(0.0), 20.0);
    }

    #[test]
    fn per_wheel_temperature_to_celsius_at_one() {
        assert_approx(PerWheelTemperature::to_celsius(1.0), 150.0);
    }

    #[test]
    fn per_wheel_temperature_to_celsius_at_half() {
        assert_approx(PerWheelTemperature::to_celsius(0.5), 85.0);
    }

    #[test]
    fn semi_auto_config_default_is_balanced() {
        let def = SemiAutoConfig::default();
        assert_approx(def.target_min, 0.40);
        assert_approx(def.target_max, 0.70);
        assert_eq!(def.preset, SemiAutoPreset::Balanced);
        assert!(!def.lap_mode);
        assert!(!def.expert_mode);
    }

    #[test]
    fn semi_auto_config_for_preset_balanced() {
        let config = SemiAutoConfig::for_preset(SemiAutoPreset::Balanced);
        assert_approx(config.target_min, 0.40);
        assert_approx(config.target_max, 0.70);
        assert_eq!(config.preset, SemiAutoPreset::Balanced);
        assert!(config.target_min < config.target_max);
    }

    #[test]
    fn semi_auto_config_for_preset_aggressive() {
        let config = SemiAutoConfig::for_preset(SemiAutoPreset::Aggressive);
        assert_approx(config.target_min, 0.25);
        assert_approx(config.target_max, 0.50);
        assert_eq!(config.preset, SemiAutoPreset::Aggressive);
        assert!(config.target_min < config.target_max);
    }

    #[test]
    fn semi_auto_config_for_preset_conservative() {
        let config = SemiAutoConfig::for_preset(SemiAutoPreset::Conservative);
        assert_approx(config.target_min, 0.60);
        assert_approx(config.target_max, 0.85);
        assert_eq!(config.preset, SemiAutoPreset::Conservative);
        assert!(config.target_min < config.target_max);
    }

    #[test]
    fn semi_auto_config_aggressive_deploys_more_than_balanced() {
        let aggressive = SemiAutoConfig::for_preset(SemiAutoPreset::Aggressive);
        let balanced = SemiAutoConfig::for_preset(SemiAutoPreset::Balanced);
        assert!(aggressive.target_min < balanced.target_min);
        assert!(aggressive.target_max < balanced.target_max);
    }

    #[test]
    fn semi_auto_config_conservative_harvests_more_than_balanced() {
        let conservative = SemiAutoConfig::for_preset(SemiAutoPreset::Conservative);
        let balanced = SemiAutoConfig::for_preset(SemiAutoPreset::Balanced);
        assert!(conservative.target_min > balanced.target_min);
        assert!(conservative.target_max > balanced.target_max);
    }

    #[test]
    fn semi_auto_preset_default_is_balanced() {
        assert_eq!(SemiAutoPreset::default(), SemiAutoPreset::Balanced);
    }

    #[test]
    fn tire_config_soft_highest_grip() {
        let soft = TireConfig::for_compound(TireCompound::Soft);
        let medium = TireConfig::for_compound(TireCompound::Medium);
        let hard = TireConfig::for_compound(TireCompound::Hard);
        assert!(soft.grip_multiplier > medium.grip_multiplier);
        assert!(medium.grip_multiplier > hard.grip_multiplier);
    }

    #[test]
    fn tire_config_soft_highest_degradation() {
        let soft = TireConfig::for_compound(TireCompound::Soft);
        let medium = TireConfig::for_compound(TireCompound::Medium);
        let hard = TireConfig::for_compound(TireCompound::Hard);
        assert!(soft.degradation_rate > medium.degradation_rate);
        assert!(medium.degradation_rate > hard.degradation_rate);
    }

    #[test]
    fn tire_config_wet_best_rain_suitability() {
        let wet = TireConfig::for_compound(TireCompound::Wet);
        let inter = TireConfig::for_compound(TireCompound::Intermediate);
        let soft = TireConfig::for_compound(TireCompound::Soft);
        assert_approx(wet.rain_suitability, 1.0);
        assert!(inter.rain_suitability > soft.rain_suitability);
    }

    #[test]
    fn tire_config_soft_specific_values() {
        let soft = TireConfig::for_compound(TireCompound::Soft);
        assert_approx(soft.grip_multiplier, 1.15);
        assert_approx(soft.degradation_rate, 0.0015);
        assert_approx(soft.rain_suitability, 0.3);
        assert_approx(soft.rubber_deposit_multiplier, 1.4);
    }

    #[test]
    fn tire_config_medium_specific_values() {
        let medium = TireConfig::for_compound(TireCompound::Medium);
        assert_approx(medium.grip_multiplier, 1.0);
        assert_approx(medium.degradation_rate, 0.0008);
        assert_approx(medium.rain_suitability, 0.4);
        assert_approx(medium.rubber_deposit_multiplier, 1.0);
    }

    #[test]
    fn tire_config_hard_specific_values() {
        let hard = TireConfig::for_compound(TireCompound::Hard);
        assert_approx(hard.grip_multiplier, 0.92);
        assert_approx(hard.degradation_rate, 0.0004);
        assert_approx(hard.rubber_deposit_multiplier, 0.7);
    }

    #[test]
    fn tire_config_wet_specific_values() {
        let wet = TireConfig::for_compound(TireCompound::Wet);
        assert_approx(wet.grip_multiplier, 0.75);
        assert_approx(wet.rain_suitability, 1.0);
        assert_approx(wet.rubber_deposit_multiplier, 0.3);
    }

    #[test]
    fn tire_config_intermediate_specific_values() {
        let inter = TireConfig::for_compound(TireCompound::Intermediate);
        assert_approx(inter.grip_multiplier, 0.88);
        assert_approx(inter.rain_suitability, 0.8);
        assert_approx(inter.rubber_deposit_multiplier, 0.5);
    }

    #[test]
    fn tire_config_each_compound_has_valid_temp_range() {
        let compounds = [
            TireCompound::Soft,
            TireCompound::Medium,
            TireCompound::Hard,
            TireCompound::Wet,
            TireCompound::Intermediate,
        ];
        for compound in compounds {
            let config = TireConfig::for_compound(compound);
            assert!(config.optimal_temp_range.0 < config.optimal_temp_range.1);
            assert!(config.temp_window.min_optimal < config.temp_window.max_optimal);
            assert!(config.temp_window.cold_grip_penalty > 0.0);
            assert!(config.temp_window.cold_grip_penalty <= 1.0);
            assert!(config.temp_window.hot_grip_penalty > 0.0);
            assert!(config.temp_window.hot_grip_penalty <= 1.0);
        }
    }

    #[test]
    fn tire_config_rubber_deposit_soft_most_hard_least() {
        let soft = TireConfig::for_compound(TireCompound::Soft);
        let medium = TireConfig::for_compound(TireCompound::Medium);
        let hard = TireConfig::for_compound(TireCompound::Hard);
        assert!(soft.rubber_deposit_multiplier > medium.rubber_deposit_multiplier);
        assert!(medium.rubber_deposit_multiplier > hard.rubber_deposit_multiplier);
    }

    #[test]
    fn tire_compound_default_is_medium() {
        assert_eq!(TireCompound::default(), TireCompound::Medium);
    }

    #[test]
    fn wind_state_default_disabled_zero_speed() {
        let ws = WindState::default();
        assert_approx(ws.direction, 0.0);
        assert_approx(ws.base_speed, 0.0);
        assert_approx(ws.current_speed, 0.0);
        assert_approx(ws.gust_intensity, 0.0);
        assert_approx(ws.gust_timer, 0.0);
        assert!(!ws.enabled);
    }

    #[test]
    fn wind_modifiers_default_neutral() {
        let wm = WindModifiers::default();
        assert_approx(wm.drag_modifier, 1.0);
        assert_approx(wm.lateral_force, 0.0);
        assert_approx(wm.steering_difficulty, 1.0);
        assert_approx(wm.cooling_multiplier, 1.0);
        assert_approx(wm.headwind_component, 0.0);
        assert_approx(wm.crosswind_component, 0.0);
    }

    #[test]
    fn engine_braking_level_default_is_medium() {
        assert_eq!(EngineBrakingLevel::default(), EngineBrakingLevel::Medium);
    }

    #[test]
    fn brake_config_default_zero_bias() {
        let bc = BrakeConfig::default();
        assert_approx(bc.front_bias, 0.0);
        assert_eq!(bc.engine_braking, EngineBrakingLevel::Medium);
    }

    #[test]
    fn brake_state_default_zeros() {
        let bs = BrakeState::default();
        assert_approx(bs.front_bias, 0.0);
        assert_approx(bs.front_brake_force, 0.0);
        assert_approx(bs.rear_brake_force, 0.0);
    }

    #[test]
    fn ers_mode_default_is_balanced() {
        assert_eq!(ErsMode::default(), ErsMode::Balanced);
    }

    #[test]
    fn harvest_source_default_is_none() {
        assert_eq!(HarvestSource::default(), HarvestSource::None);
    }

    #[test]
    fn ers_state_default_zero_charge() {
        let ers = ErsState::default();
        assert_approx(ers.battery_charge, 0.0);
        assert_eq!(ers.mode, ErsMode::Balanced);
        assert_approx(ers.power_flow, 0.0);
        assert!(!ers.is_deploying);
        assert!(!ers.is_harvesting);
        assert!(!ers.super_clip_active);
        assert_eq!(ers.harvest_source, HarvestSource::None);
    }

    #[test]
    fn semi_auto_state_default_all_zero() {
        let sas = SemiAutoState::default();
        assert!(!sas.coast_recommended);
        assert_approx(sas.coast_benefit, 0.0);
        assert_approx(sas.deploy_efficiency, 0.0);
        assert!(!sas.is_critical);
        assert_approx(sas.effective_deploy_mult, 0.0);
        assert_approx(sas.effective_harvest_mult, 0.0);
    }

    #[test]
    fn aero_mode_default_is_corner() {
        assert_eq!(AeroMode::default(), AeroMode::Corner);
    }

    #[test]
    fn active_aero_state_default_zeros() {
        let aas = ActiveAeroState::default();
        assert_eq!(aas.mode, AeroMode::Corner);
        assert_approx(aas.front_wing_angle, 0.0);
        assert_approx(aas.rear_wing_angle, 0.0);
    }

    #[test]
    fn grid_cell_new_sets_rain_exposure_and_drainage() {
        let cell = GridCell::new();
        assert_approx(cell.rain_exposure, 1.0);
        assert_approx(cell.drainage_rate, 1.0);
        assert_approx(cell.temperature, 0.0);
        assert_approx(cell.wetness, 0.0);
        assert!(!cell.is_road);
    }

    #[test]
    fn grid_cell_default_zero_exposure() {
        let cell = GridCell::default();
        assert_approx(cell.rain_exposure, 0.0);
        assert_approx(cell.drainage_rate, 0.0);
        assert_approx(cell.temperature, 0.0);
    }

    #[test]
    fn track_bounds_default_symmetric_500() {
        let tb = TrackBounds::default();
        assert_approx(tb.min_x, -500.0);
        assert_approx(tb.max_x, 500.0);
        assert_approx(tb.min_z, -500.0);
        assert_approx(tb.max_z, 500.0);
    }

    #[test]
    fn tire_degradation_modifiers_default_no_penalty() {
        let tdm = TireDegradationModifiers::default();
        assert_approx(tdm.grip_multiplier, 1.0);
        assert_approx(tdm.brake_efficiency, 1.0);
        assert_approx(tdm.max_steer_multiplier, 1.0);
        assert_approx(tdm.steer_instability, 0.0);
        assert_approx(tdm.drift_entry_multiplier, 1.0);
        assert_approx(tdm.drift_exit_multiplier, 1.0);
        assert_approx(tdm.max_speed_multiplier, 1.0);
        assert_approx(tdm.lateral_correction_penalty, 1.0);
    }

    #[test]
    fn surface_type_default_is_grass() {
        assert_eq!(SurfaceType::default(), SurfaceType::Grass);
    }

    #[test]
    fn surface_modifiers_road_all_ones() {
        let road = SurfaceModifiers::road();
        assert_approx(road.grip_multiplier, 1.0);
        assert_approx(road.speed_multiplier, 1.0);
        assert_approx(road.tire_wear_multiplier, 1.0);
        assert_approx(road.drag_multiplier, 1.0);
        assert_approx(road.brake_efficiency, 1.0);
        assert_approx(road.steer_response, 1.0);
    }

    #[test]
    fn surface_modifiers_grass_reduces_grip_and_braking() {
        let grass = SurfaceModifiers::grass();
        assert!(grass.grip_multiplier < 1.0);
        assert!(grass.speed_multiplier < 1.0);
        assert!(grass.brake_efficiency < 1.0);
        assert!(grass.steer_response < 1.0);
        assert!(grass.drag_multiplier > 1.0);
    }

    #[test]
    fn surface_modifiers_curb_increases_grip() {
        let curb = SurfaceModifiers::curb();
        assert!(curb.grip_multiplier > 1.0);
    }

    #[test]
    fn surface_modifiers_default_is_road() {
        let def = SurfaceModifiers::default();
        let road = SurfaceModifiers::road();
        assert_approx(def.grip_multiplier, road.grip_multiplier);
        assert_approx(def.speed_multiplier, road.speed_multiplier);
    }

    #[test]
    fn surface_modifiers_for_surface_matches_named_constructors() {
        let road = SurfaceModifiers::for_surface(SurfaceType::Road);
        assert_approx(road.grip_multiplier, SurfaceModifiers::road().grip_multiplier);

        let grass = SurfaceModifiers::for_surface(SurfaceType::Grass);
        assert_approx(grass.grip_multiplier, SurfaceModifiers::grass().grip_multiplier);

        let curb = SurfaceModifiers::for_surface(SurfaceType::Curb);
        assert_approx(curb.grip_multiplier, SurfaceModifiers::curb().grip_multiplier);
    }

    #[test]
    fn curb_modifiers_default_values() {
        let cm = CurbModifiers::default();
        assert_approx(cm.speed_multiplier, 0.92);
        assert_approx(cm.grip_multiplier, 1.15);
        assert_approx(cm.lateral_stability, 1.1);
        assert_approx(cm.drag_multiplier, 1.5);
    }

    #[test]
    fn engine_temperature_default_warm_idle() {
        let et = EngineTemperature::default();
        assert_approx(et.temperature, 0.3);
        assert!(!et.is_overheating);
        assert_approx(et.power_multiplier, 1.0);
    }

    #[test]
    fn engine_temperature_to_celsius_default_about_50c() {
        let et = EngineTemperature::default();
        assert_approx(et.to_celsius(), 50.0);
    }

    #[test]
    fn engine_temperature_to_celsius_at_zero_is_20c() {
        let et = EngineTemperature { temperature: 0.0, is_overheating: false, power_multiplier: 1.0 };
        assert_approx(et.to_celsius(), 20.0);
    }

    #[test]
    fn engine_temperature_to_celsius_at_one_is_120c() {
        let et = EngineTemperature { temperature: 1.0, is_overheating: false, power_multiplier: 1.0 };
        assert_approx(et.to_celsius(), 120.0);
    }

    #[test]
    fn tire_temperature_window_default_medium_compound() {
        let ttw = TireTemperatureWindow::default();
        assert_approx(ttw.min_optimal, 0.45);
        assert_approx(ttw.max_optimal, 0.75);
        assert_approx(ttw.cold_grip_penalty, 0.80);
        assert_approx(ttw.hot_grip_penalty, 0.88);
    }

    #[test]
    fn aquaplaning_state_default_not_aquaplaning() {
        let aq = AquaplaningState::default();
        assert!(!aq.is_aquaplaning);
        assert_approx(aq.intensity, 0.0);
        assert_eq!(aq.affected_wheels, [false; 4]);
    }

    #[test]
    fn tire_thermal_shock_default_not_shocked() {
        let tts = TireThermalShock::default();
        assert!(!tts.is_shocked);
        assert_approx(tts.grip_penalty, 0.0);
        assert_approx(tts.recovery_time, 0.0);
    }

    #[test]
    fn per_wheel_thermal_shock_default_no_shock() {
        let pwts = PerWheelThermalShock::default();
        assert!(!pwts.any_shocked());
        assert_approx(pwts.max_grip_penalty(), 0.0);
    }

    #[test]
    fn per_wheel_thermal_shock_max_grip_penalty_single_wheel() {
        let mut pwts = PerWheelThermalShock::default();
        pwts.rear_left.grip_penalty = 0.7;
        assert_approx(pwts.max_grip_penalty(), 0.7);
    }

    #[test]
    fn per_wheel_thermal_shock_max_grip_penalty_multiple_wheels() {
        let pwts = PerWheelThermalShock {
            front_left: TireThermalShock { is_shocked: true, grip_penalty: 0.3, recovery_time: 1.0 },
            front_right: TireThermalShock { is_shocked: true, grip_penalty: 0.5, recovery_time: 1.0 },
            rear_left: TireThermalShock { is_shocked: true, grip_penalty: 0.8, recovery_time: 1.0 },
            rear_right: TireThermalShock { is_shocked: false, grip_penalty: 0.1, recovery_time: 0.0 },
        };
        assert_approx(pwts.max_grip_penalty(), 0.8);
    }

    #[test]
    fn per_wheel_thermal_shock_any_shocked_single() {
        let mut pwts = PerWheelThermalShock::default();
        pwts.front_right.is_shocked = true;
        assert!(pwts.any_shocked());
    }

    #[test]
    fn per_wheel_thermal_shock_any_shocked_none() {
        let pwts = PerWheelThermalShock::default();
        assert!(!pwts.any_shocked());
    }

    #[test]
    fn car_input_default_all_false() {
        let ci = CarInput::default();
        assert!(!ci.forward);
        assert!(!ci.backward);
        assert!(!ci.left);
        assert!(!ci.right);
        assert!(!ci.brake);
        assert!(!ci.handbrake);
    }

    #[test]
    fn car_physics_output_default_zeros() {
        let cpo = CarPhysicsOutput::default();
        assert_approx(cpo.speed_kmh, 0.0);
        assert_eq!(cpo.gear, 0);
        assert_approx(cpo.slip_angle, 0.0);
        assert!(!cpo.is_drifting);
        assert_approx(cpo.effective_grip, 0.0);
        assert_approx(cpo.lateral_g, 0.0);
        assert_approx(cpo.longitudinal_g, 0.0);
    }
}
