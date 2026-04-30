#![allow(dead_code)]

mod active_aero;
mod brakes;
mod car_physics;
mod constants;
mod curb;
pub mod engine;
mod engine_temp;
mod ers;
mod pit_lane;
mod surface;
mod terrain;
mod tires;
mod track_temperature;
pub mod types;
mod utils;
mod weather;
mod wind;

use engine::PhysicsEngine as PhysicsEngineInternal;
use serde_wasm_bindgen::{from_value, to_value};
use types::{
    AeroMode, AmbientEnvironment, CarInput, CurbSide, CurbType, ErsMode, SemiAutoPreset,
    SurfaceType, TerrainMaterial, TireCompound, TrackBounds,
};
use wasm_bindgen::prelude::*;

// Re-export enums for JavaScript
pub use types::AeroMode as AeroModeEnum;
pub use types::ErsMode as ErsModeEnum;
pub use types::TireCompound as TireCompoundEnum;

/// WASM-exposed physics engine wrapper
#[wasm_bindgen]
pub struct PhysicsEngine {
    inner: PhysicsEngineInternal,
}

#[wasm_bindgen]
impl PhysicsEngine {
    /// Create a new physics engine instance
    #[wasm_bindgen(constructor)]
    pub fn new() -> PhysicsEngine {
        // Set panic hook for better error messages in browser
        #[cfg(feature = "console_error_panic_hook")]
        console_error_panic_hook::set_once();

        PhysicsEngine {
            inner: PhysicsEngineInternal::new(),
        }
    }

    // ========================================================================
    // Weather API
    // ========================================================================

    /// Get current weather modifiers as JavaScript object
    #[wasm_bindgen]
    pub fn get_weather_modifiers(&self) -> JsValue {
        to_value(&self.inner.get_weather_modifiers()).unwrap_or(JsValue::NULL)
    }

    /// Get current ambient conditions (temperature and humidity)
    #[wasm_bindgen]
    pub fn get_ambient_conditions(&self) -> JsValue {
        to_value(&self.inner.get_ambient_conditions()).unwrap_or(JsValue::NULL)
    }

    /// Set ambient conditions
    /// celsius: temperature in Celsius (-10 to 50)
    /// humidity: 0.0 to 1.0
    /// rain_intensity: 0.0 to 1.0 (0% to 100%)
    #[wasm_bindgen]
    pub fn set_custom_weather(&mut self, celsius: f32, humidity: f32, rain_intensity: f32) {
        self.inner
            .set_custom_weather(celsius, humidity, rain_intensity);
    }

    /// Get current rain intensity (0.0 to 1.0)
    #[wasm_bindgen]
    pub fn get_rain_intensity(&self) -> f32 {
        self.inner.get_rain_intensity()
    }

    #[wasm_bindgen]
    pub fn set_environment(
        &mut self,
        celsius: f32,
        humidity: f32,
        precipitation_rate_mmh: f32,
        pressure_hpa: f32,
        cloud_cover: f32,
    ) {
        let env = AmbientEnvironment::new(celsius, humidity, precipitation_rate_mmh)
            .with_pressure(pressure_hpa)
            .with_cloud_cover(cloud_cover);
        self.inner.set_environment(env);
    }

    #[wasm_bindgen]
    pub fn get_air_density(&self) -> f32 {
        self.inner.get_air_density()
    }

    #[wasm_bindgen]
    pub fn get_surface_friction_breakdown(&self) -> JsValue {
        to_value(&self.inner.get_surface_friction_breakdown()).unwrap_or(JsValue::NULL)
    }

    // ========================================================================
    // Wind API
    // ========================================================================

    /// Set wind parameters
    /// direction: radians (0 = +X axis, π/2 = +Z axis)
    /// speed: m/s (0-25 range)
    #[wasm_bindgen]
    pub fn set_wind(&mut self, direction: f32, speed: f32) {
        self.inner.set_wind(direction, speed);
    }

    /// Enable or disable the wind system
    #[wasm_bindgen]
    pub fn set_wind_enabled(&mut self, enabled: bool) {
        self.inner.set_wind_enabled(enabled);
    }

    /// Check if wind system is enabled
    #[wasm_bindgen]
    pub fn is_wind_enabled(&self) -> bool {
        self.inner.is_wind_enabled()
    }

    /// Get current wind state as JavaScript object
    /// Returns: { direction, baseSpeed, currentSpeed, gustIntensity, enabled }
    #[wasm_bindgen]
    pub fn get_wind_state(&self) -> JsValue {
        to_value(&self.inner.get_wind_state()).unwrap_or(JsValue::NULL)
    }

    /// Get current wind modifiers relative to car heading
    /// car_heading: radians
    /// car_speed: m/s
    /// Returns: { dragModifier, lateralForce, steeringDifficulty, coolingMultiplier, headwindComponent, crosswindComponent }
    #[wasm_bindgen]
    pub fn get_wind_modifiers(&self, car_heading: f32, car_speed: f32) -> JsValue {
        to_value(&self.inner.get_wind_modifiers(car_heading, car_speed)).unwrap_or(JsValue::NULL)
    }

    // ========================================================================
    // Tire API
    // ========================================================================

    /// Set the tire compound
    #[wasm_bindgen]
    pub fn set_tire_compound(&mut self, compound: TireCompound) {
        self.inner.set_tire_compound(compound);
    }

    /// Get the current tire compound
    #[wasm_bindgen]
    pub fn get_tire_compound(&self) -> TireCompound {
        self.inner.get_tire_compound()
    }

    /// Get current tire wear (0.0 to 1.0)
    #[wasm_bindgen]
    pub fn get_tire_wear(&self) -> f32 {
        self.inner.get_tire_wear()
    }

    /// Reset tire wear to 0
    #[wasm_bindgen]
    pub fn reset_tire_wear(&mut self) {
        self.inner.reset_tire_wear();
    }

    /// Set tire wear for all wheels (for debug/testing)
    /// wear: 0.0 (new) to 1.0 (fully worn)
    #[wasm_bindgen]
    pub fn set_tire_wear(&mut self, wear: f32) {
        self.inner.set_tire_wear(wear);
    }

    /// Get effective grip (compound * weather * wear)
    #[wasm_bindgen]
    pub fn get_effective_grip(&self) -> f32 {
        self.inner.get_effective_grip()
    }

    /// Get per-wheel tire wear as JavaScript object
    #[wasm_bindgen]
    pub fn get_tire_wear_per_wheel(&self) -> JsValue {
        to_value(&self.inner.get_tire_wear_per_wheel()).unwrap_or(JsValue::NULL)
    }

    // ========================================================================
    // ERS API
    // ========================================================================

    /// Set ERS mode (Balanced, Attack, Harvest)
    #[wasm_bindgen]
    pub fn set_ers_mode(&mut self, mode: ErsMode) {
        self.inner.set_ers_mode(mode);
    }

    /// Get current ERS mode
    #[wasm_bindgen]
    pub fn get_ers_mode(&self) -> ErsMode {
        self.inner.get_ers_mode()
    }

    /// Get full ERS state as JavaScript object
    #[wasm_bindgen]
    pub fn get_ers_state(&self) -> JsValue {
        to_value(&self.inner.get_ers_state()).unwrap_or(JsValue::NULL)
    }

    /// Reset per-lap ERS accounting (call on lap_complete)
    #[wasm_bindgen]
    pub fn reset_ers_lap(&mut self) {
        self.inner.reset_ers_lap();
    }

    /// Get ERS battery charge (0.0 to 1.0)
    #[wasm_bindgen]
    pub fn get_ers_battery_charge(&self) -> f32 {
        self.inner.get_ers_battery_charge()
    }

    /// Set ERS battery charge (for debug/testing)
    /// charge: 0.0 (empty) to 1.0 (full)
    #[wasm_bindgen]
    pub fn set_ers_battery_charge(&mut self, charge: f32) {
        self.inner.set_ers_battery_charge(charge);
    }

    /// Set ERS overtake availability (testing mode only)
    #[wasm_bindgen]
    pub fn set_ers_overtake_available(&mut self, available: bool) {
        self.inner.set_ers_overtake_available(available);
    }

    // ========================================================================
    // Semi-Auto ERS API
    // ========================================================================

    /// Set ERS Semi-Auto preset
    /// preset: 0 = Balanced, 1 = Aggressive, 2 = Conservative
    #[wasm_bindgen]
    pub fn set_ers_semi_auto_preset(&mut self, preset: u8) {
        let semi_preset = match preset {
            0 => SemiAutoPreset::Balanced,
            1 => SemiAutoPreset::Aggressive,
            2 => SemiAutoPreset::Conservative,
            _ => SemiAutoPreset::Balanced,
        };
        self.inner.set_ers_semi_auto_preset(semi_preset);
    }

    /// Get current Semi-Auto preset
    /// Returns: 0 = Balanced, 1 = Aggressive, 2 = Conservative
    #[wasm_bindgen]
    pub fn get_ers_semi_auto_preset(&self) -> u8 {
        match self.inner.get_ers_semi_auto_preset() {
            SemiAutoPreset::Balanced => 0,
            SemiAutoPreset::Aggressive => 1,
            SemiAutoPreset::Conservative => 2,
        }
    }

    /// Get ERS Semi-Auto config as JavaScript object
    /// Returns: { target_min, target_max, preset, lap_mode, expert_mode }
    #[wasm_bindgen]
    pub fn get_ers_semi_auto_config(&self) -> JsValue {
        to_value(&self.inner.get_ers_semi_auto_config()).unwrap_or(JsValue::NULL)
    }

    /// Set ERS lap mode (race-aware strategy)
    #[wasm_bindgen]
    pub fn set_ers_lap_mode(&mut self, enabled: bool) {
        self.inner.set_ers_lap_mode(enabled);
    }

    /// Set ERS expert mode (manual control)
    #[wasm_bindgen]
    pub fn set_ers_expert_mode(&mut self, enabled: bool) {
        self.inner.set_ers_expert_mode(enabled);
    }

    /// Activate ERS overtake override (temporary 100% deploy in SemiAuto mode)
    #[wasm_bindgen]
    pub fn activate_ers_overtake(&mut self) {
        self.inner.activate_ers_overtake();
    }

    /// Deactivate ERS overtake override
    #[wasm_bindgen]
    pub fn deactivate_ers_overtake(&mut self) {
        self.inner.deactivate_ers_overtake();
    }

    /// Check if ERS overtake override is active
    #[wasm_bindgen]
    pub fn is_ers_overtake_override(&self) -> bool {
        self.inner.is_ers_overtake_override()
    }

    // ========================================================================
    // Active Aero API
    // ========================================================================

    /// Set active aero mode
    /// mode: 0 = Corner (max downforce), 1 = Straight (low drag), 2 = DRS
    #[wasm_bindgen]
    pub fn set_aero_mode(&mut self, mode: u8) {
        let aero_mode = match mode {
            0 => AeroMode::Corner,
            1 => AeroMode::Straight,
            2 => AeroMode::Drs,
            _ => AeroMode::Corner,
        };
        self.inner.set_aero_mode(aero_mode);
    }

    /// Get current active aero mode
    /// Returns: 0 = Corner, 1 = Straight, 2 = DRS
    #[wasm_bindgen]
    pub fn get_aero_mode(&self) -> u8 {
        match self.inner.get_aero_mode() {
            AeroMode::Corner => 0,
            AeroMode::Straight => 1,
            AeroMode::Drs => 2,
        }
    }

    /// Set whether the car is currently inside a DRS zone.
    #[wasm_bindgen]
    pub fn set_drs_zone(&mut self, in_zone: bool) {
        self.inner.set_drs_zone(in_zone);
    }

    /// Force DRS off (call when brake is applied).
    #[wasm_bindgen]
    pub fn disable_drs_on_brake(&mut self) {
        self.inner.disable_drs_on_brake();
    }

    /// Toggle active aero mode between Corner and Straight (manual mode)
    #[wasm_bindgen]
    pub fn toggle_aero_mode(&mut self) {
        self.inner.toggle_aero_mode();
    }

    /// Toggle auto aero mode on/off
    #[wasm_bindgen]
    pub fn toggle_aero_auto(&mut self) {
        self.inner.toggle_aero_auto();
    }

    /// Get current active aero state as JavaScript object
    /// Returns: { mode, frontWingAngle, rearWingAngle, dragMultiplier, downforceMultiplier }
    #[wasm_bindgen]
    pub fn get_active_aero_state(&self) -> JsValue {
        to_value(&self.inner.get_active_aero_state()).unwrap_or(JsValue::NULL)
    }

    // ========================================================================
    // Brake API
    // ========================================================================

    /// Set front brake bias (clamped to 0.50-0.70)
    /// bias: 0.50 to 0.70 (50% to 70% front)
    #[wasm_bindgen]
    pub fn set_brake_bias(&mut self, bias: f32) {
        self.inner.set_brake_bias(bias);
    }

    /// Get current front brake bias
    /// Returns: 0.50 to 0.70
    #[wasm_bindgen]
    pub fn get_brake_bias(&self) -> f32 {
        self.inner.get_brake_bias()
    }

    /// Increase brake bias by 2%
    #[wasm_bindgen]
    pub fn increase_brake_bias(&mut self) {
        self.inner.increase_brake_bias();
    }

    /// Decrease brake bias by 2%
    #[wasm_bindgen]
    pub fn decrease_brake_bias(&mut self) {
        self.inner.decrease_brake_bias();
    }

    /// Set engine braking level
    /// level: 0 = Low, 1 = Medium, 2 = High
    #[wasm_bindgen]
    pub fn set_engine_braking_level(&mut self, level: u8) {
        use types::EngineBrakingLevel;
        let brake_level = match level {
            0 => EngineBrakingLevel::Low,
            1 => EngineBrakingLevel::Medium,
            2 => EngineBrakingLevel::High,
            _ => EngineBrakingLevel::Medium,
        };
        self.inner.set_engine_braking_level(brake_level);
    }

    /// Get current engine braking level
    /// Returns: 0 = Low, 1 = Medium, 2 = High
    #[wasm_bindgen]
    pub fn get_engine_braking_level(&self) -> u8 {
        use types::EngineBrakingLevel;
        match self.inner.get_engine_braking_level() {
            EngineBrakingLevel::Low => 0,
            EngineBrakingLevel::Medium => 1,
            EngineBrakingLevel::High => 2,
        }
    }

    /// Cycle through engine braking levels (Low -> Medium -> High -> Low)
    #[wasm_bindgen]
    pub fn cycle_engine_braking_level(&mut self) {
        self.inner.cycle_engine_braking_level();
    }

    /// Get current brake state as JavaScript object
    /// Returns: { frontBias, engineBraking, frontBrakeForce, rearBrakeForce }
    #[wasm_bindgen]
    pub fn get_brake_state(&self) -> JsValue {
        to_value(&self.inner.get_brake_state()).unwrap_or(JsValue::NULL)
    }

    // ========================================================================
    // Curb API
    // ========================================================================

    /// Set whether the car is on a curb
    #[wasm_bindgen]
    pub fn set_on_curb(
        &mut self,
        is_on_curb: bool,
        side: Option<String>,
        curb_type: Option<String>,
    ) {
        let curb_side = side.and_then(|s| match s.as_str() {
            "left" | "Left" => Some(CurbSide::Left),
            "right" | "Right" => Some(CurbSide::Right),
            _ => None,
        });
        let ct = curb_type
            .map(|s| match s.as_str() {
                "exit" | "Exit" => CurbType::Exit,
                "flat" | "Flat" => CurbType::Flat,
                _ => CurbType::Apex,
            })
            .unwrap_or(CurbType::Apex);
        self.inner.set_on_curb(is_on_curb, curb_side, ct);
    }

    /// Numeric-enum variant of `set_on_curb` (Wave 2 Phase 4).
    /// Avoids per-call `String` allocations on the FFI boundary.
    /// `side`: 0 = none, 1 = left, 2 = right.
    /// `curb_type`: 0 = apex, 1 = exit, 2 = flat.
    /// Out-of-range values fall back to defaults (none / apex).
    #[wasm_bindgen]
    pub fn set_on_curb_numeric(&mut self, is_on_curb: bool, side: u8, curb_type: u8) {
        let curb_side = match side {
            1 => Some(CurbSide::Left),
            2 => Some(CurbSide::Right),
            _ => None,
        };
        let ct = match curb_type {
            1 => CurbType::Exit,
            2 => CurbType::Flat,
            _ => CurbType::Apex,
        };
        self.inner.set_on_curb(is_on_curb, curb_side, ct);
    }

    /// Check if car is on curb
    #[wasm_bindgen]
    pub fn is_on_curb(&self) -> bool {
        self.inner.is_on_curb()
    }

    // ========================================================================
    // Surface API
    // ========================================================================

    /// Set the current surface type (grass, road, curb)
    #[wasm_bindgen]
    pub fn set_surface(&mut self, surface: SurfaceType) {
        self.inner.set_surface(surface);
    }

    /// Get the current surface type
    #[wasm_bindgen]
    pub fn get_surface(&self) -> SurfaceType {
        self.inner.get_surface()
    }

    /// Check if car is on road
    #[wasm_bindgen]
    pub fn is_on_road(&self) -> bool {
        self.inner.is_on_road()
    }

    /// Check if car is off-track (on grass)
    #[wasm_bindgen]
    pub fn is_off_track(&self) -> bool {
        self.inner.is_off_track()
    }

    /// Get current surface modifiers as JavaScript object
    #[wasm_bindgen]
    pub fn get_surface_modifiers(&self) -> JsValue {
        to_value(&self.inner.get_surface_modifiers()).unwrap_or(JsValue::NULL)
    }

    // ========================================================================
    // Pit Lane API
    // ========================================================================

    #[wasm_bindgen]
    pub fn set_pit_lane_active(&mut self, active: bool) {
        self.inner.set_pit_lane_active(active);
    }

    #[wasm_bindgen]
    pub fn is_pit_lane_active(&self) -> bool {
        self.inner.is_pit_lane_active()
    }

    #[wasm_bindgen]
    pub fn set_pit_lane_speed_limit(&mut self, kmh: f32) {
        self.inner.set_pit_lane_speed_limit(kmh);
    }

    #[wasm_bindgen]
    pub fn get_pit_lane_speed_limit_kmh(&self) -> f32 {
        self.inner.get_pit_lane_speed_limit_kmh()
    }

    #[wasm_bindgen]
    pub fn is_pit_lane_speed_limited(&self) -> bool {
        self.inner.is_pit_lane_speed_limited()
    }

    #[wasm_bindgen]
    pub fn get_pit_lane_limiter_blend(&self) -> f32 {
        self.inner.get_pit_lane_limiter_blend()
    }

    // ========================================================================
    // Track Temperature API
    // ========================================================================

    /// Initialize track temperature grid
    #[wasm_bindgen]
    pub fn init_track_temperature(&mut self, cell_size: f32, bounds: JsValue) {
        let track_bounds: TrackBounds = from_value(bounds).unwrap_or_default();
        self.inner.init_track_temperature(cell_size, track_bounds);
    }

    /// Get track temperature texture data (RGBA bytes)
    #[wasm_bindgen]
    pub fn get_track_texture_data(&mut self) -> Vec<u8> {
        self.inner.get_track_texture_data()
    }

    /// Get number of active track temperature cells
    #[wasm_bindgen]
    pub fn get_track_cell_count(&self) -> usize {
        self.inner.get_track_cell_count()
    }

    /// Update track temperature from normal driving (heat generation, road drying)
    /// Call this every frame when car is moving (even without skidding)
    #[wasm_bindgen]
    pub fn update_car_driving(&mut self, x: f32, z: f32, speed_ms: f32, delta: f32) {
        self.inner.update_car_driving(x, z, speed_ms, delta);
    }

    /// Get water depth at a position (0.0 to 1.0)
    #[wasm_bindgen]
    pub fn get_water_depth(&self, x: f32, z: f32) -> f32 {
        self.inner.get_water_depth(x, z)
    }

    /// Set rain exposure for a cell (0.0 = fully sheltered, 1.0 = open sky)
    /// Use this to mark covered areas like tunnels or pit garages
    #[wasm_bindgen]
    pub fn set_rain_exposure(&mut self, x: f32, z: f32, exposure: f32) {
        self.inner.set_rain_exposure(x, z, exposure);
    }

    /// Set drainage rate for a cell (based on track slope)
    /// Higher values mean water drains faster
    #[wasm_bindgen]
    pub fn set_drainage_rate(&mut self, x: f32, z: f32, rate: f32) {
        self.inner.set_drainage_rate(x, z, rate);
    }

    /// Mark a cell as road surface
    /// Road surfaces retain heat better than non-road surfaces,
    /// but lose heat faster when it's raining
    #[wasm_bindgen]
    pub fn set_road_cell(&mut self, x: f32, z: f32, is_road: bool) {
        self.inner.set_road_cell(x, z, is_road);
    }

    /// Mark a rectangular region as road surface
    /// Useful for registering entire road segments at once
    #[wasm_bindgen]
    pub fn set_road_region(
        &mut self,
        min_x: f32,
        min_z: f32,
        max_x: f32,
        max_z: f32,
        is_road: bool,
    ) {
        self.inner
            .set_road_region(min_x, min_z, max_x, max_z, is_road);
    }

    /// Check for aquaplaning conditions at a position
    /// Returns: { is_aquaplaning, intensity, affected_wheels }
    #[wasm_bindgen]
    pub fn check_aquaplaning(&self, x: f32, z: f32, speed_ms: f32) -> JsValue {
        to_value(&self.inner.check_aquaplaning(x, z, speed_ms)).unwrap_or(JsValue::NULL)
    }

    /// Check if tires are currently in thermal shock
    #[wasm_bindgen]
    pub fn is_tire_thermal_shock(&self) -> bool {
        self.inner.is_tire_thermal_shock()
    }

    /// Get current thermal shock state
    /// Returns: { is_shocked, grip_penalty, recovery_time }
    #[wasm_bindgen]
    pub fn get_thermal_shock_state(&self) -> JsValue {
        to_value(&self.inner.get_thermal_shock_state()).unwrap_or(JsValue::NULL)
    }

    /// Update rubber deposits from per-wheel positions (for tire marks)
    ///
    /// # Arguments
    /// * `wheel_positions` - Flat array of 8 floats: [FL_x, FL_z, FR_x, FR_z, RL_x, RL_z, RR_x, RR_z]
    /// * `wheel_intensities` - Array of 4 floats: [FL, FR, RL, RR] intensity (0.0-1.0)
    /// * `delta_seconds` - Time delta
    #[wasm_bindgen]
    pub fn update_rubber_deposits(
        &mut self,
        wheel_positions: &[f32],
        wheel_intensities: &[f32],
        delta_seconds: f32,
    ) {
        if wheel_positions.len() < 8 || wheel_intensities.len() < 4 {
            return;
        }

        let positions = [
            [wheel_positions[0], wheel_positions[1]], // FL
            [wheel_positions[2], wheel_positions[3]], // FR
            [wheel_positions[4], wheel_positions[5]], // RL
            [wheel_positions[6], wheel_positions[7]], // RR
        ];
        let intensities = [
            wheel_intensities[0],
            wheel_intensities[1],
            wheel_intensities[2],
            wheel_intensities[3],
        ];

        self.inner
            .update_rubber_deposits(&positions, &intensities, delta_seconds);
    }

    #[wasm_bindgen]
    pub fn is_track_texture_dirty(&self) -> bool {
        self.inner.is_track_texture_dirty()
    }

    #[wasm_bindgen]
    pub fn get_active_surface_cells(&self) -> Vec<f32> {
        self.inner.get_active_surface_cells()
    }

    /// Get track wetness at a position (for rubber intensity calculation)
    #[wasm_bindgen]
    pub fn get_track_wetness(&self, x: f32, z: f32) -> f32 {
        self.inner.get_track_wetness(x, z)
    }

    /// Get tire compound rubber deposit multiplier
    #[wasm_bindgen]
    pub fn get_rubber_deposit_multiplier(&self) -> f32 {
        self.inner.get_rubber_deposit_multiplier()
    }

    /// Batched rubber frame update — combines updateCarDriving, getRubberDepositMultiplier,
    /// getTrackWetness, and updateRubberDeposits into a single FFI call.
    /// Writes `[compoundMult, wetness]` into the caller-supplied 2-element
    /// `out` buffer. The buffer is reused across frames on the JS side so
    /// the FFI boundary never allocates.
    #[wasm_bindgen]
    pub fn update_rubber_frame(
        &mut self,
        car_x: f32,
        car_z: f32,
        speed_ms: f32,
        delta: f32,
        wheel_positions: &[f32],
        wheel_intensities: &[f32],
        out: &mut [f32],
    ) {
        debug_assert!(
            out.len() >= 2,
            "update_rubber_frame: out buffer must hold at least 2 elements (got {})",
            out.len()
        );
        if out.len() < 2 {
            return;
        }
        if wheel_positions.len() < 8 || wheel_intensities.len() < 4 {
            out[0] = 1.0;
            out[1] = 0.0;
            return;
        }

        let positions = [
            [wheel_positions[0], wheel_positions[1]],
            [wheel_positions[2], wheel_positions[3]],
            [wheel_positions[4], wheel_positions[5]],
            [wheel_positions[6], wheel_positions[7]],
        ];
        let intensities = [
            wheel_intensities[0],
            wheel_intensities[1],
            wheel_intensities[2],
            wheel_intensities[3],
        ];

        let (compound_mult, wetness) =
            self.inner
                .update_rubber_frame(car_x, car_z, speed_ms, delta, &positions, &intensities);
        out[0] = compound_mult;
        out[1] = wetness;
    }

    // ========================================================================
    // Main Physics Step
    // ========================================================================

    /// Main physics step - call every frame
    ///
    /// # Arguments
    /// * `delta_seconds` - Time since last frame in seconds
    /// * `input` - CarInput object with control state
    /// * `car_position` - [x, y, z] world position
    /// * `car_rotation` - [x, y, z, w] quaternion rotation
    /// * `current_linvel` - [x, y, z] current linear velocity
    /// * `current_angvel` - [x, y, z] current angular velocity
    ///
    /// # Returns
    /// CarPhysicsOutput with new velocities and telemetry
    #[wasm_bindgen]
    pub fn step(
        &mut self,
        delta_seconds: f32,
        input: JsValue,
        car_position: JsValue,
        car_rotation: JsValue,
        current_linvel: JsValue,
        current_angvel: JsValue,
        surface_normal: JsValue,
        wheel_loads: JsValue,
    ) -> JsValue {
        let input: CarInput = from_value(input).unwrap_or_default();
        let position: [f32; 3] = from_value(car_position).unwrap_or([0.0, 0.0, 0.0]);
        let rotation: [f32; 4] = from_value(car_rotation).unwrap_or([0.0, 0.0, 0.0, 1.0]);
        let linvel: [f32; 3] = from_value(current_linvel).unwrap_or([0.0, 0.0, 0.0]);
        let angvel: [f32; 3] = from_value(current_angvel).unwrap_or([0.0, 0.0, 0.0]);
        let normal: [f32; 3] = from_value(surface_normal).unwrap_or([0.0, 1.0, 0.0]);
        let loads: Option<[f32; 4]> = parse_wheel_loads(wheel_loads);

        let output = self.inner.step(
            delta_seconds,
            input,
            position,
            rotation,
            linvel,
            angvel,
            normal,
            loads,
        );
        to_value(&output).unwrap_or(JsValue::NULL)
    }

    // ========================================================================
    // Batched Step + Sync (fewer FFI calls per frame)
    // ========================================================================

    /// Combined physics step + state sync in one FFI call
    /// Returns physics output + wind state + aero state + brake state
    #[wasm_bindgen]
    pub fn step_and_sync(
        &mut self,
        delta_seconds: f32,
        input: JsValue,
        car_position: JsValue,
        car_rotation: JsValue,
        current_linvel: JsValue,
        current_angvel: JsValue,
        surface_normal: JsValue,
        wheel_loads: JsValue,
    ) -> JsValue {
        let input: CarInput = from_value(input).unwrap_or_default();
        let position: [f32; 3] = from_value(car_position).unwrap_or([0.0, 0.0, 0.0]);
        let rotation: [f32; 4] = from_value(car_rotation).unwrap_or([0.0, 0.0, 0.0, 1.0]);
        let linvel: [f32; 3] = from_value(current_linvel).unwrap_or([0.0, 0.0, 0.0]);
        let angvel: [f32; 3] = from_value(current_angvel).unwrap_or([0.0, 0.0, 0.0]);
        let normal: [f32; 3] = from_value(surface_normal).unwrap_or([0.0, 1.0, 0.0]);
        let loads: Option<[f32; 4]> = parse_wheel_loads(wheel_loads);

        let output = self.inner.step_and_sync(
            delta_seconds,
            input,
            position,
            rotation,
            linvel,
            angvel,
            normal,
            loads,
        );
        to_value(&output).unwrap_or(JsValue::NULL)
    }

    /// Packed-payload variant of `step_and_sync` (Wave 2 Phase 3).
    /// Reads all numeric per-step input from a single `Float32Array`
    /// instead of 6 individual `JsValue` deserializes. JS-side caller
    /// owns the buffer and writes into it once per frame; Rust reads as
    /// a borrowed slice with no allocation. `CarInput` booleans are
    /// packed into `input_bits`:
    ///   bit 0 forward, bit 1 backward, bit 2 left, bit 3 right,
    ///   bit 4 brake,   bit 5 handbrake.
    /// Payload layout (25 floats):
    ///   [0] dt
    ///   [1] throttle
    ///   [2] steer
    ///   [3] brake_analog
    ///   [4] _reserved (zero)
    ///   [5..8]  car_position xyz
    ///   [8..12] car_rotation xyzw
    ///   [12..15] current_linvel xyz
    ///   [15..18] current_angvel xyz
    ///   [18..21] surface_normal xyz
    ///   [21..25] wheel_loads fl/fr/rl/rr
    /// `wheel_loads` is treated as "no signal" (engine fallback) when
    /// the four-wheel sum < `WHEEL_LOADS_MIN_TOTAL_N` (matches the
    /// legacy `parse_wheel_loads` semantics).
    #[wasm_bindgen]
    pub fn step_and_sync_packed(&mut self, payload: &[f32], input_bits: u32) -> JsValue {
        if payload.len() < 25 {
            return JsValue::NULL;
        }
        let input = CarInput {
            forward: (input_bits & 0b0000_0001) != 0,
            backward: (input_bits & 0b0000_0010) != 0,
            left: (input_bits & 0b0000_0100) != 0,
            right: (input_bits & 0b0000_1000) != 0,
            brake: (input_bits & 0b0001_0000) != 0,
            handbrake: (input_bits & 0b0010_0000) != 0,
            steer: payload[2],
            throttle: payload[1],
            brake_analog: payload[3],
        };
        let position = [payload[5], payload[6], payload[7]];
        let rotation = [payload[8], payload[9], payload[10], payload[11]];
        let linvel = [payload[12], payload[13], payload[14]];
        let angvel = [payload[15], payload[16], payload[17]];
        let normal = [payload[18], payload[19], payload[20]];
        let raw_loads = [payload[21], payload[22], payload[23], payload[24]];
        let loads = if raw_loads.iter().all(|v| v.is_finite())
            && raw_loads.iter().sum::<f32>() >= WHEEL_LOADS_MIN_TOTAL_N
        {
            Some(raw_loads)
        } else {
            None
        };

        let output = self.inner.step_and_sync(
            payload[0], input, position, rotation, linvel, angvel, normal, loads,
        );
        to_value(&output).unwrap_or(JsValue::NULL)
    }

    // ========================================================================
    // Terrain API
    // ========================================================================

    #[wasm_bindgen]
    pub fn init_terrain(&mut self, cell_size: f32, origin_x: f32, origin_z: f32) {
        self.inner.init_terrain(cell_size, origin_x, origin_z);
    }

    #[wasm_bindgen]
    pub fn set_terrain_cell(&mut self, x: f32, z: f32, height: f32, material_id: u8) {
        self.inner
            .set_terrain_cell(x, z, height, TerrainMaterial::from_u8(material_id));
    }

    #[wasm_bindgen]
    pub fn set_terrain_region(
        &mut self,
        min_x: f32,
        min_z: f32,
        max_x: f32,
        max_z: f32,
        height: f32,
        material_id: u8,
    ) {
        self.inner.set_terrain_region(
            min_x,
            min_z,
            max_x,
            max_z,
            height,
            TerrainMaterial::from_u8(material_id),
        );
    }

    #[wasm_bindgen]
    pub fn set_terrain_height(&mut self, x: f32, z: f32, height: f32) {
        self.inner
            .set_terrain_cell(x, z, height, TerrainMaterial::Asphalt);
    }

    #[wasm_bindgen]
    pub fn query_terrain(&self, x: f32, z: f32) -> JsValue {
        match self.inner.query_terrain(x, z) {
            Some(result) => to_value(&result).unwrap_or(JsValue::NULL),
            None => JsValue::NULL,
        }
    }

    #[wasm_bindgen]
    pub fn is_terrain_initialized(&self) -> bool {
        self.inner.is_terrain_initialized()
    }

    #[wasm_bindgen]
    pub fn load_terrain_heightmap(
        &mut self,
        data: &[f32],
        width: u32,
        height: u32,
        origin_x: f32,
        origin_z: f32,
        cell_size: f32,
    ) {
        self.inner.init_terrain(cell_size, origin_x, origin_z);
        for z in 0..height {
            for x in 0..width {
                let idx = (z * width + x) as usize;
                if idx < data.len() {
                    let world_x = origin_x + x as f32 * cell_size;
                    let world_z = origin_z + z as f32 * cell_size;
                    self.inner.set_terrain_cell(
                        world_x,
                        world_z,
                        data[idx],
                        TerrainMaterial::Asphalt,
                    );
                }
            }
        }
    }

    #[wasm_bindgen]
    pub fn clear_terrain(&mut self) {
        self.inner.clear_terrain();
    }

    // ========================================================================
    // Debug API
    // ========================================================================

    /// Get debug information as JavaScript object
    #[wasm_bindgen]
    pub fn get_debug_state(&self) -> JsValue {
        let info = self.inner.get_debug_info();
        JsValue::from_str(&format!("{:?}", info))
    }
}

impl Default for PhysicsEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// Total per-wheel-load floor below which we treat the array as "no signal"
/// and let the engine fall back to its quasi-static estimate. A car at rest
/// pushes ~7830 N total; this picks up undefined/null/all-zero arrays from JS.
const WHEEL_LOADS_MIN_TOTAL_N: f32 = 1.0;

/// Deserialize the optional `wheel_loads` FFI arg from JS. Returns `None`
/// (engine uses fallback) when the value is undefined/null, fails to parse,
/// contains non-finite entries, or sums below the no-signal floor.
fn parse_wheel_loads(value: JsValue) -> Option<[f32; 4]> {
    if value.is_undefined() || value.is_null() {
        return None;
    }
    let loads: [f32; 4] = from_value(value).ok()?;
    let mut sum = 0.0_f32;
    for v in &loads {
        if !v.is_finite() {
            return None;
        }
        sum += v;
    }
    if sum < WHEEL_LOADS_MIN_TOTAL_N {
        return None;
    }
    Some(loads)
}
