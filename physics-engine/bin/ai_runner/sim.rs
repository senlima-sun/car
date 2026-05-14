use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::track_geometry::{
    check_off_track, nearest_centerline_windowed, OffTrackState,
    DEFAULT_ENTER_THRESHOLD_M, DEFAULT_EXIT_THRESHOLD_M, DEFAULT_WINDOW,
};
use car_physics_engine::types::{CarInput, SurfaceType, TireCompound};

use crate::obs::{build_observation, ObservationContext};
use crate::track_loader::{LoadedTrack, RaceDirection};

pub const DT: f32 = 1.0 / 120.0;
pub const TRACK_HALF_WIDTH_M: f32 = 6.0;

pub const LAP_COMPLETE_TOLERANCE_FRAC: f32 = 0.001;

pub const CURVATURE_LOOKAHEAD_M: [f32; 5] = [5.0, 10.0, 20.0, 40.0, 80.0];

const WHEELBASE: f32 = car_physics_engine::constants::car::WHEELBASE;
const TRACK_WIDTH_FRONT: f32 = car_physics_engine::constants::car::TRACK_WIDTH_FRONT;
const TRACK_WIDTH_REAR: f32 = car_physics_engine::constants::car::TRACK_WIDTH_REAR;

#[derive(Debug, Clone, Copy)]
pub struct SimState {
    pub position: [f32; 3],
    pub rotation: [f32; 4],
    pub linvel: [f32; 3],
    pub angvel: [f32; 3],
}

#[derive(Debug, Clone, Copy)]
#[allow(dead_code)]
pub struct Observation {
    pub car_xz: [f32; 2],
    pub yaw: f32,
    pub speed_kmh: f32,
    pub lateral_distance_m: f32,
    pub heading_error_rad: f32,
    pub arc_cursor: usize,
    pub arc_length_m: f32,
    pub curvatures: [f32; 5],
    pub longitudinal_accel_ms2: f32,
}

pub trait Policy {
    fn act(&mut self, obs: &Observation) -> CarInput;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TerminationReason {
    LapComplete,
    Timeout,
    ExtendedOffTrack,
}

#[derive(Debug, Clone, Copy)]
#[allow(dead_code)]
pub struct TelemetryFrame {
    pub t_s: f32,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub qx: f32,
    pub qy: f32,
    pub qz: f32,
    pub qw: f32,
    pub speed_kmh: f32,
    pub throttle: f32,
    pub brake: f32,
    pub steer: f32,
    pub is_off_track: bool,
    pub lateral_distance_m: f32,
    pub arc_length_m: f32,
}

#[derive(Debug)]
#[allow(dead_code)]
pub struct SimResult {
    pub track_id: String,
    pub telemetry: Vec<TelemetryFrame>,
    pub lap_completed: bool,
    pub off_track_count: u32,
    pub off_track_seconds: f32,
    pub terminated_by: TerminationReason,
    pub final_xz: [f32; 2],
    pub distance_to_spawn_m: f32,
}

#[inline]
pub(crate) fn angle_diff(a: f32, b: f32) -> f32 {
    let mut d = a - b;
    while d > std::f32::consts::PI {
        d -= 2.0 * std::f32::consts::PI;
    }
    while d < -std::f32::consts::PI {
        d += 2.0 * std::f32::consts::PI;
    }
    d
}

pub fn run_sim(
    track: &LoadedTrack,
    policy: &mut dyn Policy,
    max_t_s: f32,
    off_track_kill_s: f32,
) -> SimResult {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);
    engine.set_tire_compound(TireCompound::Medium);

    let (spawn_pos, spawn_rot, _spawn_fwd) = crate::track_loader::spawn_pose(track);
    let mut state = SimState {
        position: spawn_pos,
        rotation: spawn_rot,
        linvel: [0.0, 0.0, 0.0],
        angvel: [0.0, 0.0, 0.0],
    };

    let mut off_track_state =
        OffTrackState::seed_from_position(&track.polyline, spawn_pos[0], spawn_pos[2]);

    let spawn_near = nearest_centerline_windowed(
        &track.polyline,
        spawn_pos[0],
        spawn_pos[2],
        off_track_state.arc_cursor,
        DEFAULT_WINDOW,
    );
    let arc_at_spawn = spawn_near.arc_length;
    let total_arc = track
        .polyline
        .cumulative_arc
        .last()
        .copied()
        .unwrap_or(0.0)
        .max(1.0);

    let mut telemetry: Vec<TelemetryFrame> =
        Vec::with_capacity((max_t_s / DT) as usize + 16);
    let mut t_s = 0.0_f32;
    let mut off_track_continuous_s = 0.0_f32;
    let mut off_track_count: u32 = 0;
    let mut off_track_seconds_total: f32 = 0.0;
    let mut prev_was_off = false;
    let mut max_steps = ((max_t_s / DT).ceil() as usize) + 2;
    let mut lap_completed = false;
    let mut terminated_by = TerminationReason::Timeout;

    let mut prev_arc = arc_at_spawn;
    let mut arc_progress_m: f32 = 0.0;
    let backward = track.race_direction == RaceDirection::Backward;
    let mut obs_ctx = ObservationContext::new();

    while max_steps > 0 {
        max_steps -= 1;

        let products = build_observation(track, &state, off_track_state.arc_cursor, &mut obs_ctx);
        let obs = products.obs;
        let near = products.near;

        let input = policy.act(&obs);

        let output = engine.step(
            DT,
            input,
            state.position,
            state.rotation,
            state.linvel,
            state.angvel,
            [0.0, 1.0, 0.0],
            None,
        );

        state.linvel = output.linear_velocity;
        state.angvel = output.angular_velocity;
        state.position[0] += state.linvel[0] * DT;
        state.position[1] += state.linvel[1] * DT;
        state.position[2] += state.linvel[2] * DT;

        integrate_yaw(&mut state.rotation, state.angvel[1], DT);

        let off = check_off_track(
            &track.polyline,
            state.position[0],
            state.position[2],
            state.rotation[0],
            state.rotation[1],
            state.rotation[2],
            state.rotation[3],
            TRACK_HALF_WIDTH_M,
            DEFAULT_ENTER_THRESHOLD_M,
            DEFAULT_EXIT_THRESHOLD_M,
            WHEELBASE,
            TRACK_WIDTH_FRONT,
            TRACK_WIDTH_REAR,
            off_track_state,
        );
        off_track_state = OffTrackState {
            is_off_track: off.is_off_track,
            arc_cursor: off.arc_cursor,
        };

        if off.is_off_track {
            off_track_continuous_s += DT;
            off_track_seconds_total += DT;
            if !prev_was_off {
                off_track_count += 1;
            }
        } else {
            off_track_continuous_s = 0.0;
        }
        prev_was_off = off.is_off_track;

        let arc_delta = arc_signed_delta(prev_arc, near.arc_length, total_arc, backward);
        if arc_delta > 0.0 {
            arc_progress_m += arc_delta;
        }
        prev_arc = near.arc_length;

        telemetry.push(TelemetryFrame {
            t_s,
            x: state.position[0],
            y: state.position[1],
            z: state.position[2],
            qx: state.rotation[0],
            qy: state.rotation[1],
            qz: state.rotation[2],
            qw: state.rotation[3],
            speed_kmh: obs.speed_kmh,
            throttle: input.throttle,
            brake: input.brake_analog,
            steer: input.steer,
            is_off_track: off.is_off_track,
            lateral_distance_m: off.max_lateral_distance_m,
            arc_length_m: near.arc_length,
        });

        t_s += DT;

        if arc_progress_m >= total_arc * (1.0 - LAP_COMPLETE_TOLERANCE_FRAC) {
            lap_completed = true;
            terminated_by = TerminationReason::LapComplete;
            break;
        }
        if off_track_continuous_s >= off_track_kill_s {
            terminated_by = TerminationReason::ExtendedOffTrack;
            break;
        }
        if t_s >= max_t_s {
            terminated_by = TerminationReason::Timeout;
            break;
        }
    }

    let dx = state.position[0] - spawn_pos[0];
    let dz = state.position[2] - spawn_pos[2];
    SimResult {
        track_id: track.id.clone(),
        telemetry,
        lap_completed,
        off_track_count,
        off_track_seconds: off_track_seconds_total,
        terminated_by,
        final_xz: [state.position[0], state.position[2]],
        distance_to_spawn_m: (dx * dx + dz * dz).sqrt(),
    }
}

#[inline]
pub(crate) fn integrate_yaw(rotation: &mut [f32; 4], yaw_rate: f32, dt: f32) {
    let half = yaw_rate * dt * 0.5;
    let s = half.sin();
    let c = half.cos();
    let (qx, qy, qz, qw) = (rotation[0], rotation[1], rotation[2], rotation[3]);
    rotation[0] = qx * c + qz * s;
    rotation[1] = qy * c + qw * s;
    rotation[2] = qz * c - qx * s;
    rotation[3] = qw * c - qy * s;
    let len_sq = rotation[0].powi(2)
        + rotation[1].powi(2)
        + rotation[2].powi(2)
        + rotation[3].powi(2);
    if len_sq > 1e-8 {
        let inv = 1.0 / len_sq.sqrt();
        rotation[0] *= inv;
        rotation[1] *= inv;
        rotation[2] *= inv;
        rotation[3] *= inv;
    }
}

#[inline]
fn arc_signed_delta(prev: f32, current: f32, total: f32, backward: bool) -> f32 {
    let raw = current - prev;
    let half = total * 0.5;
    let wrapped = if raw > half {
        raw - total
    } else if raw < -half {
        raw + total
    } else {
        raw
    };
    if backward {
        -wrapped
    } else {
        wrapped
    }
}

