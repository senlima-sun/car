pub mod aerodynamics;
pub mod drift;
pub mod steering;
pub mod tire_model;
pub mod weight_transfer;

use crate::types::{CarInput, CarPhysicsOutput, TireDegradationModifiers, WeatherModifiers, WindModifiers};
use crate::utils::{lerp, sanitize, Quat, Vec3};

// ============================================================================
// Vehicle Constants
// ============================================================================

pub const CAR_MASS: f32 = 600.0;
pub const WHEELBASE: f32 = 2.8;
pub const TRACK_WIDTH: f32 = 1.9;
pub const CG_HEIGHT: f32 = 0.35;
pub const WEIGHT_DIST_FRONT: f32 = 0.47;

pub const BASE_MAX_SPEED: f32 = 86.1; // m/s = 310 km/h
pub const BASE_TIRE_GRIP_COEFFICIENT: f32 = 1.7;
pub const BASE_DRAG_COEFFICIENT: f32 = 0.35;
pub const BASE_DOWNFORCE_COEFFICIENT: f32 = 2.8;
pub const BASE_BRAKE_FORCE: f32 = 35000.0;
pub const BASE_ENGINE_BRAKE: f32 = 2500.0;

pub const DRIFT_ENTRY_SLIP_ANGLE: f32 = 15.0; // degrees
pub const DRIFT_EXIT_SLIP_ANGLE: f32 = 8.0;
pub const MIN_DRIFT_SPEED: f32 = 30.0; // km/h

// ============================================================================
// Car Physics State
// ============================================================================

#[derive(Debug)]
pub struct CarPhysicsState {
    // Smoothed values
    steer_angle: f32,
    slip_angle_smoothed: f32,

    // Drift state
    drift: drift::DriftState,

    // Cached calculations
    speed_kmh: f32,
    speed_ms: f32,
    gear: i8,
    effective_grip: f32,

    // Previous frame values for G-force calculation
    prev_forward_speed: f32,
    prev_lateral_speed: f32,

    // Angular velocity smoothing
    target_angular_velocity: f32,
}

impl Default for CarPhysicsState {
    fn default() -> Self {
        Self {
            steer_angle: 0.0,
            slip_angle_smoothed: 0.0,
            drift: drift::DriftState::default(),
            speed_kmh: 0.0,
            speed_ms: 0.0,
            gear: 1,
            effective_grip: 1.0,
            prev_forward_speed: 0.0,
            prev_lateral_speed: 0.0,
            target_angular_velocity: 0.0,
        }
    }
}

impl CarPhysicsState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Main physics step - computes all forces and returns new velocities
    pub fn step(
        &mut self,
        delta: f32,
        input: &CarInput,
        position: Vec3,
        rotation: Quat,
        current_linvel: Vec3,
        current_angvel: Vec3,
        weather_modifiers: &WeatherModifiers,
        tire_degradation: &TireDegradationModifiers,
        wind_modifiers: &WindModifiers,
        curb_grip_bonus: f32,
        is_on_curb: bool,
        curb_speed_multiplier: f32,
        ers_boost: f32,
        active_aero_drag_mult: f32,
        active_aero_downforce_mult: f32,
    ) -> CarPhysicsOutput {
        let dt = delta.min(0.05); // Clamp delta time

        // Get directions from rotation
        let forward_dir = rotation.forward();
        let right_dir = rotation.right();

        // Calculate speeds
        let forward_speed = current_linvel.dot(forward_dir);
        let lateral_speed = current_linvel.dot(right_dir);
        self.speed_ms = forward_speed.abs();
        self.speed_kmh = self.speed_ms * 3.6;

        // Calculate gear
        self.gear = self.calculate_gear(self.speed_kmh);

        // Calculate effective grip (tire_degradation.grip_multiplier already includes compound and weather)
        let grip_coefficient = BASE_TIRE_GRIP_COEFFICIENT
            * weather_modifiers.friction_slip_multiplier
            * tire_degradation.grip_multiplier
            * curb_grip_bonus;
        self.effective_grip = grip_coefficient;

        // Calculate slip angle
        let slip_angle = if self.speed_ms > 0.3 {
            lateral_speed.atan2(forward_speed.abs()).to_degrees()
        } else {
            0.0
        };
        self.slip_angle_smoothed = lerp(self.slip_angle_smoothed, slip_angle, dt * 10.0);

        // Update drift state with tire degradation effects
        self.drift.update(
            self.slip_angle_smoothed.abs(),
            self.speed_kmh,
            weather_modifiers.drift_entry_slip_angle_multiplier,
            tire_degradation.drift_entry_multiplier,
            tire_degradation.drift_exit_multiplier,
        );

        // Update steering with tire degradation effects
        let max_steer = steering::get_max_steer_angle(
            self.speed_kmh,
            tire_degradation.max_steer_multiplier,
            tire_degradation.steer_instability,
        ) * weather_modifiers.max_steer_angle_multiplier;
        let steer_input = if input.left { -1.0 } else if input.right { 1.0 } else { 0.0 };
        let target_steer = steer_input * max_steer.to_radians();

        // Steering speed affected by both weather and wind (crosswinds make steering harder)
        let steer_speed = 4.5 * weather_modifiers.steer_response_multiplier * wind_modifiers.steering_difficulty;
        let center_speed = 5.0 + self.speed_ms * 0.04;

        if steer_input.abs() > 0.01 {
            self.steer_angle = lerp(self.steer_angle, target_steer, dt * steer_speed);
        } else {
            self.steer_angle = lerp(self.steer_angle, 0.0, dt * center_speed);
        }

        // Calculate forces
        let mut longitudinal_force = 0.0;

        // Engine force
        if input.forward && !input.brake {
            let engine_force = aerodynamics::get_engine_force(self.speed_ms, input.drs, ers_boost)
                * weather_modifiers.engine_efficiency_multiplier;
            longitudinal_force += engine_force;
        }

        // Braking / Reverse
        if input.backward || input.brake {
            // If going forward fast enough, apply brakes
            if forward_speed > 1.0 {
                let brake_force = BASE_BRAKE_FORCE
                    * weather_modifiers.brake_efficiency_multiplier
                    * tire_degradation.brake_efficiency;
                let handbrake_mult = if input.handbrake { 1.2 } else { 1.0 };
                longitudinal_force -= brake_force * handbrake_mult;
            } else if input.backward && !input.brake {
                // If slow or stopped and backward is pressed (not just brake), apply reverse force
                let reverse_force = aerodynamics::get_engine_force(self.speed_ms, false, 0.0)
                    * weather_modifiers.engine_efficiency_multiplier
                    * 0.4; // Reverse is weaker than forward (no ERS in reverse)
                longitudinal_force -= reverse_force;
            }
        }

        // Engine braking
        if !input.forward && !input.backward && !input.brake && self.speed_ms > 1.0 {
            longitudinal_force -= BASE_ENGINE_BRAKE * forward_speed.signum();
        }

        // Aerodynamic drag (affected by weather, wind, and active aero)
        let drag = aerodynamics::get_drag_force(self.speed_ms, input.drs, active_aero_drag_mult)
            * weather_modifiers.drag_multiplier
            * wind_modifiers.drag_modifier;
        longitudinal_force -= drag * forward_speed.signum();

        // Curb drag
        if is_on_curb && self.speed_ms > 1.0 {
            let curb_drag = self.speed_ms * CAR_MASS * (1.0 - curb_speed_multiplier) * 0.5;
            longitudinal_force -= curb_drag * forward_speed.signum();
        }

        // Downforce for grip (affected by weather and active aero)
        let downforce = aerodynamics::get_downforce(self.speed_ms, input.drs, active_aero_downforce_mult)
            * weather_modifiers.downforce_multiplier;
        let total_load = CAR_MASS * 9.81 + downforce;
        let downforce_grip_bonus = 1.0 + (downforce / (CAR_MASS * 9.81)) * 0.3;

        // Weight transfer (use safe_dt to prevent division by very small numbers)
        let safe_dt = dt.max(0.001); // Minimum 1ms to prevent NaN
        let long_g = ((forward_speed - self.prev_forward_speed) / safe_dt / 9.81)
            .clamp(-10.0, 10.0); // Clamp to reasonable G-force values
        let lat_g = ((lateral_speed - self.prev_lateral_speed) / safe_dt / 9.81)
            .clamp(-10.0, 10.0);

        let weight_transfer = weight_transfer::calculate_weight_transfer(
            sanitize(long_g, 0.0),
            sanitize(lat_g, 0.0),
        );

        // Tire grip calculation
        let (front_grip, rear_grip) = tire_model::calculate_tire_grip(
            self.slip_angle_smoothed,
            total_load,
            grip_coefficient * downforce_grip_bonus,
            input.handbrake,
            input.forward && !input.brake,
            &weight_transfer,
        );

        let combined_grip = front_grip * 0.4 + rear_grip * 0.6;

        // Turn dynamics
        let angular_velocity = if self.steer_angle.abs() > 0.005 && self.speed_ms > 0.3 {
            steering::calculate_turn_dynamics(
                self.steer_angle,
                self.speed_ms,
                combined_grip,
                self.drift.is_drifting(),
            )
        } else {
            0.0
        };

        // Smooth angular velocity
        let response_rate = if self.drift.is_drifting() { 25.0 } else { 28.0 };
        self.target_angular_velocity = lerp(
            self.target_angular_velocity,
            angular_velocity,
            dt * response_rate,
        );

        // Add drift rotation
        let drift_rotation = if self.drift.is_drifting() {
            self.slip_angle_smoothed.to_radians() * 0.015
        } else {
            0.0
        };

        // Calculate lateral correction with tire degradation effects
        let lateral_correction = self.drift.get_lateral_correction(
            combined_grip,
            weather_modifiers.drift_lateral_correction_multiplier,
            if is_on_curb { 1.1 } else { 1.0 },
            tire_degradation.lateral_correction_penalty,
        );

        // Calculate new velocities
        let new_forward_speed = forward_speed + (longitudinal_force / CAR_MASS) * dt;

        // Apply lateral wind force (crosswind pushes car sideways)
        let wind_lateral_accel = wind_modifiers.lateral_force / CAR_MASS;
        let new_lateral_speed = lateral_speed * lateral_correction + wind_lateral_accel * dt;

        // Clamp speeds with tire degradation effects
        let max_speed = BASE_MAX_SPEED
            * weather_modifiers.max_speed_multiplier
            * tire_degradation.max_speed_multiplier;
        let clamped_forward = new_forward_speed.clamp(-40.0 / 3.6, max_speed);
        let clamped_lateral = new_lateral_speed.clamp(-30.0, 30.0);

        // Reconstruct velocity
        let new_velocity = forward_dir.scale(clamped_forward).add(right_dir.scale(clamped_lateral));

        // Cap angular velocity
        let max_ang_vel = if self.drift.is_drifting() { 2.8 } else { 1.8 };
        let final_ang_vel = (self.target_angular_velocity + drift_rotation).clamp(-max_ang_vel, max_ang_vel);

        // Update previous values
        self.prev_forward_speed = clamped_forward;
        self.prev_lateral_speed = clamped_lateral;

        // Calculate skid intensity for track marks
        let skid_intensity = if self.drift.is_drifting() {
            (self.slip_angle_smoothed.abs() / 30.0).min(1.0)
        } else if input.handbrake && self.speed_ms > 5.0 {
            0.7
        } else {
            (self.slip_angle_smoothed.abs() / 45.0).min(0.5)
        };

        CarPhysicsOutput {
            linear_velocity: [
                sanitize(new_velocity.x, 0.0),
                sanitize(current_linvel.y, 0.0), // Keep Y velocity (gravity)
                sanitize(new_velocity.z, 0.0),
            ],
            angular_velocity: [
                sanitize(current_angvel.x * 0.95, 0.0), // Dampen roll
                sanitize(final_ang_vel, 0.0),           // Yaw (steering)
                sanitize(current_angvel.z * 0.95, 0.0), // Dampen pitch
            ],
            speed_kmh: self.speed_kmh,
            gear: self.gear,
            slip_angle: self.slip_angle_smoothed,
            is_drifting: self.drift.is_drifting(),
            effective_grip: combined_grip,
            lateral_g: sanitize(lat_g, 0.0),
            longitudinal_g: sanitize(long_g, 0.0),
            skid_intensity,
            tire_wear: Default::default(),       // Will be filled in by engine
            steer_angle: self.steer_angle,
            temperature: Default::default(),     // Will be filled in by engine
            aquaplaning: Default::default(),     // Will be filled in by engine
            tire_thermal_shock: Default::default(), // Will be filled in by engine
            ers: Default::default(),             // Will be filled in by engine
            active_aero: Default::default(),     // Will be filled in by engine
        }
    }

    fn calculate_gear(&self, speed_kmh: f32) -> i8 {
        if speed_kmh < 0.0 {
            return -1;
        }

        match speed_kmh as i32 {
            0..=30 => 1,
            31..=60 => 2,
            61..=100 => 3,
            101..=150 => 4,
            151..=210 => 5,
            211..=260 => 6,
            _ => 7,
        }
    }

    pub fn get_speed_kmh(&self) -> f32 {
        self.speed_kmh
    }

    pub fn get_speed_ms(&self) -> f32 {
        self.speed_ms
    }

    pub fn is_drifting(&self) -> bool {
        self.drift.is_drifting()
    }

    pub fn get_steer_angle(&self) -> f32 {
        self.steer_angle
    }
}
