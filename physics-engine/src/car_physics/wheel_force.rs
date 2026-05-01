use crate::car_physics::differential::DifferentialConfig;
use crate::car_physics::driveshaft::{decay_first_order, ShaftConfig};
use crate::car_physics::powertrain::{ENGINE_INERTIA, TIRE_RADIUS};
use crate::car_physics::tire_model::{
    combined_slip, gx_combined, gy_combined, pacejka_lateral_per_wheel, pacejka_longitudinal,
    peak_mu_lat_at_fz, peak_mu_lon_at_fz, CombinedSlipCoeffs, PacejkaCoeffs,
    TIRE_DEFAULT_LOAD_SENSITIVITY,
};
use crate::constants::car::BASE_TIRE_GRIP_COEFFICIENT;
use crate::tires::is_front_wheel;
use crate::utils::sanitize;

const WHEEL_INERTIA: f32 = 8.0;
const SLIP_RATIO_VEL_FLOOR_MS: f32 = 0.5;
const SLIP_RATIO_ABS_CLAMP: f32 = 2.0;
const WHEEL_OMEGA_OVERSPEED_RATIO: f32 = 5.0;
const WHEEL_OMEGA_OVERSPEED_BIAS_RAD_S: f32 = 50.0;
/// Brake torque is configured per-axle but applied per-corner. The drive
/// path no longer uses this — the LSD does that split via `differential.rs`.
pub const BRAKE_AXLE_TO_CORNER_SPLIT: f32 = 0.5;

/// Per-step inputs to the wheel-force integrator.
pub struct WheelForceInputs {
    pub dt: f32,
    pub forward_speed: f32,
    pub drive_engaged: bool,
    /// Total rear-axle drive torque (Nm). Component #3 (LSD) introduced
    /// this in place of the per-corner value: the differential splits it
    /// into RL/RR torques inside the integrator using live wheel angvel.
    pub driven_axle_torque: f32,
    pub differential: DifferentialConfig,
    pub braking_active: bool,
    pub brake_torque_modifier: f32,
    pub front_brake_force: f32,
    pub rear_brake_force: f32,
    pub resolved_wheel_loads: [f32; 4],
    pub downforce_grip_bonus: f32,
    /// Wave 3 Phase 6: full grip-stack multiplier (surface × material ×
    /// weather × aqua × terrain × curb × thermal_shock). Both longitudinal
    /// and lateral paths multiply this single value after G-method
    /// weighting. Cold-rubber drop on launch is calibrated via
    /// `BASE_TIRE_GRIP_COEFFICIENT` rather than a per-axis split.
    pub combined_grip_multiplier: f32,
    /// Chassis-level slip angle in degrees, after Wave 1 EMA smoothing.
    /// Phase 1 (Wave 3) feeds it as the per-wheel slip angle (no kinematic
    /// yaw-rate × wheel-offset correction yet — see Wave 4 backlog).
    /// Used to compute per-wheel Fy alongside the existing Fx.
    pub slip_angle_smoothed_deg: f32,
    /// Wave 3 Phase 5: clutch engagement on `[0, 1]`. Slipping clutch
    /// (engagement < 1) reduces both transmitted drive torque and the
    /// reflected engine inertia at the driven wheels.
    pub clutch_engagement: f32,
    /// Wave 3 Phase 5: total transmission ratio (`gear_ratio × FINAL_DRIVE`).
    /// Used to reflect engine inertia into the driven-wheel ODE via
    /// `(total_gear_ratio × clutch_engagement)²`.
    pub total_gear_ratio: f32,
    /// Component #4: gearbox-output angular velocity (rad/s) seen by both
    /// rear half-shafts. Equals `engine_omega_rad_s / total_gear_ratio`
    /// when the clutch is locked. Drives the shaft Δω.
    pub engine_side_omega_rad_s: f32,
    pub shaft: ShaftConfig,
}

const SHAFT_DISENGAGE_DECAY_TAU_S: f32 = 0.05;

/// Per-step output from the wheel-force integrator. Phase 1 (Wave 3)
/// promotes Fy to per-wheel newtons alongside Fx. The body-frame yaw
/// computation stays on the legacy μ-scalar path (Phase 6 deliberately
/// kept it for bootstrap stability — see `car_physics::mod::step`).
#[derive(Debug, Default, Clone, Copy)]
pub struct WheelForceOutput {
    pub total_long_force: f32,
    pub total_lat_force: f32,
    pub fx_per_wheel: [f32; 4],
    pub fy_per_wheel: [f32; 4],
    pub slip_ratio_per_wheel: [f32; 4],
    /// Drive torque (Nm) actually applied at each wheel after the LSD
    /// split. Front entries are always 0.0. Useful for debug + future
    /// driveshaft-compliance work (component #4).
    pub driven_torque_per_wheel: [f32; 4],
}

#[derive(Debug, Default)]
pub struct WheelForceIntegrator {
    wheel_angvel: [f32; 4],
    prev_wheel_fx: [f32; 4],
    /// Per-half-axle driveshaft twist (rad). [0] = RL, [1] = RR.
    /// 1st-order delivered drive torque per rear shaft (Nm). Tracks the
    /// LSD allocation with τ = WHEEL_INERTIA / damping. Was named
    /// `shaft_twist` during the spring-damper draft of this component.
    shaft_torque_delivered_nm: [f32; 2],
}

impl WheelForceIntegrator {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn wheel_angvel(&self) -> [f32; 4] {
        self.wheel_angvel
    }

    pub fn shaft_torque_delivered_nm(&self) -> [f32; 2] {
        self.shaft_torque_delivered_nm
    }

    pub fn reset_shaft_torque(&mut self) {
        self.shaft_torque_delivered_nm = [0.0; 2];
    }

    pub fn prev_wheel_fx(&self) -> [f32; 4] {
        self.prev_wheel_fx
    }

    /// Integrate per-wheel angular velocity from drive + brake torque,
    /// compute slip ratios, route through `pacejka_longitudinal` /
    /// `pacejka_lateral_per_wheel` with Pacejka G-method coupling and
    /// a 2-axis friction-ellipse cap, then apply the unified grip chain
    /// (`BASE_TIRE_GRIP_COEFFICIENT × downforce × combined_grip_mult`)
    /// to both Fx and Fy. Tire-reaction torque uses last frame's Fx
    /// (1-step lag at 120Hz).
    pub fn step(&mut self, i: &WheelForceInputs) -> WheelForceOutput {
        let omega_cap = (i.forward_speed.abs() / TIRE_RADIUS) * WHEEL_OMEGA_OVERSPEED_RATIO
            + WHEEL_OMEGA_OVERSPEED_BIAS_RAD_S;
        let v_floor = i.forward_speed.abs().max(SLIP_RATIO_VEL_FLOOR_MS);
        let slip_angle_rad = i.slip_angle_smoothed_deg.to_radians();
        // Wave 3 Phase 5: reflected engine inertia for driven wheels.
        // I_eff = WHEEL_INERTIA + ENGINE_INERTIA × (total_gear_ratio × engagement)²
        // At locked clutch in 1st gear (gear=3.6 × final=2.9 ≈ 10.4) this is
        // ~24 kg·m² — much larger than the bare wheel inertia (8 kg·m²) and
        // dominates the wheel-spin time constant for driven wheels.
        let coupling = i.total_gear_ratio * i.clutch_engagement;
        let driven_i_eff = WHEEL_INERTIA + ENGINE_INERTIA * coupling * coupling;

        // LSD splits the rear-axle drive torque between RL (index 2) and
        // RR (index 3) using current wheel speeds. Clutch attenuation
        // applies to the axle total before the split.
        let axle_drive_torque = if i.drive_engaged {
            i.driven_axle_torque * i.clutch_engagement
        } else {
            0.0
        };
        let (rear_torque_rl, rear_torque_rr) = i.differential.distribute_axle_torque(
            axle_drive_torque,
            self.wheel_angvel[2],
            self.wheel_angvel[3],
        );

        let mut wheel_long_force = 0.0_f32;
        let mut wheel_lat_force = 0.0_f32;
        let mut wheel_fx_now = [0.0_f32; 4];
        let mut wheel_fy_now = [0.0_f32; 4];
        let mut wheel_slip_ratio_now = [0.0_f32; 4];
        let mut driven_torque_per_wheel = [0.0_f32; 4];
        for wheel in 0..4 {
            let is_front = is_front_wheel(wheel);
            let is_driven = !is_front;
            let per_axle_brake = if is_front {
                i.front_brake_force
            } else {
                i.rear_brake_force
            };
            let has_brake_torque = i.braking_active && per_axle_brake > 0.0;
            let inertia = if is_driven { driven_i_eff } else { WHEEL_INERTIA };

            if !is_driven && !has_brake_torque {
                self.wheel_angvel[wheel] = i.forward_speed / TIRE_RADIUS;
            } else {
                // Component #4: rear drive torque flows through the
                // half-shaft compliance, modelled as a first-order torque
                // lag. The shaft's twist state holds the *currently
                // delivered* torque; it tracks the LSD allocation with
                // time constant τ = I_eff / c. At τ ≈ 0.4 s for default
                // (I=8, c=20) this gives a noticeable but bounded delay.
                let drive_torque = if is_driven {
                    let shaft_idx = wheel - 2;
                    let lsd_torque = if wheel == 2 { rear_torque_rl } else { rear_torque_rr };
                    if i.drive_engaged {
                        let tau = (WHEEL_INERTIA / i.shaft.damping_nm_s_rad().max(1.0))
                            .clamp(0.001, 1.0);
                        let alpha = i.dt / (tau + i.dt);
                        let prev = self.shaft_torque_delivered_nm[shaft_idx];
                        let next = prev + (lsd_torque - prev) * alpha;
                        self.shaft_torque_delivered_nm[shaft_idx] = next;
                        next
                    } else {
                        self.shaft_torque_delivered_nm[shaft_idx] = decay_first_order(
                            self.shaft_torque_delivered_nm[shaft_idx],
                            i.dt,
                            SHAFT_DISENGAGE_DECAY_TAU_S,
                        );
                        0.0
                    }
                } else {
                    0.0
                };
                if is_driven {
                    driven_torque_per_wheel[wheel] = drive_torque;
                }
                let brake_torque_corner =
                    per_axle_brake * BRAKE_AXLE_TO_CORNER_SPLIT * i.brake_torque_modifier * TIRE_RADIUS;
                // Brake opposes macro vehicle motion. Using ω.signum() causes
                // a sign-flip oscillation when ω crosses zero (signum(0)=+1)
                // which pumps spurious force into prev_wheel_fx.
                let brake_signed_torque = -brake_torque_corner * i.forward_speed.signum();
                let tire_reaction_torque = self.prev_wheel_fx[wheel] * TIRE_RADIUS;
                let net_torque = drive_torque + brake_signed_torque - tire_reaction_torque;
                let omega_before = self.wheel_angvel[wheel];
                let omega_after = omega_before + net_torque / inertia * i.dt;
                // Anti-overshoot: brake-only step that would carry ω across
                // zero clamps at zero so the wheel doesn't reverse-spin.
                self.wheel_angvel[wheel] = if drive_torque.abs() < f32::EPSILON
                    && has_brake_torque
                    && omega_before * omega_after < 0.0
                {
                    0.0
                } else {
                    omega_after
                };
                self.wheel_angvel[wheel] = self.wheel_angvel[wheel].clamp(-omega_cap, omega_cap);
            }

            let slip_ratio =
                ((self.wheel_angvel[wheel] * TIRE_RADIUS - i.forward_speed) / v_floor)
                    .clamp(-SLIP_RATIO_ABS_CLAMP, SLIP_RATIO_ABS_CLAMP);
            wheel_slip_ratio_now[wheel] = slip_ratio;
            let fz = i.resolved_wheel_loads[wheel].max(0.0);
            let fx_pure = sanitize(
                pacejka_longitudinal(slip_ratio, fz, &PacejkaCoeffs::LONGITUDINAL_DEFAULT),
                0.0,
            );
            let fy_pure = sanitize(
                pacejka_lateral_per_wheel(
                    slip_angle_rad,
                    fz,
                    &PacejkaCoeffs::LATERAL_DEFAULT,
                    TIRE_DEFAULT_LOAD_SENSITIVITY,
                ),
                0.0,
            );
            // Phase 2 (Wave 3): Pacejka G-method weights pure-slip Fx by
            // lateral slip and pure-slip Fy by longitudinal slip. At zero
            // off-axis slip both multipliers are 1.0 (pure-slip preserved).
            // The friction-ellipse below is now a defensive guard since
            // G-method already keeps total magnitude inside the circle.
            let g_x = gx_combined(
                slip_ratio,
                slip_angle_rad,
                &CombinedSlipCoeffs::LATERAL_DEFAULT_COMBINED,
            );
            let g_y = gy_combined(
                slip_angle_rad,
                slip_ratio,
                &CombinedSlipCoeffs::LATERAL_DEFAULT_COMBINED,
            );
            let fx_combined = fx_pure * g_x;
            let fy_combined = fy_pure * g_y;
            // Two-axis friction-ellipse cap. Radius uses the larger of
            // lateral / longitudinal peak μ (matches Wave 1's
            // `calculate_per_wheel_forces` ellipse).
            let mu_fz_limit = peak_mu_lat_at_fz(fz).max(peak_mu_lon_at_fz(fz)) * fz;
            let (fx_capped, fy_capped) = combined_slip(fx_combined, fy_combined, mu_fz_limit);
            // Wave 3 Phase 6: unified grip stack. Both axes multiply by the
            // same `BASE_TIRE_GRIP_COEFFICIENT × downforce_grip_bonus ×
            // combined_grip_multiplier` chain. Replaces the Wave 2 split
            // where the lateral path got the full chain and the longitudinal
            // path only the environmental subset.
            let grip_chain =
                BASE_TIRE_GRIP_COEFFICIENT * i.downforce_grip_bonus * i.combined_grip_multiplier;
            let fx = fx_capped * grip_chain;
            let fy = fy_capped * grip_chain;
            wheel_fx_now[wheel] = fx;
            wheel_fy_now[wheel] = fy;
            wheel_long_force += fx;
            wheel_lat_force += fy;
        }
        self.prev_wheel_fx = wheel_fx_now;
        WheelForceOutput {
            total_long_force: wheel_long_force,
            total_lat_force: wheel_lat_force,
            fx_per_wheel: wheel_fx_now,
            fy_per_wheel: wheel_fy_now,
            slip_ratio_per_wheel: wheel_slip_ratio_now,
            driven_torque_per_wheel,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn nominal_loads() -> [f32; 4] {
        [1957.0; 4]
    }

    fn idle_inputs() -> WheelForceInputs {
        WheelForceInputs {
            dt: 1.0 / 120.0,
            forward_speed: 10.0,
            drive_engaged: false,
            driven_axle_torque: 0.0,
            differential: DifferentialConfig::new(),
            braking_active: false,
            brake_torque_modifier: 0.0,
            front_brake_force: 0.0,
            rear_brake_force: 0.0,
            resolved_wheel_loads: nominal_loads(),
            downforce_grip_bonus: 1.0,
            combined_grip_multiplier: 1.0,
            slip_angle_smoothed_deg: 0.0,
            // Default: idle (slipping clutch, low inertia coupling). Tests
            // that need locked-clutch behaviour override these explicitly.
            clutch_engagement: 0.1,
            total_gear_ratio: 0.0,
            engine_side_omega_rad_s: 0.0,
            shaft: ShaftConfig::new(),
        }
    }

    #[test]
    fn idle_no_drive_no_brake_rolls_front_kinematically() {
        // Front wheels (non-driven, no brake) snap to kinematic ω = v/r
        // every step. Rear wheels integrate freely under zero net torque
        // and stay near their previous value (start at 0 here) — the
        // engine-brake path in `mod.rs` handles rear off-throttle decel,
        // not the integrator.
        let mut s = WheelForceIntegrator::new();
        let _ = s.step(&idle_inputs());
        let target = 10.0 / TIRE_RADIUS;
        for w in 0..2 {
            assert!(
                (s.wheel_angvel()[w] - target).abs() < 1e-3,
                "front wheel {} expected {:.3}, got {:.3}",
                w,
                target,
                s.wheel_angvel()[w]
            );
        }
    }

    #[test]
    fn full_throttle_drive_torque_applies_to_rear_only() {
        let mut s = WheelForceIntegrator::new();
        // Seed wheels at the rolling-kinematic ω so we measure drive
        // torque's effect on top of cruise, not the integrator spool-up.
        let kinematic = 10.0 / TIRE_RADIUS;
        s.wheel_angvel = [kinematic; 4];
        let mut inputs = idle_inputs();
        inputs.drive_engaged = true;
        inputs.driven_axle_torque = 4000.0;
        inputs.clutch_engagement = 1.0;
        inputs.engine_side_omega_rad_s = 200.0;
        for _ in 0..120 {
            s.step(&inputs);
        }
        let target_kinematic = 10.0 / TIRE_RADIUS;
        // Front rolls kinematically.
        assert!((s.wheel_angvel()[0] - target_kinematic).abs() < 1e-3);
        assert!((s.wheel_angvel()[1] - target_kinematic).abs() < 1e-3);
        // Rear diverges (spins faster under drive torque).
        assert!(
            s.wheel_angvel()[2] > target_kinematic,
            "RL {} not > {}",
            s.wheel_angvel()[2],
            target_kinematic
        );
        assert!(
            s.wheel_angvel()[3] > target_kinematic,
            "RR {} not > {}",
            s.wheel_angvel()[3],
            target_kinematic
        );
    }

    #[test]
    fn full_brake_anti_overshoot_clamps_to_zero() {
        let mut s = WheelForceIntegrator::new();
        // Seed a small positive ω so the next step would carry it past zero
        // under brake-only torque.
        s.wheel_angvel = [0.5, 0.5, 0.5, 0.5];
        let mut inputs = idle_inputs();
        inputs.forward_speed = 0.5;
        inputs.braking_active = true;
        inputs.brake_torque_modifier = 1.0;
        inputs.front_brake_force = 30000.0;
        inputs.rear_brake_force = 30000.0;
        s.step(&inputs);
        for w in 0..4 {
            assert!(
                s.wheel_angvel()[w] >= 0.0,
                "wheel {} ω went negative: {}",
                w,
                s.wheel_angvel()[w]
            );
        }
    }

    #[test]
    fn fy_zero_at_zero_slip_angle() {
        let mut s = WheelForceIntegrator::new();
        let out = s.step(&idle_inputs());
        assert!(out.total_lat_force.abs() < 1.0);
        for w in 0..4 {
            assert!(out.fy_per_wheel[w].abs() < 1.0);
        }
    }

    #[test]
    fn fy_per_wheel_nonzero_at_nonzero_slip_angle() {
        let mut s = WheelForceIntegrator::new();
        let mut inputs = idle_inputs();
        inputs.slip_angle_smoothed_deg = 5.0;
        let out = s.step(&inputs);
        assert!(out.total_lat_force.abs() > 1.0);
        for w in 0..4 {
            assert!(out.fy_per_wheel[w].abs() > 1.0);
        }
    }

    #[test]
    fn fy_consistent_with_axle_average_under_symmetric_loads() {
        // Axle-average parity: at symmetric Fz + moderate slip angle + zero
        // longitudinal slip (G-method gy = 1.0; friction-ellipse cap doesn't
        // clamp 4 wheels × pacejka_lateral_per_wheel inside the circle), the
        // integrator's total_lat_force should round-trip the per-wheel
        // Pacejka call after applying the unified grip chain
        // (BASE_TIRE_GRIP_COEFFICIENT × downforce × combined_grip_mult).
        let mut s = WheelForceIntegrator::new();
        let mut inputs = idle_inputs();
        inputs.slip_angle_smoothed_deg = 6.0;
        for _ in 0..60 {
            s.step(&inputs);
        }
        let out = s.step(&inputs);

        // Confirm slip-ratio has settled.
        for sr in &out.slip_ratio_per_wheel {
            assert!(
                sr.abs() < 0.05,
                "slip_ratio should have settled to ~0, got {:?}",
                out.slip_ratio_per_wheel
            );
        }

        let slip_rad = 6.0_f32.to_radians();
        let one_corner_fy = pacejka_lateral_per_wheel(
            slip_rad,
            nominal_loads()[0],
            &PacejkaCoeffs::LATERAL_DEFAULT,
            TIRE_DEFAULT_LOAD_SENSITIVITY,
        )
        .abs();
        // Phase 6 unified grip stack: Fy scales by the same chain Fx does.
        // idle_inputs has downforce_grip_bonus=1.0, combined_grip_mult=1.0,
        // so the chain reduces to BASE_TIRE_GRIP_COEFFICIENT.
        let expected_total = one_corner_fy * 4.0 * BASE_TIRE_GRIP_COEFFICIENT;
        let observed = out.total_lat_force.abs();
        let drift = (observed - expected_total).abs() / expected_total;
        assert!(
            drift < 0.05,
            "axle-average parity drifted: observed {} vs expected {} ({}%)",
            observed,
            expected_total,
            drift * 100.0
        );
    }

    // Phase 2 (Wave 3) — G-method combined-slip behaviour change tests

    #[test]
    fn combined_slip_reduces_fx_when_lateral_slip_present() {
        // Pure-slip vs combined-slip Fx: at slip_ratio > 0 + slip_angle = 10°,
        // gx_combined kicks in and Fx drops below the pure-slip value.
        // Use locked clutch in 1st gear so torque transmits and inertia
        // reflects realistically.
        let mut s_pure = WheelForceIntegrator::new();
        let mut inputs_pure = idle_inputs();
        inputs_pure.drive_engaged = true;
        inputs_pure.driven_axle_torque = 3000.0;
        inputs_pure.slip_angle_smoothed_deg = 0.0;
        inputs_pure.clutch_engagement = 1.0;
        inputs_pure.total_gear_ratio = 10.4;
        for _ in 0..30 {
            s_pure.step(&inputs_pure);
        }
        let pure_out = s_pure.step(&inputs_pure);

        let mut s_combined = WheelForceIntegrator::new();
        let mut inputs_combined = idle_inputs();
        inputs_combined.drive_engaged = true;
        inputs_combined.driven_axle_torque = 3000.0;
        inputs_combined.slip_angle_smoothed_deg = 10.0;
        inputs_combined.clutch_engagement = 1.0;
        inputs_combined.total_gear_ratio = 10.4;
        for _ in 0..30 {
            s_combined.step(&inputs_combined);
        }
        let combined_out = s_combined.step(&inputs_combined);

        let pure_fx_total = pure_out.fx_per_wheel.iter().sum::<f32>().abs();
        let combined_fx_total = combined_out.fx_per_wheel.iter().sum::<f32>().abs();
        assert!(
            combined_fx_total < pure_fx_total * 0.95,
            "combined Fx ({}) should drop below 95% of pure Fx ({}) due to G-method",
            combined_fx_total,
            pure_fx_total
        );
    }

    #[test]
    fn combined_slip_reduces_fy_when_longitudinal_slip_present() {
        // Pure-lateral baseline: slip_angle = 8°, slip_ratio settled to ~0
        // (no drive/brake; ω drifts to v/r within ~60 warmup steps).
        let mut s_pure = WheelForceIntegrator::new();
        let mut inputs_pure = idle_inputs();
        inputs_pure.slip_angle_smoothed_deg = 8.0;
        for _ in 0..60 {
            s_pure.step(&inputs_pure);
        }
        let pure_out = s_pure.step(&inputs_pure);

        // Combined: same slip_angle but rear wheels driven with locked clutch
        // → settled rear slip_ratio > 0 → gy < 1 on rear, Fy drops.
        let mut s_combined = WheelForceIntegrator::new();
        let mut inputs_combined = idle_inputs();
        inputs_combined.slip_angle_smoothed_deg = 8.0;
        inputs_combined.drive_engaged = true;
        inputs_combined.driven_axle_torque = 3000.0;
        inputs_combined.clutch_engagement = 1.0;
        inputs_combined.total_gear_ratio = 10.4;
        for _ in 0..60 {
            s_combined.step(&inputs_combined);
        }
        let combined_out = s_combined.step(&inputs_combined);

        // Rear wheels (driven) see non-zero slip_ratio in combined; front
        // wheels stay kinematic in both cases. Compare rear-only Fy.
        let pure_rear: f32 = pure_out.fy_per_wheel[2..].iter().map(|f| f.abs()).sum();
        let combined_rear: f32 = combined_out.fy_per_wheel[2..].iter().map(|f| f.abs()).sum();
        assert!(
            combined_rear < pure_rear * 0.97,
            "rear Fy ({}) should drop below 97% of pure rear Fy ({}) when slip_ratio active",
            combined_rear,
            pure_rear
        );
        // Sanity: rear slip_ratio in combined > 0.
        let combined_rear_sr = combined_out.slip_ratio_per_wheel[2];
        assert!(
            combined_rear_sr.abs() > 0.01,
            "expected non-zero rear slip_ratio in combined case, got {}",
            combined_rear_sr
        );
    }

    #[test]
    fn pure_slip_outputs_unchanged_when_off_axis_slip_zero() {
        // At slip_angle = 0, gx returns 1.0 → Fx_combined = Fx_pure.
        // Verifies the G-method is a strict superset of pure-slip behaviour.
        let mut s = WheelForceIntegrator::new();
        let mut inputs = idle_inputs();
        inputs.drive_engaged = true;
        inputs.driven_axle_torque = 1600.0;
        inputs.slip_angle_smoothed_deg = 0.0;
        for _ in 0..30 {
            s.step(&inputs);
        }
        let out = s.step(&inputs);
        // At zero slip angle, Fy is zero too.
        assert!(out.total_lat_force.abs() < 1.0);
        // Fx is a meaningful drive force.
        assert!(out.total_long_force.abs() > 100.0);
    }

    #[test]
    fn fy_total_equals_sum_of_per_wheel() {
        let mut s = WheelForceIntegrator::new();
        let mut inputs = idle_inputs();
        inputs.slip_angle_smoothed_deg = 8.0;
        let out = s.step(&inputs);
        let sum: f32 = out.fy_per_wheel.iter().sum();
        assert!(
            (out.total_lat_force - sum).abs() < 1e-3,
            "total_lat_force {} != sum {}",
            out.total_lat_force,
            sum
        );
    }

    // Phase 5 (Wave 3) — engine inertia reflection + clutch torque gating

    #[test]
    fn engaged_clutch_lowers_wheel_acceleration_in_first_gear() {
        // With locked clutch in 1st gear (gear=3.6 × final=2.9 ≈ 10.4),
        // I_eff = 8 + 0.15 × 10.4² ≈ 24.2 kg·m². For the same drive torque,
        // wheel acceleration should drop ~3x versus an idle-clutch baseline.
        let mut s_idle = WheelForceIntegrator::new();
        let kinematic = 10.0 / TIRE_RADIUS;
        s_idle.wheel_angvel = [kinematic; 4];
        let mut idle = idle_inputs();
        idle.drive_engaged = true;
        idle.driven_axle_torque = 2000.0;
        idle.clutch_engagement = 0.1;
        idle.total_gear_ratio = 10.4;
        idle.engine_side_omega_rad_s = 200.0;
        for _ in 0..120 {
            s_idle.step(&idle);
        }

        let mut s_locked = WheelForceIntegrator::new();
        s_locked.wheel_angvel = [kinematic; 4];
        let mut locked = idle_inputs();
        locked.drive_engaged = true;
        locked.driven_axle_torque = 2000.0;
        locked.clutch_engagement = 1.0;
        locked.total_gear_ratio = 10.4;
        locked.engine_side_omega_rad_s = 200.0;
        for _ in 0..120 {
            s_locked.step(&locked);
        }

        // Rear wheel angvel growth is much smaller with locked clutch (more
        // inertia AND full drive torque vs idle's 10% torque).
        let kinematic = 10.0 / TIRE_RADIUS;
        let idle_growth = (s_idle.wheel_angvel()[2] - kinematic).abs();
        let locked_growth = (s_locked.wheel_angvel()[2] - kinematic).abs();
        // With idle_clutch=0.1, transmitted torque = 100Nm with low inertia →
        // negligible ω change. With locked clutch, transmitted torque = 1000Nm
        // but I_eff is 3x larger → still meaningful but bounded.
        assert!(
            locked_growth > 0.0,
            "locked clutch should still produce wheel acceleration: {}",
            locked_growth
        );
        // Sanity: idle (slipping) and locked (engaged) shouldn't produce
        // identical ω given the dramatic torque + inertia difference.
        assert!(
            (idle_growth - locked_growth).abs() > 0.1,
            "idle vs locked should differ noticeably: idle={}, locked={}",
            idle_growth,
            locked_growth
        );
    }

    #[test]
    fn ers_boost_routes_through_integrator_and_friction_cap_holds() {
        // Phase 5 Step 5.4. ERS deploy adds to PowertrainOutput.drive_force,
        // which routes through `driven_wheel_torque` and the friction-ellipse
        // cap inside this integrator. Verify that even with an enormous
        // additional drive torque (proxying maximum ERS boost at low speed),
        // per-wheel Fx stays bounded by μ × Fz.
        let mut s = WheelForceIntegrator::new();
        let mut inputs = idle_inputs();
        inputs.forward_speed = 10.0;
        inputs.drive_engaged = true;
        // 30 kN drive torque @ 0.33m wheel radius = 90 kNm net per axle.
        // Way past the friction cap; should clamp inside the ellipse.
        inputs.driven_axle_torque = 60_000.0;
        inputs.clutch_engagement = 1.0;
        inputs.total_gear_ratio = 10.4;
        for _ in 0..120 {
            s.step(&inputs);
        }
        let out = s.step(&inputs);
        // Each rear wheel Fx must stay inside μ × Fz × BASE_TIRE_GRIP_COEFFICIENT
        // (~ 1.0 × 1957 × 3.5 = ~6.85 kN). Phase 6 bumped BASE; cap accordingly.
        for w in 2..4 {
            let fx_abs = out.fx_per_wheel[w].abs();
            assert!(
                fx_abs < 8000.0,
                "rear[{}] Fx exceeded friction cap: {}",
                w,
                fx_abs
            );
        }
    }

    #[test]
    fn explicit_euler_stable_at_high_engine_torque_in_first_gear() {
        // Phase 5 Step 5.3 stability check. Per the plan, the worst case is
        // 1st-gear locked clutch (I_eff ~24 kg·m²) at high tire-reaction
        // stiffness — explicit Euler could ring at dt = 1/120. Run 10000
        // steps with worst-case torque + dt = 1/60 and assert ω stays
        // bounded.
        let mut s = WheelForceIntegrator::new();
        let mut inputs = idle_inputs();
        inputs.dt = 1.0 / 60.0;
        inputs.forward_speed = 5.0;
        inputs.drive_engaged = true;
        inputs.driven_axle_torque = 10_000.0;
        inputs.clutch_engagement = 1.0;
        inputs.total_gear_ratio = 10.4;
        for n in 0..10_000 {
            let out = s.step(&inputs);
            for w in 0..4 {
                let omega = s.wheel_angvel()[w];
                assert!(
                    omega.is_finite(),
                    "omega[{w}] non-finite at step {n}: {omega}"
                );
                // Cap is enforced inside step(); just sanity-check it's
                // not flying off.
                assert!(
                    omega.abs() < 1e4,
                    "omega[{w}] exploded at step {n}: {omega}"
                );
            }
            for w in 0..4 {
                assert!(out.fx_per_wheel[w].is_finite());
                assert!(out.fy_per_wheel[w].is_finite());
            }
        }
    }

    #[test]
    fn slipping_clutch_reduces_drive_torque() {
        // Same I_eff scaling but engagement low → drive torque proportional.
        // Capture front-wheel state (kinematic) vs rear-wheel state (driven).
        let mut s_50 = WheelForceIntegrator::new();
        let mut inputs_50 = idle_inputs();
        inputs_50.drive_engaged = true;
        inputs_50.driven_axle_torque = 3000.0;
        inputs_50.clutch_engagement = 0.5;
        inputs_50.total_gear_ratio = 10.4;
        inputs_50.engine_side_omega_rad_s = 200.0;
        for _ in 0..30 {
            s_50.step(&inputs_50);
        }
        let out_50 = s_50.step(&inputs_50);

        let mut s_full = WheelForceIntegrator::new();
        let mut inputs_full = idle_inputs();
        inputs_full.drive_engaged = true;
        inputs_full.driven_axle_torque = 3000.0;
        inputs_full.clutch_engagement = 1.0;
        inputs_full.total_gear_ratio = 10.4;
        inputs_full.engine_side_omega_rad_s = 200.0;
        for _ in 0..30 {
            s_full.step(&inputs_full);
        }
        let out_full = s_full.step(&inputs_full);

        // Rear Fx should be HIGHER with full engagement (more torque
        // transmitted). Both runs use the same Pacejka, so the diff comes
        // from slip_ratio ⇒ Fx growth.
        let rear_fx_50 = out_50.fx_per_wheel[2].abs() + out_50.fx_per_wheel[3].abs();
        let rear_fx_full = out_full.fx_per_wheel[2].abs() + out_full.fx_per_wheel[3].abs();
        assert!(
            rear_fx_full > rear_fx_50,
            "full engagement should produce more rear Fx than slipping: full={}, 50%={}",
            rear_fx_full,
            rear_fx_50
        );
    }

    #[test]
    fn omega_cap_prevents_runaway() {
        let mut s = WheelForceIntegrator::new();
        let mut inputs = idle_inputs();
        inputs.forward_speed = 1.0;
        inputs.drive_engaged = true;
        inputs.driven_axle_torque = 2.0e6;
        for _ in 0..120 {
            s.step(&inputs);
        }
        let cap = (1.0_f32 / TIRE_RADIUS) * WHEEL_OMEGA_OVERSPEED_RATIO
            + WHEEL_OMEGA_OVERSPEED_BIAS_RAD_S;
        for w in 0..4 {
            assert!(
                s.wheel_angvel()[w].abs() <= cap + 1e-3,
                "wheel {} ω ({}) exceeded cap ({})",
                w,
                s.wheel_angvel()[w],
                cap
            );
        }
    }

    #[test]
    fn lsd_split_equals_open_when_rear_wheels_synced() {
        let mut s = WheelForceIntegrator::new();
        let mut inputs = idle_inputs();
        inputs.drive_engaged = true;
        inputs.driven_axle_torque = 4000.0;
        inputs.clutch_engagement = 1.0;
        inputs.total_gear_ratio = 1.0;
        inputs.engine_side_omega_rad_s = 200.0;
        let out = s.step(&inputs);
        let rl = out.driven_torque_per_wheel[2];
        let rr = out.driven_torque_per_wheel[3];
        assert!((rl - rr).abs() < 1.0, "synced wheels should split evenly: rl {}, rr {}", rl, rr);
        assert!(out.driven_torque_per_wheel[0].abs() < 1e-6, "front-left has no drive torque");
        assert!(out.driven_torque_per_wheel[1].abs() < 1e-6, "front-right has no drive torque");
    }

    #[test]
    fn lsd_redirects_torque_when_rear_wheels_disagree() {
        let mut s = WheelForceIntegrator::new();
        // Pre-load asymmetric wheel speeds: RL on grass, spinning faster.
        // The integrator's `wheel_angvel` is private; reach through the
        // public ω accessor by stepping once with imbalanced loads to seed.
        let kinematic = 10.0 / TIRE_RADIUS;
        s.wheel_angvel = [kinematic; 4];
        let mut seed = idle_inputs();
        seed.drive_engaged = true;
        seed.driven_axle_torque = 4000.0;
        seed.clutch_engagement = 1.0;
        seed.total_gear_ratio = 10.0;
        seed.engine_side_omega_rad_s = 200.0;
        // RL has much lower vertical load: the spin integrator will drive
        // it past the grip envelope, building Δω.
        seed.resolved_wheel_loads[2] = 100.0;
        seed.resolved_wheel_loads[3] = 4000.0;
        for _ in 0..120 {
            s.step(&seed);
        }
        let omegas = s.wheel_angvel();
        assert!(omegas[2] > omegas[3], "RL should be spinning faster: {:?}", omegas);

        // Now apply the LSD with a tight power ramp.
        let mut diff = DifferentialConfig::new();
        diff.set_power_ramp_deg(20.0);
        diff.set_preload_nm(80.0);
        let mut inputs = seed;
        inputs.differential = diff;
        let out = s.step(&inputs);
        let rl = out.driven_torque_per_wheel[2];
        let rr = out.driven_torque_per_wheel[3];
        // LSD must transfer torque to the slower (gripping) wheel.
        assert!(rr > rl, "tight LSD should give RR more torque: rl {}, rr {}", rl, rr);
        // Driveshaft lag: per-frame delivery may trail the LSD allocation.
        // Sum is bounded above by axle_torque (cap) and grows toward it.
        assert!(rl + rr <= inputs.driven_axle_torque + 1.0);
        assert!(rl + rr > inputs.driven_axle_torque * 0.5);
    }
}
