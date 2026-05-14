pub mod aerodynamics;
pub mod clutch;
pub mod differential;
pub mod driveshaft;
pub mod drift;
pub mod fuel;
pub mod override_mode;
pub mod powertrain;
pub mod steering;
pub mod tire_model;
pub mod turbo;
pub mod weight_transfer;
pub mod wheel_force;

use crate::car_physics::powertrain::TIRE_RADIUS;
use crate::car_physics::wheel_force::{WheelForceIntegrator, WheelForceInputs};
use crate::constants::car::*;
use crate::types::{
    CarInput, CarPhysicsOutput, PerWheelForces, TireDegradationModifiers, WeatherModifiers,
    WindModifiers,
};
use crate::utils::{lerp, sanitize, Quat, Vec3};

// Linear damping rate (1/s) applied to body forward velocity below 1 m/s
// while braking. Compensates for slip-ratio oscillation at near-zero speed.
const LOW_SPEED_CREEP_DAMPING_RATE: f32 = 8.0;

/// Gearbox-output angular velocity (rad/s) — the engine-side speed
/// reference shared by both rear half-shafts. Crank ω ÷ total ratio.
fn gearbox_output_omega_rad_s(pt: &powertrain::PowertrainOutput) -> f32 {
    let crank_omega = pt.rpm * std::f32::consts::TAU / 60.0;
    crank_omega / pt.total_gear_ratio.max(1e-3)
}


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
    clutch: clutch::ClutchState,
    turbo: turbo::TurboState,
    fuel: fuel::FuelState,
    fuel_flow_factor_prev: f32,
    differential: differential::DifferentialConfig,
    shaft: driveshaft::ShaftConfig,
    /// Wave-2 feature flag: when `true`, the body lateral velocity
    /// integrates `total_lat_force / m × dt` from the wheel-force
    /// integrator and yaw rate derives from the force-shaped path
    /// (`calculate_turn_dynamics_from_lateral_force`). When `false`,
    /// the legacy lateral-correction damper + Ackermann yaw runs
    /// unchanged. Behind a flag during plan execution so the swap
    /// can be staged and rebaselined cleanly.
    force_shaped_lateral: bool,
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
            clutch: clutch::ClutchState::new(),
            turbo: turbo::TurboState::new(),
            fuel: fuel::FuelState::new(),
            fuel_flow_factor_prev: 1.0,
            differential: differential::DifferentialConfig::new(),
            shaft: driveshaft::ShaftConfig::new(),
            // Default off: the force-shaped path is wired, sign-correct,
            // and passes 600-frame L/R symmetry + 1000-step soak, but
            // flipping the default rebalances handling globally
            // (drift entry/exit, peak cornering) in ways the existing
            // calibration suite can't fully validate. Hosts opt in via
            // `set_force_shaped_lateral(true)`.
            force_shaped_lateral: false,
        }
    }
}

impl CarPhysicsState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Wave-2 lateral-dynamics path selector. When `true`, body lateral
    /// velocity integrates the wheel-force `total_lat_force` and yaw
    /// derives from the force-shaped bicycle model; when `false` (the
    /// pre-Wave-2 default), the Ackermann + lateral-correction damper
    /// path runs unchanged.
    pub fn set_force_shaped_lateral(&mut self, enabled: bool) {
        self.force_shaped_lateral = enabled;
    }

    pub fn force_shaped_lateral(&self) -> bool {
        self.force_shaped_lateral
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
        // Wave 3 Phase 6: full grip-stack multiplier (surface × material
        // × weather × aqua × terrain × curb × thermal_shock). Replaces
        // the Wave 2 split (separate `curb_grip_bonus` and
        // `environmental_grip_modifier`). Both Fx and Fy paths multiply
        // this single value.
        combined_grip_multiplier: f32,
        is_on_curb: bool,
        curb_speed_multiplier: f32,
        ers_boost: f32,
        active_aero_drag_mult: f32,
        active_aero_front_downforce_mult: f32,
        active_aero_rear_downforce_mult: f32,
        engine_braking_force: f32,
        engine_power_multiplier: f32,
        front_brake_force: f32,
        rear_brake_force: f32,
        ers_harvest_decel: f32,
        air_density: f32,
        surface_normal: [f32; 3],
        wheel_loads: Option<[f32; 4]>,
        front_ride_height_m: f32,
        rear_ride_height_m: f32,
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

        let effective_throttle = if input.throttle > 0.01 {
            input.throttle.clamp(0.0, 1.0)
        } else if input.forward {
            1.0
        } else {
            0.0
        };
        // Turbo runs before powertrain so this frame's combustion sees the
        // already-integrated boost. RPM is last frame's value (one-frame
        // lag); at 120 Hz that's < 5% of τ — within model noise.
        let (boost_pressure_bar, boost_multiplier) =
            self.turbo.update(effective_throttle, self.rpm, dt);

        let pt_out = self.powertrain.update(&powertrain::PowertrainInput {
            dt,
            speed_ms: self.speed_ms,
            max_speed_ms: max_speed,
            is_throttle: effective_throttle_for_pt,
            ers_boost_n: ers_boost,
            engine_efficiency: weather_modifiers.engine_efficiency_multiplier * engine_power_multiplier,
            engine_power_mult: 1.0,
            boost_multiplier,
            fuel_flow_factor: self.fuel_flow_factor_prev,
        });
        self.gear = pt_out.gear;
        self.rpm = pt_out.rpm;

        // Fuel runs after powertrain: integrates the ICE's *current* demand
        // and yields the factor that gates the next frame. One-frame lag is
        // within combustion-cycle noise at 120 Hz. The demand value comes
        // directly from `PowertrainOutput.engine_power_demand_w` — pre-cap,
        // pre-ERS, pre-transmission-loss, so the fuel cap measures the true
        // ICE demand.
        let (fuel_flow_factor, _burned_kg) =
            self.fuel.update(pt_out.engine_power_demand_w, self.rpm, dt);
        self.fuel_flow_factor_prev = fuel_flow_factor;

        // Effective grip. Wave 3 Phase 7 review fix:
        // `weather_modifiers.friction_slip_multiplier` is folded into
        // `combined_grip_multiplier` upstream (engine.rs) so the yaw and
        // Fx/Fy paths share weather. `tire_degradation.grip_multiplier`
        // stays here in the yaw-path-only chain because it already
        // captures wet penalty via `wrong_conditions_penalty` — folding
        // it upstream would double-apply weather to Fx/Fy.
        let grip_coefficient = BASE_TIRE_GRIP_COEFFICIENT
            * tire_degradation.grip_multiplier
            * combined_grip_multiplier;
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
        let live_mass = self.live_mass_kg();

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
                longitudinal_force -= forward_speed * live_mass * 15.0;
            }
        } else if in_reverse {
            let reverse_force = 8000.0;
            longitudinal_force -= reverse_force;
        } else if effective_brake > 0.01 && forward_speed.abs() < 1.0 {
            // Low-speed creep assist: the slip-ratio Pacejka path oscillates
            // near zero velocity because ω locks at 0 and slip jumps between
            // signs each frame. A linear damper on body velocity keeps the
            // car from stalling at ~0.9 m/s under full brake.
            longitudinal_force -= forward_speed * live_mass * LOW_SPEED_CREEP_DAMPING_RATE;
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
            let curb_drag = self.speed_ms * live_mass * (1.0 - curb_speed_multiplier) * 0.5;
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
        let gravity_normal = live_mass * 9.81 * slope_angle.cos();

        let normal_forward = (surface_normal[0] * forward_dir.x
            + surface_normal[1] * forward_dir.y
            + surface_normal[2] * forward_dir.z)
            .clamp(-1.0, 1.0);
        let pitch_angle = normal_forward.asin().clamp(-0.5, 0.5);
        let gravity_tangent = live_mass * 9.81 * pitch_angle.sin();

        let normal_right = (surface_normal[0] * right_dir.x
            + surface_normal[1] * right_dir.y
            + surface_normal[2] * right_dir.z)
            .clamp(-1.0, 1.0);
        let banking_angle = normal_right.asin().clamp(-0.5, 0.5);
        let banking_lateral_force = live_mass * 9.81 * banking_angle.sin();

        // Apply slope-induced longitudinal force (downhill = positive, uphill = negative)
        longitudinal_force += gravity_tangent;

        let (front_downforce, rear_downforce) = aerodynamics::get_split_downforce(
            self.speed_ms,
            active_aero_front_downforce_mult,
            active_aero_rear_downforce_mult,
            air_density,
            front_ride_height_m,
            rear_ride_height_m,
        );
        let downforce = front_downforce + rear_downforce;
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
            weight_transfer::calculate_weight_transfer(
                sanitize(long_g, 0.0),
                sanitize(lat_g, 0.0),
                live_mass,
            );

        let resolved_wheel_loads = wheel_loads.unwrap_or_else(|| {
            // Wave 3 Phase 4: per-axle downforce flows into the fallback Fz
            // reconstruction so DRS-mode rear unloading is visible at the
            // wheel level. Static gravity split uses WEIGHT_DIST_FRONT.
            let gravity_front_axle = gravity_normal * WEIGHT_DIST_FRONT;
            let gravity_rear_axle = gravity_normal * (1.0 - WEIGHT_DIST_FRONT);
            let front_axle_load = gravity_front_axle + front_downforce;
            let rear_axle_load = gravity_rear_axle + rear_downforce;
            // Per-corner split: half axle load + half weight-transfer change.
            let front_corner = front_axle_load * 0.5 + weight_transfer.front_load_change * 0.5;
            let rear_corner = rear_axle_load * 0.5 + weight_transfer.rear_load_change * 0.5;
            [front_corner, front_corner, rear_corner, rear_corner]
        });

        // Wheel-force integration: see `wheel_force::WheelForceIntegrator`.
        let drive_engaged = effective_throttle > 0.01
            && effective_brake < 0.01
            && !input.handbrake
            && pt_out.shift_state == powertrain::ShiftState::Engaged;
        // Total rear-axle drive torque. LSD inside the integrator splits
        // it into RL/RR. The earlier × AXLE_TO_CORNER_SPLIT was an
        // open-diff approximation; the differential now does the work.
        let driven_axle_torque = if drive_engaged {
            pt_out.drive_force * TIRE_RADIUS * effective_throttle
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
        // Wave 3 Phase 5: clutch engagement based on current engine RPM.
        // The integrator uses this to (a) reflect engine inertia at the
        // driven wheels and (b) gate the transmitted drive torque so the
        // energy balance stays physical.
        let clutch_engagement = self.clutch.engagement_for(self.rpm, dt);
        // Bicycle-model axle distances. WEIGHT_DIST_FRONT is the static
        // front-load fraction; CG sits `(1 - WEIGHT_DIST_FRONT) × L`
        // behind the front axle for an F1 47/53 front/rear bias.
        let a_front_m = WHEELBASE * (1.0 - WEIGHT_DIST_FRONT);
        let b_rear_m = WHEELBASE * WEIGHT_DIST_FRONT;
        let wheel_force_out = self.wheel_force.step(&WheelForceInputs {
            dt,
            forward_speed,
            drive_engaged,
            driven_axle_torque,
            differential: self.differential,
            braking_active,
            brake_torque_modifier,
            front_brake_force,
            rear_brake_force,
            resolved_wheel_loads,
            downforce_grip_bonus,
            combined_grip_multiplier,
            slip_angle_smoothed_deg: self.slip_angle_smoothed,
            lateral_speed_ms: lateral_speed,
            yaw_rate_rad_s: current_angvel.y,
            steer_angle_rad: self.steer_angle,
            a_front_m,
            b_rear_m,
            clutch_engagement,
            total_gear_ratio: pt_out.total_gear_ratio,
            engine_side_omega_rad_s: gearbox_output_omega_rad_s(&pt_out),
            shaft: self.shaft,
        });
        longitudinal_force += wheel_force_out.total_long_force;

        let yaw_grip = grip_coefficient * downforce_grip_bonus;

        // Two lateral-dynamics paths gated on `force_shaped_lateral`:
        //
        // Force-shaped (Wave 2+, target architecture): yaw rate derives
        // from total wheel lat force via the bicycle centripetal model;
        // body lateral velocity integrates `F_y / m · dt` with a continuous
        // damper that replaces the binary `is_drifting` lateral_correction
        // step. Front/rear grip asymmetry from per-axle slip now reaches
        // the body.
        //
        // Legacy (pre-Wave-2): Ackermann + grip-multiplier yaw, with
        // binary drift_rotation and `lateral_correction` damper on v_y.
        let (angular_velocity, drift_rotation, new_lateral_speed_pre_clamp) =
            if self.force_shaped_lateral {
                let steer_sign = if self.steer_angle.abs() > f32::EPSILON {
                    self.steer_angle.signum()
                } else {
                    0.0
                };
                let yaw = steering::calculate_turn_dynamics_from_lateral_force(
                    wheel_force_out.total_lat_force,
                    live_mass,
                    self.speed_ms,
                    steer_sign,
                );
                // Continuous slip-angle-dependent lateral damper. At zero
                // slip the damping rate is small (no spurious decay);
                // grows smoothly past the drift threshold so the car
                // doesn't slide infinitely in a half-spin. Replaces the
                // binary `lateral_correction` step.
                let slip_mag_deg = self.slip_angle_smoothed.abs();
                let damping_rate_hz = lerp(0.5, 4.0, (slip_mag_deg / 20.0).clamp(0.0, 1.0));
                // In this codebase, positive `total_lat_force` corresponds
                // to a right turn (see `calculate_turn_dynamics_from_lateral_force`
                // sign-convention doc). Right turn → body accelerates
                // toward +X (right) = positive lateral_speed delta.
                let lat_accel = wheel_force_out.total_lat_force / live_mass;
                let wind_lat_accel = wind_modifiers.lateral_force / live_mass;
                let banking_accel = -banking_lateral_force / live_mass;
                let v_y_next = lateral_speed
                    + (lat_accel + wind_lat_accel + banking_accel) * dt
                    - lateral_speed * damping_rate_hz * dt;
                (yaw, 0.0, v_y_next)
            } else {
                let yaw = if self.steer_angle.abs() > 0.005 && self.speed_ms > 0.3 {
                    steering::calculate_turn_dynamics(
                        self.steer_angle,
                        self.speed_ms,
                        yaw_grip,
                        self.drift.is_drifting(),
                    )
                } else {
                    0.0
                };
                let drift_rot = if self.drift.is_drifting() {
                    self.slip_angle_smoothed.to_radians() * 0.015
                } else {
                    0.0
                };
                let lateral_correction = self.drift.get_lateral_correction(
                    yaw_grip,
                    weather_modifiers.drift_lateral_correction_multiplier,
                    if is_on_curb { 1.1 } else { 1.0 },
                    tire_degradation.lateral_correction_penalty,
                );
                let wind_lat_accel = wind_modifiers.lateral_force / live_mass;
                let banking_accel = -banking_lateral_force / live_mass;
                let v_y_next =
                    lateral_speed * lateral_correction + (wind_lat_accel + banking_accel) * dt;
                (yaw, drift_rot, v_y_next)
            };

        // Legacy Ackermann path needs an explicit 22 Hz lerp because
        // `angular_velocity` is a geometric target (turn radius / grip)
        // that should ease in. The force-shaped path is already a
        // physical centripetal output and has no such filter; passing
        // it through the 22 Hz lag adds ~45 ms of artificial response
        // delay on top of the Pacejka response.
        if self.force_shaped_lateral {
            self.target_angular_velocity = angular_velocity;
        } else {
            let response_rate = if self.drift.is_drifting() { 20.0 } else { 22.0 };
            self.target_angular_velocity = lerp(
                self.target_angular_velocity,
                angular_velocity,
                dt * response_rate,
            );
        }

        let new_forward_speed = forward_speed + (longitudinal_force / live_mass) * dt;
        let new_lateral_speed = new_lateral_speed_pre_clamp;

        // Yaw moment uses dry mass: rotational inertia about the vertical axis
        // is dominated by the rigid chassis; fuel-tank slosh is not modelled.
        let crosswind_yaw_moment = wind_modifiers.lateral_force * 0.3 / (CAR_MASS_DRY * WHEELBASE);

        // Clamp speeds with tire degradation effects
        let clamped_forward = new_forward_speed.clamp(-40.0 / 3.6, max_speed);
        let clamped_lateral = new_lateral_speed.clamp(-30.0, 30.0);

        // Reconstruct velocity
        let new_velocity = forward_dir
            .scale(clamped_forward)
            .add(right_dir.scale(clamped_lateral));

        // Speed-scheduled angular-velocity cap, C¹-continuous across the
        // full speed range. Replaces the prior {1.8 grip, 2.8 drift} step,
        // which produced a perceptible "snap" whenever ω lingered at the
        // grip cap long enough to push slip past the drift threshold and
        // the cap jumped by ~1 rad/s in a single frame.
        //
        // Anchors:
        //   ≤ 40 km/h  →  2.8 rad/s  (low-speed agility preserved)
        //   ≥ 220 km/h →  1.5 rad/s  (high-speed stability)
        // Half-cosine blend in between.
        let max_ang_vel = {
            const V_LO: f32 = 40.0 / 3.6;
            const V_HI: f32 = 220.0 / 3.6;
            const OMEGA_LO: f32 = 2.8;
            const OMEGA_HI: f32 = 1.5;
            let t = ((self.speed_ms - V_LO) / (V_HI - V_LO)).clamp(0.0, 1.0);
            let eased = 0.5 - 0.5 * (t * std::f32::consts::PI).cos();
            OMEGA_LO + eased * (OMEGA_HI - OMEGA_LO)
        };
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
            effective_grip: grip_coefficient,
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
                slip_angle: wheel_force_out.slip_angle_per_wheel,
                slip_ratio: wheel_force_out.slip_ratio_per_wheel,
            },
            boost_pressure_bar: sanitize(boost_pressure_bar, 1.0),
            fuel_mass_kg: sanitize(self.fuel.fuel_mass_kg(), 0.0),
            fuel_flow_factor: sanitize(self.fuel_flow_factor_prev, 1.0),
            driven_torque_per_wheel: wheel_force_out
                .driven_torque_per_wheel
                .map(|v| sanitize(v, 0.0)),
        }
    }

    /// Reset the powertrain to launch state (1st gear, idle RPM, engaged).
    /// Wave 4: used by formation-lap-warmup test scenarios.
    pub fn reset_powertrain_for_launch(&mut self) {
        self.powertrain.reset_for_launch();
        self.turbo = turbo::TurboState::new();
        self.fuel = fuel::FuelState::new();
        self.fuel_flow_factor_prev = 1.0;
        self.wheel_force.reset_shaft_torque();
    }

    pub fn get_shaft_stiffness_nm_rad(&self) -> f32 {
        self.shaft.stiffness_nm_rad()
    }

    pub fn get_shaft_damping_nm_s_rad(&self) -> f32 {
        self.shaft.damping_nm_s_rad()
    }

    pub fn set_shaft_stiffness_nm_rad(&mut self, k: f32) {
        self.shaft.set_stiffness_nm_rad(k);
    }

    pub fn set_shaft_damping_nm_s_rad(&mut self, c: f32) {
        self.shaft.set_damping_nm_s_rad(c);
    }

    pub fn get_boost_pressure_bar(&self) -> f32 {
        self.turbo.boost_bar()
    }

    pub fn get_fuel_mass_kg(&self) -> f32 {
        self.fuel.fuel_mass_kg()
    }

    pub fn get_fuel_flow_factor(&self) -> f32 {
        self.fuel_flow_factor_prev
    }

    pub fn set_fuel_mass_kg(&mut self, kg: f32) {
        self.fuel.set_fuel_mass_kg(kg);
    }

    pub fn get_fuel_mix_mode(&self) -> fuel::FuelMixMode {
        self.fuel.mix()
    }

    pub fn set_fuel_mix_mode(&mut self, mode: fuel::FuelMixMode) {
        self.fuel.set_mix(mode);
    }

    pub fn live_mass_kg(&self) -> f32 {
        crate::constants::car::CAR_MASS_DRY + self.fuel.fuel_mass_kg()
    }

    pub fn get_diff_preload_nm(&self) -> f32 {
        self.differential.preload_nm()
    }

    pub fn get_diff_power_ramp_deg(&self) -> f32 {
        self.differential.power_ramp_deg()
    }

    pub fn get_diff_coast_ramp_deg(&self) -> f32 {
        self.differential.coast_ramp_deg()
    }

    pub fn set_diff_preload_nm(&mut self, nm: f32) {
        self.differential.set_preload_nm(nm);
    }

    pub fn set_diff_power_ramp_deg(&mut self, deg: f32) {
        self.differential.set_power_ramp_deg(deg);
    }

    pub fn set_diff_coast_ramp_deg(&mut self, deg: f32) {
        self.differential.set_coast_ramp_deg(deg);
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
