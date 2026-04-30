use crate::car_physics::powertrain::TIRE_RADIUS;
use crate::car_physics::tire_model::{
    combined_slip, pacejka_longitudinal, peak_mu_at_fz, PacejkaCoeffs,
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

/// Per-step inputs to the wheel-spin integrator.
pub struct WheelSpinInputs {
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
    /// the wheel-spin integrator's tire-reaction feedback loop already
    /// couples to the cold-rubber state via prev_wheel_fx.
    pub longitudinal_grip_modifier: f32,
}

#[derive(Debug, Default)]
pub struct WheelSpinIntegrator {
    wheel_angvel: [f32; 4],
    prev_wheel_fx: [f32; 4],
}

impl WheelSpinIntegrator {
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
    /// friction-ellipse cap, and return the body-frame longitudinal force.
    /// Tire-reaction torque uses last frame's Fx (1-step lag at 120Hz).
    pub fn step(&mut self, i: &WheelSpinInputs) -> f32 {
        let omega_cap = (i.forward_speed.abs() / TIRE_RADIUS) * WHEEL_OMEGA_OVERSPEED_RATIO
            + WHEEL_OMEGA_OVERSPEED_BIAS_RAD_S;
        let v_floor = i.forward_speed.abs().max(SLIP_RATIO_VEL_FLOOR_MS);
        let mut wheel_long_force = 0.0_f32;
        let mut wheel_fx_now = [0.0_f32; 4];
        for wheel in 0..4 {
            let is_driven = !is_front_wheel(wheel);
            let per_axle_brake = if is_front_wheel(wheel) {
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
            let fz = i.resolved_wheel_loads[wheel].max(0.0);
            // TODO(wave-2-phase-5): unify longitudinal grip stack with the
            // lateral path. Currently scales by base μ only.
            let fx_pacejka = sanitize(
                pacejka_longitudinal(slip_ratio, fz, &PacejkaCoeffs::LONGITUDINAL_DEFAULT),
                0.0,
            );
            // Friction-ellipse cap in raw-Newton units; apply grip scaling
            // once after capping so cap and value share dimensions. Wave 1
            // has no per-wheel Fy yet — degenerates to a friction-line cap
            // on |fx|. Wave 3 will pass real lateral force.
            let mu_fz_limit = peak_mu_at_fz(fz, &PacejkaCoeffs::LONGITUDINAL_DEFAULT) * fz;
            let (fx_capped, _) = combined_slip(fx_pacejka, 0.0, mu_fz_limit);
            let fx = fx_capped
                * BASE_TIRE_GRIP_COEFFICIENT
                * i.downforce_grip_bonus
                * i.longitudinal_grip_modifier;
            wheel_fx_now[wheel] = fx;
            wheel_long_force += fx;
        }
        self.prev_wheel_fx = wheel_fx_now;
        wheel_long_force
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn nominal_loads() -> [f32; 4] {
        [1957.0; 4]
    }

    fn idle_inputs() -> WheelSpinInputs {
        WheelSpinInputs {
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
            longitudinal_grip_modifier: 1.0,
        }
    }

    #[test]
    fn idle_no_drive_no_brake_rolls_front_kinematically() {
        // Front wheels (non-driven, no brake) snap to kinematic ω = v/r
        // every step. Rear wheels integrate freely under zero net torque
        // and stay near their previous value (start at 0 here) — the
        // engine-brake path in `mod.rs` handles rear off-throttle decel,
        // not the integrator.
        let mut s = WheelSpinIntegrator::new();
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
        let mut s = WheelSpinIntegrator::new();
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
        let mut s = WheelSpinIntegrator::new();
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
    fn omega_cap_prevents_runaway() {
        let mut s = WheelSpinIntegrator::new();
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
