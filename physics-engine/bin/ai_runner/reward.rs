#![allow(dead_code)]

use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

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

pub fn evaluate_with_trace(
    params: &[f32; LOOKAHEAD_PARAM_COUNT],
    track: &LoadedTrack,
    engine: &mut PhysicsEngine,
    record_telemetry: bool,
    max_t_s: f32,
    off_track_kill_s: f32,
    reward_trace_path: Option<&Path>,
) -> EvalResult {
    let result = evaluate_inner(params, track, engine, record_telemetry, max_t_s, off_track_kill_s);
    if let (Some(path), Some(telemetry)) = (reward_trace_path, &result.telemetry) {
        let rows = sample_reward_trace(telemetry);
        let _ = write_reward_trace_csv_atomic(path, &rows);
    }
    result
}

pub fn evaluate(
    params: &[f32; LOOKAHEAD_PARAM_COUNT],
    track: &LoadedTrack,
    engine: &mut PhysicsEngine,
    record_telemetry: bool,
    max_t_s: f32,
    off_track_kill_s: f32,
) -> EvalResult {
    evaluate_inner(params, track, engine, record_telemetry, max_t_s, off_track_kill_s)
}

fn evaluate_inner(
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

#[derive(Debug, Clone, Copy)]
pub struct RewardTraceRow {
    pub t_s: f32,
    pub progress_delta_m: f32,
    pub speed_factor: f32,
    pub off_track_penalty_delta: f32,
    pub instantaneous_fitness: f32,
}

pub fn sample_reward_trace(telemetry: &[TelemetryFrame]) -> Vec<RewardTraceRow> {
    if telemetry.is_empty() {
        return Vec::new();
    }
    let mut rows: Vec<RewardTraceRow> = Vec::with_capacity(telemetry.len() / 120 + 4);
    let mut next_sample_t = 0.0_f32;
    let mut prev_arc = telemetry[0].arc_length_m;
    let mut off_track_seconds_cum: f32 = 0.0;
    let mut prev_t = telemetry[0].t_s;
    let mut prev_off_track_seconds: f32 = 0.0;

    for frame in telemetry {
        let dt = (frame.t_s - prev_t).max(0.0);
        if frame.is_off_track {
            off_track_seconds_cum += dt;
        }
        prev_t = frame.t_s;

        if frame.t_s + 1e-6 < next_sample_t {
            continue;
        }
        let progress_delta = (frame.arc_length_m - prev_arc).max(0.0);
        prev_arc = frame.arc_length_m;
        let off_track_penalty_delta = (off_track_seconds_cum - prev_off_track_seconds) * 50.0;
        prev_off_track_seconds = off_track_seconds_cum;
        let avg_speed_kmh = (frame.arc_length_m / frame.t_s.max(1.0)) * 3.6;
        let speed_factor = (avg_speed_kmh / 100.0).clamp(0.5, 4.0);
        let instantaneous_fitness =
            progress_delta * speed_factor - off_track_penalty_delta - 5.0;

        rows.push(RewardTraceRow {
            t_s: frame.t_s,
            progress_delta_m: progress_delta,
            speed_factor,
            off_track_penalty_delta,
            instantaneous_fitness,
        });

        next_sample_t = (frame.t_s.floor() + 1.0).max(next_sample_t + 1.0);
    }

    rows
}

pub fn write_reward_trace_csv_atomic(
    path: &Path,
    rows: &[RewardTraceRow],
) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)?;
        }
    }

    let mut tmp: PathBuf = path.to_path_buf();
    let mut name = tmp
        .file_name()
        .map(|s| s.to_os_string())
        .unwrap_or_else(|| std::ffi::OsString::from("reward-trace.csv"));
    name.push(".tmp");
    tmp.set_file_name(name);

    {
        let mut f = fs::File::create(&tmp)?;
        writeln!(
            f,
            "t_s,progress_delta_m,speed_factor,off_track_penalty_delta,instantaneous_fitness"
        )?;
        for r in rows {
            writeln!(
                f,
                "{:.3},{:.3},{:.4},{:.3},{:.3}",
                r.t_s,
                r.progress_delta_m,
                r.speed_factor,
                r.off_track_penalty_delta,
                r.instantaneous_fitness
            )?;
        }
        f.flush()?;
    }
    fs::rename(&tmp, path)?;
    Ok(())
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
    fn sample_reward_trace_emits_roughly_one_row_per_second() {
        let mut frames: Vec<TelemetryFrame> = Vec::new();
        for i in 0..1200 {
            frames.push(TelemetryFrame {
                t_s: (i as f32) / 120.0,
                x: 0.0,
                y: 0.0,
                z: 0.0,
                qx: 0.0,
                qy: 0.0,
                qz: 0.0,
                qw: 1.0,
                speed_kmh: 100.0,
                throttle: 1.0,
                brake: 0.0,
                steer: 0.0,
                is_off_track: false,
                lateral_distance_m: 0.0,
                arc_length_m: (i as f32) * 0.231,
            });
        }
        let rows = sample_reward_trace(&frames);
        assert!(rows.len() >= 9 && rows.len() <= 12, "got {} rows", rows.len());
        for r in &rows {
            assert!(r.instantaneous_fitness.is_finite());
            assert!(r.speed_factor >= 0.5 && r.speed_factor <= 4.0);
        }
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
