pub mod aerodynamics;
pub mod drift;
pub mod powertrain;
pub mod steering;
pub mod tire_model;
pub mod weight_transfer;
pub mod wheel_force;

use crate::car_physics::powertrain::TIRE_RADIUS;
use crate::car_physics::wheel_force::{WheelForceIntegrator, WheelForceInputs, AXLE_TO_CORNER_SPLIT};
use crate::constants::car::*;
use crate::types::{
    CarInput, CarPhysicsOutput, PerWheelForces, TireDegradationModifiers, WeatherModifiers,
    WindModifiers,
};
use crate::utils::{lerp, sanitize, Quat, Vec3};

// Linear damping rate (1/s) applied to body forward velocity below 1 m/s
// while braking. Compensates for slip-ratio oscillation at near-zero speed.
const LOW_SPEED_CREEP_DAMPING_RATE: f32 = 8.0;

// ============================================================================
// Car Physics State
// ============================================================================

#[derive(Debug)]
pub struct CarPhysicsState {
    steer_angle: f32,
    slip_angle_smoothed: f32,
    drift: drift::DriftState,
    powertrain: powertrain::PowertrainState,
    speed_kmh: f32,
    speed_ms: f32,
    gear: i8,
    rpm: f32,
    effective_grip: f32,
    prev_forward_speed: f32,
    prev_lateral_speed: f32,
    target_angular_velocity: f32,
    long_g_filtered: f32,
    lat_g_filtered: f32,
    wheel_force: WheelForceIntegrator,
}

impl Default for CarPhysicsState {
    fn default() -> Self {
        Self {
            steer_angle: 0.0,
            slip_angle_smoothed: 0.0,
            drift: drift::DriftState::default(),
            powertrain: powertrain::PowertrainState::new(),
            speed_kmh: 0.0,
            speed_ms: 0.0,
            gear: 1,
            rpm: 0.0,
            effective_grip: 1.0,
            prev_forward_speed: 0.0,
            prev_lateral_speed: 0.0,
            target_angular_velocity: 0.0,
            long_g_filtered: 0.0,
            lat_g_filtered: 0.0,
            wheel_force: WheelForceIntegrator::new(),
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
        _position: Vec3,
        rotation: Quat,
        current_linvel: Vec3,
        current_angvel: Vec3,
        weather_modifiers: &WeatherModifiers,
        tire_degradation: &TireDegradationModifiers,
        wind_modifiers: &WindModifiers,
        curb_grip_bonus: f32,
        environmental_grip_modifier: f32,
        is_on_curb: bool,
        curb_speed_multiplier: f32,
        ers_boost: f32,
        active_aero_drag_mult: f32,
        active_aero_downforce_mult: f32,
        engine_braking_force: f32,
        engine_power_multiplier: f32,
        front_brake_force: f32,
        rear_brake_force: f32,
        ers_harvest_decel: f32,
        air_density: f32,
        surface_normal: [f32; 3],
        wheel_loads: Option<[f32; 4]>,
        ride_height_m: f32,
    ) -> CarPhysicsOutput {
        let dt = delta.min(0.05); // Clamp delta time

        // Get directions from rotation
        let forward_dir = rotation.forward();
        let right_dir = rotation.right();

        let forward_speed = current_linvel.dot(forward_dir);
        let lateral_speed = current_linvel.dot(right_dir);
        self.speed_ms = forward_speed.abs();
        self.speed_kmh = self.speed_ms * 3.6;
        let signed_forward_speed = forward_speed;
        let max_speed = BASE_MAX_SPEED
            * weather_modifiers.max_speed_multiplier
            * tire_degradation.max_speed_multiplier;

        let effective_throttle_for_pt = input.throttle > 0.01 || (input.forward && !input.brake);

        let pt_out = self.powertrain.update(
            dt,
            self.speed_ms,
            max_speed,
            effective_throttle_for_pt,
            ers_boost,
            weather_modifiers.engine_efficiency_multiplier * engine_power_multiplier,
            1.0,
        );
        self.gear = pt_out.gear;
        self.rpm = pt_out.rpm;

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
        let steer_input = if input.steer.abs() > 0.01 {
            input.steer.clamp(-1.0, 1.0)
        } else if input.left {
            -1.0
        } else if input.right {
            1.0
        } else {
            0.0
        };
        let target_steer = steer_input * max_steer.to_radians();

        // Steering speed affected by both weather and wind (crosswinds make steering harder)
        let steer_speed =
            12.0 * weather_modifiers.steer_response_multiplier * wind_modifiers.steering_difficulty;
        let center_speed = 8.0 + self.speed_ms * 0.06;

        if steer_input.abs() > 0.01 {
            self.steer_angle = lerp(self.steer_angle, target_steer, dt * steer_speed);
        } else {
            self.steer_angle = lerp(self.steer_angle, 0.0, dt * center_speed);
        }

        let mut longitudinal_force = 0.0;

        let effective_throttle = if input.throttle > 0.01 {
            input.throttle.clamp(0.0, 1.0)
        } else if input.forward {
            1.0
        } else {
            0.0
        };

        let effective_brake = if input.brake_analog > 0.01 {
            input.brake_analog.clamp(0.0, 1.0)
        } else if input.brake || input.backward {
            1.0
        } else {
            0.0
        };

        // Throttle and per-wheel brake forces go through the slip-ratio path
        // in the wheel-spin block ~100 lines below. Handbrake skid,
        // pure-reverse-from-rest, and the low-speed creep assist stay as
        // direct body impulses; they aren't modelled by the longitudinal
        // Pacejka path in Wave 1.
        let in_reverse = input.backward && forward_speed <= 0.1;
        if input.handbrake && forward_speed.abs() > 0.05 {
            let handbrake_force = (front_brake_force + rear_brake_force) * 2.5;
            longitudinal_force -= handbrake_force * forward_speed.signum();
            if forward_speed.abs() < 2.0 {
                longitudinal_force -= forward_speed * CAR_MASS * 15.0;
            }
        } else if in_reverse {
            let reverse_force = 8000.0;
            longitudinal_force -= reverse_force;
        } else if effective_brake > 0.01 && forward_speed.abs() < 1.0 {
            // Low-speed creep assist: the slip-ratio Pacejka path oscillates
            // near zero velocity because ω locks at 0 and slip jumps between
            // signs each frame. A linear damper on body velocity keeps the
            // car from stalling at ~0.9 m/s under full brake.
            longitudinal_force -= forward_speed * CAR_MASS * LOW_SPEED_CREEP_DAMPING_RATE;
        }

        if effective_throttle < 0.01
            && effective_brake < 0.01
            && !input.backward
            && self.speed_ms > 1.0
        {
            let rpm_engine_brake = pt_out.engine_brake_force;
            let configured_brake = engine_braking_force;
            longitudinal_force -= rpm_engine_brake.max(configured_brake) * forward_speed.signum();
        }

        let drag = aerodynamics::get_drag_force_with_density(
            self.speed_ms,
            active_aero_drag_mult,
            air_density,
        ) * wind_modifiers.drag_modifier;
        longitudinal_force -= drag * forward_speed.signum();

        // Curb drag
        if is_on_curb && self.speed_ms > 1.0 {
            let curb_drag = self.speed_ms * CAR_MASS * (1.0 - curb_speed_multiplier) * 0.5;
            longitudinal_force -= curb_drag * forward_speed.signum();
        }

        // ERS harvest deceleration (energy conservation)
        if ers_harvest_decel > 0.0 && self.speed_ms > 1.0 {
            longitudinal_force -= ers_harvest_decel * forward_speed.signum();
        }

        // Surface normal gravity decomposition.
        // Clamp `acos`/`asin` inputs to their valid domain even though the
        // surface normal is *supposed* to be unit-length: Rapier-derived
        // normals can drift slightly past 1.0 from FP error, and acos/asin
        // of an out-of-range value returns NaN that survives downstream
        // clamps. Pre-clamp keeps the math finite at the source.
        let normal_y = surface_normal[1].clamp(0.01, 1.0);
        let slope_angle = normal_y.acos();
        let gravity_normal = CAR_MASS * 9.81 * slope_angle.cos();

        let normal_forward = (surface_normal[0] * forward_dir.x
            + surface_normal[1] * forward_dir.y
            + surface_normal[2] * forward_dir.z)
            .clamp(-1.0, 1.0);
        let pitch_angle = normal_forward.asin().clamp(-0.5, 0.5);
        let gravity_tangent = CAR_MASS * 9.81 * pitch_angle.sin();

        let normal_right = (surface_normal[0] * right_dir.x
            + surface_normal[1] * right_dir.y
            + surface_normal[2] * right_dir.z)
            .clamp(-1.0, 1.0);
        let banking_angle = normal_right.asin().clamp(-0.5, 0.5);
        let banking_lateral_force = CAR_MASS * 9.81 * banking_angle.sin();

        // Apply slope-induced longitudinal force (downhill = positive, uphill = negative)
        longitudinal_force += gravity_tangent;

        let downforce = aerodynamics::get_downforce_with_density_and_ride_height(
            self.speed_ms,
            active_aero_downforce_mult,
            air_density,
            ride_height_m,
        );
        let quasi_static_total_load = gravity_normal + downforce;
        let load_sensitivity = 0.015;
        let load_ratio = quasi_static_total_load / gravity_normal.max(1.0);
        let downforce_grip_bonus =
            load_ratio.powf(1.0 - load_sensitivity * (load_ratio - 1.0).max(0.0));

        let safe_dt = dt.max(0.001);
        let long_g_raw =
            ((forward_speed - self.prev_forward_speed) / safe_dt / 9.81).clamp(-10.0, 10.0);
        let lat_g_raw =
            ((lateral_speed - self.prev_lateral_speed) / safe_dt / 9.81).clamp(-10.0, 10.0);

        let ema_alpha = (dt * 30.0).min(1.0);
        self.long_g_filtered += (long_g_raw - self.long_g_filtered) * ema_alpha;
        self.lat_g_filtered += (lat_g_raw - self.lat_g_filtered) * ema_alpha;
        let long_g = self.long_g_filtered;
        let lat_g = self.lat_g_filtered;

        let weight_transfer =
            weight_transfer::calculate_weight_transfer(sanitize(long_g, 0.0), sanitize(lat_g, 0.0));

        let resolved_wheel_loads = wheel_loads.unwrap_or_else(|| {
            let base = quasi_static_total_load * 0.25;
            let front_corner = base + weight_transfer.front_load_change * 0.5;
            let rear_corner = base + weight_transfer.rear_load_change * 0.5;
            [front_corner, front_corner, rear_corner, rear_corner]
        });

        // Wheel-force integration: see `wheel_force::WheelForceIntegrator`.
        let drive_engaged = effective_throttle > 0.01
            && effective_brake < 0.01
            && !input.handbrake
            && pt_out.shift_state == powertrain::ShiftState::Engaged;
        let driven_wheel_torque = if drive_engaged {
            pt_out.drive_force * TIRE_RADIUS * AXLE_TO_CORNER_SPLIT * effective_throttle
        } else {
            0.0
        };
        let braking_active =
            effective_brake > 0.01 && !input.handbrake && !in_reverse && forward_speed > 0.1;
        let brake_torque_modifier = if braking_active {
            weather_modifiers.brake_efficiency_multiplier
                * tire_degradation.brake_efficiency
                * effective_brake
        } else {
            0.0
        };
        let wheel_force_out = self.wheel_force.step(&WheelForceInputs {
            dt,
            forward_speed,
            drive_engaged,
            driven_wheel_torque,
            braking_active,
            brake_torque_modifier,
            front_brake_force,
            rear_brake_force,
            resolved_wheel_loads,
            downforce_grip_bonus,
            environmental_grip_modifier,
            slip_angle_smoothed_deg: self.slip_angle_smoothed,
        });
        longitudinal_force += wheel_force_out.total_long_force;

        let (front_grip, rear_grip) = tire_model::calculate_tire_grip(
            self.slip_angle_smoothed,
            resolved_wheel_loads,
            grip_coefficient * downforce_grip_bonus,
            input.handbrake,
            effective_throttle > 0.01 && effective_brake < 0.01,
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
        let response_rate = if self.drift.is_drifting() { 20.0 } else { 22.0 };
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

        let wind_lateral_accel = wind_modifiers.lateral_force / CAR_MASS;
        let banking_accel = -banking_lateral_force / CAR_MASS;
        let new_lateral_speed =
            lateral_speed * lateral_correction + (wind_lateral_accel + banking_accel) * dt;

        let crosswind_yaw_moment = wind_modifiers.lateral_force * 0.3 / (CAR_MASS * WHEELBASE);

        // Clamp speeds with tire degradation effects
        let clamped_forward = new_forward_speed.clamp(-40.0 / 3.6, max_speed);
        let clamped_lateral = new_lateral_speed.clamp(-30.0, 30.0);

        // Reconstruct velocity
        let new_velocity = forward_dir
            .scale(clamped_forward)
            .add(right_dir.scale(clamped_lateral));

        // Cap angular velocity
        let max_ang_vel = if self.drift.is_drifting() { 2.8 } else { 1.8 };
        let final_ang_vel =
            (self.target_angular_velocity + drift_rotation + crosswind_yaw_moment * dt)
                .clamp(-max_ang_vel, max_ang_vel);

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

        let roll_pitch_damping = 1.0 - (12.0 * dt).min(1.0);
        let damped_angvel_x = current_angvel.x * roll_pitch_damping;
        let damped_angvel_z = current_angvel.z * roll_pitch_damping;

        CarPhysicsOutput {
            linear_velocity: [
                sanitize(new_velocity.x, 0.0),
                sanitize(current_linvel.y, 0.0),
                sanitize(new_velocity.z, 0.0),
            ],
            angular_velocity: [
                sanitize(damped_angvel_x, 0.0),
                sanitize(final_ang_vel, 0.0),
                sanitize(damped_angvel_z, 0.0),
            ],
            speed_kmh: self.speed_kmh,
            forward_speed_ms: sanitize(signed_forward_speed, 0.0),
            gear: self.gear,
            rpm: self.rpm,
            current_gear_ratio: pt_out.gear_ratio,
            slip_angle: self.slip_angle_smoothed,
            is_drifting: self.drift.is_drifting(),
            effective_grip: combined_grip,
            lateral_g: sanitize(lat_g, 0.0),
            longitudinal_g: sanitize(long_g, 0.0),
            skid_intensity,
            tire_wear: Default::default(),
            steer_angle: self.steer_angle,
            temperature: Default::default(),
            aquaplaning: Default::default(),
            tire_thermal_shock: Default::default(),
            ers: Default::default(),
            active_aero: Default::default(),
            grip_breakdown: Default::default(),
            tire_material: Default::default(),
            downforce_newtons: sanitize(downforce, 0.0),
            per_wheel_terrain: Default::default(),
            bottoming_out: Default::default(),
            per_wheel_forces: PerWheelForces {
                fx: wheel_force_out.fx_per_wheel,
                fy: wheel_force_out.fy_per_wheel,
                fz: resolved_wheel_loads,
                slip_angle: [self.slip_angle_smoothed; 4],
                slip_ratio: wheel_force_out.slip_ratio_per_wheel,
            },
        }
    }

    pub fn get_rpm(&self) -> f32 {
        self.rpm
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
