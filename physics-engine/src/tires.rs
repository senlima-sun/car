use crate::car_physics::weight_transfer::WeightTransferResult;
use crate::types::{
    AmbientConditions, PerWheelTemperature, PerWheelThermalShock, PerWheelWear, TireCompound,
    TireConfig, TireDegradationModifiers, TireMaterialOutput, TireMaterialProperties,
    TireMaterialState, TireTemperatureWindow, TireThermalShock,
};

/// Wheel position indices
pub const FL: usize = 0; // Front Left
pub const FR: usize = 1; // Front Right
pub const RL: usize = 2; // Rear Left
pub const RR: usize = 3; // Rear Right

#[inline]
pub const fn is_front_wheel(wheel: usize) -> bool {
    wheel < 2
}

/// Input parameters for per-wheel wear calculation
#[derive(Debug, Clone, Copy, Default)]
pub struct WearInput {
    pub delta_seconds: f32,
    pub speed_ms: f32,
    pub steer_angle: f32, // Radians, negative = left, positive = right
    pub is_braking: bool,
    pub is_throttle: bool,
    pub is_drifting: bool,
    pub is_handbrake: bool,
    pub ambient: AmbientConditions,
    pub track_temperature: f32, // 0.0 to 1.0 normalized
    pub weight_transfer: WeightTransferResult,
    pub lateral_g: f32,               // Lateral G-force (cornering force)
    pub longitudinal_g: f32,          // Longitudinal G-force (accel/brake)
    pub tire_temperatures: [f32; 4],  // Per-wheel tire temperature (0.0 to 1.0)
    pub slip_angle: f32,              // degrees, from CarPhysicsOutput
    pub surface_wear_multiplier: f32, // from SurfaceState.get_tire_wear_modifier()
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

    /// Cached tire config for the current compound. Avoids
    /// `TireConfig::for_compound(...)` rebuilds on the per-frame hot path.
    pub fn get_config(&self) -> &TireConfig {
        &self.config
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
    ///
    /// Uses a hybrid additive-multiplicative model:
    /// wear = base_rate × combined_intensity × env_modifiers × per_wheel_mults × dt
    ///
    /// combined_intensity is an additive sum of wear sources (prevents multiplicative explosion):
    /// - Cornering: 0.2 + G×0.25 + G²×0.45 (primary F1 wear source; 0.2 baseline = straights nearly free)
    /// - Longitudinal: G² × 0.3 (braking/accel; zero when coasting)
    /// - Excess slip: ((slip-9°)/15)×0.8 when slip>9° (tire-saving mechanic)
    /// - Drift/handbrake: +1.5 when active (additive penalty)
    pub fn update_wear_per_wheel(&mut self, input: &WearInput) {
        if input.speed_ms < 0.5 {
            return;
        }

        let base_rate = self.config.degradation_rate;

        let lat_g = input.lateral_g.abs();
        let lon_g = input.longitudinal_g.abs();

        let cornering_wear = 0.2 + lat_g * 0.25 + lat_g * lat_g * 0.45;
        let longitudinal_wear = lon_g * lon_g * 0.3;

        let excess_slip = if input.slip_angle.abs() > 9.0 {
            ((input.slip_angle.abs() - 9.0) / 15.0).min(1.5) * 0.8
        } else {
            0.0
        };

        let rear_drift_penalty = if input.is_drifting || input.is_handbrake {
            1.5
        } else {
            0.0
        };

        let base_intensity = (cornering_wear + longitudinal_wear + excess_slip).min(5.0);
        let rear_intensity = (base_intensity + rear_drift_penalty).min(5.0);

        let weather_mod = if self.is_optimal_conditions(&input.ambient) {
            1.0
        } else {
            1.3
        };

        let track_temp_mod = 0.85 + input.track_temperature * 0.3;

        let surface_mod = if input.surface_wear_multiplier > 0.0 {
            input.surface_wear_multiplier
        } else {
            1.0
        };

        let env_factor = weather_mod * track_temp_mod * surface_mod;
        let front_common = base_rate * base_intensity * env_factor;
        let rear_common = base_rate * rear_intensity * env_factor;

        let steer_abs = input.steer_angle.abs();
        let is_turning_left = input.steer_angle < -0.02;
        let is_turning_right = input.steer_angle > 0.02;

        let front_steer_mult = 1.0 + (steer_abs / 0.5).min(1.0) * 0.8;

        let base_outer_bias = (steer_abs / 0.5).min(1.0) * 0.3;
        let g_outer_bias = (lat_g / 1.5).min(1.0) * 0.2;
        let outer_bias = base_outer_bias + g_outer_bias;

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

        let brake_front_mult = if input.is_braking { 1.25 } else { 1.0 };

        let throttle_rear_mult = if input.is_throttle && !input.is_drifting {
            1.2
        } else {
            1.0
        };

        let tire_temp_mults: [f32; 4] = [
            Self::calculate_tire_temp_wear_mult(input.tire_temperatures[FL]),
            Self::calculate_tire_temp_wear_mult(input.tire_temperatures[FR]),
            Self::calculate_tire_temp_wear_mult(input.tire_temperatures[RL]),
            Self::calculate_tire_temp_wear_mult(input.tire_temperatures[RR]),
        ];

        // Inner-side wheels in a turn do far less work (lateral G is borne by
        // the outer side). Apply explicit reduction so unloaded tires barely
        // wear during cornering — matches real F1 telemetry.
        let inner_relief_front = 1.0 - (steer_abs / 0.5).min(1.0) * 0.45
            - (lat_g / 1.5).min(1.0) * 0.25;
        let inner_relief_rear = 1.0 - (steer_abs / 0.5).min(1.0) * 0.2
            - (lat_g / 1.5).min(1.0) * 0.15;

        let fl_outer_mult = if is_turning_right {
            1.0 + outer_bias
        } else if is_turning_left {
            inner_relief_front.max(0.4)
        } else {
            1.0
        };
        let fl_rate = front_common
            * front_steer_mult
            * fl_load_mult.max(0.5)
            * fl_outer_mult
            * brake_front_mult
            * tire_temp_mults[FL];

        let fr_outer_mult = if is_turning_left {
            1.0 + outer_bias
        } else if is_turning_right {
            inner_relief_front.max(0.4)
        } else {
            1.0
        };
        let fr_rate = front_common
            * front_steer_mult
            * fr_load_mult.max(0.5)
            * fr_outer_mult
            * brake_front_mult
            * tire_temp_mults[FR];

        let rl_outer_mult = if is_turning_right {
            1.0 + outer_bias * 0.3
        } else if is_turning_left {
            inner_relief_rear.max(0.55)
        } else {
            1.0
        };
        let rl_rate = rear_common
            * rl_load_mult.max(0.5)
            * rl_outer_mult
            * throttle_rear_mult
            * tire_temp_mults[RL];

        let rr_outer_mult = if is_turning_left {
            1.0 + outer_bias * 0.3
        } else if is_turning_right {
            inner_relief_rear.max(0.55)
        } else {
            1.0
        };
        let rr_rate = rear_common
            * rr_load_mult.max(0.5)
            * rr_outer_mult
            * throttle_rear_mult
            * tire_temp_mults[RR];

        self.wheels[FL] = (self.wheels[FL] + fl_rate * input.delta_seconds).min(1.0);
        self.wheels[FR] = (self.wheels[FR] + fr_rate * input.delta_seconds).min(1.0);
        self.wheels[RL] = (self.wheels[RL] + rl_rate * input.delta_seconds).min(1.0);
        self.wheels[RR] = (self.wheels[RR] + rr_rate * input.delta_seconds).min(1.0);
    }

    /// Calculate wear multiplier based on tire temperature.
    /// Normalized: 0.0 = 20C, 1.0 = 180C.
    /// Optimal window 70-115C (compound-agnostic baseline); overheating begins
    /// ~140C, where blistering and rapid degradation occur on slicks.
    fn calculate_tire_temp_wear_mult(temp: f32) -> f32 {
        const OPTIMAL_MIN: f32 = 0.313; // ~70C
        const OPTIMAL_MAX: f32 = 0.594; // ~115C
        const OVERHEAT_THRESHOLD: f32 = 0.75; // ~140C

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
    pub fn calculate_degradation_modifiers_from_ambient(
        &self,
        ambient: &AmbientConditions,
    ) -> TireDegradationModifiers {
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

// Temperature constants (normalized scale: 0.0 = 20C, 1.0 = 180C).
// Rates scaled by 130/160 vs. legacy 150C-max so absolute deg-C-per-second is preserved.
const TIRE_AMBIENT_TEMP: f32 = 0.125; // Cold tire starting temp (~40C)
const TIRE_HEAT_RATE_FRICTION: f32 = 0.081; // Heat from road friction (driving)
const TIRE_HEAT_RATE_BRAKING: f32 = 0.146; // Heat from heavy braking (front)
const TIRE_HEAT_RATE_BRAKING_REAR: f32 = 0.065; // Heat from braking (rear)
const TIRE_HEAT_RATE_CORNERING: f32 = 0.0975; // Heat from lateral load
const TIRE_HEAT_RATE_SPINNING: f32 = 0.203; // Heat from wheelspin/drift
const TIRE_COOLING_RATE_AIRFLOW: f32 = 0.0488; // Cooling from airflow
const TIRE_COOLING_RATE_AMBIENT: f32 = 0.0325; // Passive cooling to ambient
const TRACK_TEMP_TRANSFER_RATE: f32 = 0.0406; // Heat transfer from track surface (legacy)

// Puddle cooling and thermal shock constants
const PUDDLE_COOLING_RATE: f32 = 0.4; // Temp drop per second in deep water
const PUDDLE_COOLING_THRESHOLD: f32 = 0.5; // Min water depth to trigger cooling
const PUDDLE_MIN_SPEED: f32 = 5.0; // Min speed for puddle cooling effect
const THERMAL_SHOCK_TEMP_DIFF: f32 = 0.15; // Temp drop to trigger shock
const THERMAL_SHOCK_HOT_THRESHOLD: f32 = 0.5; // Tire must be hot for shock
const THERMAL_SHOCK_GRIP_PENALTY: f32 = 0.3; // Max 30% grip loss
const THERMAL_SHOCK_DURATION: f32 = 3.0; // Seconds of shock effect
const THERMAL_SHOCK_RECOVERY_RATE: f32 = 0.15; // Grip recovery per second

// Soft-clamp + thermal failure constants (normalized: 1.0 = 180C).
// Real F1 tires don't "freeze" at a ceiling — past blistering they rapidly
// lose structural integrity and can deflate or burst. Soft ceiling allows
// readings to climb realistically, then puncture risk accumulates.
const TIRE_TEMP_SOFT_CEILING: f32 = 1.4; // ~244C absolute ceiling (carcass disintegration)
const TIRE_BLOWOUT_RISK_THRESHOLD: f32 = 1.05; // ~189C — risk starts accumulating
const TIRE_BLOWOUT_RISK_RATE: f32 = 0.6; // Risk units / sec at 1.0 (extreme overheat)
const TIRE_BLOWOUT_RISK_RECOVERY: f32 = 0.05; // Risk decay below threshold (sec^-1)

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
    temps: [[f32; 2]; 4],                 // [wheel][inner/outer]
    thermal_shock: [TireThermalShock; 4], // Per-wheel thermal shock state
    blowout_risk: [f32; 4],               // 0.0-1.0 per wheel; 1.0 = burst
    is_blown: [bool; 4],                  // Latched once tire bursts
}

impl Default for TireTemperatureState {
    fn default() -> Self {
        Self {
            temps: [[TIRE_AMBIENT_TEMP; 2]; 4],
            thermal_shock: [TireThermalShock::default(); 4],
            blowout_risk: [0.0; 4],
            is_blown: [false; 4],
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

    /// Update tire temperatures — cooling pass only (airflow, ambient, track conduction)
    /// Call BEFORE car.step() so cooling is frame-accurate
    pub fn update_cooling(&mut self, input: &TempInput) {
        let dt = input.delta_seconds.min(0.05);

        let ambient_target = input.ambient.temperature * 0.4;

        if input.speed_ms < 0.5 {
            for wheel in 0..4 {
                for edge in 0..2 {
                    let diff = ambient_target - self.temps[wheel][edge];
                    // Newton's law of cooling: rate scales with temp delta
                    let overheat_boost = (self.temps[wheel][edge] - 0.6).max(0.0) * 0.5;
                    self.temps[wheel][edge] +=
                        diff * (TIRE_COOLING_RATE_AMBIENT + overheat_boost) * dt * 2.0;
                    // Convective cooling can't drop a tire below the
                    // ambient air around it; floor at the ambient target.
                    self.temps[wheel][edge] = self.temps[wheel][edge].max(ambient_target);
                }
            }
            return;
        }

        let base_airflow = TIRE_COOLING_RATE_AIRFLOW * (input.speed_ms / 40.0).min(1.0);
        let wind_factor = if input.wind_cooling_multiplier > 0.0 {
            input.wind_cooling_multiplier
        } else {
            1.0
        };
        let airflow_cooling = base_airflow * wind_factor;
        let cooling = airflow_cooling + TIRE_COOLING_RATE_AMBIENT;

        for wheel in 0..4 {
            for edge in 0..2 {
                let temp = self.temps[wheel][edge];
                let ambient_pull = (ambient_target - temp) * 0.02;
                // Newton's law of cooling: hotter tires shed heat faster.
                // At 1.0 (180C) the boost adds ~50% extra cooling rate; at 1.4
                // (244C) it more than doubles cooling — preventing runaway.
                let overheat_boost = (temp - 0.6).max(0.0) * 0.6;
                let net = -(cooling + overheat_boost) * dt + ambient_pull * dt;
                // Floor at ambient — convective cooling can't drop a
                // tire below the surrounding air (only puddle-spray
                // cooling can, handled separately).
                self.temps[wheel][edge] = (temp + net).max(ambient_target);
            }
        }
    }

    /// Update tire temperatures — heating pass only (friction, braking, cornering, drift, track)
    /// Call AFTER car.step() so actual G-forces and weight transfer are used.
    /// `per_wheel_track_temp`: track surface temperature sampled at each wheel's
    /// world position (0.0-1.0 normalized). Pass `None` to fall back to the
    /// car-center value in `input.track_temperature`.
    pub fn update_heating(
        &mut self,
        input: &TempInput,
        per_wheel_track_temp: Option<[f32; 4]>,
    ) {
        let dt = input.delta_seconds.min(0.05);

        if input.speed_ms < 0.5 {
            return;
        }

        let speed_factor = (input.speed_ms / 30.0).min(1.5);
        let base_heat = TIRE_HEAT_RATE_FRICTION * speed_factor;

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

        let lateral_load = input.lateral_g.abs();
        let cornering_heat = TIRE_HEAT_RATE_CORNERING * lateral_load.min(1.5);

        let turning_left = input.steer_angle < -0.02;
        let turning_right = input.steer_angle > 0.02;
        let is_cornering = turning_left || turning_right;

        let drift_heat = if input.is_drifting {
            TIRE_HEAT_RATE_SPINNING
        } else if input.is_throttle && input.speed_ms < 10.0 {
            TIRE_HEAT_RATE_SPINNING * 0.5
        } else {
            0.0
        };

        for wheel in 0..4 {
            let is_front = wheel < 2;
            let is_left = wheel == 0 || wheel == 2;

            let load_mult = self.get_load_multiplier(wheel, &input.weight_transfer);

            // Per-wheel track contact heat (cell sampled under this wheel)
            let wheel_track_temp = per_wheel_track_temp
                .map(|arr| arr[wheel])
                .unwrap_or(input.track_temperature);
            let track_heat = if wheel_track_temp > 0.3 {
                TRACK_TEMP_TRANSFER_RATE * (wheel_track_temp - 0.3) * speed_factor
            } else {
                0.0
            };

            // Side-of-car cornering loading. Inner-side wheels in a turn carry
            // ~30-40% of the static load; outer-side wheels carry the rest.
            // Real F1: inner-side temps DROP below straight-line because the
            // tire is barely doing work. Both edges of inner wheels scale
            // together, but outer wheels' OUTER edge gets the strongest hit.
            let is_loaded_side = (turning_left && !is_left) || (turning_right && is_left);
            let cornering_side_factor = if is_cornering {
                if is_loaded_side {
                    1.3 // Outer side bears most lateral work
                } else {
                    0.45 // Inner side unloaded — significantly less heat
                }
            } else {
                1.0
            };

            for edge in 0..2 {
                let is_inner = edge == 0;

                let mut heat = base_heat;

                heat += if is_front {
                    brake_heat_front
                } else {
                    brake_heat_rear
                };

                // Edge bias on top of side factor: outer edge of outer wheel
                // takes the most punishment due to camber + load.
                let edge_factor = if is_cornering && is_loaded_side {
                    if is_inner {
                        0.85
                    } else {
                        1.4 // Outer edge of outer wheel — hottest spot
                    }
                } else if is_cornering && !is_loaded_side {
                    if is_inner {
                        0.7 // Inner wheel barely flexing inside edge
                    } else {
                        1.0
                    }
                } else {
                    1.0
                };
                heat += cornering_heat * cornering_side_factor * edge_factor;

                if !is_front {
                    heat += drift_heat;
                }

                heat += track_heat;

                heat *= load_mult;

                let net = heat * dt;
                let new_temp = self.temps[wheel][edge] + net;

                // Soft ceiling: as temp climbs past 1.0, additional heat input
                // is increasingly resisted (heat dissipation grows non-linearly).
                // Past TIRE_TEMP_SOFT_CEILING the carcass has effectively burned
                // through and the tire is structurally compromised.
                self.temps[wheel][edge] = if new_temp > 1.0 {
                    let overshoot = new_temp - 1.0;
                    let damped = overshoot / (1.0 + overshoot * 1.5);
                    (1.0 + damped).min(TIRE_TEMP_SOFT_CEILING)
                } else {
                    new_temp.max(0.0)
                };
            }

            // Blowout risk accumulation per wheel.
            let max_edge_temp = self.temps[wheel][0].max(self.temps[wheel][1]);
            if max_edge_temp > TIRE_BLOWOUT_RISK_THRESHOLD {
                let excess = (max_edge_temp - TIRE_BLOWOUT_RISK_THRESHOLD)
                    / (TIRE_TEMP_SOFT_CEILING - TIRE_BLOWOUT_RISK_THRESHOLD);
                self.blowout_risk[wheel] =
                    (self.blowout_risk[wheel] + TIRE_BLOWOUT_RISK_RATE * excess * dt).min(1.0);
                if self.blowout_risk[wheel] >= 1.0 {
                    self.is_blown[wheel] = true;
                }
            } else {
                self.blowout_risk[wheel] =
                    (self.blowout_risk[wheel] - TIRE_BLOWOUT_RISK_RECOVERY * dt).max(0.0);
            }
        }
    }

    /// Legacy combined update (delegates to cooling + heating)
    pub fn update(&mut self, input: &TempInput) {
        self.update_cooling(input);
        self.update_heating(input, None);
    }

    /// Get per-wheel blowout risk (0.0 = safe, 1.0 = burst)
    pub fn get_blowout_risk(&self) -> [f32; 4] {
        self.blowout_risk
    }

    /// Whether each wheel has burst from thermal overload.
    pub fn get_is_blown(&self) -> [bool; 4] {
        self.is_blown
    }

    /// Reset blowout state (e.g. tire change in pit)
    pub fn reset_blowout(&mut self) {
        self.blowout_risk = [0.0; 4];
        self.is_blown = [false; 4];
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

    /// Apply external heat change (from track-tire heat exchange).
    /// heat_delta: positive = tire gains heat, negative = tire loses heat.
    /// Uniform across all wheels — kept for legacy callers.
    pub fn apply_external_heat(&mut self, heat_delta: f32) {
        for wheel in 0..4 {
            for edge in 0..2 {
                let new_temp = self.temps[wheel][edge] + heat_delta;
                self.temps[wheel][edge] = new_temp.clamp(0.0, TIRE_TEMP_SOFT_CEILING);
            }
        }
    }

    /// Apply per-wheel external heat deltas (e.g. track-tire conduction).
    /// Heat is split evenly between inner and outer edges — appropriate
    /// for surface contact, which is symmetric across the contact patch.
    /// For brake-derived heat (inner-rim entry), use
    /// `apply_brake_heat_per_wheel` which applies a 70/30 inner bias.
    pub fn apply_external_heat_per_wheel(&mut self, deltas: [f32; 4]) {
        for wheel in 0..4 {
            for edge in 0..2 {
                let new_temp = self.temps[wheel][edge] + deltas[wheel];
                self.temps[wheel][edge] = new_temp.clamp(0.0, TIRE_TEMP_SOFT_CEILING);
            }
        }
    }

    /// Apply per-wheel brake-derived heat deltas with a 70/30 inner-bias.
    /// Brake heat enters through the inner rim; the imbalance produces
    /// the inner-tread degradation observed on heavy-braking circuits.
    /// The `× 2.0` preserves the same total energy budget as a uniform
    /// split would (sum of edge shares = 2.0).
    pub fn apply_brake_heat_per_wheel(&mut self, deltas: [f32; 4]) {
        const INNER_EDGE_SHARE: f32 = 0.7;
        const OUTER_EDGE_SHARE: f32 = 0.3;
        for wheel in 0..4 {
            // Edge 0 = inner, edge 1 = outer.
            let inner = self.temps[wheel][0] + deltas[wheel] * INNER_EDGE_SHARE * 2.0;
            let outer = self.temps[wheel][1] + deltas[wheel] * OUTER_EDGE_SHARE * 2.0;
            self.temps[wheel][0] = inner.clamp(0.0, TIRE_TEMP_SOFT_CEILING);
            self.temps[wheel][1] = outer.clamp(0.0, TIRE_TEMP_SOFT_CEILING);
        }
    }

    /// Apply puddle cooling effect when driving through standing water
    /// Returns true if any thermal shock was triggered
    pub fn apply_puddle_cooling(
        &mut self,
        water_depth: f32,
        speed_ms: f32,
        delta_seconds: f32,
    ) -> bool {
        // Check thresholds
        if water_depth < PUDDLE_COOLING_THRESHOLD || speed_ms < PUDDLE_MIN_SPEED {
            return false;
        }

        let dt = delta_seconds.min(0.05);

        // Cooling intensity based on water depth and speed
        let water_factor =
            (water_depth - PUDDLE_COOLING_THRESHOLD) / (1.0 - PUDDLE_COOLING_THRESHOLD);
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
                        (self.thermal_shock[wheel].grip_penalty - THERMAL_SHOCK_RECOVERY_RATE * dt)
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
            recovery_time: self
                .thermal_shock
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

// ============================================================================
// Tire Material Science System
// ============================================================================

const REFERENCE_TEMP_CELSIUS: f32 = 25.0;
const GRAINING_BUILDUP_RATE: f32 = 0.05;
const GRAINING_RECOVERY_RATE: f32 = 0.03;
const GRAINING_MAX_GRIP_PENALTY: f32 = 0.15;
const BLISTERING_BUILDUP_RATE: f32 = 0.02;
const BLISTERING_MAX_GRIP_PENALTY: f32 = 0.25;
const SHORE_WEAR_RATE_FACTOR: f32 = 0.01;

pub struct TireMaterialSystem {
    properties: TireMaterialProperties,
    wheels: [TireMaterialState; 4],
}

impl TireMaterialSystem {
    pub fn new(compound: TireCompound) -> Self {
        Self {
            properties: TireMaterialProperties::for_compound(compound),
            wheels: [TireMaterialState::default(); 4],
        }
    }

    pub fn set_compound(&mut self, compound: TireCompound) {
        self.properties = TireMaterialProperties::for_compound(compound);
        self.wheels = [TireMaterialState::default(); 4];
    }

    pub fn update(&mut self, dt: f32, tire_temps_normalized: &[f32; 4]) {
        let dt = dt.min(0.05);
        for i in 0..4 {
            // WAVE6: part of tire-temp Celsius newtype refactor.
            let temp_celsius = tire_temps_normalized[i] * 130.0 + 20.0;
            self.update_wheel(i, dt, temp_celsius);
        }
    }

    fn update_wheel(&mut self, wheel: usize, dt: f32, temp_celsius: f32) {
        let props = &self.properties;
        let state = &mut self.wheels[wheel];

        let delta_t = temp_celsius - props.optimal_temp_celsius;
        // Guard against zero-sigma compound configs that would divide by
        // zero. The set_compound path debug-asserts sigma > 0 (see test in
        // material-properties block); this floor keeps release runs safe
        // if a future config ever slips through.
        let sigma_sq = (props.temp_sigma_celsius * props.temp_sigma_celsius).max(0.001);
        let gaussian = (-delta_t * delta_t / (2.0 * sigma_sq)).exp();
        let min_grip_floor = props.peak_grip_amplitude * 0.4;
        state.viscoelastic_grip =
            min_grip_floor + (props.peak_grip_amplitude - min_grip_floor) * gaussian;

        let delta_from_ref = temp_celsius - REFERENCE_TEMP_CELSIUS;
        state.shore_hardness = (props.base_shore_hardness
            - props.hardness_temp_coefficient * delta_from_ref)
            .max(20.0);

        let graining_threshold = props.optimal_temp_celsius - props.graining_onset_delta;
        if temp_celsius < graining_threshold {
            let cold_excess = (graining_threshold - temp_celsius) / props.graining_onset_delta;
            let severity_target = cold_excess.clamp(0.0, 1.0);
            state.graining_severity =
                (state.graining_severity + GRAINING_BUILDUP_RATE * severity_target * dt).min(1.0);
        } else {
            state.graining_severity =
                (state.graining_severity - GRAINING_RECOVERY_RATE * dt).max(0.0);
        }

        let blistering_threshold = props.optimal_temp_celsius + props.blistering_onset_delta;
        if temp_celsius > blistering_threshold {
            let hot_excess = (temp_celsius - blistering_threshold) / props.blistering_onset_delta;
            let damage_rate = hot_excess.clamp(0.0, 1.0);
            state.blistering_damage =
                (state.blistering_damage + BLISTERING_BUILDUP_RATE * damage_rate * dt).min(1.0);
        }
    }

    pub fn get_effective_grip(&self, wheel: usize) -> f32 {
        let state = &self.wheels[wheel.min(3)];
        let graining_penalty = state.graining_severity * GRAINING_MAX_GRIP_PENALTY;
        let blistering_penalty = state.blistering_damage * BLISTERING_MAX_GRIP_PENALTY;
        (state.viscoelastic_grip - graining_penalty - blistering_penalty).max(0.1)
    }

    /// Average per-wheel effective material grip across all 4 corners.
    /// Wave 4 Phase 1 verification: at warm tire (temperature within
    /// the per-compound optimal window), `viscoelastic_grip` =
    /// `peak_grip_amplitude` of that compound — i.e. the warm baseline
    /// is the *physical* per-compound peak μ scalar (1.15 soft, 1.0
    /// medium, 0.92 hard), NOT a residual that needs rescaling. The
    /// cold-rubber penalty enters via the Gaussian off-peak fall to
    /// `0.4 × peak_grip_amplitude`. Wave 3 wave-end review flagged
    /// this as `~0.5-0.7 cold` which is correct for cold tire; warm
    /// is already 1.0 for the default medium compound.
    pub fn get_average_effective_grip(&self) -> f32 {
        (self.get_effective_grip(0)
            + self.get_effective_grip(1)
            + self.get_effective_grip(2)
            + self.get_effective_grip(3))
            / 4.0
    }

    pub fn get_wear_rate_modifier(&self, wheel: usize) -> f32 {
        let hardness = self.wheels[wheel.min(3)].shore_hardness;
        1.0 + (62.0 - hardness) * SHORE_WEAR_RATE_FACTOR
    }

    pub fn get_output(&self) -> TireMaterialOutput {
        TireMaterialOutput {
            per_wheel_graining: [
                self.wheels[0].graining_severity,
                self.wheels[1].graining_severity,
                self.wheels[2].graining_severity,
                self.wheels[3].graining_severity,
            ],
            per_wheel_blistering: [
                self.wheels[0].blistering_damage,
                self.wheels[1].blistering_damage,
                self.wheels[2].blistering_damage,
                self.wheels[3].blistering_damage,
            ],
            per_wheel_viscoelastic_grip: [
                self.get_effective_grip(0),
                self.get_effective_grip(1),
                self.get_effective_grip(2),
                self.get_effective_grip(3),
            ],
            per_wheel_shore_hardness: [
                self.wheels[0].shore_hardness,
                self.wheels[1].shore_hardness,
                self.wheels[2].shore_hardness,
                self.wheels[3].shore_hardness,
            ],
        }
    }

    pub fn get_wheel_state(&self, wheel: usize) -> &TireMaterialState {
        &self.wheels[wheel.min(3)]
    }

    pub fn get_properties(&self) -> &TireMaterialProperties {
        &self.properties
    }
}

impl std::fmt::Debug for TireMaterialSystem {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TireMaterialSystem")
            .field("properties", &self.properties)
            .field("wheels", &self.wheels)
            .finish()
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
            slip_angle: 0.0,
            surface_wear_multiplier: 1.0,
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
            slip_angle: 0.0,
            surface_wear_multiplier: 1.0,
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
            slip_angle: 0.0,
            surface_wear_multiplier: 1.0,
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
            slip_angle: 0.0,
            surface_wear_multiplier: 1.0,
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
            slip_angle: 0.0,
            surface_wear_multiplier: 1.0,
        };

        for _ in 0..30 {
            state.update_wear_per_wheel(&input);
        }

        let wear = state.get_per_wheel_wear();
        let front_avg = (wear.front_left + wear.front_right) / 2.0;
        let rear_avg = (wear.rear_left + wear.rear_right) / 2.0;

        // Front should wear more when braking (brake_front_mult=1.25)
        assert!(front_avg > rear_avg * 1.2);
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
            slip_angle: 0.0,
            surface_wear_multiplier: 1.0,
        };

        let rain_input = WearInput {
            ambient: AmbientConditions::new(15.0, 0.9, 0.8), // Rain conditions
            ..dry_input
        };

        for _ in 0..30 {
            state1.update_wear_per_wheel(&dry_input);
            state2.update_wear_per_wheel(&rain_input);
        }

        // Wrong weather should cause 1.3x wear
        assert!(state2.get_wear() > state1.get_wear() * 1.2);
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
            slip_angle: 0.0,
            surface_wear_multiplier: 1.0,
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
            slip_angle: 0.0,
            surface_wear_multiplier: 1.0,
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
            slip_angle: 0.0,
            surface_wear_multiplier: 1.0,
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

    // ========================================================================
    // Phase 7: Tire Material Science Tests
    // ========================================================================

    fn temp_celsius_to_normalized(celsius: f32) -> f32 {
        // WAVE6: part of tire-temp Celsius newtype refactor.
        (celsius - 20.0) / 130.0
    }

    #[test]
    fn test_material_viscoelastic_grip_bell_curve_shape() {
        let sys = TireMaterialSystem::new(TireCompound::Soft);
        let props = sys.get_properties();

        let mut grips = Vec::new();
        for temp_c in (20..=150).step_by(5) {
            let norm = temp_celsius_to_normalized(temp_c as f32);
            let mut sys_copy = TireMaterialSystem::new(TireCompound::Soft);
            sys_copy.update(1.0, &[norm; 4]);
            grips.push((temp_c, sys_copy.get_effective_grip(0)));
        }

        let peak_idx = grips
            .iter()
            .enumerate()
            .max_by(|a, b| a.1 .1.partial_cmp(&b.1 .1).unwrap())
            .unwrap()
            .0;

        let peak_temp = grips[peak_idx].0;
        assert!(
            (peak_temp as f32 - props.optimal_temp_celsius).abs() <= 5.0,
            "Peak grip should be near optimal temp {}°C, got {}°C",
            props.optimal_temp_celsius,
            peak_temp
        );

        if peak_idx > 0 {
            assert!(
                grips[peak_idx].1 > grips[0].1,
                "Peak should be higher than coldest"
            );
        }
        if peak_idx < grips.len() - 1 {
            assert!(
                grips[peak_idx].1 > grips[grips.len() - 1].1,
                "Peak should be higher than hottest"
            );
        }
    }

    #[test]
    fn test_material_soft_vs_hard_peak_and_width() {
        let mut soft = TireMaterialSystem::new(TireCompound::Soft);
        let mut hard = TireMaterialSystem::new(TireCompound::Hard);

        let soft_opt = temp_celsius_to_normalized(95.0);
        let hard_opt = temp_celsius_to_normalized(110.0);

        soft.update(1.0, &[soft_opt; 4]);
        hard.update(1.0, &[hard_opt; 4]);

        let soft_peak = soft.get_effective_grip(0);
        let hard_peak = hard.get_effective_grip(0);

        assert!(
            soft_peak > hard_peak,
            "Soft peak grip ({}) should exceed hard peak grip ({})",
            soft_peak,
            hard_peak
        );

        let off_by_30 = temp_celsius_to_normalized(95.0 + 30.0);
        let off_by_30_hard = temp_celsius_to_normalized(110.0 + 30.0);

        let mut soft_off = TireMaterialSystem::new(TireCompound::Soft);
        let mut hard_off = TireMaterialSystem::new(TireCompound::Hard);
        soft_off.update(1.0, &[off_by_30; 4]);
        hard_off.update(1.0, &[off_by_30_hard; 4]);

        let soft_drop = (soft_peak - soft_off.get_effective_grip(0)) / soft_peak;
        let hard_drop = (hard_peak - hard_off.get_effective_grip(0)) / hard_peak;

        assert!(
            soft_drop > hard_drop,
            "Soft tires should drop more off-peak ({:.2}%) vs hard ({:.2}%)",
            soft_drop * 100.0,
            hard_drop * 100.0
        );
    }

    #[test]
    fn test_material_graining_triggers_below_threshold() {
        let mut sys = TireMaterialSystem::new(TireCompound::Soft);
        let cold_temp = temp_celsius_to_normalized(50.0);

        for _ in 0..200 {
            sys.update(0.05, &[cold_temp; 4]);
        }

        let state = sys.get_wheel_state(0);
        assert!(
            state.graining_severity > 0.0,
            "Graining should trigger at 50°C (threshold ~75°C for soft), got severity {}",
            state.graining_severity
        );
    }

    #[test]
    fn test_material_graining_recovers_at_optimal_temp() {
        let mut sys = TireMaterialSystem::new(TireCompound::Soft);

        let cold_temp = temp_celsius_to_normalized(50.0);
        for _ in 0..200 {
            sys.update(0.05, &[cold_temp; 4]);
        }
        let graining_before = sys.get_wheel_state(0).graining_severity;
        assert!(graining_before > 0.0);

        let optimal_temp = temp_celsius_to_normalized(95.0);
        for _ in 0..400 {
            sys.update(0.05, &[optimal_temp; 4]);
        }
        let graining_after = sys.get_wheel_state(0).graining_severity;
        assert!(
            graining_after < graining_before,
            "Graining should recover at optimal temp: before={}, after={}",
            graining_before,
            graining_after
        );
    }

    #[test]
    fn test_material_blistering_triggers_above_threshold() {
        let mut sys = TireMaterialSystem::new(TireCompound::Soft);
        let hot_temp = temp_celsius_to_normalized(140.0);

        for _ in 0..200 {
            sys.update(0.05, &[hot_temp; 4]);
        }

        let state = sys.get_wheel_state(0);
        assert!(
            state.blistering_damage > 0.0,
            "Blistering should trigger at 140°C (threshold 125°C for soft), got damage {}",
            state.blistering_damage
        );
    }

    #[test]
    fn test_material_blistering_is_permanent() {
        let mut sys = TireMaterialSystem::new(TireCompound::Soft);

        let hot_temp = temp_celsius_to_normalized(140.0);
        for _ in 0..200 {
            sys.update(0.05, &[hot_temp; 4]);
        }
        let damage_after_heat = sys.get_wheel_state(0).blistering_damage;
        assert!(damage_after_heat > 0.0);

        let cool_temp = temp_celsius_to_normalized(95.0);
        for _ in 0..400 {
            sys.update(0.05, &[cool_temp; 4]);
        }
        let damage_after_cool = sys.get_wheel_state(0).blistering_damage;

        assert!(
            (damage_after_cool - damage_after_heat).abs() < 0.001,
            "Blistering damage should not recover: before={}, after={}",
            damage_after_heat,
            damage_after_cool
        );
    }

    #[test]
    fn test_material_shore_hardness_decreases_with_temperature() {
        let mut sys = TireMaterialSystem::new(TireCompound::Medium);

        let cold_temp = temp_celsius_to_normalized(30.0);
        sys.update(1.0, &[cold_temp; 4]);
        let cold_hardness = sys.get_wheel_state(0).shore_hardness;

        let hot_temp = temp_celsius_to_normalized(120.0);
        sys.update(1.0, &[hot_temp; 4]);
        let hot_hardness = sys.get_wheel_state(0).shore_hardness;

        assert!(
            cold_hardness > hot_hardness,
            "Shore hardness should decrease with temperature: cold={}, hot={}",
            cold_hardness,
            hot_hardness
        );
    }

    #[test]
    fn test_material_shore_hardness_linear() {
        let mut sys = TireMaterialSystem::new(TireCompound::Hard);

        let t1 = temp_celsius_to_normalized(50.0);
        sys.update(1.0, &[t1; 4]);
        let h1 = sys.get_wheel_state(0).shore_hardness;

        let t2 = temp_celsius_to_normalized(100.0);
        sys.update(1.0, &[t2; 4]);
        let h2 = sys.get_wheel_state(0).shore_hardness;

        let expected_diff = 0.1 * (100.0 - 50.0);
        let actual_diff = h1 - h2;
        assert!(
            (actual_diff - expected_diff).abs() < 0.5,
            "Shore hardness drop should be linear: expected ~{}, got {}",
            expected_diff,
            actual_diff
        );
    }

    #[test]
    fn test_material_compound_change_resets_state() {
        let mut sys = TireMaterialSystem::new(TireCompound::Soft);

        let hot_temp = temp_celsius_to_normalized(140.0);
        for _ in 0..200 {
            sys.update(0.05, &[hot_temp; 4]);
        }
        assert!(sys.get_wheel_state(0).blistering_damage > 0.0);

        sys.set_compound(TireCompound::Hard);
        assert!(
            sys.get_wheel_state(0).blistering_damage == 0.0,
            "Compound change should reset blistering damage"
        );
        assert!(
            sys.get_wheel_state(0).graining_severity == 0.0,
            "Compound change should reset graining"
        );
    }

    #[test]
    fn test_material_no_nan_or_infinity() {
        for compound in [
            TireCompound::Soft,
            TireCompound::Medium,
            TireCompound::Hard,
            TireCompound::Wet,
            TireCompound::Intermediate,
        ] {
            let mut sys = TireMaterialSystem::new(compound);

            for norm_temp in [0.0_f32, 0.1, 0.3, 0.5, 0.7, 0.9, 1.0] {
                sys.update(0.016, &[norm_temp; 4]);
                for w in 0..4 {
                    let state = sys.get_wheel_state(w);
                    assert!(
                        !state.viscoelastic_grip.is_nan(),
                        "NaN grip for {:?} at temp {}",
                        compound,
                        norm_temp
                    );
                    assert!(
                        !state.viscoelastic_grip.is_infinite(),
                        "Inf grip for {:?} at temp {}",
                        compound,
                        norm_temp
                    );
                    assert!(
                        !state.shore_hardness.is_nan(),
                        "NaN hardness for {:?} at temp {}",
                        compound,
                        norm_temp
                    );
                    assert!(
                        !state.graining_severity.is_nan(),
                        "NaN graining for {:?} at temp {}",
                        compound,
                        norm_temp
                    );
                    assert!(
                        !state.blistering_damage.is_nan(),
                        "NaN blistering for {:?} at temp {}",
                        compound,
                        norm_temp
                    );
                    assert!(
                        sys.get_effective_grip(w) >= 0.1,
                        "Grip too low for {:?} at temp {}",
                        compound,
                        norm_temp
                    );
                }
            }
        }
    }

    #[test]
    fn test_material_wear_rate_modifier() {
        let mut soft_sys = TireMaterialSystem::new(TireCompound::Soft);
        let mut hard_sys = TireMaterialSystem::new(TireCompound::Hard);

        let temp = temp_celsius_to_normalized(95.0);
        soft_sys.update(1.0, &[temp; 4]);
        hard_sys.update(1.0, &[temp; 4]);

        let soft_rate = soft_sys.get_wear_rate_modifier(0);
        let hard_rate = hard_sys.get_wear_rate_modifier(0);

        assert!(
            soft_rate > hard_rate,
            "Soft tires should wear faster: soft_rate={}, hard_rate={}",
            soft_rate,
            hard_rate
        );
    }

    #[test]
    fn test_material_output_structure() {
        let mut sys = TireMaterialSystem::new(TireCompound::Medium);
        let temp = temp_celsius_to_normalized(100.0);
        sys.update(1.0, &[temp; 4]);

        let output = sys.get_output();
        for w in 0..4 {
            assert!(output.per_wheel_viscoelastic_grip[w] > 0.0);
            assert!(output.per_wheel_shore_hardness[w] > 0.0);
            assert!(output.per_wheel_graining[w] >= 0.0);
            assert!(output.per_wheel_blistering[w] >= 0.0);
        }
    }

    #[test]
    fn test_material_wet_compound_lower_optimal_temp() {
        let wet_props = TireMaterialProperties::for_compound(TireCompound::Wet);
        let soft_props = TireMaterialProperties::for_compound(TireCompound::Soft);

        assert!(
            wet_props.optimal_temp_celsius < soft_props.optimal_temp_celsius,
            "Wet tires should have lower optimal temp: wet={}°C, soft={}°C",
            wet_props.optimal_temp_celsius,
            soft_props.optimal_temp_celsius
        );
    }

    #[test]
    fn test_material_all_compounds_have_valid_properties() {
        for compound in [
            TireCompound::Soft,
            TireCompound::Medium,
            TireCompound::Hard,
            TireCompound::Wet,
            TireCompound::Intermediate,
        ] {
            let props = TireMaterialProperties::for_compound(compound);
            assert!(
                props.optimal_temp_celsius > 20.0 && props.optimal_temp_celsius < 150.0,
                "Invalid optimal temp for {:?}: {}°C",
                compound,
                props.optimal_temp_celsius
            );
            assert!(
                props.temp_sigma_celsius > 5.0 && props.temp_sigma_celsius < 50.0,
                "Invalid sigma for {:?}: {}°C",
                compound,
                props.temp_sigma_celsius
            );
            assert!(
                props.peak_grip_amplitude > 0.5 && props.peak_grip_amplitude < 2.0,
                "Invalid peak grip for {:?}: {}",
                compound,
                props.peak_grip_amplitude
            );
            assert!(
                props.base_shore_hardness > 30.0 && props.base_shore_hardness < 100.0,
                "Invalid Shore A for {:?}: {}",
                compound,
                props.base_shore_hardness
            );
            assert!(
                props.hardness_temp_coefficient > 0.0 && props.hardness_temp_coefficient < 1.0,
                "Invalid hardness coefficient for {:?}: {}",
                compound,
                props.hardness_temp_coefficient
            );
            assert!(
                props.graining_onset_delta > 5.0 && props.graining_onset_delta < 50.0,
                "Invalid graining onset for {:?}: {}°C",
                compound,
                props.graining_onset_delta
            );
            assert!(
                props.blistering_onset_delta > 10.0 && props.blistering_onset_delta < 60.0,
                "Invalid blistering onset for {:?}: {}°C",
                compound,
                props.blistering_onset_delta
            );
        }
    }

    #[test]
    fn test_material_grip_at_extreme_cold() {
        let mut sys = TireMaterialSystem::new(TireCompound::Medium);
        sys.update(1.0, &[0.0; 4]);
        let grip = sys.get_effective_grip(0);
        assert!(
            grip >= 0.1,
            "Grip should not go below minimum floor even at 20°C"
        );
        assert!(
            grip < 0.8,
            "Grip should be significantly reduced at 20°C for medium compound"
        );
    }

    #[test]
    fn test_material_grip_at_extreme_hot() {
        let mut sys = TireMaterialSystem::new(TireCompound::Medium);
        sys.update(1.0, &[1.0; 4]);
        let grip = sys.get_effective_grip(0);
        assert!(
            grip >= 0.1,
            "Grip should not go below minimum floor even at 150°C"
        );
        assert!(
            grip < 0.8,
            "Grip should be significantly reduced at 150°C for medium compound"
        );
    }
}
