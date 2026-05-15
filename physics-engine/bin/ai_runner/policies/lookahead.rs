#![allow(dead_code)]

use car_physics_engine::types::CarInput;

use crate::sim::{Observation, Policy, PolicyContext, DT};

pub const LOOKAHEAD_PARAM_COUNT: usize = 24;

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
    pub lateral_p_gain: f32,
    pub coast_curvature_thresh: f32,
    pub throttle_smoothing_tau: f32,
    pub brake_sigmoid_steepness: f32,
    pub brake_sigmoid_bias: f32,
    pub brake_lookahead_distance_m: f32,
    pub lateral_d_gain: f32,
    pub reserved_1: f32,
    pub reserved_2: f32,
    pub reserved_3: f32,
    pub reserved_4: f32,
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
            self.lateral_p_gain,
            self.coast_curvature_thresh,
            self.throttle_smoothing_tau,
            self.brake_sigmoid_steepness,
            self.brake_sigmoid_bias,
            self.brake_lookahead_distance_m,
            self.lateral_d_gain,
            self.reserved_1,
            self.reserved_2,
            self.reserved_3,
            self.reserved_4,
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
            lateral_p_gain: p[13],
            coast_curvature_thresh: p[14],
            throttle_smoothing_tau: p[15],
            brake_sigmoid_steepness: p[16],
            brake_sigmoid_bias: p[17],
            brake_lookahead_distance_m: p[18],
            lateral_d_gain: p[19],
            reserved_1: p[20],
            reserved_2: p[21],
            reserved_3: p[22],
            reserved_4: p[23],
        }
    }
}

pub const BASELINE_PARAMS_MONZA: [f32; LOOKAHEAD_PARAM_COUNT] = [
    120.0,
    40.0,
    150.0,
    0.04,
    0.0,
    2.0,
    1.2,
    0.005,
    0.003,
    0.01,
    1.0,
    1.0,
    0.0,
    0.0,
    0.0015,
    0.10,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
];

// Phase 4.11 active champion — clean Monza lap under F1-realistic reward.
//   ai_runner --mode train --track monza \
//     --bc-seed apps/game/public/demos/f1_autodromo_nazionale_monza.demo.json \
//     --auto-iterate --seed 11 \
//     --gate-lap-time 120.0 --gate-off-track 3 --mu 16 --lambda 48
// Produced lap_time_s = 116.57, off_track_count = 1, severe_off_track_s = 0.00
// at iteration 4 (sigma_scale=0.2, 500 gens). Wall-time ~403s.
// Gate passed: lap_time <= 120.0s AND off_track_count <= 3. Replaces the
// Phase 4.7 cheater champion that hit 94.47s but with 12 off-track violations
// peaking 41m off the racing line — visually unacceptable to the user.
//
// Reward semantics (per Phase 4.9): escalating off-track penalty 50*n^1.5,
// severe-lateral penalty 1000/s for max_lateral_distance > 12m, graded
// lap_complete bonus by off_track_count, progress-grade collapse to 0.1 when
// severe_off_track_seconds > 1.5s. These together eliminated the deliberate-
// cheating channel: severe_off_track_seconds = 0.00 across all 32 iterations
// across all attempted seeds.
//
// Historical Phase 4.7 cheater champion (kept for reference; do not use):
//   const BASELINE_PARAMS_MONZA_CHAMPION_PHASE4_7_CHEATING = [
//     274.18375,   152.5118,     0.0,         0.08015525,
//     -3.282829,   3.2393687,    0.1,         0.0,
//     0.013265899, 0.053698707,  1.0011088,   0.79306155,
//     0.49130064,  0.0,          0.0044210367,0.01,
//     4.880074,   -1.8583239,    32.338844,   0.15553048,
//     0.5978072,   0.4171325,    0.8725595,   0.3125701,
//   ];
//   That champion drove through grass on tight corners; replaced in Phase 4.11.
pub const BASELINE_PARAMS_MONZA_CHAMPION: [f32; LOOKAHEAD_PARAM_COUNT] = [
    369.73038,
    151.04822,
    3.1907682,
    0.46833268,
    -0.13450809,
    1.5166283,
    0.1,
    0.00017975901,
    0.0008842546,
    0.0,
    0.67593366,
    0.20368741,
    0.19702986,
    0.039907604,
    0.040800404,
    0.14858526,
    2.4456584,
    0.6316891,
    36.15828,
    0.06651181,
    0.025775697,
    -0.022551153,
    0.304288,
    0.9279218,
];

pub struct LookaheadPolicy {
    pub params: LookaheadParams,
    smoothed_throttle: f32,
    prev_heading_error: f32,
    prev_curvature_for_speed: f32,
    prev_lat_offset: f32,
}

impl LookaheadPolicy {
    pub fn new(params: LookaheadParams) -> Self {
        Self {
            params,
            smoothed_throttle: 0.0,
            prev_heading_error: 0.0,
            prev_curvature_for_speed: 0.0,
            prev_lat_offset: 0.0,
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

#[inline]
pub fn sigmoid(x: f32) -> f32 {
    1.0 / (1.0 + (-x).exp())
}

impl Policy for LookaheadPolicy {
    fn act(&mut self, obs: &Observation, ctx: &PolicyContext) -> CarInput {
        let p = &self.params;

        let curvature_for_steer = lerp_curvature(&obs.curvatures, p.lookahead_idx_for_steer);
        let abs_curvature_speed = max_abs_curvature(&obs.curvatures);
        let curvature_delta = abs_curvature_speed - self.prev_curvature_for_speed;
        self.prev_curvature_for_speed = abs_curvature_speed;

        let v_target = (p.max_speed_kmh
            - p.brake_curvature_gain * abs_curvature_speed * 1000.0)
            .max(p.min_corner_speed_kmh);
        let _ = curvature_delta;

        let speed_error_kmh = v_target - obs.speed_kmh;

        let throttle_desired: f32;
        let raw_brake: f32;
        if speed_error_kmh > 5.0 {
            let mut t = p.throttle_recovery_gain * speed_error_kmh;
            if curvature_delta < 0.0 {
                t *= p.exit_throttle_bias.max(0.5);
            }
            throttle_desired = t.clamp(0.0, 1.0);
            raw_brake = 0.0;
        } else if speed_error_kmh > -5.0 {
            throttle_desired = 0.0;
            raw_brake = 0.0;
        } else if abs_curvature_speed > p.full_brake_curvature_thresh
            || (-speed_error_kmh) > 30.0
        {
            throttle_desired = 0.0;
            raw_brake = 1.0;
        } else {
            throttle_desired = 0.0;
            raw_brake = (p.brake_curvature_gain * (-speed_error_kmh) * 0.02).clamp(0.0, 1.0);
        }

        let new_brake_active = p.brake_sigmoid_steepness.abs() > 1e-6
            || p.brake_sigmoid_bias.abs() > 1e-6
            || p.brake_lookahead_distance_m.abs() > 1e-6;
        let brake = if new_brake_active {
            let brake_curvature = if p.brake_lookahead_distance_m > 0.5 {
                ctx.curvature_at_arc_offset(obs.arc_length_m, p.brake_lookahead_distance_m)
                    .abs()
            } else {
                abs_curvature_speed
            };
            let speed_error_norm = (obs.speed_kmh - v_target) / 60.0;
            let brake_arg = p.brake_sigmoid_steepness
                * (speed_error_norm + p.brake_curvature_gain * brake_curvature)
                + p.brake_sigmoid_bias;
            let sigmoid_brake = sigmoid(brake_arg).clamp(0.0, 1.0);
            sigmoid_brake.max(raw_brake).clamp(0.0, 1.0)
        } else {
            raw_brake
        };

        let tau = p.throttle_smoothing_tau.max(1e-3);
        let alpha = (DT / tau).clamp(0.0, 1.0);
        self.smoothed_throttle += (throttle_desired - self.smoothed_throttle) * alpha;
        if brake > 0.01 {
            self.smoothed_throttle = 0.0;
        }
        let throttle = self.smoothed_throttle.clamp(0.0, 1.0);

        let heading_d_raw =
            p.steer_d_gain * (obs.heading_error_rad - self.prev_heading_error) / DT;
        self.prev_heading_error = obs.heading_error_rad;
        let heading_d = heading_d_raw.clamp(-0.1, 0.1);

        let curvature_ff_clamped = (curvature_for_steer * 12.0).clamp(-0.6, 0.6);

        let lat_offset = obs.lateral_distance_m - p.target_lateral_offset;
        let lat_correction =
            (-lat_offset * p.understeer_recovery_gain * 0.05).clamp(-0.3, 0.3);
        let lat_p = (-lat_offset * p.lateral_p_gain).clamp(-0.5, 0.5);

        let lat_d_raw = -p.lateral_d_gain * (lat_offset - self.prev_lat_offset) / DT;
        self.prev_lat_offset = lat_offset;
        let lat_d = lat_d_raw.clamp(-0.3, 0.3);

        let raw_steer = p.steer_p_gain * obs.heading_error_rad
            + heading_d
            + curvature_ff_clamped
            + lat_correction
            + lat_p
            + lat_d;
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
    use car_physics_engine::track_geometry::Polyline;

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

    fn straight_polyline() -> Polyline {
        let mut points = Vec::with_capacity(200);
        let mut cumulative_arc = Vec::with_capacity(200);
        for i in 0..200 {
            let x = i as f32 * 5.0;
            points.push([x, 0.0]);
            cumulative_arc.push(x);
        }
        Polyline {
            points,
            cumulative_arc,
            closed: false,
        }
    }

    fn mock_ctx<'a>(polyline: &'a Polyline) -> PolicyContext<'a> {
        let total_arc = polyline.cumulative_arc.last().copied().unwrap_or(1.0).max(1.0);
        PolicyContext {
            polyline,
            total_arc,
            backward: false,
        }
    }

    #[test]
    fn sigmoid_basic_properties() {
        assert!((sigmoid(0.0) - 0.5).abs() < 1e-6);
        assert!(sigmoid(100.0) > 0.999);
        assert!(sigmoid(-100.0) < 0.001);
        let mut prev = sigmoid(-10.0);
        for i in 1..=100 {
            let x = -10.0 + 0.2 * (i as f32);
            let s = sigmoid(x);
            assert!(s >= prev - 1e-6, "sigmoid not monotonic at x={x}");
            prev = s;
        }
    }

    #[test]
    fn act_returns_finite_input_on_straight() {
        let mut policy = LookaheadPolicy::baseline_monza();
        let pl = straight_polyline();
        let ctx = mock_ctx(&pl);
        let input = policy.act(&neutral_obs(), &ctx);
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
        let pl = straight_polyline();
        let ctx = mock_ctx(&pl);
        let mut obs = neutral_obs();
        obs.speed_kmh = 250.0;
        obs.curvatures = [0.04, 0.04, 0.04, 0.04, 0.04];
        let input = policy.act(&obs, &ctx);
        assert!(
            input.brake_analog > 0.5,
            "expected hard braking on tight corner at speed, got brake={}",
            input.brake_analog
        );
    }

    #[test]
    fn act_accelerates_on_clear_straight() {
        let mut policy = LookaheadPolicy::baseline_monza();
        let pl = straight_polyline();
        let ctx = mock_ctx(&pl);
        let mut obs = neutral_obs();
        obs.speed_kmh = 50.0;
        obs.curvatures = [0.0; 5];
        for _ in 0..30 {
            policy.act(&obs, &ctx);
        }
        let input = policy.act(&obs, &ctx);
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
        let pl = straight_polyline();
        let ctx = mock_ctx(&pl);
        let mut obs = neutral_obs();
        obs.speed_kmh = 350.0;
        obs.heading_error_rad = std::f32::consts::PI;
        obs.lateral_distance_m = 20.0;
        obs.curvatures = [0.1, 0.1, 0.1, 0.1, 0.1];
        for _ in 0..10 {
            let input = policy.act(&obs, &ctx);
            assert!(!input.backward, "policy engaged reverse");
        }
    }

    fn legacy_baseline_act(
        params: &LookaheadParams,
        obs: &Observation,
        smoothed_throttle: &mut f32,
        prev_heading_error: &mut f32,
        prev_curvature_for_speed: &mut f32,
    ) -> CarInput {
        let p = params;
        let curvature_for_steer = lerp_curvature(&obs.curvatures, p.lookahead_idx_for_steer);
        let abs_curvature_speed = max_abs_curvature(&obs.curvatures);
        let curvature_delta = abs_curvature_speed - *prev_curvature_for_speed;
        *prev_curvature_for_speed = abs_curvature_speed;

        let v_target = (p.max_speed_kmh
            - p.brake_curvature_gain * abs_curvature_speed * 1000.0)
            .max(p.min_corner_speed_kmh);

        let speed_error_kmh = v_target - obs.speed_kmh;

        let throttle_desired: f32;
        let brake: f32;
        if speed_error_kmh > 5.0 {
            let mut t = p.throttle_recovery_gain * speed_error_kmh;
            if curvature_delta < 0.0 {
                t *= p.exit_throttle_bias.max(0.5);
            }
            throttle_desired = t.clamp(0.0, 1.0);
            brake = 0.0;
        } else if speed_error_kmh > -5.0 {
            throttle_desired = 0.0;
            brake = 0.0;
        } else if abs_curvature_speed > p.full_brake_curvature_thresh
            || (-speed_error_kmh) > 30.0
        {
            throttle_desired = 0.0;
            brake = 1.0;
        } else {
            throttle_desired = 0.0;
            brake = (p.brake_curvature_gain * (-speed_error_kmh) * 0.02).clamp(0.0, 1.0);
        }

        let tau = p.throttle_smoothing_tau.max(1e-3);
        let alpha = (DT / tau).clamp(0.0, 1.0);
        *smoothed_throttle += (throttle_desired - *smoothed_throttle) * alpha;
        if brake > 0.01 {
            *smoothed_throttle = 0.0;
        }
        let throttle = smoothed_throttle.clamp(0.0, 1.0);

        let heading_d_raw =
            p.steer_d_gain * (obs.heading_error_rad - *prev_heading_error) / DT;
        *prev_heading_error = obs.heading_error_rad;
        let heading_d = heading_d_raw.clamp(-0.1, 0.1);

        let curvature_ff_clamped = (curvature_for_steer * 12.0).clamp(-0.6, 0.6);

        let lat_offset = obs.lateral_distance_m - p.target_lateral_offset;
        let lat_correction =
            (-lat_offset * p.understeer_recovery_gain * 0.05).clamp(-0.3, 0.3);
        let lat_p = (-lat_offset * p.lateral_p_gain).clamp(-0.5, 0.5);

        let raw_steer = p.steer_p_gain * obs.heading_error_rad
            + heading_d
            + curvature_ff_clamped
            + lat_correction
            + lat_p;
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

    fn synthetic_obs_stream() -> Vec<Observation> {
        let mut out = Vec::with_capacity(240);
        for i in 0..240 {
            let phase = (i as f32) / 240.0;
            let speed = 80.0 + 200.0 * phase;
            let kappa_mag = 0.005 + 0.04 * (phase * std::f32::consts::TAU).sin().abs();
            let curvatures = [
                kappa_mag,
                kappa_mag * 0.9,
                kappa_mag * 1.1,
                kappa_mag * 0.8,
                kappa_mag * 0.7,
            ];
            out.push(Observation {
                car_xz: [phase * 1000.0, 0.0],
                yaw: 0.0,
                speed_kmh: speed,
                lateral_distance_m: 0.3 * (phase * std::f32::consts::TAU * 2.0).sin(),
                heading_error_rad: 0.05 * (phase * std::f32::consts::TAU * 3.0).cos(),
                arc_cursor: i,
                arc_length_m: phase * 1000.0,
                curvatures,
                longitudinal_accel_ms2: 0.0,
            });
        }
        out
    }

    #[test]
    fn baseline_24_param_matches_phase4_behavior() {
        let stream = synthetic_obs_stream();
        let pl = straight_polyline();
        let ctx = mock_ctx(&pl);

        let mut policy = LookaheadPolicy::from_array(&BASELINE_PARAMS_MONZA);
        let params = LookaheadParams::from_array(&BASELINE_PARAMS_MONZA);
        let mut leg_smoothed = 0.0_f32;
        let mut leg_prev_heading = 0.0_f32;
        let mut leg_prev_curv = 0.0_f32;

        for (i, obs) in stream.iter().enumerate() {
            let new_in = policy.act(obs, &ctx);
            let leg_in = legacy_baseline_act(
                &params,
                obs,
                &mut leg_smoothed,
                &mut leg_prev_heading,
                &mut leg_prev_curv,
            );
            assert_eq!(
                new_in.throttle.to_bits(),
                leg_in.throttle.to_bits(),
                "throttle bit-mismatch at frame {i}: new={} legacy={}",
                new_in.throttle,
                leg_in.throttle
            );
            assert_eq!(
                new_in.brake_analog.to_bits(),
                leg_in.brake_analog.to_bits(),
                "brake_analog bit-mismatch at frame {i}: new={} legacy={}",
                new_in.brake_analog,
                leg_in.brake_analog
            );
            assert_eq!(
                new_in.steer.to_bits(),
                leg_in.steer.to_bits(),
                "steer bit-mismatch at frame {i}: new={} legacy={}",
                new_in.steer,
                leg_in.steer
            );
            assert_eq!(new_in.brake, leg_in.brake);
            assert_eq!(new_in.forward, leg_in.forward);
            assert_eq!(new_in.backward, leg_in.backward);
        }
    }

    #[test]
    fn sigmoid_brake_activates_when_new_params_nonzero() {
        let mut params = BASELINE_PARAMS_MONZA;
        params[16] = 5.0;
        params[17] = 0.0;
        params[18] = 0.0;
        let mut policy = LookaheadPolicy::from_array(&params);
        let pl = straight_polyline();
        let ctx = mock_ctx(&pl);

        let mut obs = neutral_obs();
        obs.speed_kmh = 250.0;
        obs.curvatures = [0.0; 5];

        let input = policy.act(&obs, &ctx);
        assert!(
            input.brake_analog > 0.5,
            "expected sigmoid brake > 0.5 when over speed and steepness=5, got {}",
            input.brake_analog
        );
    }

    #[test]
    fn lateral_d_gain_zero_preserves_existing_behavior() {
        let stream = synthetic_obs_stream();
        let pl = straight_polyline();
        let ctx = mock_ctx(&pl);

        let mut params = BASELINE_PARAMS_MONZA;
        params[19] = 0.0;
        let mut policy = LookaheadPolicy::from_array(&params);
        let mut policy_baseline = LookaheadPolicy::from_array(&BASELINE_PARAMS_MONZA);

        for (i, obs) in stream.iter().enumerate() {
            let a = policy.act(obs, &ctx);
            let b = policy_baseline.act(obs, &ctx);
            assert_eq!(
                a.steer.to_bits(),
                b.steer.to_bits(),
                "steer differs at frame {i} with lateral_d_gain=0",
            );
        }
    }

    #[test]
    fn lateral_d_gain_nonzero_changes_steer() {
        let mut params = BASELINE_PARAMS_MONZA;
        params[19] = 2.0;
        let mut policy = LookaheadPolicy::from_array(&params);
        let mut policy_baseline = LookaheadPolicy::from_array(&BASELINE_PARAMS_MONZA);
        let pl = straight_polyline();
        let ctx = mock_ctx(&pl);

        let mut obs = neutral_obs();
        obs.lateral_distance_m = 0.0;
        let _ = policy.act(&obs, &ctx);
        let _ = policy_baseline.act(&obs, &ctx);

        obs.lateral_distance_m = 1.0;
        let a = policy.act(&obs, &ctx);
        let b = policy_baseline.act(&obs, &ctx);
        assert!(
            (a.steer - b.steer).abs() > 1e-4,
            "expected D-term to influence steer (a={}, b={})",
            a.steer,
            b.steer
        );
    }
}
