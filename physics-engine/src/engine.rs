use crate::car_physics::weight_transfer::calculate_weight_transfer;
use crate::car_physics::CarPhysicsState;
use crate::curb::CurbState;
use crate::tires::{TireState, WearInput};
use crate::track_temperature::TrackTemperatureGrid;
use crate::types::{
    CarInput, CarPhysicsOutput, CurbSide, PerWheelWear, TireCompound, TrackBounds,
    WeatherCondition, WeatherModifiers,
};
use crate::utils::{Quat, Vec3};
use crate::weather::WeatherState;

/// Main physics engine that orchestrates all physics systems
#[derive(Debug)]
pub struct PhysicsEngine {
    weather: WeatherState,
    tires: TireState,
    track_temperature: TrackTemperatureGrid,
    curb: CurbState,
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
            tires: TireState::new(),
            track_temperature: TrackTemperatureGrid::default(),
            curb: CurbState::new(),
            car: CarPhysicsState::new(),
        }
    }

    // ========================================================================
    // Weather API
    // ========================================================================

    pub fn set_weather(&mut self, weather: WeatherCondition) {
        self.weather.set_weather(weather);
    }

    pub fn get_weather(&self) -> WeatherCondition {
        self.weather.get_weather()
    }

    pub fn update_weather_transition(&mut self, delta_seconds: f32) {
        self.weather.update(delta_seconds);
    }

    pub fn get_weather_modifiers(&self) -> WeatherModifiers {
        *self.weather.get_modifiers()
    }

    pub fn is_weather_transitioning(&self) -> bool {
        self.weather.is_transitioning()
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

    pub fn get_effective_grip(&self) -> f32 {
        self.tires
            .calculate_effective_grip(self.weather.get_current_weather())
    }

    pub fn get_tire_wear_per_wheel(&self) -> PerWheelWear {
        self.tires.get_per_wheel_wear()
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

        // Update track temperature
        self.track_temperature.update_time(dt);
        self.track_temperature
            .update_weather(self.weather.get_current_weather(), dt);

        // Get modifiers
        let weather_modifiers = self.weather.get_modifiers();
        let tire_degradation = self
            .tires
            .calculate_degradation_modifiers(self.weather.get_current_weather());
        let curb_grip = if self.curb.is_on_curb() {
            self.curb.get_modifiers().grip_multiplier
        } else {
            1.0
        };
        let curb_speed = if self.curb.is_on_curb() {
            self.curb.get_modifiers().speed_multiplier
        } else {
            1.0
        };

        // Run car physics with tire degradation effects
        let mut output = self.car.step(
            dt,
            &input,
            Vec3::from_array(car_position),
            Quat::from_array(car_rotation),
            Vec3::from_array(current_linvel),
            Vec3::from_array(current_angvel),
            weather_modifiers,
            &tire_degradation,
            curb_grip,
            self.curb.is_on_curb(),
            curb_speed,
        );

        // Get track temperature at car position
        let track_temp = self
            .track_temperature
            .get_temperature_at(car_position[0], car_position[2])
            .unwrap_or(0.5);

        // Calculate weight transfer for tire wear
        let weight_transfer = calculate_weight_transfer(output.longitudinal_g, output.lateral_g);

        // Update per-wheel tire wear
        let wear_input = WearInput {
            delta_seconds: dt,
            speed_ms: self.car.get_speed_ms(),
            steer_angle: self.car.get_steer_angle(),
            is_braking: input.backward || input.brake,
            is_throttle: input.forward && !input.brake,
            is_drifting: self.car.is_drifting(),
            is_handbrake: input.handbrake,
            weather: self.weather.get_current_weather(),
            track_temperature: track_temp,
            weight_transfer,
        };
        self.tires.update_wear_per_wheel(&wear_input);

        // Fill in tire wear in output
        output.tire_wear = self.tires.get_per_wheel_wear();

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
        DebugInfo {
            weather: self.weather.get_weather(),
            weather_transitioning: self.weather.is_transitioning(),
            tire_compound: self.tires.get_compound(),
            tire_wear: self.tires.get_wear(),
            tire_wear_per_wheel: self.tires.get_per_wheel_wear(),
            effective_grip: self.get_effective_grip(),
            is_on_curb: self.curb.is_on_curb(),
            track_cells: self.track_temperature.get_cell_count(),
            speed_kmh: self.car.get_speed_kmh(),
            is_drifting: self.car.is_drifting(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct DebugInfo {
    pub weather: WeatherCondition,
    pub weather_transitioning: bool,
    pub tire_compound: TireCompound,
    pub tire_wear: f32,
    pub tire_wear_per_wheel: PerWheelWear,
    pub effective_grip: f32,
    pub is_on_curb: bool,
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
        assert_eq!(engine.get_weather(), WeatherCondition::Dry);
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
    fn test_weather_change() {
        let mut engine = PhysicsEngine::new();

        engine.set_weather(WeatherCondition::Rain);
        assert_eq!(engine.get_weather(), WeatherCondition::Rain);
        assert!(engine.is_weather_transitioning());

        // Complete transition
        for _ in 0..200 {
            engine.update_weather_transition(1.0 / 60.0);
        }

        assert!(!engine.is_weather_transitioning());
        let modifiers = engine.get_weather_modifiers();
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
