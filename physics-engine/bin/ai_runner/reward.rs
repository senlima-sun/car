#![allow(dead_code)]

use car_physics_engine::engine::PhysicsEngine;

use crate::policies::lookahead::{LookaheadPolicy, LOOKAHEAD_PARAM_COUNT};
use crate::sim::{run_sim_with_engine, TelemetryFrame, TerminationReason};
use crate::track_loader::LoadedTrack;

#[derive(Debug, Clone)]
pub struct EvalResult {
    pub fitness: f32,
    pub arc_length_progress_m: f32,
    pub sim_time_s: f32,
    pub lap_time_s: f32,
    pub off_track_seconds: f32,
    pub off_track_count: u32,
    pub lap_completed: bool,
    pub terminated_by: TerminationReason,
    pub telemetry: Option<Vec<TelemetryFrame>>,
}

#[inline]
pub fn compute_fitness(
    arc_length_progress_m: f32,
    sim_time_s: f32,
    off_track_seconds: f32,
    lap_completed: bool,
    lap_time_s: f32,
) -> f32 {
    let avg_speed_kmh = (arc_length_progress_m / sim_time_s.max(1.0)) * 3.6;
    let speed_factor = (avg_speed_kmh / 100.0).clamp(0.5, 4.0);
    let lap_bonus = if lap_completed {
        (1200.0 - lap_time_s).max(0.0) * 10.0
    } else {
        0.0
    };
    arc_length_progress_m * speed_factor - 50.0 * off_track_seconds - 5.0 * sim_time_s + lap_bonus
}

pub fn evaluate(
    params: &[f32; LOOKAHEAD_PARAM_COUNT],
    track: &LoadedTrack,
    engine: &mut PhysicsEngine,
    record_telemetry: bool,
    max_t_s: f32,
    off_track_kill_s: f32,
) -> EvalResult {
    let mut policy = LookaheadPolicy::from_array(params);
    let result = run_sim_with_engine(track, &mut policy, engine, max_t_s, off_track_kill_s);

    let sim_time_s = result.telemetry.last().map(|f| f.t_s).unwrap_or(0.0);
    let lap_time_s = if result.lap_completed { sim_time_s } else { f32::MAX };
    let arc_length_progress_m = result
        .telemetry
        .last()
        .map(|f| f.arc_length_m)
        .unwrap_or(0.0)
        .max(0.0);

    let total_arc = track
        .polyline
        .cumulative_arc
        .last()
        .copied()
        .unwrap_or(0.0)
        .max(1.0);
    let progress_for_fitness = if result.lap_completed {
        total_arc
    } else {
        arc_length_progress_m
    };

    let fitness = compute_fitness(
        progress_for_fitness,
        sim_time_s,
        result.off_track_seconds,
        result.lap_completed,
        if result.lap_completed { lap_time_s } else { 1200.0 },
    );

    let telemetry = if record_telemetry {
        Some(result.telemetry)
    } else {
        None
    };

    EvalResult {
        fitness,
        arc_length_progress_m: progress_for_fitness,
        sim_time_s,
        lap_time_s,
        off_track_seconds: result.off_track_seconds,
        off_track_count: result.off_track_count,
        lap_completed: result.lap_completed,
        terminated_by: result.terminated_by,
        telemetry,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::policies::lookahead::BASELINE_PARAMS_MONZA;
    use crate::track_loader::load_track;

    #[test]
    fn crawl_loses_to_fast_with_one_violation() {
        let crawl = compute_fitness(5800.0, 700.0, 0.0, false, 1200.0);
        let fast_with_violation = compute_fitness(5800.0, 100.0, 1.0, true, 100.0);
        assert!(
            fast_with_violation > crawl,
            "fast-with-1-violation ({fast_with_violation}) should beat crawl ({crawl})",
        );
    }

    #[test]
    fn lap_complete_bonus_dominates_partial_progress() {
        let complete_at_100s = compute_fitness(5800.0, 100.0, 0.0, true, 100.0);
        let partial_at_1200s = compute_fitness(2900.0, 1200.0, 0.0, false, 1200.0);
        assert!(
            complete_at_100s > partial_at_1200s,
            "complete-at-100s ({complete_at_100s}) should beat partial-at-1200s ({partial_at_1200s})",
        );
    }

    #[test]
    fn off_track_penalty_reduces_fitness() {
        let clean = compute_fitness(5000.0, 200.0, 0.0, false, 1200.0);
        let dirty = compute_fitness(5000.0, 200.0, 5.0, false, 1200.0);
        assert!(
            dirty < clean,
            "off-track penalty must reduce fitness (clean={clean}, dirty={dirty})",
        );
        assert!(
            (clean - dirty - 5.0 * 50.0).abs() < 1e-3,
            "off-track penalty must be exactly 50 per second",
        );
    }

    #[test]
    fn evaluate_runs_without_panicking_on_silverstone() {
        let track = match load_track("silverstone") {
            Ok(t) => t,
            Err(err) => panic!("test fixture failed to load silverstone: {err}"),
        };
        let mut engine = PhysicsEngine::new();
        let result = evaluate(
            &BASELINE_PARAMS_MONZA,
            &track,
            &mut engine,
            false,
            20.0,
            5.0,
        );
        assert!(
            result.sim_time_s >= 0.0,
            "evaluate produced negative sim time: {}",
            result.sim_time_s
        );
        assert!(result.fitness.is_finite());
    }
}
