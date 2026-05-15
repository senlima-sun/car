#![cfg(feature = "headless")]

#[path = "../bin/ai_runner/track_loader.rs"]
mod track_loader;
#[path = "../bin/ai_runner/sim.rs"]
mod sim;
#[path = "../bin/ai_runner/obs.rs"]
mod obs;
#[path = "../bin/ai_runner/policies/mod.rs"]
mod policies;
#[path = "../bin/ai_runner/reward.rs"]
mod reward;

use car_physics_engine::engine::PhysicsEngine;

use policies::constant_throttle::ConstantThrottle;
use policies::lookahead::{BASELINE_PARAMS_MONZA, BASELINE_PARAMS_MONZA_CHAMPION};
use reward::evaluate;
use sim::{run_sim_with_engine, TerminationReason};
use track_loader::load_track;

#[test]
fn test_lookahead_baseline_drives_forward_on_monza() {
    let track = load_track("monza").expect("monza loads");
    let mut engine = PhysicsEngine::new();
    let result = evaluate(&BASELINE_PARAMS_MONZA, &track, &mut engine, false, 30.0, 5.0);

    assert!(result.fitness.is_finite(), "fitness must be finite");
    assert!(
        result.arc_length_progress_m > 100.0,
        "baseline must cover >100m of Monza, got {}m",
        result.arc_length_progress_m
    );
    assert!(result.sim_time_s > 0.0);
}

// Phase 4.11 quality gate: BC + auto-iterate champion (seed=11, iter 4,
// sigma_scale=0.2, 500 gens) completes Monza cleanly under F1-realistic
// reward. The Phase 4.7 cheater (94.47s / 12 off-track / ~15s in grass) was
// replaced because it deliberately abandoned the track. Champion params are
// baked into BASELINE_PARAMS_MONZA_CHAMPION so the result is reproducible
// from this fixture alone. See .claude/plans/ai-self-driving-evolutionary.md
// §Phase 4.11.
//
// Release-build sim (the production driver): lap=116.57s, off_track_count=1,
// severe=0.00. Debug-build sim drifts a few extra small touches at the same
// kerbs (~off_track_count=3, severe=0.00) due to f32 rounding differences.
// Gate values below tolerate that drift while still excluding the cheater
// pattern (12 violations, ~15s off-track, severe>0).
const LAP_TIME_QUALITY_GATE_S: f32 = 120.0;
const OFF_TRACK_COUNT_GATE: u32 = 3;
const SEVERE_OFF_TRACK_GATE_S: f32 = 1.0;

#[test]
fn test_lookahead_monza_minimum_competence() {
    let track = load_track("monza").expect("monza loads");
    let mut engine = PhysicsEngine::new();
    let result = evaluate(
        &BASELINE_PARAMS_MONZA_CHAMPION,
        &track,
        &mut engine,
        false,
        300.0,
        5.0,
    );
    assert!(
        result.lap_completed,
        "champion must complete the lap (off_track_count={}, lap_time_s={})",
        result.off_track_count,
        result.lap_time_s,
    );
    assert!(
        result.lap_time_s <= LAP_TIME_QUALITY_GATE_S,
        "lap_time {:.2}s must be <= {:.2}s (Phase 4.11 gate)",
        result.lap_time_s,
        LAP_TIME_QUALITY_GATE_S,
    );
    assert!(
        result.off_track_count <= OFF_TRACK_COUNT_GATE,
        "off_track_count {} must be <= {} (F1 3-strikes rule)",
        result.off_track_count,
        OFF_TRACK_COUNT_GATE,
    );
    assert!(
        result.severe_off_track_seconds <= SEVERE_OFF_TRACK_GATE_S,
        "severe_off_track_seconds {:.2}s must be <= {:.2}s (no deliberate-cheating)",
        result.severe_off_track_seconds,
        SEVERE_OFF_TRACK_GATE_S,
    );
}

#[test]
fn test_constant_throttle_does_not_complete_a_lap() {
    let track = load_track("monza").expect("monza loads");
    let mut engine = PhysicsEngine::new();
    let mut policy = ConstantThrottle::default();
    let result = run_sim_with_engine(&track, &mut policy, &mut engine, 90.0, 5.0);

    assert!(
        !result.lap_completed,
        "constant-throttle must not complete a Monza lap",
    );
    assert_eq!(
        result.terminated_by,
        TerminationReason::ExtendedOffTrack,
        "expected ExtendedOffTrack termination, got {:?}",
        result.terminated_by,
    );
}
