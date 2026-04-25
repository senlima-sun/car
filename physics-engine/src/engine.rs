use crate::active_aero::ActiveAeroPhysicsState;
use crate::brakes::BrakePhysicsState;
use crate::car_physics::weight_transfer::calculate_weight_transfer;
use crate::car_physics::CarPhysicsState;
use crate::constants::car::{BASE_BRAKE_FORCE, CAR_MASS, TRACK_WIDTH, WHEELBASE};
use crate::curb::CurbState;
use crate::engine_temp::EngineTemperatureState;
use crate::ers::ErsPhysicsState;
use crate::pit_lane::PitLaneState;
use crate::surface::SurfaceState;
use crate::terrain::{check_bottoming_out_from_height, TerrainGrid};
use crate::tires::{TempInput, TireMaterialSystem, TireState, TireTemperatureState, WearInput};
use crate::track_temperature::TrackTemperatureGrid;
use crate::types::{
    AeroMode, AmbientConditions, AmbientEnvironment, AquaplaningState, BrakeState, CarInput,
    CarPhysicsOutput, CurbSide, CurbType, EngineBrakingLevel, ErsMode, GripBreakdown,
    PerWheelTerrain, PerWheelWear, SemiAutoConfig, SemiAutoPreset, SurfaceFrictionBreakdown,
    SurfaceModifiers, SurfaceType, TemperatureOutput, TerrainMaterial, TerrainQueryResult,
    TireCompound, TireThermalShock, TrackBounds, WeatherModifiers, WindModifiers, WindState,
};
use crate::utils::{Quat, Vec3};
use crate::weather::WeatherState;

const TRACK_WEATHER_UPDATE_INTERVAL: f32 = 1.0 / 30.0;

/// Main physics engine that orchestrates all physics systems
#[derive(Debug)]
pub struct PhysicsEngine {
    weather: WeatherState,
    wind: WindState,
    tires: TireState,
    tire_temperature: TireTemperatureState,
    engine_temperature: EngineTemperatureState,
    ers: ErsPhysicsState,
    active_aero: ActiveAeroPhysicsState,
    brakes: BrakePhysicsState,
    track_temperature: TrackTemperatureGrid,
    curb: CurbState,
    surface: SurfaceState,
    pit_lane: PitLaneState,
    car: CarPhysicsState,
    tire_material: TireMaterialSystem,
    terrain: Option<TerrainGrid>,
    prev_wheel_terrain: [TerrainQueryResult; 4],
    terrain_step_counter: u32,
    cached_terrain_results: Option<[TerrainQueryResult; 4]>,
    cached_wheel_positions: Option<[[f32; 2]; 4]>,
    track_weather_accumulator: f32,
}

impl Default for PhysicsEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl PhysicsEngine {
    pub fn new() -> Self {
        Self {
            weather: WeatherState::new(),
            wind: WindState::default(),
            tires: TireState::new(),
            tire_temperature: TireTemperatureState::new(),
            engine_temperature: EngineTemperatureState::new(),
            ers: ErsPhysicsState::new(),
            active_aero: ActiveAeroPhysicsState::new(),
            brakes: BrakePhysicsState::new(),
            track_temperature: TrackTemperatureGrid::default(),
            curb: CurbState::new(),
            surface: SurfaceState::new(),
            pit_lane: PitLaneState::new(),
            car: CarPhysicsState::new(),
            tire_material: TireMaterialSystem::new(TireCompound::Medium),
            terrain: None,
            prev_wheel_terrain: Default::default(),
            terrain_step_counter: 0,
            cached_terrain_results: None,
            cached_wheel_positions: None,
            track_weather_accumulator: 0.0,
        }
    }

    fn wheel_cache_stale(&self, current_wheel_positions: &[[f32; 2]; 4], max_delta_m: f32) -> bool {
        let Some(cached_positions) = self.cached_wheel_positions else {
            return true;
        };
        let max_delta_sq = max_delta_m * max_delta_m;
        cached_positions
            .iter()
            .zip(current_wheel_positions.iter())
            .any(|(cached, current)| {
                let dx = current[0] - cached[0];
                let dz = current[1] - cached[1];
                dx * dx + dz * dz > max_delta_sq
            })
    }

    // ========================================================================
    // Weather API
    // ========================================================================

    pub fn get_weather_modifiers(&self) -> WeatherModifiers {
        *self.weather.get_modifiers()
    }

    pub fn get_ambient_conditions(&self) -> AmbientConditions {
        self.weather.get_ambient_conditions()
    }

    pub fn set_custom_weather(&mut self, celsius: f32, humidity: f32, rain_intensity: f32) {
        self.weather
            .set_custom_ambient(celsius, humidity, rain_intensity);
    }

    pub fn set_environment(&mut self, env: AmbientEnvironment) {
        self.weather.set_environment(env);
    }

    pub fn get_environment(&self) -> AmbientEnvironment {
        *self.weather.get_environment()
    }

    pub fn get_air_density(&self) -> f32 {
        self.weather.get_air_density()
    }

    pub fn get_surface_friction_breakdown(&self) -> SurfaceFrictionBreakdown {
        self.weather.get_surface_friction_breakdown()
    }

    pub fn get_rain_intensity(&self) -> f32 {
        self.weather.get_rain_intensity()
    }

    // ========================================================================
    // Wind API
    // ========================================================================

    pub fn set_wind(&mut self, direction: f32, speed: f32) {
        self.wind.set_wind(direction, speed);
    }

    pub fn set_wind_enabled(&mut self, enabled: bool) {
        self.wind.set_enabled(enabled);
    }

    pub fn is_wind_enabled(&self) -> bool {
        self.wind.enabled
    }

    pub fn get_wind_state(&self) -> WindState {
        self.wind
    }

    pub fn get_wind_modifiers(&self, car_heading: f32, car_speed: f32) -> WindModifiers {
        self.wind.calculate_modifiers(car_heading, car_speed)
    }

    // ========================================================================
    // Tire API
    // ========================================================================

    pub fn set_tire_compound(&mut self, compound: TireCompound) {
        self.tires.set_compound(compound);
        self.tire_material.set_compound(compound);
    }

    pub fn get_tire_compound(&self) -> TireCompound {
        self.tires.get_compound()
    }

    pub fn get_tire_wear(&self) -> f32 {
        self.tires.get_wear()
    }

    pub fn reset_tire_wear(&mut self) {
        self.tires.reset_wear();
    }

    pub fn set_tire_wear(&mut self, wear: f32) {
        self.tires.set_wear_all(wear);
    }

    pub fn get_effective_grip(&self) -> f32 {
        let ambient = self.weather.get_ambient_conditions();
        self.tires.calculate_effective_grip_from_ambient(&ambient)
    }

    pub fn get_tire_wear_per_wheel(&self) -> PerWheelWear {
        self.tires.get_per_wheel_wear()
    }

    // ========================================================================
    // ERS API
    // ========================================================================

    pub fn set_ers_mode(&mut self, mode: ErsMode) {
        self.ers.set_mode(mode);
    }

    pub fn get_ers_mode(&self) -> ErsMode {
        self.ers.get_mode()
    }

    pub fn get_ers_state(&self) -> crate::types::ErsState {
        self.ers.get_state()
    }

    pub fn reset_ers_lap(&mut self) {
        self.ers.reset_lap();
    }

    pub fn get_ers_battery_charge(&self) -> f32 {
        self.ers.get_battery_charge()
    }

    pub fn set_ers_battery_charge(&mut self, charge: f32) {
        self.ers.set_battery_charge(charge);
    }

    pub fn set_ers_overtake_available(&mut self, available: bool) {
        self.ers.set_overtake_available(available);
    }

    // ========================================================================
    // Semi-Auto ERS API
    // ========================================================================

    pub fn set_ers_semi_auto_preset(&mut self, preset: SemiAutoPreset) {
        self.ers.set_semi_auto_preset(preset);
    }

    pub fn get_ers_semi_auto_preset(&self) -> SemiAutoPreset {
        self.ers.get_semi_auto_config().preset
    }

    pub fn get_ers_semi_auto_config(&self) -> SemiAutoConfig {
        self.ers.get_semi_auto_config()
    }

    pub fn set_ers_lap_mode(&mut self, enabled: bool) {
        self.ers.set_lap_mode(enabled);
    }

    pub fn set_ers_expert_mode(&mut self, enabled: bool) {
        self.ers.set_expert_mode(enabled);
    }

    pub fn activate_ers_overtake(&mut self) {
        self.ers.activate_overtake_override();
    }

    pub fn deactivate_ers_overtake(&mut self) {
        self.ers.deactivate_overtake_override();
    }

    pub fn is_ers_overtake_override(&self) -> bool {
        self.ers.is_overtake_override()
    }

    // ========================================================================
    // Active Aero API
    // ========================================================================

    pub fn set_aero_mode(&mut self, mode: AeroMode) {
        self.active_aero.set_mode(mode);
    }

    pub fn get_aero_mode(&self) -> AeroMode {
        self.active_aero.get_mode()
    }

    pub fn toggle_aero_mode(&mut self) {
        self.active_aero.toggle_mode();
    }

    pub fn toggle_aero_auto(&mut self) {
        self.active_aero.toggle_auto();
    }

    pub fn get_active_aero_state(&self) -> crate::types::ActiveAeroState {
        self.active_aero.get_state()
    }

    /// Mark DRS zone eligibility. Outside a zone, `AeroMode::Drs`
    /// degrades to Straight.
    pub fn set_drs_zone(&mut self, in_zone: bool) {
        self.active_aero.set_drs_zone(in_zone);
    }

    /// Auto-disable DRS (call when driver applies brake).
    pub fn disable_drs_on_brake(&mut self) {
        self.active_aero.disable_drs_on_brake();
    }

    // ========================================================================
    // Brake API
    // ========================================================================

    pub fn set_brake_bias(&mut self, bias: f32) {
        self.brakes.set_brake_bias(bias);
    }

    pub fn get_brake_bias(&self) -> f32 {
        self.brakes.get_brake_bias()
    }

    pub fn increase_brake_bias(&mut self) {
        self.brakes.increase_brake_bias();
    }

    pub fn decrease_brake_bias(&mut self) {
        self.brakes.decrease_brake_bias();
    }

    pub fn set_engine_braking_level(&mut self, level: EngineBrakingLevel) {
        self.brakes.set_engine_braking_level(level);
    }

    pub fn get_engine_braking_level(&self) -> EngineBrakingLevel {
        self.brakes.get_engine_braking_level()
    }

    pub fn cycle_engine_braking_level(&mut self) {
        self.brakes.cycle_engine_braking_level();
    }

    pub fn get_brake_state(&self) -> BrakeState {
        self.brakes.get_state()
    }

    // ========================================================================
    // Curb API
    // ========================================================================

    pub fn set_on_curb(&mut self, is_on_curb: bool, side: Option<CurbSide>, curb_type: CurbType) {
        self.curb.set_on_curb(is_on_curb, side, curb_type);
    }

    pub fn is_on_curb(&self) -> bool {
        self.curb.is_on_curb()
    }

    // ========================================================================
    // Surface API
    // ========================================================================

    pub fn set_surface(&mut self, surface: SurfaceType) {
        self.surface.set_surface(surface);
    }

    pub fn get_surface(&self) -> SurfaceType {
        self.surface.get_surface()
    }

    pub fn is_on_road(&self) -> bool {
        self.surface.is_on_road()
    }

    pub fn is_off_track(&self) -> bool {
        self.surface.is_off_track()
    }

    pub fn get_surface_modifiers(&self) -> SurfaceModifiers {
        *self.surface.get_modifiers()
    }

    // ========================================================================
    // Pit Lane API
    // ========================================================================

    pub fn set_pit_lane_active(&mut self, active: bool) {
        self.pit_lane.set_active(active);
    }

    pub fn is_pit_lane_active(&self) -> bool {
        self.pit_lane.is_active()
    }

    pub fn set_pit_lane_speed_limit(&mut self, kmh: f32) {
        self.pit_lane.set_speed_limit_kmh(kmh);
    }

    pub fn get_pit_lane_speed_limit_kmh(&self) -> f32 {
        self.pit_lane.get_speed_limit_kmh()
    }

    pub fn is_pit_lane_speed_limited(&self) -> bool {
        self.pit_lane.is_speed_limited()
    }

    pub fn get_pit_lane_limiter_blend(&self) -> f32 {
        self.pit_lane.get_limiter_blend()
    }

    // ========================================================================
    // Track Temperature API
    // ========================================================================

    pub fn init_track_temperature(&mut self, cell_size: f32, bounds: TrackBounds) {
        self.track_temperature.init(cell_size, bounds);
    }

    pub fn get_track_texture_data(&mut self) -> Vec<u8> {
        self.track_temperature.get_texture_data().to_vec()
    }

    pub fn get_track_cell_count(&self) -> usize {
        self.track_temperature.get_cell_count()
    }

    /// Update track temperature from normal driving (heat generation, road drying)
    pub fn update_car_driving(&mut self, x: f32, z: f32, speed_ms: f32, delta: f32) {
        self.track_temperature
            .update_car_driving(x, z, speed_ms, delta);
    }

    /// Get water depth at position
    pub fn get_water_depth(&self, x: f32, z: f32) -> f32 {
        self.track_temperature.get_water_depth_at(x, z)
    }

    /// Set rain exposure for a cell (0.0 = sheltered, 1.0 = open sky)
    pub fn set_rain_exposure(&mut self, x: f32, z: f32, exposure: f32) {
        self.track_temperature.set_rain_exposure(x, z, exposure);
    }

    /// Set drainage rate for a cell (slope-based)
    pub fn set_drainage_rate(&mut self, x: f32, z: f32, rate: f32) {
        self.track_temperature.set_drainage_rate(x, z, rate);
    }

    /// Mark a cell as road surface (roads retain heat better)
    pub fn set_road_cell(&mut self, x: f32, z: f32, is_road: bool) {
        self.track_temperature.set_road_cell(x, z, is_road);
    }

    /// Mark a rectangular region as road surface
    pub fn set_road_region(
        &mut self,
        min_x: f32,
        min_z: f32,
        max_x: f32,
        max_z: f32,
        is_road: bool,
    ) {
        self.track_temperature
            .set_road_region(min_x, min_z, max_x, max_z, is_road);
    }

    /// Check for aquaplaning at position
    pub fn check_aquaplaning(&self, x: f32, z: f32, speed_ms: f32) -> AquaplaningState {
        self.track_temperature.check_aquaplaning(x, z, speed_ms)
    }

    /// Check for aquaplaning at per-wheel positions
    pub fn check_aquaplaning_per_wheel(
        &self,
        wheel_positions: &[[f32; 2]; 4],
        speed_ms: f32,
    ) -> AquaplaningState {
        self.track_temperature
            .check_aquaplaning_per_wheel(wheel_positions, speed_ms)
    }

    /// Check if tires are in thermal shock
    pub fn is_tire_thermal_shock(&self) -> bool {
        self.tire_temperature.is_in_thermal_shock()
    }

    /// Get thermal shock state
    pub fn get_thermal_shock_state(&self) -> TireThermalShock {
        self.tire_temperature.get_thermal_shock_state()
    }

    /// Update rubber deposits from per-wheel positions (for tire marks)
    pub fn update_rubber_deposits(
        &mut self,
        wheel_positions: &[[f32; 2]; 4],
        wheel_intensities: &[f32; 4],
        delta_seconds: f32,
    ) {
        self.track_temperature.update_rubber_per_wheel(
            wheel_positions,
            wheel_intensities,
            delta_seconds,
        );
    }

    pub fn is_track_texture_dirty(&self) -> bool {
        self.track_temperature.is_texture_dirty()
    }

    pub fn get_active_surface_cells(&self) -> Vec<f32> {
        self.track_temperature.get_active_surface_cells()
    }

    /// Get track wetness at position (for rubber intensity calculation)
    pub fn get_track_wetness(&self, x: f32, z: f32) -> f32 {
        self.track_temperature.get_wetness_at(x, z)
    }

    /// Get tire compound rubber deposit multiplier
    pub fn get_rubber_deposit_multiplier(&self) -> f32 {
        self.tires.get_rubber_deposit_multiplier()
    }

    pub fn update_rubber_frame(
        &mut self,
        car_x: f32,
        car_z: f32,
        speed_ms: f32,
        delta: f32,
        wheel_positions: &[[f32; 2]; 4],
        wheel_intensities: &[f32; 4],
    ) -> (f32, f32) {
        self.track_temperature
            .update_car_driving(car_x, car_z, speed_ms, delta);
        let compound_mult = self.tires.get_rubber_deposit_multiplier();
        let wetness = self.track_temperature.get_wetness_at(car_x, car_z);
        if wheel_intensities.iter().any(|&v| v > 0.01) {
            self.track_temperature.update_rubber_per_wheel(
                wheel_positions,
                wheel_intensities,
                delta,
            );
        }
        (compound_mult, wetness)
    }

    // ========================================================================
    // Terrain API
    // ========================================================================

    pub fn init_terrain(&mut self, cell_size: f32, origin_x: f32, origin_z: f32) {
        self.terrain = Some(TerrainGrid::new(cell_size, origin_x, origin_z));
        self.prev_wheel_terrain = Default::default();
        self.terrain_step_counter = 0;
        self.cached_terrain_results = None;
        self.cached_wheel_positions = None;
    }

    pub fn set_terrain_cell(&mut self, x: f32, z: f32, height: f32, material: TerrainMaterial) {
        if let Some(ref mut terrain) = self.terrain {
            terrain.set_cell(x, z, height, material);
        }
    }

    pub fn set_terrain_region(
        &mut self,
        min_x: f32,
        min_z: f32,
        max_x: f32,
        max_z: f32,
        height: f32,
        material: TerrainMaterial,
    ) {
        if let Some(ref mut terrain) = self.terrain {
            terrain.set_region(min_x, min_z, max_x, max_z, height, material);
        }
    }

    pub fn query_terrain(&self, x: f32, z: f32) -> Option<TerrainQueryResult> {
        self.terrain.as_ref().map(|t| t.query_point(x, z))
    }

    pub fn is_terrain_initialized(&self) -> bool {
        self.terrain.as_ref().map_or(false, |t| t.is_initialized())
    }

    pub fn clear_terrain(&mut self) {
        self.terrain = None;
        self.prev_wheel_terrain = Default::default();
        self.terrain_step_counter = 0;
        self.cached_terrain_results = None;
        self.cached_wheel_positions = None;
    }

    // ========================================================================
    // Main Physics Step
    // ========================================================================

    /// Main physics update - call this every frame
    pub fn step(
        &mut self,
        delta_seconds: f32,
        input: CarInput,
        car_position: [f32; 3],
        car_rotation: [f32; 4],
        current_linvel: [f32; 3],
        current_angvel: [f32; 3],
        surface_normal: [f32; 3],
    ) -> CarPhysicsOutput {
        let dt = delta_seconds.min(0.05);

        // Update weather transition
        self.weather.update(dt);

        // Update wind (gusts)
        self.wind.update(dt);

        // Calculate car heading from quaternion (yaw angle)
        // car_rotation is [x, y, z, w] quaternion
        let quat = Quat::from_array(car_rotation);
        let car_heading = quat.yaw();

        // Calculate car speed for wind modifiers
        let speed_ms = (current_linvel[0].powi(2) + current_linvel[2].powi(2)).sqrt();

        // Update pit lane state from surface
        self.pit_lane
            .update_from_surface(self.surface.get_surface());

        // Get pit lane throttle limiter
        let pit_lane_throttle = self.pit_lane.update(dt, speed_ms);

        // Get wind modifiers based on car heading and speed
        let wind_modifiers = self.wind.calculate_modifiers(car_heading, speed_ms);

        self.track_temperature.update_time(dt);
        self.track_weather_accumulator += dt;
        let ambient = self.weather.get_ambient_conditions();
        if self.track_weather_accumulator >= TRACK_WEATHER_UPDATE_INTERVAL {
            let weather_dt = self.track_weather_accumulator.min(0.25);
            self.track_weather_accumulator = 0.0;
            self.track_temperature.update_weather_with_ambient(
                &ambient,
                wind_modifiers.cooling_multiplier,
                weather_dt,
            );
        }

        // Get modifiers
        let weather_modifiers = self.weather.get_modifiers();
        let tire_degradation = self
            .tires
            .calculate_degradation_modifiers_from_ambient(&ambient);

        // Get track temperature at car position
        let track_temp = self
            .track_temperature
            .get_temperature_at(car_position[0], car_position[2])
            .unwrap_or(0.5);

        // Get water depth at car position
        let water_depth = self
            .track_temperature
            .get_water_depth_at(car_position[0], car_position[2]);

        // Compute wheel world positions for per-wheel aquaplaning
        let fwd = quat.forward();
        let right = quat.right();
        let half_wb = 3.38 / 2.0;
        let half_tw = 1.525 / 2.0;
        let wheel_xz: [[f32; 2]; 4] = [
            [
                car_position[0] - right.x * half_tw + fwd.x * half_wb,
                car_position[2] - right.z * half_tw + fwd.z * half_wb,
            ], // FL
            [
                car_position[0] + right.x * half_tw + fwd.x * half_wb,
                car_position[2] + right.z * half_tw + fwd.z * half_wb,
            ], // FR
            [
                car_position[0] - right.x * half_tw - fwd.x * half_wb,
                car_position[2] - right.z * half_tw - fwd.z * half_wb,
            ], // RL
            [
                car_position[0] + right.x * half_tw - fwd.x * half_wb,
                car_position[2] + right.z * half_tw - fwd.z * half_wb,
            ], // RR
        ];

        let aquaplaning = self
            .track_temperature
            .check_aquaplaning_per_wheel(&wheel_xz, speed_ms);

        let movement_requires_query = self.wheel_cache_stale(&wheel_xz, 0.25);
        let terrain_results = if let Some(ref mut terrain) = self.terrain {
            let should_query = self.terrain_step_counter % 2 == 0
                || self.cached_terrain_results.is_none()
                || movement_requires_query;
            let results = if should_query {
                let queried = terrain.query_wheels(&wheel_xz, &self.prev_wheel_terrain);
                self.cached_terrain_results = Some(queried);
                self.cached_wheel_positions = Some(wheel_xz);
                queried
            } else {
                self.cached_terrain_results
                    .unwrap_or([TerrainQueryResult::default(); 4])
            };
            self.prev_wheel_terrain = results;
            self.terrain_step_counter = self.terrain_step_counter.wrapping_add(1);
            Some(results)
        } else {
            None
        };

        if let Some(ref results) = terrain_results {
            let mut dominant_idx = 0usize;
            let mut dominant_count = 0usize;
            for i in 0..4 {
                let material = results[i].material;
                let count = results.iter().filter(|r| r.material == material).count();
                if count > dominant_count
                    || (count == dominant_count
                        && results[i].properties.grip_coefficient
                            < results[dominant_idx].properties.grip_coefficient)
                {
                    dominant_idx = i;
                    dominant_count = count;
                }
            }
            let dominant = results[dominant_idx].material;
            let derived_surface = dominant.to_surface_type();
            self.surface.set_surface(derived_surface);
        }

        self.surface.update(dt);
        let surface_modifiers = self.surface.get_modifiers();

        // Surface grip is the primary grip modifier
        // Curb turn-specific grip stacks on top when on curb
        let curb_turn_grip = if self.curb.is_on_curb() {
            self.curb.get_modifiers().grip_multiplier
        } else {
            1.0
        };

        // Update engine temperature
        self.engine_temperature
            .update(dt, input.forward, speed_ms, &ambient);

        // Update ERS and get force boost
        let throttle_input = if input.throttle > 0.01 {
            input.throttle
        } else if input.forward {
            1.0
        } else {
            0.0
        };
        let ers_boost = self.ers.update(
            dt,
            input.forward && !input.brake,
            input.backward || input.brake,
            speed_ms,
            throttle_input,
        );

        // Update active aero wing positions (auto mode uses speed for adjustment)
        self.active_aero.update(dt, speed_ms);

        // Pre-step cooling pass (ambient/airflow cooling only — no G-force data needed)
        let cooling_input = TempInput {
            delta_seconds: dt,
            speed_ms,
            steer_angle: self.car.get_steer_angle(),
            is_braking: input.backward || input.brake,
            is_throttle: input.forward && !input.brake,
            is_drifting: self.car.is_drifting(),
            lateral_g: 0.0,
            longitudinal_g: 0.0,
            weight_transfer: Default::default(),
            ambient,
            track_temperature: track_temp,
            wind_cooling_multiplier: wind_modifiers.cooling_multiplier,
        };
        self.tire_temperature.update_cooling(&cooling_input);

        // Bidirectional heat exchange between tires and track
        // Always active - even when stationary, hot tires transfer heat to track
        let tire_avg_temp = self.tire_temperature.get_average_temperature();
        let tire_heat_delta = self.track_temperature.update_tire_track_exchange(
            car_position[0],
            car_position[2],
            tire_avg_temp,
            ambient.temperature,
            dt,
        );
        // Apply the heat change to tires
        self.tire_temperature.apply_external_heat(tire_heat_delta);

        // Apply puddle cooling effect (can trigger thermal shock)
        self.tire_temperature
            .apply_puddle_cooling(water_depth, speed_ms, dt);

        // Update thermal shock recovery
        self.tire_temperature.update_thermal_shock(dt);

        // Update tire material science
        let tire_temps_for_material = [
            (self.tire_temperature.get_temperatures().front_left_inner
                + self.tire_temperature.get_temperatures().front_left_outer)
                / 2.0,
            (self.tire_temperature.get_temperatures().front_right_inner
                + self.tire_temperature.get_temperatures().front_right_outer)
                / 2.0,
            (self.tire_temperature.get_temperatures().rear_left_inner
                + self.tire_temperature.get_temperatures().rear_left_outer)
                / 2.0,
            (self.tire_temperature.get_temperatures().rear_right_inner
                + self.tire_temperature.get_temperatures().rear_right_outer)
                / 2.0,
        ];
        self.tire_material.update(dt, &tire_temps_for_material);

        // Integrate material grip into combined_grip
        let material_grip_avg = self.tire_material.get_average_effective_grip();

        // Get temperature-based grip multiplier (kept for output/diagnostics)
        let temp_window = self.tires.get_temp_window();

        // Calculate aquaplaning grip penalty (0.1-0.5x grip during aquaplaning)
        let aquaplaning_grip = if aquaplaning.is_aquaplaning {
            0.1 + (1.0 - aquaplaning.intensity) * 0.4
        } else {
            1.0
        };

        // Calculate thermal shock grip penalty
        let thermal_shock_penalty = self.tire_temperature.get_thermal_shock_penalty();
        let thermal_shock_grip = 1.0 - thermal_shock_penalty;

        let tire_config = crate::types::TireConfig::for_compound(self.tires.get_compound());
        let base_compound_grip = tire_config.grip_multiplier;
        let weather_friction_mult = weather_modifiers.friction_slip_multiplier;
        let tire_wear_grip_mult = tire_degradation.grip_multiplier
            / (base_compound_grip
                * if self.tires.is_optimal_conditions(&ambient) {
                    1.0
                } else {
                    tire_config.wrong_conditions_penalty
                })
            .max(0.001);

        let terrain_grip = if let Some(ref results) = terrain_results {
            let grips = [
                results[0].properties.grip_coefficient,
                results[1].properties.grip_coefficient,
                results[2].properties.grip_coefficient,
                results[3].properties.grip_coefficient,
            ];
            (grips[0] + grips[1] + grips[2] + grips[3]) / 4.0
        } else {
            1.0
        };

        let combined_grip = surface_modifiers.grip_multiplier
            * curb_turn_grip
            * material_grip_avg
            * aquaplaning_grip
            * thermal_shock_grip
            * terrain_grip;

        // Speed modifier from surface
        let surface_speed = surface_modifiers.speed_multiplier;

        let curb_vibration = self.curb.update(dt, speed_ms);

        // Get active aero multipliers
        let active_aero_state = self.active_aero.get_state();

        // Get engine braking force from brake system
        let engine_braking_force = self.brakes.get_engine_braking_force();

        // Get engine temperature power multiplier
        let engine_power_multiplier = self.engine_temperature.get_state().power_multiplier;

        let is_braking = input.backward || input.brake;
        self.brakes.update_disc_temps(
            dt,
            speed_ms,
            is_braking,
            BASE_BRAKE_FORCE,
            ambient.to_celsius(),
        );
        let brake_fade = self.brakes.get_fade_multiplier();
        let (front_brake_force, rear_brake_force) =
            self.brakes.calculate_forces(BASE_BRAKE_FORCE * brake_fade);
        let ers_harvest_decel = if self.ers.is_harvesting() {
            let harvest_power = self.ers.get_harvest_power_watts();
            harvest_power / speed_ms.max(1.0)
        } else {
            0.0
        };

        let air_density = self.weather.get_air_density();

        let ers_boost = ers_boost * pit_lane_throttle;
        let engine_power_multiplier = engine_power_multiplier * pit_lane_throttle;

        let mut output = self.car.step(
            dt,
            &input,
            Vec3::from_array(car_position),
            Quat::from_array(car_rotation),
            Vec3::from_array(current_linvel),
            Vec3::from_array(current_angvel),
            weather_modifiers,
            &tire_degradation,
            &wind_modifiers,
            combined_grip,
            self.curb.is_on_curb(),
            surface_speed,
            ers_boost,
            active_aero_state.drag_multiplier,
            active_aero_state.downforce_multiplier,
            engine_braking_force,
            engine_power_multiplier,
            front_brake_force,
            rear_brake_force,
            ers_harvest_decel,
            air_density,
            surface_normal,
        );

        // Apply pit lane speed limiter braking
        let pit_brake = self.pit_lane.get_braking_force(speed_ms);
        if pit_brake > 0.0 {
            let brake_decel = pit_brake * 5000.0; // N of braking force
            let brake_vel = brake_decel * dt / 750.0; // Approximate deceleration
            let speed =
                (output.linear_velocity[0].powi(2) + output.linear_velocity[2].powi(2)).sqrt();
            if speed > 0.1 {
                let factor = ((speed - brake_vel) / speed).max(0.0);
                output.linear_velocity[0] *= factor;
                output.linear_velocity[2] *= factor;
            }
        }

        if curb_vibration.abs() > 0.001 {
            let vibration_force = curb_vibration * 2000.0;
            output.linear_velocity[1] += vibration_force * dt / 768.0;
        }

        if let Some(ref terrain_results) = terrain_results {
            output.per_wheel_terrain = PerWheelTerrain {
                heights: [
                    terrain_results[0].height,
                    terrain_results[1].height,
                    terrain_results[2].height,
                    terrain_results[3].height,
                ],
                materials: [
                    terrain_results[0].material,
                    terrain_results[1].material,
                    terrain_results[2].material,
                    terrain_results[3].material,
                ],
                grip_multipliers: [
                    terrain_results[0].properties.grip_coefficient,
                    terrain_results[1].properties.grip_coefficient,
                    terrain_results[2].properties.grip_coefficient,
                    terrain_results[3].properties.grip_coefficient,
                ],
                roughness: [
                    terrain_results[0].roughness,
                    terrain_results[1].roughness,
                    terrain_results[2].roughness,
                    terrain_results[3].roughness,
                ],
                bump_forces: [0.0; 4],
            };

            if let Some(ref terrain) = self.terrain {
                let fwd_speed = output.forward_speed_ms.abs();
                let mut bump_forces = [0.0f32; 4];
                for i in 0..4 {
                    bump_forces[i] = terrain.compute_bump_force(
                        wheel_xz[i][0],
                        wheel_xz[i][1],
                        fwd_speed,
                        terrain_results[i].roughness,
                        dt,
                    );
                }
                output.per_wheel_terrain.bump_forces = bump_forces;

                let avg_bump =
                    (bump_forces[0] + bump_forces[1] + bump_forces[2] + bump_forces[3]) / 4.0;
                let inertia_factor = CAR_MASS * 0.5;
                output.linear_velocity[1] += avg_bump / inertia_factor;

                let half_track = TRACK_WIDTH / 2.0;
                let roll_moment = ((bump_forces[1] + bump_forces[3])
                    - (bump_forces[0] + bump_forces[2]))
                    * half_track;
                output.angular_velocity[2] += roll_moment / inertia_factor;

                let half_wheelbase = WHEELBASE / 2.0;
                let pitch_moment = ((bump_forces[0] + bump_forces[1])
                    - (bump_forces[2] + bump_forces[3]))
                    * half_wheelbase;
                output.angular_velocity[0] += pitch_moment / inertia_factor;

                let center_height = terrain.query_point(car_position[0], car_position[2]).height;
                let bottoming =
                    check_bottoming_out_from_height(center_height, car_position[1], fwd_speed);
                output.bottoming_out = bottoming;

                if output.bottoming_out.is_contact {
                    let drag = output.bottoming_out.drag_force;
                    let spd = output.forward_speed_ms;
                    if spd.abs() > 0.1 {
                        let drag_decel = drag / CAR_MASS;
                        let speed_sign = if spd >= 0.0 { 1.0 } else { -1.0 };
                        let drag_delta = drag_decel * dt * speed_sign;
                        output.linear_velocity[0] -= fwd.x * drag_delta;
                        output.linear_velocity[2] -= fwd.z * drag_delta;
                    }
                    output.downforce_newtons *=
                        1.0 - (output.bottoming_out.scrape_intensity * 0.15);
                }
            }
        }

        // Post-step heating pass — use actual G-forces from car.step() output
        let weight_transfer_post =
            calculate_weight_transfer(output.longitudinal_g, output.lateral_g);
        let heating_input = TempInput {
            delta_seconds: dt,
            speed_ms: self.car.get_speed_ms(),
            steer_angle: self.car.get_steer_angle(),
            is_braking: input.backward || input.brake,
            is_throttle: input.forward && !input.brake,
            is_drifting: self.car.is_drifting(),
            lateral_g: output.lateral_g,
            longitudinal_g: output.longitudinal_g,
            weight_transfer: weight_transfer_post,
            ambient,
            track_temperature: track_temp,
            wind_cooling_multiplier: wind_modifiers.cooling_multiplier,
        };
        self.tire_temperature.update_heating(&heating_input);

        // Calculate weight transfer for tire wear (use actual G-forces from output)
        let weight_transfer_wear = weight_transfer_post;

        // Get per-wheel tire temperatures for wear calculation
        let tire_temps = self.tire_temperature.get_temperatures();
        let tire_temp_array = [
            (tire_temps.front_left_inner + tire_temps.front_left_outer) / 2.0,
            (tire_temps.front_right_inner + tire_temps.front_right_outer) / 2.0,
            (tire_temps.rear_left_inner + tire_temps.rear_left_outer) / 2.0,
            (tire_temps.rear_right_inner + tire_temps.rear_right_outer) / 2.0,
        ];

        // Update per-wheel tire wear
        let wear_input = WearInput {
            delta_seconds: dt,
            speed_ms: self.car.get_speed_ms(),
            steer_angle: self.car.get_steer_angle(),
            is_braking: input.backward || input.brake,
            is_throttle: input.forward && !input.brake,
            is_drifting: self.car.is_drifting(),
            is_handbrake: input.handbrake,
            ambient: ambient.clone(),
            track_temperature: track_temp,
            weight_transfer: weight_transfer_wear,
            lateral_g: output.lateral_g,
            longitudinal_g: output.longitudinal_g,
            tire_temperatures: tire_temp_array,
            slip_angle: output.slip_angle,
            surface_wear_multiplier: surface_modifiers.tire_wear_multiplier,
        };
        self.tires.update_wear_per_wheel(&wear_input);

        // Fill in tire wear in output
        output.tire_wear = self.tires.get_per_wheel_wear();

        // Fill in temperature output
        output.temperature = TemperatureOutput {
            engine: self.engine_temperature.get_state(),
            tires: self.tire_temperature.get_temperatures(),
            tire_temp_grip: self.tire_temperature.calculate_temp_grip(&temp_window),
            tire_in_window: self.tire_temperature.check_in_window(&temp_window),
        };

        // Fill in aquaplaning state
        output.aquaplaning = aquaplaning;

        // Fill in thermal shock state
        output.tire_thermal_shock = self.tire_temperature.get_thermal_shock_state();

        // Fill in ERS state
        output.ers = self.ers.get_state();

        // Fill in active aero state
        output.active_aero = self.active_aero.get_state();

        output.grip_breakdown = GripBreakdown {
            base_compound_grip,
            weather_friction_mult,
            tire_wear_grip_mult,
            surface_grip_mult: surface_modifiers.grip_multiplier,
            curb_turn_grip_mult: curb_turn_grip,
            tire_temp_grip_mult: material_grip_avg,
            aquaplaning_grip_mult: aquaplaning_grip,
            thermal_shock_grip_mult: thermal_shock_grip,
            final_effective_grip: output.effective_grip,
        };

        output.tire_material = self.tire_material.get_output();

        // Update track temperature with skid marks
        if output.skid_intensity > 0.01 {
            self.track_temperature.update_car_position(
                car_position[0],
                car_position[2],
                output.skid_intensity,
                dt,
            );
        }

        output
    }

    // ========================================================================
    // Batched Step + Sync (reduces FFI overhead)
    // ========================================================================

    pub fn step_and_sync(
        &mut self,
        delta_seconds: f32,
        input: CarInput,
        car_position: [f32; 3],
        car_rotation: [f32; 4],
        current_linvel: [f32; 3],
        current_angvel: [f32; 3],
        surface_normal: [f32; 3],
    ) -> crate::types::StepAndSyncOutput {
        let physics = self.step(
            delta_seconds,
            input,
            car_position,
            car_rotation,
            current_linvel,
            current_angvel,
            surface_normal,
        );
        let wind_state = self.get_wind_state();
        let aero_state = self.get_active_aero_state();
        let brake_state = self.get_brake_state();
        let ambient = self.weather.get_ambient_conditions();
        let world_downforce = compute_world_downforce(&physics, car_rotation);

        crate::types::StepAndSyncOutput {
            physics,
            wind_state,
            aero_state,
            brake_state,
            brake_disc_temps_celsius: self.brakes.get_brake_temperatures(),
            brake_fade: self.brakes.get_fade_multiplier(),
            input_throttle: input.throttle,
            input_brake: input.brake_analog,
            input_steer: input.steer,
            ambient,
            world_downforce,
        }
    }

    // ========================================================================
    // Debug API
    // ========================================================================

    pub fn get_debug_info(&self) -> DebugInfo {
        let ambient = self.weather.get_ambient_conditions();
        DebugInfo {
            temperature_celsius: ambient.to_celsius(),
            rain_intensity: ambient.rain_intensity,
            tire_compound: self.tires.get_compound(),
            tire_wear: self.tires.get_wear(),
            tire_wear_per_wheel: self.tires.get_per_wheel_wear(),
            effective_grip: self.get_effective_grip(),
            is_on_curb: self.curb.is_on_curb(),
            surface: self.surface.get_surface(),
            surface_grip: self.surface.get_grip_modifier(),
            track_cells: self.track_temperature.get_cell_count(),
            speed_kmh: self.car.get_speed_kmh(),
            is_drifting: self.car.is_drifting(),
        }
    }
}

fn compute_world_downforce(output: &CarPhysicsOutput, rotation: [f32; 4]) -> [f32; 3] {
    let df = output.downforce_newtons;
    if df <= 0.0 {
        return [0.0, 0.0, 0.0];
    }
    let qx = rotation[0];
    let qy = rotation[1];
    let qz = rotation[2];
    let qw = rotation[3];
    let up_x = 2.0 * (qx * qy - qw * qz);
    let up_y = 1.0 - 2.0 * (qx * qx + qz * qz);
    let up_z = 2.0 * (qy * qz + qw * qx);
    [-df * up_x, -df * up_y, -df * up_z]
}

#[derive(Debug, Clone)]
pub struct DebugInfo {
    pub temperature_celsius: f32,
    pub rain_intensity: f32,
    pub tire_compound: TireCompound,
    pub tire_wear: f32,
    pub tire_wear_per_wheel: PerWheelWear,
    pub effective_grip: f32,
    pub is_on_curb: bool,
    pub surface: SurfaceType,
    pub surface_grip: f32,
    pub track_cells: usize,
    pub speed_kmh: f32,
    pub is_drifting: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_creation() {
        let engine = PhysicsEngine::new();
        let ambient = engine.get_ambient_conditions();
        assert!((ambient.to_celsius() - 25.0).abs() < 1.0); // Default is ~25C
        assert_eq!(engine.get_tire_compound(), TireCompound::Medium);
        assert!(!engine.is_on_curb());
    }

    #[test]
    fn test_full_step() {
        let mut engine = PhysicsEngine::new();

        let input = CarInput {
            forward: true,
            ..Default::default()
        };

        let output = engine.step(
            1.0 / 60.0,
            input,
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
            [0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
        );

        // Should have positive forward velocity after accelerating
        // Note: forward direction is -Z in Three.js convention
        assert!(output.linear_velocity[2].abs() > 0.0 || output.speed_kmh > 0.0);
    }

    #[test]
    fn test_custom_weather() {
        let mut engine = PhysicsEngine::new();

        // Set rainy conditions
        engine.set_custom_weather(15.0, 0.9, 1.0);

        let ambient = engine.get_ambient_conditions();
        assert!((ambient.to_celsius() - 15.0).abs() < 1.0);
        assert!((ambient.rain_intensity - 1.0).abs() < 0.01);

        let modifiers = engine.get_weather_modifiers();
        assert!(
            modifiers.friction_slip_multiplier < 0.85,
            "Rain should reduce friction, got {}",
            modifiers.friction_slip_multiplier
        );
    }

    #[test]
    fn test_tire_compound_change() {
        let mut engine = PhysicsEngine::new();

        engine.set_tire_compound(TireCompound::Soft);
        assert_eq!(engine.get_tire_compound(), TireCompound::Soft);
        assert!((engine.get_tire_wear() - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_power_multiplier_affects_acceleration() {
        let input = CarInput {
            forward: true,
            ..Default::default()
        };

        let mut normal_engine = PhysicsEngine::new();
        let mut linvel = [0.0, 0.0, 0.0];
        for _ in 0..120 {
            let output = normal_engine.step(
                1.0 / 60.0,
                input,
                [0.0, 1.0, 0.0],
                [0.0, 0.0, 0.0, 1.0],
                linvel,
                [0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0],
            );
            linvel = output.linear_velocity;
        }
        let normal_speed = normal_engine.get_debug_info().speed_kmh;

        let mut overheated_engine = PhysicsEngine::new();
        let ambient = overheated_engine.get_ambient_conditions();
        for _ in 0..3000 {
            overheated_engine
                .engine_temperature
                .update(1.0 / 60.0, true, 80.0, &ambient);
        }
        assert!(
            overheated_engine
                .engine_temperature
                .get_state()
                .power_multiplier
                < 1.0,
            "Engine should be power-limited after sustained heat, got {}",
            overheated_engine
                .engine_temperature
                .get_state()
                .power_multiplier
        );

        let mut linvel2 = [0.0, 0.0, 0.0];
        for _ in 0..120 {
            let output = overheated_engine.step(
                1.0 / 60.0,
                input,
                [0.0, 1.0, 0.0],
                [0.0, 0.0, 0.0, 1.0],
                linvel2,
                [0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0],
            );
            linvel2 = output.linear_velocity;
        }
        let overheated_speed = overheated_engine.get_debug_info().speed_kmh;

        assert!(
            overheated_speed < normal_speed,
            "Overheated engine ({}km/h) should be slower than normal ({}km/h)",
            overheated_speed,
            normal_speed
        );
    }

    #[test]
    fn test_grip_breakdown_populated() {
        let mut engine = PhysicsEngine::new();

        let input = CarInput {
            forward: true,
            ..Default::default()
        };

        let output = engine.step(
            1.0 / 60.0,
            input,
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
            [0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
        );

        assert!(output.grip_breakdown.base_compound_grip > 0.0);
        assert!(output.grip_breakdown.weather_friction_mult > 0.0);
        assert!(output.grip_breakdown.tire_wear_grip_mult > 0.0);
        assert!(output.grip_breakdown.surface_grip_mult > 0.0);
        assert!((output.grip_breakdown.curb_turn_grip_mult - 1.0).abs() < 0.01);
        assert!(output.grip_breakdown.tire_temp_grip_mult > 0.0);
        assert!((output.grip_breakdown.aquaplaning_grip_mult - 1.0).abs() < 0.01);
        assert!((output.grip_breakdown.thermal_shock_grip_mult - 1.0).abs() < 0.01);
        assert!(output.grip_breakdown.final_effective_grip > 0.0);
    }

    #[test]
    fn test_terrain_queries_refresh_when_wheels_move_past_threshold() {
        let mut engine = PhysicsEngine::new();
        engine.init_terrain(1.0, 0.0, 0.0);

        for cx in 0..32 {
            for cz in 0..32 {
                engine.set_terrain_cell(
                    cx as f32,
                    cz as f32,
                    cx as f32 * 0.1,
                    TerrainMaterial::Asphalt,
                );
            }
        }

        let input = CarInput::default();
        let first = engine.step(
            1.0 / 120.0,
            input,
            [6.0, 1.0, 6.0],
            [0.0, 0.0, 0.0, 1.0],
            [0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
        );
        let second = engine.step(
            1.0 / 120.0,
            input,
            [7.0, 1.0, 6.0],
            [0.0, 0.0, 0.0, 1.0],
            [0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
        );

        assert!(
            (second.per_wheel_terrain.heights[0] - first.per_wheel_terrain.heights[0]).abs() > 0.01
        );
    }

    #[test]
    fn test_bottoming_uses_center_height() {
        let mut engine = PhysicsEngine::new();
        engine.init_terrain(1.0, 0.0, 0.0);
        engine.set_terrain_region(0.0, 0.0, 20.0, 20.0, 0.0, TerrainMaterial::Asphalt);
        engine.set_terrain_cell(10.0, 10.0, 0.08, TerrainMaterial::Asphalt);

        let output = engine.step(
            1.0 / 120.0,
            CarInput::default(),
            [10.0, 0.03, 10.0],
            [0.0, 0.0, 0.0, 1.0],
            [0.0, 0.0, 15.0],
            [0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
        );

        assert!(output.bottoming_out.is_contact);
        assert!(output.bottoming_out.drag_force > 0.0);
    }

    #[test]
    fn test_surface_state_uses_majority_wheel_material() {
        let mut engine = PhysicsEngine::new();
        engine.init_terrain(1.0, 0.0, 0.0);
        engine.set_terrain_region(0.0, 0.0, 30.0, 30.0, 0.0, TerrainMaterial::Grass);
        engine.set_terrain_region(9.0, 11.4, 9.5, 12.0, 0.0, TerrainMaterial::Asphalt);

        for _ in 0..4 {
            engine.cached_wheel_positions = None;
            engine.step(
                1.0 / 120.0,
                CarInput::default(),
                [10.0, 1.0, 10.0],
                [0.0, 0.0, 0.0, 1.0],
                [0.0, 0.0, 0.0],
                [0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0],
            );
        }

        assert_eq!(engine.get_surface(), SurfaceType::Grass);
    }

    #[test]
    fn test_bottoming_drag_follows_car_forward_axis() {
        let mut baseline = PhysicsEngine::new();
        baseline.init_terrain(1.0, 0.0, 0.0);
        baseline.set_terrain_region(0.0, 0.0, 20.0, 20.0, 0.0, TerrainMaterial::Asphalt);

        let mut scraping = PhysicsEngine::new();
        scraping.init_terrain(1.0, 0.0, 0.0);
        scraping.set_terrain_region(0.0, 0.0, 20.0, 20.0, 0.0, TerrainMaterial::Asphalt);
        scraping.set_terrain_cell(10.0, 10.0, 0.08, TerrainMaterial::Asphalt);

        let yaw_90 = std::f32::consts::FRAC_PI_4;
        let rotation = [0.0, yaw_90.sin(), 0.0, yaw_90.cos()];

        let baseline_output = baseline.step(
            1.0 / 120.0,
            CarInput::default(),
            [10.0, 0.03, 10.0],
            rotation,
            [25.0, 0.0, 0.0],
            [0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
        );
        let scraping_output = scraping.step(
            1.0 / 120.0,
            CarInput::default(),
            [10.0, 0.03, 10.0],
            rotation,
            [25.0, 0.0, 0.0],
            [0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
        );

        assert!(scraping_output.bottoming_out.is_contact);
        assert!(scraping_output.linear_velocity[0] < baseline_output.linear_velocity[0]);
        assert!(
            (scraping_output.linear_velocity[2] - baseline_output.linear_velocity[2]).abs() < 1e-3
        );
    }
}
