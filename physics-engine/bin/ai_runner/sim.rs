use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::track_geometry::{
    check_off_track, nearest_centerline_windowed, OffTrackState, Polyline,
    DEFAULT_ENTER_THRESHOLD_M, DEFAULT_EXIT_THRESHOLD_M, DEFAULT_WINDOW,
};
use car_physics_engine::types::{CarInput, SurfaceType, TireCompound};

use crate::track_loader::{LoadedTrack, RaceDirection};

pub const DT: f32 = 1.0 / 120.0;
pub const TRACK_HALF_WIDTH_M: f32 = 6.0;

const LAP_COMPLETE_TOLERANCE_FRAC: f32 = 0.001;

pub const CURVATURE_LOOKAHEAD_M: [f32; 5] = [5.0, 10.0, 20.0, 40.0, 80.0];
const CURVATURE_HALF_WINDOW_M: f32 = 0.5;

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
fn yaw_from_quat(q: [f32; 4]) -> f32 {
    use car_physics_engine::utils::Quat;
    Quat::from_array(q).yaw()
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

    while max_steps > 0 {
        max_steps -= 1;

        let yaw = yaw_from_quat(state.rotation);
        let near = nearest_centerline_windowed(
            &track.polyline,
            state.position[0],
            state.position[2],
            off_track_state.arc_cursor,
            DEFAULT_WINDOW,
        );
        let tangent_yaw = near.tangent[0].atan2(near.tangent[1]);
        let race_tangent_yaw = if backward {
            tangent_yaw + std::f32::consts::PI
        } else {
            tangent_yaw
        };
        let heading_error = angle_diff(race_tangent_yaw, yaw);
        let speed_ms = (state.linvel[0].powi(2) + state.linvel[2].powi(2)).sqrt();

        let obs = Observation {
            car_xz: [state.position[0], state.position[2]],
            yaw,
            speed_kmh: speed_ms * 3.6,
            lateral_distance_m: near.lateral_distance,
            heading_error_rad: heading_error,
            arc_cursor: near.nearest_index,
            arc_length_m: near.arc_length,
            curvatures: curvature_ladder(&track.polyline, near.arc_length, total_arc, backward),
        };

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

fn tangent_at_arc(polyline: &Polyline, target_arc: f32, total_arc: f32) -> [f32; 2] {
    let n = polyline.points.len();
    if n < 2 {
        return [1.0, 0.0];
    }
    let wrapped = if polyline.closed && total_arc > 0.0 {
        target_arc.rem_euclid(total_arc)
    } else {
        target_arc.clamp(0.0, polyline.cumulative_arc[n - 1])
    };
    let arc = &polyline.cumulative_arc;
    let mut lo = 0usize;
    let mut hi = n - 1;
    while lo + 1 < hi {
        let mid = (lo + hi) / 2;
        if arc[mid] <= wrapped {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    let a = polyline.points[lo];
    let b_idx = if polyline.closed && lo + 1 == n { 0 } else { lo + 1 };
    let b = polyline.points[b_idx];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    let len = (dx * dx + dy * dy).sqrt();
    if len <= f32::EPSILON {
        [1.0, 0.0]
    } else {
        [dx / len, dy / len]
    }
}

fn curvature_at_arc(
    polyline: &Polyline,
    target_arc: f32,
    total_arc: f32,
    half_window_m: f32,
    backward: bool,
) -> f32 {
    let t_back = tangent_at_arc(polyline, target_arc - half_window_m, total_arc);
    let t_fwd = tangent_at_arc(polyline, target_arc + half_window_m, total_arc);
    let yaw_back = t_back[0].atan2(t_back[1]);
    let yaw_fwd = t_fwd[0].atan2(t_fwd[1]);
    let mut dyaw = angle_diff(yaw_fwd, yaw_back);
    if backward {
        dyaw = -dyaw;
    }
    dyaw / (2.0 * half_window_m)
}

fn curvature_ladder(
    polyline: &Polyline,
    arc_length_m: f32,
    total_arc: f32,
    backward: bool,
) -> [f32; 5] {
    let mut out = [0.0_f32; 5];
    for (i, &d) in CURVATURE_LOOKAHEAD_M.iter().enumerate() {
        let target = if backward {
            arc_length_m - d
        } else {
            arc_length_m + d
        };
        out[i] = curvature_at_arc(polyline, target, total_arc, CURVATURE_HALF_WINDOW_M, backward);
    }
    out
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

#[cfg(test)]
mod tests {
    use super::*;

    fn make_circle_polyline(radius: f32, n: usize) -> Polyline {
        let mut points = Vec::with_capacity(n);
        let mut cumulative_arc = Vec::with_capacity(n);
        let step = std::f32::consts::TAU / (n as f32);
        let chord = 2.0 * radius * (step * 0.5).sin();
        for i in 0..n {
            let theta = step * (i as f32);
            points.push([radius * theta.cos(), radius * theta.sin()]);
            cumulative_arc.push(chord * (i as f32));
        }
        Polyline {
            points,
            cumulative_arc,
            closed: true,
        }
    }

    #[test]
    fn curvature_of_circle_is_inverse_radius() {
        let radius = 50.0;
        let pl = make_circle_polyline(radius, 400);
        let total = pl.cumulative_arc.last().copied().unwrap();
        let half_window = 5.0;
        let k = curvature_at_arc(&pl, 100.0, total, half_window, false);
        let expected = 1.0 / radius;
        assert!(
            (k.abs() - expected).abs() < expected * 0.25,
            "expected |k|≈{expected}, got {k}",
        );
    }

    #[test]
    fn curvature_ladder_returns_finite_values() {
        let pl = make_circle_polyline(40.0, 400);
        let total = pl.cumulative_arc.last().copied().unwrap();
        let ladder = curvature_ladder(&pl, 10.0, total, false);
        for k in ladder {
            assert!(k.is_finite(), "ladder entry not finite: {k}");
        }
    }
}
