use std::time::Instant;

use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::track_geometry::OffTrackState;
use car_physics_engine::types::{CarInput, SurfaceType, TireCompound};

use crate::obs::{build_observation, ObservationContext};
use crate::policies::constant_throttle::ConstantThrottle;
use crate::sim::{integrate_yaw, Policy, PolicyContext, SimState, DT};
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
    let mut state = SimState {
        position: spawn_pos,
        rotation: spawn_rot,
        linvel: [0.0_f32; 3],
        angvel: [0.0_f32; 3],
    };

    let mut off_track_state =
        OffTrackState::seed_from_position(&track.polyline, spawn_pos[0], spawn_pos[2]);
    let mut policy = ConstantThrottle::default();
    let mut obs_ctx = ObservationContext::new();
    let total_arc = track
        .polyline
        .cumulative_arc
        .last()
        .copied()
        .unwrap_or(0.0)
        .max(1.0);
    let policy_ctx = PolicyContext {
        polyline: &track.polyline,
        total_arc,
        backward: track.race_direction == RaceDirection::Backward,
    };

    let mut samples_ns: Vec<u128> = Vec::with_capacity(PERF_STEPS);

    for _ in 0..PERF_STEPS {
        let products = build_observation(track, &state, off_track_state.arc_cursor, &mut obs_ctx);
        let input: CarInput = policy.act(&products.obs, &policy_ctx);

        let start = Instant::now();
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
        let elapsed = start.elapsed().as_nanos();
        samples_ns.push(elapsed);

        state.linvel = output.linear_velocity;
        state.angvel = output.angular_velocity;
        state.position[0] += state.linvel[0] * DT;
        state.position[1] += state.linvel[1] * DT;
        state.position[2] += state.linvel[2] * DT;
        integrate_yaw(&mut state.rotation, state.angvel[1], DT);

        off_track_state = OffTrackState {
            is_off_track: false,
            arc_cursor: products.near.nearest_index,
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
