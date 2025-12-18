use crate::types::{WindModifiers, WindState};

// ============================================================================
// Wind Constants
// ============================================================================

/// Maximum wind speed in m/s (~90 km/h, hurricane force)
pub const MAX_WIND_SPEED: f32 = 25.0;

/// Base gust frequency in Hz
const GUST_BASE_FREQUENCY: f32 = 0.3;

/// Gust amplitude as fraction of base speed (±40%)
const GUST_AMPLITUDE: f32 = 0.4;

/// Secondary gust frequency for variation
const GUST_SECONDARY_FREQUENCY: f32 = 0.17;

/// Direction wobble amplitude in radians (~5 degrees)
const DIRECTION_WOBBLE_AMPLITUDE: f32 = 0.087;

/// Direction wobble frequency
const DIRECTION_WOBBLE_FREQUENCY: f32 = 0.1;

/// Crosswind steering penalty at max wind (15% reduction)
const CROSSWIND_STEERING_PENALTY: f32 = 0.15;

/// Cooling multiplier at max wind speed (2x cooling)
const MAX_WIND_COOLING_FACTOR: f32 = 2.0;

/// Lateral force coefficient: Newtons per (m/s crosswind * m/s car speed)
const LATERAL_FORCE_COEFFICIENT: f32 = 8.0;

/// Base lateral force coefficient for stationary car (N per m/s crosswind)
const BASE_LATERAL_FORCE: f32 = 50.0;

// ============================================================================
// Wind System Implementation
// ============================================================================

impl WindState {
    /// Create a new wind state with specified direction and speed
    pub fn new(direction: f32, base_speed: f32) -> Self {
        Self {
            direction,
            base_speed: base_speed.clamp(0.0, MAX_WIND_SPEED),
            current_speed: base_speed.clamp(0.0, MAX_WIND_SPEED),
            gust_intensity: 0.0,
            gust_timer: 0.0,
            enabled: true,
        }
    }

    /// Set wind parameters
    pub fn set_wind(&mut self, direction: f32, speed: f32) {
        self.direction = direction % (2.0 * std::f32::consts::PI);
        self.base_speed = speed.clamp(0.0, MAX_WIND_SPEED);
    }

    /// Enable or disable wind system
    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
        if !enabled {
            self.current_speed = 0.0;
            self.gust_intensity = 0.0;
        }
    }

    /// Update wind state with dynamic gusts
    pub fn update(&mut self, dt: f32) {
        if !self.enabled || self.base_speed < 0.1 {
            self.current_speed = 0.0;
            self.gust_intensity = 0.0;
            return;
        }

        self.gust_timer += dt;

        // Multi-frequency gust simulation for natural variation
        // Primary gust wave
        let primary_gust = (self.gust_timer * GUST_BASE_FREQUENCY * 2.0 * std::f32::consts::PI).sin();

        // Secondary slower wave for longer-term variation
        let secondary_gust = (self.gust_timer * GUST_SECONDARY_FREQUENCY * 2.0 * std::f32::consts::PI).sin();

        // Combine waves with weights
        let combined_gust = primary_gust * 0.7 + secondary_gust * 0.3;

        // Map from [-1, 1] to [0, 1] for intensity display
        self.gust_intensity = (combined_gust + 1.0) * 0.5;

        // Apply gust to speed: base_speed ± (base_speed * GUST_AMPLITUDE * gust)
        let gust_variation = self.base_speed * GUST_AMPLITUDE * combined_gust;
        self.current_speed = (self.base_speed + gust_variation).clamp(0.0, MAX_WIND_SPEED);
    }

    /// Get current wind direction with subtle wobble
    pub fn get_effective_direction(&self) -> f32 {
        if !self.enabled {
            return 0.0;
        }

        // Add subtle direction wobble based on gust timer
        let wobble = (self.gust_timer * DIRECTION_WOBBLE_FREQUENCY * 2.0 * std::f32::consts::PI).sin()
            * DIRECTION_WOBBLE_AMPLITUDE;

        self.direction + wobble
    }

    /// Calculate wind vector components [x, z] in world space
    pub fn get_wind_vector(&self) -> [f32; 2] {
        if !self.enabled {
            return [0.0, 0.0];
        }

        let dir = self.get_effective_direction();
        [
            self.current_speed * dir.cos(),
            self.current_speed * dir.sin(),
        ]
    }

    /// Calculate physics modifiers based on wind relative to car heading
    /// car_heading: radians (0 = +X axis)
    /// car_speed: m/s
    pub fn calculate_modifiers(&self, car_heading: f32, car_speed: f32) -> WindModifiers {
        if !self.enabled || self.current_speed < 0.1 {
            return WindModifiers::default();
        }

        let wind_dir = self.get_effective_direction();

        // Calculate relative angle between wind and car heading
        // Wind blowing in direction wind_dir, car facing car_heading
        // Headwind = wind coming from the direction car is facing
        let relative_angle = wind_dir - car_heading + std::f32::consts::PI;
        let relative_angle = normalize_angle(relative_angle);

        // Decompose wind into headwind and crosswind components
        // Headwind: positive means wind is against car movement
        let headwind_component = self.current_speed * relative_angle.cos();
        // Crosswind: positive means wind from car's right side
        let crosswind_component = self.current_speed * relative_angle.sin();

        // Calculate drag modifier based on headwind/tailwind
        // Effective airspeed changes drag quadratically
        // At 100 km/h with 10 m/s headwind: effective speed = 27.8 + 10 = 37.8 m/s
        // Drag ratio = (37.8/27.8)^2 = 1.85
        let car_speed_safe = car_speed.max(1.0); // Avoid division issues
        let effective_speed_ratio = (car_speed_safe + headwind_component) / car_speed_safe;
        let drag_modifier = (effective_speed_ratio * effective_speed_ratio).clamp(0.5, 2.5);

        // Calculate lateral force from crosswind
        // Force increases with both wind speed and car speed (more surface area exposed at speed)
        let speed_factor = (car_speed / 30.0).clamp(0.2, 1.5);
        let lateral_force = crosswind_component * (BASE_LATERAL_FORCE + LATERAL_FORCE_COEFFICIENT * car_speed) * speed_factor;

        // Steering difficulty from crosswind
        // Strong crosswinds make it harder to maintain direction
        let crosswind_factor = (crosswind_component.abs() / MAX_WIND_SPEED).clamp(0.0, 1.0);
        let steering_difficulty = 1.0 - (crosswind_factor * CROSSWIND_STEERING_PENALTY);

        // Cooling multiplier - higher wind = faster cooling
        // Linear interpolation from 1.0 at 0 wind to MAX_WIND_COOLING_FACTOR at max wind
        let wind_factor = self.current_speed / MAX_WIND_SPEED;
        let cooling_multiplier = 1.0 + wind_factor * (MAX_WIND_COOLING_FACTOR - 1.0);

        WindModifiers {
            drag_modifier,
            lateral_force,
            steering_difficulty,
            cooling_multiplier,
            headwind_component,
            crosswind_component,
        }
    }
}

/// Normalize angle to [-π, π]
fn normalize_angle(angle: f32) -> f32 {
    let mut a = angle % (2.0 * std::f32::consts::PI);
    if a > std::f32::consts::PI {
        a -= 2.0 * std::f32::consts::PI;
    } else if a < -std::f32::consts::PI {
        a += 2.0 * std::f32::consts::PI;
    }
    a
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wind_state_default() {
        let wind = WindState::default();
        assert_eq!(wind.base_speed, 0.0);
        assert_eq!(wind.current_speed, 0.0);
        assert!(!wind.enabled);
    }

    #[test]
    fn test_wind_state_new() {
        let wind = WindState::new(std::f32::consts::PI, 10.0);
        assert_eq!(wind.direction, std::f32::consts::PI);
        assert_eq!(wind.base_speed, 10.0);
        assert!(wind.enabled);
    }

    #[test]
    fn test_wind_speed_clamping() {
        let mut wind = WindState::new(0.0, 50.0); // Above max
        assert_eq!(wind.base_speed, MAX_WIND_SPEED);

        wind.set_wind(0.0, -5.0); // Below min
        assert_eq!(wind.base_speed, 0.0);
    }

    #[test]
    fn test_gust_variation() {
        let mut wind = WindState::new(0.0, 10.0);

        // Run several updates and check speed varies
        let mut speeds = Vec::new();
        for _ in 0..100 {
            wind.update(0.1);
            speeds.push(wind.current_speed);
        }

        let min_speed = speeds.iter().cloned().fold(f32::INFINITY, f32::min);
        let max_speed = speeds.iter().cloned().fold(f32::NEG_INFINITY, f32::max);

        // Speed should vary due to gusts
        assert!(max_speed > min_speed);
        // Should stay within reasonable bounds
        assert!(min_speed >= 0.0);
        assert!(max_speed <= MAX_WIND_SPEED);
    }

    #[test]
    fn test_headwind_increases_drag() {
        let wind = WindState::new(std::f32::consts::PI, 10.0); // Wind from +X direction

        // Car heading +X (into the wind)
        let mods = wind.calculate_modifiers(0.0, 20.0);

        // Should have significant headwind and increased drag
        assert!(mods.headwind_component > 5.0);
        assert!(mods.drag_modifier > 1.0);
    }

    #[test]
    fn test_tailwind_decreases_drag() {
        let wind = WindState::new(0.0, 10.0); // Wind blowing +X direction

        // Car heading +X (wind from behind)
        let mods = wind.calculate_modifiers(0.0, 20.0);

        // Should have tailwind (negative headwind) and reduced drag
        assert!(mods.headwind_component < 0.0);
        assert!(mods.drag_modifier < 1.0);
    }

    #[test]
    fn test_crosswind_lateral_force() {
        let wind = WindState::new(std::f32::consts::FRAC_PI_2, 15.0); // Wind from +Z

        // Car heading +X (crosswind from right)
        let mods = wind.calculate_modifiers(0.0, 20.0);

        // Should have significant crosswind and lateral force
        assert!(mods.crosswind_component.abs() > 10.0);
        assert!(mods.lateral_force.abs() > 100.0);
    }

    #[test]
    fn test_cooling_multiplier() {
        let calm = WindState::new(0.0, 0.0);
        let windy = WindState::new(0.0, MAX_WIND_SPEED);

        let calm_mods = calm.calculate_modifiers(0.0, 20.0);

        let mut windy_enabled = windy;
        windy_enabled.current_speed = MAX_WIND_SPEED;
        let windy_mods = windy_enabled.calculate_modifiers(0.0, 20.0);

        assert!((calm_mods.cooling_multiplier - 1.0).abs() < 0.01);
        assert!((windy_mods.cooling_multiplier - MAX_WIND_COOLING_FACTOR).abs() < 0.1);
    }

    #[test]
    fn test_disabled_wind() {
        let mut wind = WindState::new(0.0, 15.0);
        wind.set_enabled(false);

        let mods = wind.calculate_modifiers(0.0, 20.0);

        assert_eq!(mods.drag_modifier, 1.0);
        assert_eq!(mods.lateral_force, 0.0);
        assert_eq!(mods.cooling_multiplier, 1.0);
    }
}
