use crate::car_physics::weight_transfer::WeightTransferResult;
use crate::types::{
    AmbientConditions, PerWheelTemperature, PerWheelThermalShock, PerWheelWear, TireCompound,
    TireConfig, TireDegradationModifiers, TireTemperatureWindow, TireThermalShock,
};

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
    pub ambient: AmbientConditions,
    pub track_temperature: f32,  // 0.0 to 1.0 normalized
    pub weight_transfer: WeightTransferResult,
    pub lateral_g: f32,          // Lateral G-force (cornering force)
    pub longitudinal_g: f32,     // Longitudinal G-force (accel/brake)
    pub tire_temperatures: [f32; 4], // Per-wheel tire temperature (0.0 to 1.0)
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

    /// Set wear for all wheels (for debug/testing)
    pub fn set_wear_all(&mut self, wear: f32) {
        let clamped = wear.clamp(0.0, 1.0);
        self.wheels = [clamped; 4];
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

        // Weather compatibility penalty (based on ambient conditions)
        let weather_penalty = if self.is_optimal_conditions(&input.ambient) {
            1.0
        } else {
            1.5
        };

        // Track temperature effect (0.5 = neutral)
        // Range: 0.8 (cold) to 1.2 (hot)
        let track_temp_factor = 0.8 + input.track_temperature * 0.4;

        // =====================================================================
        // Lateral G-force effect (cornering wear)
        // Higher lateral G = more tire scrubbing = more wear
        // Effect: 1.0 at 0G, up to 2.5x at 2G+ cornering
        // =====================================================================
        let lateral_g_factor = 1.0 + (input.lateral_g.abs() / 2.0).min(1.0) * 1.5;

        // =====================================================================
        // Longitudinal G-force effect (accel/brake wear)
        // Hard braking/acceleration increases wear
        // Effect: 1.0 at 0G, up to 1.8x at 1.5G+
        // =====================================================================
        let longitudinal_g_factor = 1.0 + (input.longitudinal_g.abs() / 1.5).min(1.0) * 0.8;

        // Common multiplier for all wheels (before per-wheel temperature)
        let common_factor = base_rate
            * speed_factor
            * weather_penalty
            * track_temp_factor
            * lateral_g_factor
            * longitudinal_g_factor;

        // Steering effects
        let steer_abs = input.steer_angle.abs();
        let is_turning_left = input.steer_angle < -0.02;
        let is_turning_right = input.steer_angle > 0.02;

        // Front wheels wear more when steering (up to 3x at max steer ~0.5 rad)
        let front_steer_mult = 1.0 + (steer_abs / 0.5).min(1.0) * 2.0;

        // Outer wheel bias during cornering - enhanced by lateral G
        // Up to 80% extra wear on outer wheel at high G
        let base_outer_bias = (steer_abs / 0.5).min(1.0) * 0.5;
        let g_outer_bias = (input.lateral_g.abs() / 1.5).min(1.0) * 0.3;
        let outer_bias = base_outer_bias + g_outer_bias;

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

        // =====================================================================
        // Per-wheel tire temperature effect
        // Hot tires (above optimal window ~0.5) degrade faster
        // Cold tires have slightly less wear but poor grip
        // Temperature scale: 0.0 = cold, 0.5 = optimal, 1.0 = overheating
        // Effect: 0.9x at cold, 1.0x at optimal, up to 2.0x when overheating
        // =====================================================================
        let tire_temp_mults: [f32; 4] = [
            Self::calculate_tire_temp_wear_mult(input.tire_temperatures[FL]),
            Self::calculate_tire_temp_wear_mult(input.tire_temperatures[FR]),
            Self::calculate_tire_temp_wear_mult(input.tire_temperatures[RL]),
            Self::calculate_tire_temp_wear_mult(input.tire_temperatures[RR]),
        ];

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
            * brake_front_mult
            * tire_temp_mults[FL];

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
            * brake_front_mult
            * tire_temp_mults[FR];

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
            * throttle_rear_mult
            * tire_temp_mults[RL];

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
            * throttle_rear_mult
            * tire_temp_mults[RR];

        // Apply wear (clamped to 0.0-1.0)
        self.wheels[FL] = (self.wheels[FL] + fl_rate * input.delta_seconds).min(1.0);
        self.wheels[FR] = (self.wheels[FR] + fr_rate * input.delta_seconds).min(1.0);
        self.wheels[RL] = (self.wheels[RL] + rl_rate * input.delta_seconds).min(1.0);
        self.wheels[RR] = (self.wheels[RR] + rr_rate * input.delta_seconds).min(1.0);
    }

    /// Calculate wear multiplier based on tire temperature
    /// Cold tires: 0.9x wear (but poor grip)
    /// Optimal window (0.35-0.55): 1.0x wear
    /// Hot tires: up to 2.0x wear when overheating
    fn calculate_tire_temp_wear_mult(temp: f32) -> f32 {
        const OPTIMAL_MIN: f32 = 0.35;
        const OPTIMAL_MAX: f32 = 0.55;
        const OVERHEAT_THRESHOLD: f32 = 0.75;

        if temp < OPTIMAL_MIN {
            // Cold tire: slightly less wear
            0.9 + (temp / OPTIMAL_MIN) * 0.1
        } else if temp <= OPTIMAL_MAX {
            // Optimal window: normal wear
            1.0
        } else if temp < OVERHEAT_THRESHOLD {
            // Getting hot: gradual increase
            let t = (temp - OPTIMAL_MAX) / (OVERHEAT_THRESHOLD - OPTIMAL_MAX);
            1.0 + t * 0.3
        } else {
            // Overheating: rapid degradation
            let t = ((temp - OVERHEAT_THRESHOLD) / (1.0 - OVERHEAT_THRESHOLD)).min(1.0);
            1.3 + t * 0.7 // 1.3x to 2.0x
        }
    }

    /// Check if current ambient conditions are optimal for this tire compound
    pub fn is_optimal_conditions(&self, ambient: &AmbientConditions) -> bool {
        let celsius = ambient.to_celsius();
        let rain = ambient.rain_intensity;
        let (min_temp, max_temp) = self.config.optimal_temp_range;

        // Temperature check
        let temp_ok = celsius >= min_temp && celsius <= max_temp;

        // Rain check: if rain > 0.3, tire needs good rain suitability
        let rain_ok = if rain > 0.3 {
            self.config.rain_suitability >= 0.7
        } else {
            true
        };

        temp_ok && rain_ok
    }

    /// Calculate effective grip considering compound, ambient conditions, and average wear
    pub fn calculate_effective_grip_from_ambient(&self, ambient: &AmbientConditions) -> f32 {
        let base_grip = self.config.grip_multiplier;

        // Weather compatibility factor
        let conditions_factor = if self.is_optimal_conditions(ambient) {
            1.0
        } else {
            self.config.wrong_conditions_penalty
        };

        // Use progressive "cliff" formula for grip degradation
        let avg_wear = self.get_wear();
        let wear_factor = Self::calculate_progressive_degradation(avg_wear, 0.30);

        base_grip * conditions_factor * wear_factor
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

    /// Calculate all degradation modifiers based on current tire wear and ambient conditions
    pub fn calculate_degradation_modifiers_from_ambient(&self, ambient: &AmbientConditions) -> TireDegradationModifiers {
        let avg_wear = self.get_wear();

        // Calculate grip with ambient conditions factored in
        let base_grip = self.config.grip_multiplier;
        let conditions_factor = if self.is_optimal_conditions(ambient) {
            1.0
        } else {
            self.config.wrong_conditions_penalty
        };
        let grip_wear_factor = Self::calculate_progressive_degradation(avg_wear, 0.30);

        TireDegradationModifiers {
            grip_multiplier: base_grip * conditions_factor * grip_wear_factor,
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
            // Gentle quadratic curve for max speed (not using the cliff formula)
            // At 0% wear: 1.0, at 50% wear: 0.96, at 100% wear: 0.84
            max_speed_multiplier: 1.0 - avg_wear * avg_wear * 0.16,
            lateral_correction_penalty: Self::calculate_progressive_degradation(avg_wear, 0.70),
        }
    }

    /// Get the base grip multiplier for the compound
    pub fn get_grip_multiplier(&self) -> f32 {
        self.config.grip_multiplier
    }

    /// Get temperature window for current compound
    pub fn get_temp_window(&self) -> TireTemperatureWindow {
        self.config.temp_window
    }

    /// Get rubber deposit multiplier for current compound
    /// Soft tires leave more rubber marks, hard tires leave less
    pub fn get_rubber_deposit_multiplier(&self) -> f32 {
        self.config.rubber_deposit_multiplier
    }
}

// ============================================================================
// Tire Temperature System
// ============================================================================

// Temperature constants (normalized scale: 0.0 = 20C, 1.0 = 150C)
const TIRE_AMBIENT_TEMP: f32 = 0.15; // Cold tire starting temp (~40C)
const TIRE_HEAT_RATE_FRICTION: f32 = 0.10; // Heat from road friction (driving)
const TIRE_HEAT_RATE_BRAKING: f32 = 0.18; // Heat from heavy braking (front)
const TIRE_HEAT_RATE_BRAKING_REAR: f32 = 0.08; // Heat from braking (rear)
const TIRE_HEAT_RATE_CORNERING: f32 = 0.12; // Heat from lateral load
const TIRE_HEAT_RATE_SPINNING: f32 = 0.25; // Heat from wheelspin/drift
const TIRE_COOLING_RATE_AIRFLOW: f32 = 0.06; // Cooling from airflow
const TIRE_COOLING_RATE_AMBIENT: f32 = 0.04; // Passive cooling to ambient
const TRACK_TEMP_TRANSFER_RATE: f32 = 0.05; // Heat transfer from track surface (legacy)

// Puddle cooling and thermal shock constants
const PUDDLE_COOLING_RATE: f32 = 0.4; // Temp drop per second in deep water
const PUDDLE_COOLING_THRESHOLD: f32 = 0.5; // Min water depth to trigger cooling
const PUDDLE_MIN_SPEED: f32 = 5.0; // Min speed for puddle cooling effect
const THERMAL_SHOCK_TEMP_DIFF: f32 = 0.15; // Temp drop to trigger shock
const THERMAL_SHOCK_HOT_THRESHOLD: f32 = 0.5; // Tire must be hot for shock
const THERMAL_SHOCK_GRIP_PENALTY: f32 = 0.3; // Max 30% grip loss
const THERMAL_SHOCK_DURATION: f32 = 3.0; // Seconds of shock effect
const THERMAL_SHOCK_RECOVERY_RATE: f32 = 0.15; // Grip recovery per second

/// Input parameters for tire temperature calculation
#[derive(Debug, Clone, Copy, Default)]
pub struct TempInput {
    pub delta_seconds: f32,
    pub speed_ms: f32,
    pub steer_angle: f32,
    pub is_braking: bool,
    pub is_throttle: bool,
    pub is_drifting: bool,
    pub lateral_g: f32,
    pub longitudinal_g: f32,
    pub weight_transfer: WeightTransferResult,
    pub ambient: AmbientConditions,
    pub track_temperature: f32, // 0.0-1.0 from track temperature grid
    pub wind_cooling_multiplier: f32, // Wind cooling boost (1.0 = no wind, 2.0 = max wind)
}

/// Per-wheel tire temperature tracking (inner/outer edges)
#[derive(Debug)]
pub struct TireTemperatureState {
    temps: [[f32; 2]; 4], // [wheel][inner/outer]
    thermal_shock: [TireThermalShock; 4], // Per-wheel thermal shock state
}

impl Default for TireTemperatureState {
    fn default() -> Self {
        Self {
            temps: [[TIRE_AMBIENT_TEMP; 2]; 4],
            thermal_shock: [TireThermalShock::default(); 4],
        }
    }
}

impl TireTemperatureState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn reset(&mut self) {
        self.temps = [[TIRE_AMBIENT_TEMP; 2]; 4];
        self.thermal_shock = [TireThermalShock::default(); 4];
    }

    /// Update tire temperatures based on driving conditions
    pub fn update(&mut self, input: &TempInput) {
        let dt = input.delta_seconds.min(0.05);

        // If stationary, just cool towards ambient
        if input.speed_ms < 0.5 {
            let ambient_target = input.ambient.temperature * 0.4; // Map ambient to tire scale
            for wheel in 0..4 {
                for edge in 0..2 {
                    let diff = ambient_target - self.temps[wheel][edge];
                    self.temps[wheel][edge] += diff * TIRE_COOLING_RATE_AMBIENT * dt * 2.0;
                }
            }
            return;
        }

        // Base heat from driving (friction with road)
        let speed_factor = (input.speed_ms / 30.0).min(1.5);
        let base_heat = TIRE_HEAT_RATE_FRICTION * speed_factor;

        // Braking heat (more on front)
        let brake_heat_front = if input.is_braking {
            TIRE_HEAT_RATE_BRAKING
        } else {
            0.0
        };
        let brake_heat_rear = if input.is_braking {
            TIRE_HEAT_RATE_BRAKING_REAR
        } else {
            0.0
        };

        // Cornering heat (outer edge gets more)
        let lateral_load = input.lateral_g.abs();
        let cornering_heat = TIRE_HEAT_RATE_CORNERING * lateral_load.min(1.5);

        // Which side is outer (loaded) during turn
        let turning_left = input.steer_angle < -0.02;
        let turning_right = input.steer_angle > 0.02;

        // Drift/wheelspin heat (rear tires)
        let drift_heat = if input.is_drifting {
            TIRE_HEAT_RATE_SPINNING
        } else if input.is_throttle && input.speed_ms < 10.0 {
            // Wheelspin at low speed
            TIRE_HEAT_RATE_SPINNING * 0.5
        } else {
            0.0
        };

        // Cooling from airflow (enhanced by wind)
        let base_airflow = TIRE_COOLING_RATE_AIRFLOW * (input.speed_ms / 40.0).min(1.0);
        let wind_factor = if input.wind_cooling_multiplier > 0.0 {
            input.wind_cooling_multiplier
        } else {
            1.0
        };
        let airflow_cooling = base_airflow * wind_factor;

        // Ambient cooling target
        let ambient_target = input.ambient.temperature * 0.4;

        // Track temperature contribution (heat transfer from hot track)
        let track_heat = if input.track_temperature > 0.3 {
            TRACK_TEMP_TRANSFER_RATE * (input.track_temperature - 0.3) * speed_factor
        } else {
            0.0
        };

        // Update each wheel
        for wheel in 0..4 {
            let is_front = wheel < 2;
            let is_left = wheel == 0 || wheel == 2;

            // Weight transfer affects heat generation
            let load_mult = self.get_load_multiplier(wheel, &input.weight_transfer);

            for edge in 0..2 {
                let is_inner = edge == 0;

                // Calculate heat generation for this tire edge
                let mut heat = base_heat;

                // Braking heat
                heat += if is_front {
                    brake_heat_front
                } else {
                    brake_heat_rear
                };

                // Cornering heat distribution (outer edge gets more)
                let outer_bonus = if turning_left && !is_left {
                    // Turning left, right side is outer
                    if is_inner {
                        0.6
                    } else {
                        1.4
                    }
                } else if turning_right && is_left {
                    // Turning right, left side is outer
                    if is_inner {
                        0.6
                    } else {
                        1.4
                    }
                } else {
                    1.0
                };
                heat += cornering_heat * outer_bonus;

                // Drift heat on rear
                if !is_front {
                    heat += drift_heat;
                }

                // Track heat
                heat += track_heat;

                // Apply load multiplier
                heat *= load_mult;

                // Cooling
                let cooling = airflow_cooling + TIRE_COOLING_RATE_AMBIENT;

                // Ambient pull
                let ambient_pull = (ambient_target - self.temps[wheel][edge]) * 0.02;

                // Net change
                let net = (heat - cooling) * dt + ambient_pull * dt;
                self.temps[wheel][edge] = (self.temps[wheel][edge] + net).clamp(0.0, 1.0);
            }
        }
    }

    fn get_load_multiplier(&self, wheel: usize, wt: &WeightTransferResult) -> f32 {
        let base = 1471.5; // Base load per wheel
        let load_change = match wheel {
            0 => wt.front_load_change + wt.left_load_change,
            1 => wt.front_load_change + wt.right_load_change,
            2 => wt.rear_load_change + wt.left_load_change,
            3 => wt.rear_load_change + wt.right_load_change,
            _ => 0.0,
        };
        (1.0 + load_change / base * 0.3).max(0.5)
    }

    /// Get temperature data for all wheels
    pub fn get_temperatures(&self) -> PerWheelTemperature {
        PerWheelTemperature {
            front_left_inner: self.temps[FL][0],
            front_left_outer: self.temps[FL][1],
            front_right_inner: self.temps[FR][0],
            front_right_outer: self.temps[FR][1],
            rear_left_inner: self.temps[RL][0],
            rear_left_outer: self.temps[RL][1],
            rear_right_inner: self.temps[RR][0],
            rear_right_outer: self.temps[RR][1],
        }
    }

    /// Calculate grip multiplier based on temperature vs optimal window
    pub fn calculate_temp_grip(&self, window: &TireTemperatureWindow) -> [f32; 4] {
        let mut grips = [1.0; 4];

        for wheel in 0..4 {
            let avg_temp = (self.temps[wheel][0] + self.temps[wheel][1]) / 2.0;

            grips[wheel] = if avg_temp < window.min_optimal {
                // Cold - linear penalty towards cold_grip_penalty
                let cold_factor = avg_temp / window.min_optimal;
                window.cold_grip_penalty + (1.0 - window.cold_grip_penalty) * cold_factor
            } else if avg_temp > window.max_optimal {
                // Hot - linear penalty towards hot_grip_penalty
                let hot_excess = (avg_temp - window.max_optimal) / (1.0 - window.max_optimal);
                1.0 - (1.0 - window.hot_grip_penalty) * hot_excess.min(1.0)
            } else {
                // In optimal window - full grip
                1.0
            };
        }

        grips
    }

    /// Check if each wheel is in optimal temperature window
    pub fn check_in_window(&self, window: &TireTemperatureWindow) -> [bool; 4] {
        let mut in_window = [false; 4];
        for wheel in 0..4 {
            let avg_temp = (self.temps[wheel][0] + self.temps[wheel][1]) / 2.0;
            in_window[wheel] = avg_temp >= window.min_optimal && avg_temp <= window.max_optimal;
        }
        in_window
    }

    /// Get average grip across all wheels
    pub fn get_average_temp_grip(&self, window: &TireTemperatureWindow) -> f32 {
        let grips = self.calculate_temp_grip(window);
        (grips[0] + grips[1] + grips[2] + grips[3]) / 4.0
    }

    /// Get average temperature across all wheels
    pub fn get_average_temperature(&self) -> f32 {
        let mut total = 0.0;
        for wheel in 0..4 {
            total += (self.temps[wheel][0] + self.temps[wheel][1]) / 2.0;
        }
        total / 4.0
    }

    /// Apply external heat change (from track-tire heat exchange)
    /// heat_delta: positive = tire gains heat, negative = tire loses heat
    pub fn apply_external_heat(&mut self, heat_delta: f32) {
        for wheel in 0..4 {
            for edge in 0..2 {
                self.temps[wheel][edge] = (self.temps[wheel][edge] + heat_delta).clamp(0.0, 1.0);
            }
        }
    }

    /// Apply puddle cooling effect when driving through standing water
    /// Returns true if any thermal shock was triggered
    pub fn apply_puddle_cooling(&mut self, water_depth: f32, speed_ms: f32, delta_seconds: f32) -> bool {
        // Check thresholds
        if water_depth < PUDDLE_COOLING_THRESHOLD || speed_ms < PUDDLE_MIN_SPEED {
            return false;
        }

        let dt = delta_seconds.min(0.05);

        // Cooling intensity based on water depth and speed
        let water_factor = (water_depth - PUDDLE_COOLING_THRESHOLD)
            / (1.0 - PUDDLE_COOLING_THRESHOLD);
        let speed_factor = (speed_ms / 30.0).min(1.5);
        let cooling = PUDDLE_COOLING_RATE * water_factor * speed_factor * dt;

        let mut any_shock_triggered = false;

        for wheel in 0..4 {
            // Record pre-cooling temperature
            let pre_cool_temp = (self.temps[wheel][0] + self.temps[wheel][1]) / 2.0;

            // Apply cooling to both edges
            for edge in 0..2 {
                self.temps[wheel][edge] = (self.temps[wheel][edge] - cooling).max(0.05);
            }

            let post_cool_temp = (self.temps[wheel][0] + self.temps[wheel][1]) / 2.0;
            let temp_drop = pre_cool_temp - post_cool_temp;

            // Check for thermal shock (hot tire + significant temp drop)
            if temp_drop > THERMAL_SHOCK_TEMP_DIFF && pre_cool_temp > THERMAL_SHOCK_HOT_THRESHOLD {
                // Calculate shock severity based on temp drop and how hot the tire was
                let shock_severity = ((temp_drop / THERMAL_SHOCK_TEMP_DIFF)
                    * (pre_cool_temp / THERMAL_SHOCK_HOT_THRESHOLD))
                    .min(1.0);

                self.thermal_shock[wheel] = TireThermalShock {
                    is_shocked: true,
                    grip_penalty: shock_severity * THERMAL_SHOCK_GRIP_PENALTY,
                    recovery_time: THERMAL_SHOCK_DURATION,
                };
                any_shock_triggered = true;
            }
        }

        any_shock_triggered
    }

    /// Update thermal shock state (call every frame)
    pub fn update_thermal_shock(&mut self, delta_seconds: f32) {
        let dt = delta_seconds.min(0.05);

        for wheel in 0..4 {
            if self.thermal_shock[wheel].is_shocked {
                self.thermal_shock[wheel].recovery_time -= dt;

                if self.thermal_shock[wheel].recovery_time <= 0.0 {
                    // Shock fully recovered
                    self.thermal_shock[wheel] = TireThermalShock::default();
                } else {
                    // Gradual grip recovery
                    self.thermal_shock[wheel].grip_penalty =
                        (self.thermal_shock[wheel].grip_penalty
                            - THERMAL_SHOCK_RECOVERY_RATE * dt)
                            .max(0.0);
                }
            }
        }
    }

    /// Get the worst grip penalty across all wheels from thermal shock
    pub fn get_thermal_shock_penalty(&self) -> f32 {
        self.thermal_shock
            .iter()
            .map(|s| s.grip_penalty)
            .fold(0.0, f32::max)
    }

    /// Get combined thermal shock state for output
    pub fn get_thermal_shock_state(&self) -> TireThermalShock {
        let max_penalty = self.get_thermal_shock_penalty();
        let any_shocked = self.thermal_shock.iter().any(|s| s.is_shocked);

        TireThermalShock {
            is_shocked: any_shocked,
            grip_penalty: max_penalty,
            recovery_time: self.thermal_shock
                .iter()
                .map(|s| s.recovery_time)
                .fold(0.0, f32::max),
        }
    }

    /// Get per-wheel thermal shock data
    pub fn get_per_wheel_thermal_shock(&self) -> PerWheelThermalShock {
        PerWheelThermalShock {
            front_left: self.thermal_shock[FL],
            front_right: self.thermal_shock[FR],
            rear_left: self.thermal_shock[RL],
            rear_right: self.thermal_shock[RR],
        }
    }

    /// Check if any wheel is in thermal shock
    pub fn is_in_thermal_shock(&self) -> bool {
        self.thermal_shock.iter().any(|s| s.is_shocked)
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
            ambient: AmbientConditions::from_celsius(25.0, 0.3),
            track_temperature: 0.5,
            weight_transfer: WeightTransferResult::default(),
            lateral_g: 0.0,
            longitudinal_g: 0.0,
            tire_temperatures: [0.45; 4], // Optimal temp
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
            ambient: AmbientConditions::from_celsius(25.0, 0.3),
            track_temperature: 0.5,
            weight_transfer: WeightTransferResult::default(),
            lateral_g: 0.0,
            longitudinal_g: 0.0,
            tire_temperatures: [0.45; 4],
        };

        let turning_input = WearInput {
            steer_angle: 0.3, // Moderate turn
            lateral_g: 0.8,   // Cornering generates lateral G
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
            ambient: AmbientConditions::from_celsius(25.0, 0.3),
            track_temperature: 0.5,
            weight_transfer: WeightTransferResult::default(),
            lateral_g: 1.0, // Right turn generates positive lateral G
            longitudinal_g: 0.0,
            tire_temperatures: [0.45; 4],
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
            ambient: AmbientConditions::from_celsius(25.0, 0.3),
            track_temperature: 0.5,
            weight_transfer: WeightTransferResult::default(),
            lateral_g: 0.5, // Some lateral G during drift
            longitudinal_g: 0.0,
            tire_temperatures: [0.45; 4],
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
            ambient: AmbientConditions::from_celsius(25.0, 0.3),
            track_temperature: 0.5,
            weight_transfer: WeightTransferResult::default(),
            lateral_g: 0.0,
            longitudinal_g: -0.8, // Negative G from braking
            tire_temperatures: [0.45; 4],
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
            ambient: AmbientConditions::from_celsius(25.0, 0.3),
            track_temperature: 0.5,
            weight_transfer: WeightTransferResult::default(),
            lateral_g: 0.0,
            longitudinal_g: 0.0,
            tire_temperatures: [0.45; 4],
        };

        let rain_input = WearInput {
            ambient: AmbientConditions::new(15.0, 0.9, 0.8), // Rain conditions
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
    fn test_effective_grip_optimal_conditions() {
        let state = TireState::new(); // Medium
        let ambient = AmbientConditions::from_celsius(25.0, 0.3); // Optimal for medium tires
        let grip = state.calculate_effective_grip_from_ambient(&ambient);
        assert!((grip - 1.0).abs() < 0.01); // Medium = 1.0 grip, no penalties
    }

    #[test]
    fn test_effective_grip_wrong_conditions() {
        let mut state = TireState::new();
        state.set_compound(TireCompound::Soft); // Optimal for warm/dry

        let dry_ambient = AmbientConditions::from_celsius(25.0, 0.3);
        let rain_ambient = AmbientConditions::new(15.0, 0.9, 0.8); // Heavy rain

        let dry_grip = state.calculate_effective_grip_from_ambient(&dry_ambient);
        let rain_grip = state.calculate_effective_grip_from_ambient(&rain_ambient);

        // Rain should apply wrong conditions penalty (0.25 for soft)
        assert!(rain_grip < dry_grip * 0.3);
    }

    #[test]
    fn test_wear_grip_degradation() {
        let mut state = TireState::new();
        let ambient = AmbientConditions::from_celsius(25.0, 0.3);

        let fresh_grip = state.calculate_effective_grip_from_ambient(&ambient);

        // Manually set high wear on all wheels
        state.wheels = [1.0, 1.0, 1.0, 1.0];

        let worn_grip = state.calculate_effective_grip_from_ambient(&ambient);

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
        let ambient = AmbientConditions::from_celsius(25.0, 0.3);

        // Fresh tires - all modifiers should be near 1.0
        let fresh = state.calculate_degradation_modifiers_from_ambient(&ambient);
        assert!((fresh.brake_efficiency - 1.0).abs() < 0.01);
        assert!((fresh.max_steer_multiplier - 1.0).abs() < 0.01);
        assert!((fresh.steer_instability - 0.0).abs() < 0.01);

        // Worn tires - modifiers should be degraded
        state.wheels = [1.0, 1.0, 1.0, 1.0];
        let worn = state.calculate_degradation_modifiers_from_ambient(&ambient);
        assert!(worn.brake_efficiency < 0.5);
        assert!(worn.max_steer_multiplier < 0.8);
        assert!(worn.steer_instability > 0.1);
        assert!(worn.drift_entry_multiplier < 0.6);
    }

    #[test]
    fn test_high_lateral_g_increases_wear() {
        let mut state1 = TireState::new();
        let mut state2 = TireState::new();

        let base_input = WearInput {
            delta_seconds: 1.0,
            speed_ms: 30.0,
            steer_angle: 0.3,
            is_braking: false,
            is_throttle: false,
            is_drifting: false,
            is_handbrake: false,
            ambient: AmbientConditions::from_celsius(25.0, 0.3),
            track_temperature: 0.5,
            weight_transfer: WeightTransferResult::default(),
            lateral_g: 0.0,
            longitudinal_g: 0.0,
            tire_temperatures: [0.45; 4],
        };

        let high_g_input = WearInput {
            lateral_g: 1.5, // High cornering G
            ..base_input
        };

        for _ in 0..30 {
            state1.update_wear_per_wheel(&base_input);
            state2.update_wear_per_wheel(&high_g_input);
        }

        // High lateral G should cause significantly more wear
        assert!(state2.get_wear() > state1.get_wear() * 1.5);
    }

    #[test]
    fn test_hot_tires_wear_faster() {
        let mut state1 = TireState::new();
        let mut state2 = TireState::new();

        let optimal_temp_input = WearInput {
            delta_seconds: 1.0,
            speed_ms: 30.0,
            steer_angle: 0.0,
            is_braking: false,
            is_throttle: false,
            is_drifting: false,
            is_handbrake: false,
            ambient: AmbientConditions::from_celsius(25.0, 0.3),
            track_temperature: 0.5,
            weight_transfer: WeightTransferResult::default(),
            lateral_g: 0.0,
            longitudinal_g: 0.0,
            tire_temperatures: [0.45; 4], // Optimal temperature
        };

        let overheated_input = WearInput {
            tire_temperatures: [0.9; 4], // Overheating
            ..optimal_temp_input
        };

        for _ in 0..30 {
            state1.update_wear_per_wheel(&optimal_temp_input);
            state2.update_wear_per_wheel(&overheated_input);
        }

        // Overheated tires should wear significantly faster (up to 2x)
        assert!(state2.get_wear() > state1.get_wear() * 1.5);
    }

    #[test]
    fn test_tire_temp_wear_multiplier() {
        // Cold tire: slightly less wear
        let cold_mult = TireState::calculate_tire_temp_wear_mult(0.2);
        assert!(cold_mult < 1.0);
        assert!(cold_mult > 0.85);

        // Optimal temp: normal wear
        let optimal_mult = TireState::calculate_tire_temp_wear_mult(0.45);
        assert!((optimal_mult - 1.0).abs() < 0.01);

        // Hot tire: more wear
        let hot_mult = TireState::calculate_tire_temp_wear_mult(0.7);
        assert!(hot_mult > 1.0);
        assert!(hot_mult < 1.4);

        // Overheating: rapid degradation
        let overheat_mult = TireState::calculate_tire_temp_wear_mult(0.95);
        assert!(overheat_mult > 1.5);
        assert!(overheat_mult <= 2.0);
    }

    #[test]
    fn test_longitudinal_g_increases_wear() {
        let mut state1 = TireState::new();
        let mut state2 = TireState::new();

        let base_input = WearInput {
            delta_seconds: 1.0,
            speed_ms: 30.0,
            steer_angle: 0.0,
            is_braking: false,
            is_throttle: false,
            is_drifting: false,
            is_handbrake: false,
            ambient: AmbientConditions::from_celsius(25.0, 0.3),
            track_temperature: 0.5,
            weight_transfer: WeightTransferResult::default(),
            lateral_g: 0.0,
            longitudinal_g: 0.0,
            tire_temperatures: [0.45; 4],
        };

        let hard_accel_input = WearInput {
            longitudinal_g: 1.2, // Hard acceleration
            is_throttle: true,
            ..base_input
        };

        for _ in 0..30 {
            state1.update_wear_per_wheel(&base_input);
            state2.update_wear_per_wheel(&hard_accel_input);
        }

        // Hard acceleration should cause more wear
        assert!(state2.get_wear() > state1.get_wear() * 1.3);
    }
}
