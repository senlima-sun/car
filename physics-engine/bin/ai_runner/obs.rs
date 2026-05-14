use car_physics_engine::track_geometry::{
    nearest_centerline_windowed, NearestResult, Polyline, DEFAULT_WINDOW,
};

use crate::sim::{angle_diff, Observation, SimState, CURVATURE_LOOKAHEAD_M, DT};
use crate::track_loader::{LoadedTrack, RaceDirection};

const CURVATURE_HALF_WINDOW_M: f32 = 0.5;

pub struct ObservationContext {
    pub prev_speed_ms: f32,
}

impl ObservationContext {
    pub fn new() -> Self {
        Self { prev_speed_ms: 0.0 }
    }
}

#[derive(Debug, Clone, Copy)]
#[allow(dead_code)]
pub struct ObservationProducts {
    pub obs: Observation,
    pub near: NearestPointSummary,
    pub speed_ms: f32,
}

#[derive(Debug, Clone, Copy)]
#[allow(dead_code)]
pub struct NearestPointSummary {
    pub nearest_index: usize,
    pub arc_length: f32,
    pub lateral_distance: f32,
    pub tangent: [f32; 2],
}

impl From<&NearestResult> for NearestPointSummary {
    fn from(np: &NearestResult) -> Self {
        Self {
            nearest_index: np.nearest_index,
            arc_length: np.arc_length,
            lateral_distance: np.lateral_distance,
            tangent: np.tangent,
        }
    }
}

pub fn build_observation(
    track: &LoadedTrack,
    state: &SimState,
    arc_cursor: usize,
    ctx: &mut ObservationContext,
) -> ObservationProducts {
    let backward = track.race_direction == RaceDirection::Backward;
    let total_arc = track
        .polyline
        .cumulative_arc
        .last()
        .copied()
        .unwrap_or(0.0)
        .max(1.0);

    let near = nearest_centerline_windowed(
        &track.polyline,
        state.position[0],
        state.position[2],
        arc_cursor,
        DEFAULT_WINDOW,
    );

    let yaw = car_physics_engine::utils::Quat::from_array(state.rotation).yaw();
    let tangent_yaw = near.tangent[0].atan2(near.tangent[1]);
    let race_tangent_yaw = if backward {
        tangent_yaw + std::f32::consts::PI
    } else {
        tangent_yaw
    };
    let heading_error = angle_diff(race_tangent_yaw, yaw);

    let speed_ms = (state.linvel[0].powi(2) + state.linvel[2].powi(2)).sqrt();
    let longitudinal_accel_ms2 = (speed_ms - ctx.prev_speed_ms) / DT;
    ctx.prev_speed_ms = speed_ms;

    let obs = Observation {
        car_xz: [state.position[0], state.position[2]],
        yaw,
        speed_kmh: speed_ms * 3.6,
        lateral_distance_m: near.lateral_distance,
        heading_error_rad: heading_error,
        arc_cursor: near.nearest_index,
        arc_length_m: near.arc_length,
        curvatures: curvature_ladder(&track.polyline, near.arc_length, total_arc, backward),
        longitudinal_accel_ms2,
    };

    ObservationProducts {
        obs,
        near: NearestPointSummary::from(&near),
        speed_ms,
    }
}

pub fn tangent_at_arc(polyline: &Polyline, target_arc: f32, total_arc: f32) -> [f32; 2] {
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

pub fn curvature_at_arc(
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

pub fn curvature_ladder(
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

#[cfg(test)]
mod tests {
    use super::*;
    use car_physics_engine::track_geometry::Polyline;

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
        let k = curvature_at_arc(&pl, 100.0, total, 5.0, false);
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
