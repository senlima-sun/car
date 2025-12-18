use crate::car_physics::weight_transfer::calculate_weight_transfer;
use crate::car_physics::CarPhysicsState;
use crate::curb::CurbState;
use crate::engine_temp::EngineTemperatureState;
use crate::ers::ErsPhysicsState;
use crate::surface::SurfaceState;
use crate::tires::{TempInput, TireState, TireTemperatureState, WearInput};
use crate::track_temperature::TrackTemperatureGrid;
use crate::types::{
    AmbientConditions, AquaplaningState, CarInput, CarPhysicsOutput, CurbSide, ErsMode, PerWheelWear,
    SurfaceModifiers, SurfaceType, TemperatureOutput, TireCompound, TireThermalShock, TrackBounds,
    WeatherModifiers, WindModifiers, WindState,
};
use crate::utils::{Quat, Vec3};
use crate::weather::WeatherState;

/// Main physics engine that orchestrates all physics systems
#[derive(Debug)]
pub struct PhysicsEngine {
    weather: WeatherState,
    wind: WindState,
    tires: TireState,
    tire_temperature: TireTemperatureState,
    engine_temperature: EngineTemperatureState,
    ers: ErsPhysicsState,
    track_temperature: TrackTemperatureGrid,
    curb: CurbState,
    surface: SurfaceState,
    car: CarPhysicsState,
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
            track_temperature: TrackTemperatureGrid::default(),
            curb: CurbState::new(),
            surface: SurfaceState::new(),
            car: CarPhysicsState::new(),
        }
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
        self.weather.set_custom_ambient(celsius, humidity, rain_intensity);
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

    pub fn get_ers_battery_charge(&self) -> f32 {
        self.ers.get_battery_charge()
    }

    pub fn set_ers_battery_charge(&mut self, charge: f32) {
        self.ers.set_battery_charge(charge);
    }

    // ========================================================================
    // Curb API
    // ========================================================================

    pub fn set_on_curb(&mut self, is_on_curb: bool, side: Option<CurbSide>) {
        self.curb.set_on_curb(is_on_curb, side);
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
        self.track_temperature.update_car_driving(x, z, speed_ms, delta);
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
    pub fn set_road_region(&mut self, min_x: f32, min_z: f32, max_x: f32, max_z: f32, is_road: bool) {
        self.track_temperature.set_road_region(min_x, min_z, max_x, max_z, is_road);
    }

    /// Check for aquaplaning at position
    pub fn check_aquaplaning(&self, x: f32, z: f32, speed_ms: f32) -> AquaplaningState {
        self.track_temperature.check_aquaplaning(x, z, speed_ms)
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

    /// Get track wetness at position (for rubber intensity calculation)
    pub fn get_track_wetness(&self, x: f32, z: f32) -> f32 {
        self.track_temperature.get_wetness_at(x, z)
    }

    /// Get tire compound rubber deposit multiplier
    pub fn get_rubber_deposit_multiplier(&self) -> f32 {
        self.tires.get_rubber_deposit_multiplier()
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

        // Get wind modifiers based on car heading and speed
        let wind_modifiers = self.wind.calculate_modifiers(car_heading, speed_ms);

        // Update track temperature with ambient conditions and wind cooling
        self.track_temperature.update_time(dt);
        let ambient = self.weather.get_ambient_conditions();
        self.track_temperature
            .update_weather_with_ambient(
                &ambient,
                wind_modifiers.cooling_multiplier,
                dt,
            );

        // Get modifiers
        let weather_modifiers = self.weather.get_modifiers();
        let tire_degradation = self
            .tires
            .calculate_degradation_modifiers_from_ambient(&ambient);

        // Get surface modifiers (grass, road, curb)
        let surface_modifiers = self.surface.get_modifiers();

        // Surface grip is the primary grip modifier
        // Curb turn-specific grip stacks on top when on curb
        let curb_turn_grip = if self.curb.is_on_curb() {
            self.curb.get_modifiers().grip_multiplier
        } else {
            1.0
        };

        // Get track temperature at car position
        let track_temp = self
            .track_temperature
            .get_temperature_at(car_position[0], car_position[2])
            .unwrap_or(0.5);

        // Get water depth at car position
        let water_depth = self.track_temperature.get_water_depth_at(
            car_position[0],
            car_position[2],
        );

        // Check for aquaplaning conditions
        let aquaplaning = self.track_temperature.check_aquaplaning(
            car_position[0],
            car_position[2],
            speed_ms,
        );

        // Update engine temperature
        self.engine_temperature
            .update(dt, input.forward, speed_ms, &ambient);

        // Update ERS and get force boost
        let ers_boost = self.ers.update(
            dt,
            input.forward && !input.brake,
            input.backward || input.brake,
            speed_ms,
        );

        // Update tire temperatures (use default weight transfer for now, will be refined after car step)
        let temp_input = TempInput {
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
        self.tire_temperature.update(&temp_input);

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
        self.tire_temperature.apply_puddle_cooling(water_depth, speed_ms, dt);

        // Update thermal shock recovery
        self.tire_temperature.update_thermal_shock(dt);

        // Get temperature-based grip multiplier
        let temp_window = self.tires.get_temp_window();
        let avg_temp_grip = self.tire_temperature.get_average_temp_grip(&temp_window);

        // Calculate aquaplaning grip penalty (0.1-0.5x grip during aquaplaning)
        let aquaplaning_grip = if aquaplaning.is_aquaplaning {
            0.1 + (1.0 - aquaplaning.intensity) * 0.4
        } else {
            1.0
        };

        // Calculate thermal shock grip penalty
        let thermal_shock_penalty = self.tire_temperature.get_thermal_shock_penalty();
        let thermal_shock_grip = 1.0 - thermal_shock_penalty;

        // Combined grip: surface * curb turn bonus * tire temperature * aquaplaning * thermal shock
        let combined_grip = surface_modifiers.grip_multiplier
            * curb_turn_grip
            * avg_temp_grip
            * aquaplaning_grip
            * thermal_shock_grip;

        // Speed modifier from surface
        let surface_speed = surface_modifiers.speed_multiplier;

        // Update curb and get pitch angular velocity for bump effect
        let curb_pitch = self.curb.update(dt, speed_ms);

        // Run car physics with surface, tire degradation, wind, and ERS effects
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
        );

        // Apply curb bump as pitch rotation (X axis = pitch in Three.js)
        // Positive pitch = nose up
        if curb_pitch.abs() > 0.01 {
            output.angular_velocity[0] += curb_pitch;
        }

        // Calculate weight transfer for tire wear (use actual G-forces from output)
        let weight_transfer_wear =
            calculate_weight_transfer(output.longitudinal_g, output.lateral_g);

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
        // Rain should reduce friction
        assert!(modifiers.friction_slip_multiplier < 0.6);
    }

    #[test]
    fn test_tire_compound_change() {
        let mut engine = PhysicsEngine::new();

        engine.set_tire_compound(TireCompound::Soft);
        assert_eq!(engine.get_tire_compound(), TireCompound::Soft);
        assert!((engine.get_tire_wear() - 0.0).abs() < 0.001);
    }
}
