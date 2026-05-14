#![allow(dead_code)]

use car_physics_engine::types::CarInput;

use crate::sim::{Observation, Policy, DT};

pub const LOOKAHEAD_PARAM_COUNT: usize = 16;

#[derive(Debug, Clone, Copy)]
pub struct LookaheadParams {
    pub max_speed_kmh: f32,
    pub min_corner_speed_kmh: f32,
    pub brake_curvature_gain: f32,
    pub throttle_recovery_gain: f32,
    pub target_lateral_offset: f32,
    pub lookahead_idx_for_steer: f32,
    pub steer_p_gain: f32,
    pub steer_d_gain: f32,
    pub off_throttle_curvature_thresh: f32,
    pub full_brake_curvature_thresh: f32,
    pub entry_speed_bias: f32,
    pub exit_throttle_bias: f32,
    pub understeer_recovery_gain: f32,
    pub oversteer_recovery_gain: f32,
    pub coast_curvature_thresh: f32,
    pub throttle_smoothing_tau: f32,
}

impl LookaheadParams {
    pub fn to_array(&self) -> [f32; LOOKAHEAD_PARAM_COUNT] {
        [
            self.max_speed_kmh,
            self.min_corner_speed_kmh,
            self.brake_curvature_gain,
            self.throttle_recovery_gain,
            self.target_lateral_offset,
            self.lookahead_idx_for_steer,
            self.steer_p_gain,
            self.steer_d_gain,
            self.off_throttle_curvature_thresh,
            self.full_brake_curvature_thresh,
            self.entry_speed_bias,
            self.exit_throttle_bias,
            self.understeer_recovery_gain,
            self.oversteer_recovery_gain,
            self.coast_curvature_thresh,
            self.throttle_smoothing_tau,
        ]
    }

    pub fn from_array(p: &[f32; LOOKAHEAD_PARAM_COUNT]) -> Self {
        Self {
            max_speed_kmh: p[0],
            min_corner_speed_kmh: p[1],
            brake_curvature_gain: p[2],
            throttle_recovery_gain: p[3],
            target_lateral_offset: p[4],
            lookahead_idx_for_steer: p[5],
            steer_p_gain: p[6],
            steer_d_gain: p[7],
            off_throttle_curvature_thresh: p[8],
            full_brake_curvature_thresh: p[9],
            entry_speed_bias: p[10],
            exit_throttle_bias: p[11],
            understeer_recovery_gain: p[12],
            oversteer_recovery_gain: p[13],
            coast_curvature_thresh: p[14],
            throttle_smoothing_tau: p[15],
        }
    }
}

pub const BASELINE_PARAMS_MONZA: [f32; LOOKAHEAD_PARAM_COUNT] = [
    310.0,
    80.0,
    2.0,
    0.05,
    0.0,
    1.5,
    1.0,
    0.05,
    0.005,
    0.02,
    0.8,
    1.1,
    0.5,
    0.0,
    0.003,
    0.15,
];

pub struct LookaheadPolicy {
    pub params: LookaheadParams,
    smoothed_throttle: f32,
    prev_heading_error: f32,
    prev_curvature_for_speed: f32,
}

impl LookaheadPolicy {
    pub fn new(params: LookaheadParams) -> Self {
        Self {
            params,
            smoothed_throttle: 0.0,
            prev_heading_error: 0.0,
            prev_curvature_for_speed: 0.0,
        }
    }

    pub fn from_array(p: &[f32; LOOKAHEAD_PARAM_COUNT]) -> Self {
        Self::new(LookaheadParams::from_array(p))
    }

    pub fn baseline_monza() -> Self {
        Self::from_array(&BASELINE_PARAMS_MONZA)
    }
}

#[inline]
fn lerp_curvature(curvatures: &[f32; 5], continuous_idx: f32) -> f32 {
    let clamped = continuous_idx.clamp(0.0, 4.0);
    let lo = clamped.floor() as usize;
    let hi = (lo + 1).min(4);
    let frac = clamped - (lo as f32);
    curvatures[lo] * (1.0 - frac) + curvatures[hi] * frac
}

#[inline]
fn max_abs_curvature(curvatures: &[f32; 5]) -> f32 {
    let mut best = 0.0_f32;
    for &c in curvatures.iter() {
        let a = c.abs();
        if a > best {
            best = a;
        }
    }
    best
}

impl Policy for LookaheadPolicy {
    fn act(&mut self, obs: &Observation) -> CarInput {
        let p = &self.params;

        let curvature_for_steer = lerp_curvature(&obs.curvatures, p.lookahead_idx_for_steer);
        let abs_curvature_speed = max_abs_curvature(&obs.curvatures);
        let curvature_delta = abs_curvature_speed - self.prev_curvature_for_speed;
        self.prev_curvature_for_speed = abs_curvature_speed;

        let phase_bias = if curvature_delta > 0.0 {
            p.entry_speed_bias.max(0.01)
        } else {
            p.exit_throttle_bias.max(0.01)
        };

        let v_target_raw = (p.max_speed_kmh
            - p.brake_curvature_gain * abs_curvature_speed * 1000.0)
            .max(p.min_corner_speed_kmh);
        let v_target = if curvature_delta > 0.0 {
            v_target_raw * phase_bias
        } else {
            v_target_raw
        };

        let speed_error_kmh = v_target - obs.speed_kmh;
        let abs_curvature_speed_thresh = abs_curvature_speed;

        let throttle_desired: f32;
        let brake: f32;
        if speed_error_kmh > 0.0 {
            let mut t = p.throttle_recovery_gain * speed_error_kmh;
            if curvature_delta < 0.0 {
                t *= p.exit_throttle_bias.max(0.5);
            }
            throttle_desired = t.clamp(0.0, 1.0);
            brake = 0.0;
        } else if abs_curvature_speed_thresh > p.full_brake_curvature_thresh {
            throttle_desired = 0.0;
            brake = 1.0;
        } else if abs_curvature_speed_thresh > p.off_throttle_curvature_thresh
            && abs_curvature_speed_thresh <= p.full_brake_curvature_thresh
            && abs_curvature_speed_thresh > p.coast_curvature_thresh
        {
            throttle_desired = 0.0;
            brake = (p.brake_curvature_gain * (-speed_error_kmh) * 0.01).clamp(0.0, 1.0);
        } else if abs_curvature_speed_thresh <= p.coast_curvature_thresh {
            throttle_desired = 0.0;
            brake = 0.0;
        } else {
            throttle_desired = 0.0;
            brake = (p.brake_curvature_gain * (-speed_error_kmh) * 0.01).clamp(0.0, 1.0);
        }

        let tau = p.throttle_smoothing_tau.max(1e-3);
        let alpha = (DT / tau).clamp(0.0, 1.0);
        self.smoothed_throttle += (throttle_desired - self.smoothed_throttle) * alpha;
        if brake > 0.01 {
            self.smoothed_throttle = 0.0;
        }
        let throttle = self.smoothed_throttle.clamp(0.0, 1.0);

        let lateral_sign = if curvature_for_steer >= 0.0 { 1.0 } else { -1.0 };
        let lateral_error = obs.lateral_distance_m * lateral_sign - p.target_lateral_offset;
        let lateral_error_clamped = lateral_error.clamp(-6.0, 6.0);

        let heading_d =
            p.steer_d_gain * (obs.heading_error_rad - self.prev_heading_error) / DT;
        self.prev_heading_error = obs.heading_error_rad;

        let curvature_feedforward = curvature_for_steer * 6.0;

        let oversteer = if obs.heading_error_rad.signum() != lateral_error.signum()
            && obs.heading_error_rad.abs() > 0.1
        {
            -obs.heading_error_rad * p.oversteer_recovery_gain
        } else {
            0.0
        };

        let raw_steer = p.steer_p_gain * obs.heading_error_rad
            + heading_d
            + p.understeer_recovery_gain * lateral_error_clamped * 0.1
            + curvature_feedforward
            + oversteer;
        let steer = raw_steer.clamp(-1.0, 1.0);

        let brake_active = brake > 0.5;

        CarInput {
            forward: throttle > 0.0,
            backward: false,
            left: false,
            right: false,
            brake: brake_active,
            handbrake: false,
            steer,
            throttle,
            brake_analog: brake.clamp(0.0, 1.0),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn neutral_obs() -> Observation {
        Observation {
            car_xz: [0.0, 0.0],
            yaw: 0.0,
            speed_kmh: 100.0,
            lateral_distance_m: 0.0,
            heading_error_rad: 0.0,
            arc_cursor: 0,
            arc_length_m: 0.0,
            curvatures: [0.0; 5],
            longitudinal_accel_ms2: 0.0,
        }
    }

    #[test]
    fn act_returns_finite_input_on_straight() {
        let mut policy = LookaheadPolicy::baseline_monza();
        let input = policy.act(&neutral_obs());
        assert!(input.throttle.is_finite());
        assert!(input.steer.is_finite());
        assert!(input.brake_analog.is_finite());
        assert!(input.throttle >= 0.0 && input.throttle <= 1.0);
        assert!(input.brake_analog >= 0.0 && input.brake_analog <= 1.0);
        assert!(input.steer >= -1.0 && input.steer <= 1.0);
        assert!(!input.backward, "policy must never engage reverse");
    }

    #[test]
    fn act_brakes_for_tight_corner() {
        let mut policy = LookaheadPolicy::baseline_monza();
        let mut obs = neutral_obs();
        obs.speed_kmh = 250.0;
        obs.curvatures = [0.04, 0.04, 0.04, 0.04, 0.04];
        let input = policy.act(&obs);
        assert!(
            input.brake_analog > 0.5,
            "expected hard braking on tight corner at speed, got brake={}",
            input.brake_analog
        );
    }

    #[test]
    fn act_accelerates_on_clear_straight() {
        let mut policy = LookaheadPolicy::baseline_monza();
        let mut obs = neutral_obs();
        obs.speed_kmh = 50.0;
        obs.curvatures = [0.0; 5];
        for _ in 0..30 {
            policy.act(&obs);
        }
        let input = policy.act(&obs);
        assert!(
            input.throttle > 0.5,
            "expected throttle on clear straight at low speed, got {}",
            input.throttle
        );
        assert_eq!(input.brake_analog, 0.0);
    }

    #[test]
    fn round_trip_params_array() {
        let p = LookaheadParams::from_array(&BASELINE_PARAMS_MONZA);
        let arr = p.to_array();
        assert_eq!(arr, BASELINE_PARAMS_MONZA);
    }

    #[test]
    fn never_engages_reverse_under_extreme_inputs() {
        let mut policy = LookaheadPolicy::baseline_monza();
        let mut obs = neutral_obs();
        obs.speed_kmh = 350.0;
        obs.heading_error_rad = std::f32::consts::PI;
        obs.lateral_distance_m = 20.0;
        obs.curvatures = [0.1, 0.1, 0.1, 0.1, 0.1];
        for _ in 0..10 {
            let input = policy.act(&obs);
            assert!(!input.backward, "policy engaged reverse");
        }
    }
}
