use crate::car_physics::powertrain::TIRE_RADIUS;
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
pub const AXLE_TO_CORNER_SPLIT: f32 = 0.5;

/// Per-step inputs to the wheel-force integrator.
pub struct WheelForceInputs {
    pub dt: f32,
    pub forward_speed: f32,
    pub drive_engaged: bool,
    pub driven_wheel_torque: f32,
    pub braking_active: bool,
    pub brake_torque_modifier: f32,
    pub front_brake_force: f32,
    pub rear_brake_force: f32,
    pub resolved_wheel_loads: [f32; 4],
    pub downforce_grip_bonus: f32,
    /// Environmental grip stack (surface × weather × aquaplaning ×
    /// terrain). Multiplied into the longitudinal Pacejka output so
    /// wet/oil/aqua reduce braking and acceleration the same way they
    /// reduce cornering. Cold-tire material grip stays lateral-only —
    /// the wheel-force integrator's tire-reaction feedback loop already
    /// couples to the cold-rubber state via prev_wheel_fx.
    pub environmental_grip_modifier: f32,
    /// Chassis-level slip angle in degrees, after Wave 1 EMA smoothing.
    /// Phase 1 (Wave 3) feeds it as the per-wheel slip angle (no kinematic
    /// yaw-rate × wheel-offset correction yet — see Wave 4 backlog).
    /// Used to compute per-wheel Fy alongside the existing Fx.
    pub slip_angle_smoothed_deg: f32,
}

/// Per-step output from the wheel-force integrator. Phase 1 (Wave 3)
/// promotes Fy to per-wheel newtons alongside Fx; the body-frame yaw
/// computation stays on the μ-scalar path through Phase 5 and switches
/// in Phase 6.
#[derive(Debug, Default, Clone, Copy)]
pub struct WheelForceOutput {
    pub total_long_force: f32,
    pub total_lat_force: f32,
    pub fx_per_wheel: [f32; 4],
    pub fy_per_wheel: [f32; 4],
    pub slip_ratio_per_wheel: [f32; 4],
}

#[derive(Debug, Default)]
pub struct WheelForceIntegrator {
    wheel_angvel: [f32; 4],
    prev_wheel_fx: [f32; 4],
}

impl WheelForceIntegrator {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn wheel_angvel(&self) -> [f32; 4] {
        self.wheel_angvel
    }

    pub fn prev_wheel_fx(&self) -> [f32; 4] {
        self.prev_wheel_fx
    }

    /// Integrate per-wheel angular velocity from drive + brake torque,
    /// compute slip ratios, route through `pacejka_longitudinal` with a
    /// friction-ellipse cap, and emit per-wheel Fx + Fy in newtons. Tire-
    /// reaction torque uses last frame's Fx (1-step lag at 120Hz).
    ///
    /// Phase 1 (Wave 3): Fy is computed via `pacejka_lateral_per_wheel`
    /// alongside Fx but the friction-ellipse cap stays as `(fx, 0.0)` so
    /// the longitudinal output is bit-equivalent to Wave 2. The 2-axis
    /// cap and Pacejka G-method weighting land in Phase 2.
    pub fn step(&mut self, i: &WheelForceInputs) -> WheelForceOutput {
        let omega_cap = (i.forward_speed.abs() / TIRE_RADIUS) * WHEEL_OMEGA_OVERSPEED_RATIO
            + WHEEL_OMEGA_OVERSPEED_BIAS_RAD_S;
        let v_floor = i.forward_speed.abs().max(SLIP_RATIO_VEL_FLOOR_MS);
        let slip_angle_rad = i.slip_angle_smoothed_deg.to_radians();
        let mut wheel_long_force = 0.0_f32;
        let mut wheel_lat_force = 0.0_f32;
        let mut wheel_fx_now = [0.0_f32; 4];
        let mut wheel_fy_now = [0.0_f32; 4];
        let mut wheel_slip_ratio_now = [0.0_f32; 4];
        for wheel in 0..4 {
            let is_front = is_front_wheel(wheel);
            let is_driven = !is_front;
            let per_axle_brake = if is_front {
                i.front_brake_force
            } else {
                i.rear_brake_force
            };
            let has_brake_torque = i.braking_active && per_axle_brake > 0.0;

            if !is_driven && !has_brake_torque {
                self.wheel_angvel[wheel] = i.forward_speed / TIRE_RADIUS;
            } else {
                let drive_torque = if is_driven && i.drive_engaged {
                    i.driven_wheel_torque
                } else {
                    0.0
                };
                let brake_torque_corner =
                    per_axle_brake * AXLE_TO_CORNER_SPLIT * i.brake_torque_modifier * TIRE_RADIUS;
                // Brake opposes macro vehicle motion. Using ω.signum() causes
                // a sign-flip oscillation when ω crosses zero (signum(0)=+1)
                // which pumps spurious force into prev_wheel_fx.
                let brake_signed_torque = -brake_torque_corner * i.forward_speed.signum();
                let tire_reaction_torque = self.prev_wheel_fx[wheel] * TIRE_RADIUS;
                let net_torque = drive_torque + brake_signed_torque - tire_reaction_torque;
                let omega_before = self.wheel_angvel[wheel];
                let omega_after = omega_before + net_torque / WHEEL_INERTIA * i.dt;
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
            // TODO(wave-2-phase-5): unify longitudinal grip stack with the
            // lateral path. Currently scales by base μ only.
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
            let fx = fx_capped
                * BASE_TIRE_GRIP_COEFFICIENT
                * i.downforce_grip_bonus
                * i.environmental_grip_modifier;
            wheel_fx_now[wheel] = fx;
            wheel_fy_now[wheel] = fy_capped;
            wheel_long_force += fx;
            wheel_lat_force += fy_capped;
        }
        self.prev_wheel_fx = wheel_fx_now;
        WheelForceOutput {
            total_long_force: wheel_long_force,
            total_lat_force: wheel_lat_force,
            fx_per_wheel: wheel_fx_now,
            fy_per_wheel: wheel_fy_now,
            slip_ratio_per_wheel: wheel_slip_ratio_now,
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
            driven_wheel_torque: 0.0,
            braking_active: false,
            brake_torque_modifier: 0.0,
            front_brake_force: 0.0,
            rear_brake_force: 0.0,
            resolved_wheel_loads: nominal_loads(),
            downforce_grip_bonus: 1.0,
            environmental_grip_modifier: 1.0,
            slip_angle_smoothed_deg: 0.0,
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
        let mut inputs = idle_inputs();
        inputs.drive_engaged = true;
        inputs.driven_wheel_torque = 500.0;
        for _ in 0..30 {
            s.step(&inputs);
        }
        let target_kinematic = 10.0 / TIRE_RADIUS;
        // Front rolls kinematically.
        assert!((s.wheel_angvel()[0] - target_kinematic).abs() < 1e-3);
        assert!((s.wheel_angvel()[1] - target_kinematic).abs() < 1e-3);
        // Rear diverges (spins faster under drive torque).
        assert!(s.wheel_angvel()[2] > target_kinematic);
        assert!(s.wheel_angvel()[3] > target_kinematic);
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
        // Pacejka call. Run the integrator long enough for slip_ratio to
        // settle to zero on rear wheels (no drive/brake → ω drifts to v/r
        // via tire-reaction feedback within ~30 steps).
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
        let expected_total = one_corner_fy * 4.0;
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
        // Pure-slip vs combined-slip Fx: at slip_ratio = 0.1 + slip_angle = 10°,
        // gx_combined kicks in and Fx drops below the pure-slip value.
        let mut s_pure = WheelForceIntegrator::new();
        let mut inputs_pure = idle_inputs();
        inputs_pure.drive_engaged = true;
        inputs_pure.driven_wheel_torque = 1500.0; // induce slip_ratio
        inputs_pure.slip_angle_smoothed_deg = 0.0; // pure-slip baseline
        // Warm up so slip_ratio settles.
        for _ in 0..30 {
            s_pure.step(&inputs_pure);
        }
        let pure_out = s_pure.step(&inputs_pure);

        let mut s_combined = WheelForceIntegrator::new();
        let mut inputs_combined = idle_inputs();
        inputs_combined.drive_engaged = true;
        inputs_combined.driven_wheel_torque = 1500.0;
        inputs_combined.slip_angle_smoothed_deg = 10.0; // off-axis slip
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

        // Combined: same slip_angle but rear wheels driven → settled rear
        // slip_ratio > 0 → gy < 1 on rear, Fy drops.
        let mut s_combined = WheelForceIntegrator::new();
        let mut inputs_combined = idle_inputs();
        inputs_combined.slip_angle_smoothed_deg = 8.0;
        inputs_combined.drive_engaged = true;
        inputs_combined.driven_wheel_torque = 1500.0;
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
        inputs.driven_wheel_torque = 800.0;
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

    #[test]
    fn omega_cap_prevents_runaway() {
        let mut s = WheelForceIntegrator::new();
        let mut inputs = idle_inputs();
        inputs.forward_speed = 1.0;
        inputs.drive_engaged = true;
        inputs.driven_wheel_torque = 1.0e6;
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
}
