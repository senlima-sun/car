use std::time::Instant;

use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::track_geometry::{
    nearest_centerline_windowed, OffTrackState, DEFAULT_WINDOW,
};
use car_physics_engine::types::{CarInput, SurfaceType, TireCompound};

use crate::policies::constant_throttle::ConstantThrottle;
use crate::sim::{Observation, Policy, DT};
use crate::track_loader::{spawn_pose, LoadedTrack, RaceDirection};

const PERF_STEPS: usize = 10_000;

#[derive(Debug, Clone, Copy)]
pub struct PerfReport {
    pub median_us_per_step: f64,
    pub min_us: f64,
    pub max_us: f64,
    pub projected_monza_hours: f64,
    pub samples: usize,
}

pub fn run_perf_benchmark(track: &LoadedTrack) -> PerfReport {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);
    engine.set_tire_compound(TireCompound::Medium);

    let (spawn_pos, spawn_rot, _) = spawn_pose(track);
    let mut position = spawn_pos;
    let mut rotation = spawn_rot;
    let mut linvel = [0.0_f32; 3];
    let mut angvel = [0.0_f32; 3];

    let mut off_track_state =
        OffTrackState::seed_from_position(&track.polyline, spawn_pos[0], spawn_pos[2]);
    let backward = track.race_direction == RaceDirection::Backward;
    let mut policy = ConstantThrottle::default();

    let mut samples_ns: Vec<u128> = Vec::with_capacity(PERF_STEPS);

    for _ in 0..PERF_STEPS {
        let near = nearest_centerline_windowed(
            &track.polyline,
            position[0],
            position[2],
            off_track_state.arc_cursor,
            DEFAULT_WINDOW,
        );
        let tangent_yaw = near.tangent[0].atan2(near.tangent[1]);
        let race_tangent_yaw = if backward {
            tangent_yaw + std::f32::consts::PI
        } else {
            tangent_yaw
        };
        let yaw = car_physics_engine::utils::Quat::from_array(rotation).yaw();
        let mut diff = race_tangent_yaw - yaw;
        while diff > std::f32::consts::PI {
            diff -= 2.0 * std::f32::consts::PI;
        }
        while diff < -std::f32::consts::PI {
            diff += 2.0 * std::f32::consts::PI;
        }
        let speed_ms = (linvel[0].powi(2) + linvel[2].powi(2)).sqrt();
        let obs = Observation {
            car_xz: [position[0], position[2]],
            yaw,
            speed_kmh: speed_ms * 3.6,
            lateral_distance_m: near.lateral_distance,
            heading_error_rad: diff,
            arc_cursor: near.nearest_index,
            arc_length_m: near.arc_length,
        };
        let input: CarInput = policy.act(&obs);

        let start = Instant::now();
        let output = engine.step(DT, input, position, rotation, linvel, angvel, [0.0, 1.0, 0.0], None);
        let elapsed = start.elapsed().as_nanos();
        samples_ns.push(elapsed);

        linvel = output.linear_velocity;
        angvel = output.angular_velocity;
        position[0] += linvel[0] * DT;
        position[1] += linvel[1] * DT;
        position[2] += linvel[2] * DT;
        let half = angvel[1] * DT * 0.5;
        let s = half.sin();
        let c = half.cos();
        let (qx, qy, qz, qw) = (rotation[0], rotation[1], rotation[2], rotation[3]);
        rotation = [
            qx * c + qz * s,
            qy * c + qw * s,
            qz * c - qx * s,
            qw * c - qy * s,
        ];
        let len = (rotation[0].powi(2) + rotation[1].powi(2) + rotation[2].powi(2) + rotation[3].powi(2)).sqrt();
        if len > 1e-4 {
            for r in &mut rotation {
                *r /= len;
            }
        }

        off_track_state = OffTrackState {
            is_off_track: false,
            arc_cursor: near.nearest_index,
        };
    }

    samples_ns.sort_unstable();
    let median_us = (samples_ns[samples_ns.len() / 2] as f64) / 1000.0;
    let min_us = (*samples_ns.first().unwrap_or(&0) as f64) / 1000.0;
    let max_us = (*samples_ns.last().unwrap_or(&0) as f64) / 1000.0;

    let projected_seconds =
        (median_us * 36_000.0 * 24.0 * 200.0) / (8.0 * 1_000_000.0);
    let projected_hours = projected_seconds / 3600.0;

    PerfReport {
        median_us_per_step: median_us,
        min_us,
        max_us,
        projected_monza_hours: projected_hours,
        samples: samples_ns.len(),
    }
}

pub fn format_report(report: &PerfReport) -> String {
    let projected_minutes = report.projected_monza_hours * 60.0;
    let host = host_label();
    format!(
        "ai_runner perf baseline\n\
         host                 : {host}\n\
         samples              : {}\n\
         median_us_per_step   : {:.3}\n\
         min_us               : {:.3}\n\
         max_us               : {:.3}\n\
         projected_monza_hours: {:.4}  ({:.2} minutes; = median * 36000 steps/lap * 24 children * 200 generations / (8 cores * 1e6 us/s * 3600 s/h))\n\
         assessment           : {}\n",
        report.samples,
        report.median_us_per_step,
        report.min_us,
        report.max_us,
        report.projected_monza_hours,
        projected_minutes,
        assessment(report.projected_monza_hours),
    )
}

fn assessment(hours: f64) -> &'static str {
    if hours < 4.0 {
        "projection < 4h -> no mitigation needed (Step 4.0 skipped)"
    } else if hours < 8.0 {
        "projection in [4h, 8h] -> consider 60Hz training (Step 4.0)"
    } else {
        "projection >= 8h -> Step 4.0 mitigation REQUIRED"
    }
}

fn host_label() -> String {
    std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("HOST"))
        .unwrap_or_else(|_| "<unknown>".into())
}
