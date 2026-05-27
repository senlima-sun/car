#![allow(dead_code)]

mod active_aero;
mod brakes;
mod car_physics;
pub mod constants;
mod curb;
pub mod engine;
mod engine_temp;
mod ers;
mod pit_lane;
mod surface;
mod terrain;
mod tires;
pub mod track_geometry;
mod track_temperature;
pub mod types;
pub mod utils;
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
    track_centerline: Option<track_geometry::Polyline>,
    off_track_state: track_geometry::OffTrackState,
}

#[derive(serde::Serialize)]
struct OffTrackJsResult {
    #[serde(rename = "isOffTrack")]
    is_off_track: bool,
    #[serde(rename = "maxLateralDistance")]
    max_lateral_distance: f32,
    #[serde(rename = "hasTrackData")]
    has_track_data: bool,
    /// Per-wheel lateral distance [FL, FR, RL, RR]. Used by debug tooling
    /// (track-limit snapshot) to render exact wheel positions vs centerline.
    #[serde(rename = "wheelLateralDistances", default)]
    wheel_lateral_distances: [f32; 4],
    /// Engine's off-track enter threshold (m past half_width) used this call.
    /// Surfaced so the snapshot can draw the actual trigger ring.
    #[serde(rename = "enterThresholdM", default)]
    enter_threshold_m: f32,
    /// Track half-width used this call. Surfaced for snapshot rendering.
    #[serde(rename = "halfWidthM", default)]
    half_width_m: f32,
}

// Mirrors apps/game/src/constants/dimensions.ts TRACK_WIDTH = 12 (and ROAD_HALF_WIDTH).
// All in-game tracks share one width; per-track widths can be threaded through later
// if Phase 5 needs them.
const TRACK_HALF_WIDTH_M: f32 = 6.0;

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
            track_centerline: None,
            off_track_state: track_geometry::OffTrackState::new(),
        }
    }

    // ========================================================================
    // Track Geometry API (Phase 1 Step 1.3)
    // ========================================================================

    /// Upload the track centerline polyline as a flat `[x0, z0, x1, z1, ...]`
    /// `Float32Array`. Currently always treated as a closed loop. Resets the
    /// cached off-track hysteresis state so a fresh track doesn't inherit
    /// the previous lap's cursor.
    #[wasm_bindgen]
    pub fn set_track_centerline(&mut self, flat: &[f32]) {
        if let Some(polyline) = track_geometry::polyline_from_flat(flat, true) {
            self.track_centerline = Some(polyline);
            self.off_track_state = track_geometry::OffTrackState::new();
        }
    }

    /// Whether a track centerline has been uploaded via `set_track_centerline`.
    #[wasm_bindgen]
    pub fn has_track_centerline(&self) -> bool {
        self.track_centerline.is_some()
    }

    /// Geometry-driven off-track detection (Phase 1 Step 1.3). Returns
    /// `{ isOffTrack, maxLateralDistance, hasTrackData }`. When no centerline
    /// has been uploaded, `hasTrackData` is `false` and the call is a no-op
    /// so callers can fall back to the legacy surface-driven signal.
    #[wasm_bindgen]
    pub fn check_off_track_geom(
        &mut self,
        car_pos_x: f32,
        car_pos_z: f32,
        qx: f32,
        qy: f32,
        qz: f32,
        qw: f32,
    ) -> JsValue {
        use crate::constants::car::{
            TIRE_HALF_WIDTH_FRONT, TIRE_HALF_WIDTH_REAR, TRACK_WIDTH_FRONT, TRACK_WIDTH_REAR,
            WHEELBASE,
        };

        let polyline = match self.track_centerline.as_ref() {
            Some(p) => p,
            None => {
                return to_value(&OffTrackJsResult {
                    is_off_track: false,
                    max_lateral_distance: 0.0,
                    has_track_data: false,
                    wheel_lateral_distances: [0.0; 4],
                    enter_threshold_m: track_geometry::DEFAULT_ENTER_THRESHOLD_M,
                    half_width_m: TRACK_HALF_WIDTH_M,
                })
                .unwrap_or(JsValue::NULL);
            }
        };

        let result = track_geometry::check_off_track(
            polyline,
            car_pos_x,
            car_pos_z,
            qx,
            qy,
            qz,
            qw,
            TRACK_HALF_WIDTH_M,
            track_geometry::DEFAULT_ENTER_THRESHOLD_M,
            track_geometry::DEFAULT_EXIT_THRESHOLD_M,
            WHEELBASE,
            TRACK_WIDTH_FRONT,
            TRACK_WIDTH_REAR,
            TIRE_HALF_WIDTH_FRONT,
            TIRE_HALF_WIDTH_REAR,
            self.off_track_state,
        );

        self.off_track_state = track_geometry::OffTrackState {
            is_off_track: result.is_off_track,
            arc_cursor: result.arc_cursor,
        };

        to_value(&OffTrackJsResult {
            is_off_track: result.is_off_track,
            max_lateral_distance: result.max_lateral_distance_m,
            has_track_data: true,
            wheel_lateral_distances: result.wheel_lateral_distances_m,
            enter_threshold_m: track_geometry::DEFAULT_ENTER_THRESHOLD_M,
            half_width_m: TRACK_HALF_WIDTH_M,
        })
        .unwrap_or(JsValue::NULL)
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
    pub fn add_weather_source(
        &mut self,
        x: f32,
        z: f32,
        radius: f32,
        intensity: f32,
        vx: f32,
        vz: f32,
    ) -> bool {
        self.inner
            .add_weather_source(crate::weather::WeatherSource::new(
                x, z, radius, intensity, vx, vz,
            ))
    }

    #[wasm_bindgen]
    pub fn clear_weather_sources(&mut self) {
        self.inner.clear_weather_sources();
    }

    #[wasm_bindgen]
    pub fn replace_weather_sources(&mut self, flat: &[f32]) {
        let mut sources: Vec<crate::weather::WeatherSource> = Vec::new();
        for chunk in flat.chunks_exact(6) {
            sources.push(crate::weather::WeatherSource::new(
                chunk[0], chunk[1], chunk[2], chunk[3], chunk[4], chunk[5],
            ));
        }
        self.inner.replace_weather_sources(&sources);
    }

    #[wasm_bindgen]
    pub fn get_weather_source_count(&self) -> usize {
        self.inner.get_weather_sources().len()
    }

    #[wasm_bindgen]
    pub fn get_weather_source_data(&self) -> Vec<f32> {
        let sources = self.inner.get_weather_sources();
        let mut out = Vec::with_capacity(sources.len() * 6);
        for s in sources {
            out.push(s.position.0);
            out.push(s.position.1);
            out.push(s.radius);
            out.push(s.intensity);
            out.push(s.velocity.0);
            out.push(s.velocity.1);
        }
        out
    }

    #[wasm_bindgen]
    pub fn sample_weather_intensity(&self, x: f32, z: f32) -> f32 {
        self.inner.sample_weather_intensity_at(x, z)
    }

    #[wasm_bindgen]
    pub fn get_weather_source_max() -> usize {
        crate::weather::MAX_WEATHER_SOURCES
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

    /// Clear blown-tire latch and per-wheel blowout risk. Call from the
    /// JS respawn path so heat-blown tires don't persist across game-
    /// mode transitions.
    #[wasm_bindgen]
    pub fn reset_tire_blowout(&mut self) {
        self.inner.reset_tire_blowout();
    }

    /// Driver requests Overtake Mode (2026 DRS replacement).
    /// Holds the request between frames; pass `false` to release.
    #[wasm_bindgen]
    pub fn set_override_requested(&mut self, requested: bool) {
        self.inner.set_override_requested(requested);
    }

    /// Proximity gate for Overtake Mode (FIA 2026: within 1.0s of car
    /// ahead at detection point). Host must call this each lap or per
    /// timing-sector when running multi-car races. Defaults to `true`
    /// for single-car / dev compatibility.
    #[wasm_bindgen]
    pub fn set_override_proximity_eligible(&mut self, eligible: bool) {
        self.inner.set_override_proximity_eligible(eligible);
    }

    /// Read the current proximity-gate state. Hosts can assert this
    /// was wired before counting on the regulation to bind.
    #[wasm_bindgen]
    pub fn get_override_proximity_eligible(&self) -> bool {
        self.inner.get_override_proximity_eligible()
    }

    /// Toggle the Wave-2 force-shaped lateral-dynamics path. When `true`,
    /// body lateral velocity integrates total wheel lateral force and
    /// yaw rate derives from the bicycle centripetal model. When `false`
    /// (default), the legacy Ackermann + lateral-correction-damper path
    /// runs unchanged.
    #[wasm_bindgen]
    pub fn set_force_shaped_lateral(&mut self, enabled: bool) {
        self.inner.set_force_shaped_lateral(enabled);
    }

    #[wasm_bindgen]
    pub fn force_shaped_lateral(&self) -> bool {
        self.inner.force_shaped_lateral()
    }

    /// Override Mode budget used this lap (0.0..1.0).
    #[wasm_bindgen]
    pub fn get_override_energy_used_pct(&self) -> f32 {
        self.inner.get_override_energy_used_pct()
    }

    /// Reset Override Mode budget on lap rollover.
    #[wasm_bindgen]
    pub fn reset_override_lap_budget(&mut self) {
        self.inner.reset_override_lap_budget();
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

    /// Get current intake-manifold boost pressure (bar absolute, [1.0, 4.8]).
    #[wasm_bindgen]
    pub fn get_boost_pressure_bar(&self) -> f32 {
        self.inner.get_boost_pressure_bar()
    }

    /// Residual fuel mass (kg). Decreases as the ICE consumes fuel.
    #[wasm_bindgen]
    pub fn get_fuel_mass_kg(&self) -> f32 {
        self.inner.get_fuel_mass_kg()
    }

    /// Last frame's FIA-cap fuel-flow factor (`[0, 1]`).
    #[wasm_bindgen]
    pub fn get_fuel_flow_factor(&self) -> f32 {
        self.inner.get_fuel_flow_factor()
    }

    /// Set fuel mass (refuel / scenario reset). Clamped to tank capacity.
    #[wasm_bindgen]
    pub fn set_fuel_mass_kg(&mut self, kg: f32) {
        self.inner.set_fuel_mass_kg(kg);
    }

    /// Get current fuel mix mode (0=lean, 1=standard, 2=rich).
    #[wasm_bindgen]
    pub fn get_fuel_mix_mode(&self) -> u8 {
        self.inner.get_fuel_mix_mode_u8()
    }

    /// Set fuel mix mode (0=lean, 1=standard, 2=rich). Invalid → standard.
    #[wasm_bindgen]
    pub fn set_fuel_mix_mode(&mut self, mode: u8) {
        self.inner.set_fuel_mix_mode_u8(mode);
    }

    /// LSD preload torque in Nm (resists Δω at zero input torque).
    #[wasm_bindgen]
    pub fn get_diff_preload_nm(&self) -> f32 {
        self.inner.get_diff_preload_nm()
    }

    /// LSD power-side ramp angle in degrees (smaller = tighter lock).
    #[wasm_bindgen]
    pub fn get_diff_power_ramp_deg(&self) -> f32 {
        self.inner.get_diff_power_ramp_deg()
    }

    /// LSD coast-side ramp angle in degrees (smaller = tighter lock).
    #[wasm_bindgen]
    pub fn get_diff_coast_ramp_deg(&self) -> f32 {
        self.inner.get_diff_coast_ramp_deg()
    }

    /// Set LSD preload torque (Nm). Clamped to [0, 300].
    #[wasm_bindgen]
    pub fn set_diff_preload_nm(&mut self, nm: f32) {
        self.inner.set_diff_preload_nm(nm);
    }

    /// Set LSD power-side ramp angle (deg). Clamped to [5, 89].
    #[wasm_bindgen]
    pub fn set_diff_power_ramp_deg(&mut self, deg: f32) {
        self.inner.set_diff_power_ramp_deg(deg);
    }

    /// Set LSD coast-side ramp angle (deg). Clamped to [5, 89].
    #[wasm_bindgen]
    pub fn set_diff_coast_ramp_deg(&mut self, deg: f32) {
        self.inner.set_diff_coast_ramp_deg(deg);
    }

    /// Driveshaft torsional stiffness (Nm/rad).
    #[wasm_bindgen]
    pub fn get_shaft_stiffness_nm_rad(&self) -> f32 {
        self.inner.get_shaft_stiffness_nm_rad()
    }

    /// Driveshaft torsional damping (Nm·s/rad).
    #[wasm_bindgen]
    pub fn get_shaft_damping_nm_s_rad(&self) -> f32 {
        self.inner.get_shaft_damping_nm_s_rad()
    }

    /// Set driveshaft stiffness (Nm/rad). Clamped to [1k, 50k].
    #[wasm_bindgen]
    pub fn set_shaft_stiffness_nm_rad(&mut self, k: f32) {
        self.inner.set_shaft_stiffness_nm_rad(k);
    }

    /// Set driveshaft damping (Nm·s/rad). Clamped to [0, 500].
    #[wasm_bindgen]
    pub fn set_shaft_damping_nm_s_rad(&mut self, c: f32) {
        self.inner.set_shaft_damping_nm_s_rad(c);
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

    /// Toggle ABS. Off by default (F1 regulation); arcade/track-day modes
    /// flip on. When on, the per-wheel slip-ratio gate auto-releases
    /// brake torque to keep wheels from locking.
    #[wasm_bindgen]
    pub fn set_abs_enabled(&mut self, enabled: bool) {
        self.inner.set_abs_enabled(enabled);
    }

    #[wasm_bindgen]
    pub fn is_abs_enabled(&self) -> bool {
        self.inner.is_abs_enabled()
    }

    /// Get current brake state as JavaScript object
    /// Returns: { frontBias, engineBraking, frontBrakeForce, rearBrakeForce, absEnabled }
    #[wasm_bindgen]
    pub fn get_brake_state(&self) -> JsValue {
        to_value(&self.inner.get_brake_state()).unwrap_or(JsValue::NULL)
    }

    // ========================================================================
    // Curb API
    // ========================================================================

    /// Set whether the car is on a curb. Numeric-enum FFI; avoids
    /// per-call `String` allocations on the boundary.
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
            // Best-effort default for direct WASM consumers in release
            // (debug already panicked above). compoundMult defaults to
            // 1.0 (no-op multiplier), wetness to 0.0 — same as the
            // wheel_positions.len() < 8 branch below.
            if let Some(slot) = out.first_mut() {
                *slot = 1.0;
            }
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
    ///
    /// Wave 2 superseded: prefer `step_and_sync_packed`. This export
    /// stays for the JS `stepPhysics()` wrapper but is dead-code-eliminated
    /// by LTO when no JS caller uses it.
    #[allow(deprecated)]
    #[deprecated(note = "Use step_and_sync_packed instead (Wave 2 Phase 3)")]
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

    /// Combined physics step + state sync in one FFI call.
    ///
    /// Wave 2 superseded: `step_and_sync_packed` replaces 6 separate
    /// `serde_wasm_bindgen::from_value` deserializations with a single
    /// Float32Array slice borrow. This positional-JsValue export is kept
    /// for backward compat / direct WASM consumers; LTO + codegen-units=1
    /// DCE it from the release binary if no JS path uses it.
    #[allow(deprecated)]
    #[deprecated(note = "Use step_and_sync_packed instead (Wave 2 Phase 3)")]
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

    /// Packed-payload variant of `step_and_sync` (Wave 2 Phase 3, extended
    /// to 27 floats by Wave 3 Phase 3 with backward-compatible parsing).
    /// Reads all numeric per-step input from a single `Float32Array`
    /// instead of 6 individual `JsValue` deserializes. JS-side caller
    /// owns the buffer and writes into it once per frame; Rust reads as
    /// a borrowed slice with no allocation. `CarInput` booleans are
    /// packed into `input_bits`:
    ///   bit 0 forward, bit 1 backward, bit 2 left, bit 3 right,
    ///   bit 4 brake,   bit 5 handbrake.
    /// Payload layout (27 floats; legacy 25-float callers still work):
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
    ///   [25] front_axle_ride_height_m  (Wave 3 Phase 3, optional)
    ///   [26] rear_axle_ride_height_m   (Wave 3 Phase 3, optional)
    /// `wheel_loads` is treated as "no signal" (engine fallback) when
    /// the four-wheel sum < `WHEEL_LOADS_MIN_TOTAL_N` (matches the
    /// legacy `parse_wheel_loads` semantics). Missing or non-finite
    /// per-axle ride heights default to `RIDE_HEIGHT_OPTIMAL_M` so the
    /// ground-effect multiplier evaluates to 1.0 (Wave 2 behaviour).
    #[wasm_bindgen]
    pub fn step_and_sync_packed(&mut self, payload: &[f32], input_bits: u32) -> JsValue {
        if payload.len() < 25 {
            return JsValue::NULL;
        }
        // Defense-in-depth: the JS bridge sanitizes via `sanitize`/`sanitizeVec3`
        // but a direct WASM caller (or a future scratch-buffer reuse bug) could
        // hand us a NaN. Reject the whole frame instead of letting NaN
        // propagate into the physics step.
        let finite_window = payload.len().min(27);
        if !payload[..finite_window].iter().all(|v| v.is_finite()) {
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

        // Wave 3 Phase 3: per-axle ride heights are optional FFI inputs.
        // 25-float legacy callers default to RIDE_HEIGHT_OPTIMAL_M, which
        // produces a ground-effect multiplier of 1.0 (no behaviour change).
        let optimal = crate::car_physics::aerodynamics::RIDE_HEIGHT_OPTIMAL_M;
        let (front_h, rear_h) = if payload.len() >= 27 {
            (payload[25], payload[26])
        } else {
            (optimal, optimal)
        };
        self.inner
            .update_ride_height(front_h, rear_h, payload[0]);

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
