use crate::utils::{Quat, Vec3};

use super::Polyline;

pub const DEFAULT_WINDOW: usize = 20;
/// Additional outward buffer past `half_width` before a tire's inner
/// edge counts as off. With per-wheel tire half-width already absorbed
/// into the comparison (`inner_edge = wheel_center − tire_half_width`),
/// this is just a small numerical safety margin to absorb the
/// difference between the physics polyline (straight segments between
/// ribbonPoints) and the visual ribbon mesh (which may interpolate
/// through bezier curves). The FIA rule is "all four tires fully past
/// the white line"; 5 cm of slack keeps that intent without rejecting
/// borderline-on-line frames as off-track.
pub const DEFAULT_ENTER_THRESHOLD_M: f32 = 0.05;
pub const DEFAULT_EXIT_THRESHOLD_M: f32 = 0.3;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct NearestResult {
    pub lateral_distance: f32,
    pub arc_length: f32,
    pub tangent: [f32; 2],
    pub nearest_index: usize,
}

impl NearestResult {
    #[inline]
    pub fn zero() -> Self {
        Self {
            lateral_distance: 0.0,
            arc_length: 0.0,
            tangent: [1.0, 0.0],
            nearest_index: 0,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct OffTrackState {
    pub is_off_track: bool,
    pub arc_cursor: usize,
}

impl OffTrackState {
    #[inline]
    pub fn new() -> Self {
        Self {
            is_off_track: false,
            arc_cursor: 0,
        }
    }

    pub fn seed_from_position(polyline: &Polyline, x: f32, z: f32) -> Self {
        let near = nearest_centerline_full(polyline, x, z);
        Self {
            is_off_track: false,
            arc_cursor: near.nearest_index,
        }
    }
}

impl Default for OffTrackState {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Copy)]
pub struct OffTrackResult {
    pub is_off_track: bool,
    pub max_lateral_distance_m: f32,
    pub arc_cursor: usize,
    /// Per-wheel lateral distance to the centerline [FL, FR, RL, RR].
    /// Surfaced so debug tooling (e.g. track-limit snapshot) can show
    /// which wheels actually crossed the threshold.
    pub wheel_lateral_distances_m: [f32; 4],
}

#[inline]
fn segment_count(polyline: &Polyline) -> usize {
    let n = polyline.points.len();
    if n < 2 {
        return 0;
    }
    if polyline.closed {
        n
    } else {
        n - 1
    }
}

#[inline]
fn segment_endpoints(polyline: &Polyline, segment_index: usize) -> ([f32; 2], [f32; 2]) {
    let n = polyline.points.len();
    let a = polyline.points[segment_index];
    let b_index = if polyline.closed && segment_index + 1 == n {
        0
    } else {
        segment_index + 1
    };
    let b = polyline.points[b_index];
    (a, b)
}

#[inline]
fn segment_length_for(polyline: &Polyline, segment_index: usize) -> f32 {
    let n = polyline.points.len();
    let last_index = polyline.cumulative_arc.len().saturating_sub(1);
    if polyline.closed && segment_index + 1 == n {
        let total = polyline.cumulative_arc[last_index];
        let (a, b) = segment_endpoints(polyline, segment_index);
        let dx = b[0] - a[0];
        let dy = b[1] - a[1];
        let direct = (dx * dx + dy * dy).sqrt();
        if direct > 0.0 {
            direct
        } else {
            (total - polyline.cumulative_arc[segment_index]).max(0.0)
        }
    } else {
        polyline.cumulative_arc[segment_index + 1] - polyline.cumulative_arc[segment_index]
    }
}

#[inline]
fn project_onto_segment(
    polyline: &Polyline,
    segment_index: usize,
    x: f32,
    z: f32,
) -> (f32, f32, [f32; 2]) {
    let (a, b) = segment_endpoints(polyline, segment_index);
    let dx = b[0] - a[0];
    let dz = b[1] - a[1];
    let length_sq = dx * dx + dz * dz;
    if length_sq <= f32::EPSILON {
        let lat = ((x - a[0]).powi(2) + (z - a[1]).powi(2)).sqrt();
        return (lat, 0.0, [1.0, 0.0]);
    }
    let length = length_sq.sqrt();
    let inv_len = 1.0 / length;
    let tx = dx * inv_len;
    let tz = dz * inv_len;
    let rel_x = x - a[0];
    let rel_z = z - a[1];
    let t = (rel_x * dx + rel_z * dz) / length_sq;
    let t_clamped = t.clamp(0.0, 1.0);
    let proj_x = a[0] + dx * t_clamped;
    let proj_z = a[1] + dz * t_clamped;
    let lat = ((x - proj_x).powi(2) + (z - proj_z).powi(2)).sqrt();
    (lat, t_clamped, [tx, tz])
}

#[inline]
fn arc_at(polyline: &Polyline, segment_index: usize, t: f32) -> f32 {
    let base = polyline.cumulative_arc[segment_index];
    let seg_len = segment_length_for(polyline, segment_index);
    base + t * seg_len
}

pub fn nearest_centerline_full(polyline: &Polyline, x: f32, z: f32) -> NearestResult {
    let segments = segment_count(polyline);
    if segments == 0 {
        return NearestResult::zero();
    }
    let mut best_lat = f32::INFINITY;
    let mut best_t = 0.0_f32;
    let mut best_tangent = [1.0_f32, 0.0_f32];
    let mut best_index: usize = 0;
    for i in 0..segments {
        let (lat, t, tangent) = project_onto_segment(polyline, i, x, z);
        if lat < best_lat {
            best_lat = lat;
            best_t = t;
            best_tangent = tangent;
            best_index = i;
        }
    }
    NearestResult {
        lateral_distance: best_lat,
        arc_length: arc_at(polyline, best_index, best_t),
        tangent: best_tangent,
        nearest_index: best_index,
    }
}

pub fn nearest_centerline_windowed(
    polyline: &Polyline,
    x: f32,
    z: f32,
    cursor: usize,
    window: usize,
) -> NearestResult {
    let segments = segment_count(polyline);
    if segments == 0 {
        return NearestResult::zero();
    }
    let cursor = cursor.min(segments - 1);
    let span = window.saturating_mul(2).saturating_add(1);
    if span >= segments {
        return nearest_centerline_full(polyline, x, z);
    }
    let mut best_lat = f32::INFINITY;
    let mut best_t = 0.0_f32;
    let mut best_tangent = [1.0_f32, 0.0_f32];
    let mut best_index: usize = cursor;
    for offset in 0..span {
        let signed = offset as isize - window as isize;
        let i = if polyline.closed {
            let raw = cursor as isize + signed;
            raw.rem_euclid(segments as isize) as usize
        } else {
            let raw = cursor as isize + signed;
            if raw < 0 || raw >= segments as isize {
                continue;
            }
            raw as usize
        };
        let (lat, t, tangent) = project_onto_segment(polyline, i, x, z);
        if lat < best_lat {
            best_lat = lat;
            best_t = t;
            best_tangent = tangent;
            best_index = i;
        }
    }
    NearestResult {
        lateral_distance: best_lat,
        arc_length: arc_at(polyline, best_index, best_t),
        tangent: best_tangent,
        nearest_index: best_index,
    }
}

#[inline]
pub fn forward_right_from_quat(qx: f32, qy: f32, qz: f32, qw: f32) -> ([f32; 2], [f32; 2]) {
    let q = Quat::new(qx, qy, qz, qw);
    let fwd: Vec3 = q.forward();
    let right: Vec3 = q.right();
    ([fwd.x, fwd.z], [right.x, right.z])
}

#[inline]
#[allow(clippy::too_many_arguments)]
pub fn wheel_world_positions_quat(
    car_x: f32,
    car_z: f32,
    qx: f32,
    qy: f32,
    qz: f32,
    qw: f32,
    wheelbase: f32,
    track_width_front: f32,
    track_width_rear: f32,
) -> [[f32; 2]; 4] {
    let (fwd, right) = forward_right_from_quat(qx, qy, qz, qw);
    let half_wb = wheelbase * 0.5;
    let half_tw_front = track_width_front * 0.5;
    let half_tw_rear = track_width_rear * 0.5;
    [
        [
            car_x - right[0] * half_tw_front + fwd[0] * half_wb,
            car_z - right[1] * half_tw_front + fwd[1] * half_wb,
        ],
        [
            car_x + right[0] * half_tw_front + fwd[0] * half_wb,
            car_z + right[1] * half_tw_front + fwd[1] * half_wb,
        ],
        [
            car_x - right[0] * half_tw_rear - fwd[0] * half_wb,
            car_z - right[1] * half_tw_rear - fwd[1] * half_wb,
        ],
        [
            car_x + right[0] * half_tw_rear - fwd[0] * half_wb,
            car_z + right[1] * half_tw_rear - fwd[1] * half_wb,
        ],
    ]
}

#[inline]
pub fn wheel_world_positions(
    car_x: f32,
    car_z: f32,
    yaw: f32,
    wheelbase: f32,
    track_width_front: f32,
    track_width_rear: f32,
) -> [[f32; 2]; 4] {
    let half_yaw = yaw * 0.5;
    let s = half_yaw.sin();
    let c = half_yaw.cos();
    wheel_world_positions_quat(
        car_x,
        car_z,
        0.0,
        s,
        0.0,
        c,
        wheelbase,
        track_width_front,
        track_width_rear,
    )
}

#[allow(clippy::too_many_arguments)]
pub fn check_off_track(
    polyline: &Polyline,
    car_x: f32,
    car_z: f32,
    qx: f32,
    qy: f32,
    qz: f32,
    qw: f32,
    half_width: f32,
    enter_threshold_m: f32,
    exit_threshold_m: f32,
    wheelbase: f32,
    track_width_front: f32,
    track_width_rear: f32,
    tire_half_width_front: f32,
    tire_half_width_rear: f32,
    prev_state: OffTrackState,
) -> OffTrackResult {
    let segments = segment_count(polyline);
    if segments == 0 {
        return OffTrackResult {
            is_off_track: prev_state.is_off_track,
            max_lateral_distance_m: 0.0,
            arc_cursor: prev_state.arc_cursor,
            wheel_lateral_distances_m: [0.0; 4],
        };
    }

    let wheels = wheel_world_positions_quat(
        car_x,
        car_z,
        qx,
        qy,
        qz,
        qw,
        wheelbase,
        track_width_front,
        track_width_rear,
    );

    // For each wheel, compute the *inner-edge* distance: how far the
    // inside face of the tire is from the centerline. That's
    // `wheel_center_lateral_distance − tire_half_width`. If this is
    // less than `half_width`, *some* part of the tire is still on the
    // road. Off-track = all four tires' inner edges past `half_width`
    // (the white-line position).
    //
    // FL/FR get the front tire's half-width; RL/RR the rear's.
    let tire_half_widths = [
        tire_half_width_front,
        tire_half_width_front,
        tire_half_width_rear,
        tire_half_width_rear,
    ];
    let mut min_inner = f32::INFINITY;
    let mut max_inner = 0.0_f32;
    let mut wheel_lateral_distances_m = [0.0_f32; 4];
    for (idx, w) in wheels.iter().enumerate() {
        let r =
            nearest_centerline_windowed(polyline, w[0], w[1], prev_state.arc_cursor, DEFAULT_WINDOW);
        // Surface the raw wheel-center distance for snapshot tooling.
        wheel_lateral_distances_m[idx] = r.lateral_distance;
        // Inner edge = nearest point of the tire to the centerline.
        // Negative when the wheel center is inside the centerline
        // (which makes the inner edge well inside the road).
        let inner_edge = r.lateral_distance - tire_half_widths[idx];
        if inner_edge < min_inner {
            min_inner = inner_edge;
        }
        if inner_edge > max_inner {
            max_inner = inner_edge;
        }
    }

    let center =
        nearest_centerline_windowed(polyline, car_x, car_z, prev_state.arc_cursor, DEFAULT_WINDOW);
    let new_cursor = center.nearest_index;

    let is_off_track = if prev_state.is_off_track {
        // Exit hysteresis: stay off-track until at least one tire's
        // inner edge is back inside `half_width − exit_threshold`.
        max_inner >= half_width - exit_threshold_m
    } else {
        // Enter: all four tires have their inner edge past the white
        // line (`min_inner` is the *closest* inner edge to centerline).
        min_inner > half_width + enter_threshold_m
    };

    OffTrackResult {
        is_off_track,
        max_lateral_distance_m: max_inner,
        arc_cursor: new_cursor,
        wheel_lateral_distances_m,
    }
}
