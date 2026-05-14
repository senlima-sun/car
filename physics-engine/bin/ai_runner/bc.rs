#![allow(dead_code)]

use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::evo::{Population, INITIAL_SIGMA_MONZA};
use crate::obs::{build_observation, ObservationContext};
use crate::policies::lookahead::{LookaheadPolicy, BASELINE_PARAMS_MONZA, LOOKAHEAD_PARAM_COUNT};
use crate::sim::{Observation, Policy, PolicyContext, SimState};
use crate::track_loader::{LoadedTrack, RaceDirection};

use car_physics_engine::types::CarInput;

pub const BC_SCHEMA_VERSION: u32 = 1;
const BC_LOSS_WEIGHT_STEER: f32 = 1.0;
const BC_LOSS_WEIGHT_THROTTLE: f32 = 1.0;
const BC_LOSS_WEIGHT_BRAKE: f32 = 2.0;
const HOLDOUT_TAIL_FRACTION: f32 = 0.10;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HumanDemo {
    pub schema_version: u32,
    pub track_id: String,
    pub lap_time: f32,
    pub frame_count: u32,
    pub sample_interval_ms: f32,
    pub positions: Vec<f32>,
    pub rotations: Vec<f32>,
    pub steer_angles: Vec<f32>,
    pub wheel_rotations: Vec<f32>,
    pub timestamps: Vec<f32>,
    pub throttles: Vec<f32>,
    pub brakes: Vec<f32>,
}

#[derive(Debug)]
pub enum BcError {
    Io(io::Error),
    Parse(String),
    SchemaMismatch { found: u32, expected: u32 },
    LengthMismatch(String),
    TooShort(u32),
}

impl std::fmt::Display for BcError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BcError::Io(e) => write!(f, "io: {e}"),
            BcError::Parse(s) => write!(f, "parse: {s}"),
            BcError::SchemaMismatch { found, expected } => {
                write!(f, "unsupported demo schemaVersion = {found} (expected {expected})")
            }
            BcError::LengthMismatch(s) => write!(f, "length mismatch: {s}"),
            BcError::TooShort(n) => {
                write!(f, "demo too short ({n} frames < 100)")
            }
        }
    }
}

impl std::error::Error for BcError {}

pub fn load_demo(path: &Path) -> Result<HumanDemo, BcError> {
    let bytes = fs::read(path).map_err(BcError::Io)?;
    let demo: HumanDemo =
        serde_json::from_slice(&bytes).map_err(|e| BcError::Parse(e.to_string()))?;

    if demo.schema_version != BC_SCHEMA_VERSION {
        return Err(BcError::SchemaMismatch {
            found: demo.schema_version,
            expected: BC_SCHEMA_VERSION,
        });
    }
    if demo.frame_count < 100 {
        return Err(BcError::TooShort(demo.frame_count));
    }
    let n = demo.frame_count as usize;
    if demo.positions.len() != n * 3 {
        return Err(BcError::LengthMismatch(format!(
            "positions {} != frameCount*3 {}",
            demo.positions.len(),
            n * 3
        )));
    }
    if demo.rotations.len() != n * 4 {
        return Err(BcError::LengthMismatch(format!(
            "rotations {} != frameCount*4 {}",
            demo.rotations.len(),
            n * 4
        )));
    }
    if demo.steer_angles.len() != n {
        return Err(BcError::LengthMismatch(format!(
            "steerAngles {} != frameCount {}",
            demo.steer_angles.len(),
            n
        )));
    }
    if demo.throttles.len() != n {
        return Err(BcError::LengthMismatch(format!(
            "throttles {} != frameCount {}",
            demo.throttles.len(),
            n
        )));
    }
    if demo.brakes.len() != n {
        return Err(BcError::LengthMismatch(format!(
            "brakes {} != frameCount {}",
            demo.brakes.len(),
            n
        )));
    }
    if demo.timestamps.len() != n {
        return Err(BcError::LengthMismatch(format!(
            "timestamps {} != frameCount {}",
            demo.timestamps.len(),
            n
        )));
    }
    if demo.wheel_rotations.len() != n * 4 {
        return Err(BcError::LengthMismatch(format!(
            "wheelRotations {} != frameCount*4 {}",
            demo.wheel_rotations.len(),
            n * 4
        )));
    }
    Ok(demo)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BcFitReport {
    pub schema_version: u32,
    pub track_id: String,
    pub demo_lap_time_s: f32,
    pub demo_frame_count: u32,
    pub generations_run: u32,
    pub training_loss: f32,
    pub training_frame_count: u32,
    pub holdout_frame_count: u32,
    pub holdout_rms_steer: f32,
    pub holdout_rms_throttle: f32,
    pub holdout_rms_brake: f32,
    pub baseline_loss: f32,
    pub champion_params: Vec<f32>,
}

pub struct BcResult {
    pub params: [f32; LOOKAHEAD_PARAM_COUNT],
    pub report: BcFitReport,
}

#[inline]
fn yaw_from_quat(quat: [f32; 4]) -> f32 {
    car_physics_engine::utils::Quat::from_array(quat).yaw()
}

#[inline]
fn angle_unwrap(prev: f32, next: f32) -> f32 {
    let mut d = next - prev;
    while d > std::f32::consts::PI {
        d -= 2.0 * std::f32::consts::PI;
    }
    while d < -std::f32::consts::PI {
        d += 2.0 * std::f32::consts::PI;
    }
    d
}

pub fn reconstruct_sim_states(demo: &HumanDemo) -> Vec<SimState> {
    let n = demo.frame_count as usize;
    let dt = (demo.sample_interval_ms.max(1.0)) / 1000.0;
    let mut states: Vec<SimState> = Vec::with_capacity(n);

    for i in 0..n {
        let pos = [
            demo.positions[i * 3],
            demo.positions[i * 3 + 1],
            demo.positions[i * 3 + 2],
        ];
        let rot = [
            demo.rotations[i * 4],
            demo.rotations[i * 4 + 1],
            demo.rotations[i * 4 + 2],
            demo.rotations[i * 4 + 3],
        ];

        let (linvel, yaw_rate) = if n < 2 {
            ([0.0; 3], 0.0)
        } else if i == 0 {
            let p1 = [
                demo.positions[3],
                demo.positions[4],
                demo.positions[5],
            ];
            let yaw0 = yaw_from_quat(rot);
            let yaw1 = yaw_from_quat([
                demo.rotations[4],
                demo.rotations[5],
                demo.rotations[6],
                demo.rotations[7],
            ]);
            let dy = angle_unwrap(yaw0, yaw1) / dt;
            (
                [
                    (p1[0] - pos[0]) / dt,
                    (p1[1] - pos[1]) / dt,
                    (p1[2] - pos[2]) / dt,
                ],
                dy,
            )
        } else if i + 1 == n {
            let pm1 = [
                demo.positions[(i - 1) * 3],
                demo.positions[(i - 1) * 3 + 1],
                demo.positions[(i - 1) * 3 + 2],
            ];
            let yaw_m1 = yaw_from_quat([
                demo.rotations[(i - 1) * 4],
                demo.rotations[(i - 1) * 4 + 1],
                demo.rotations[(i - 1) * 4 + 2],
                demo.rotations[(i - 1) * 4 + 3],
            ]);
            let yaw_now = yaw_from_quat(rot);
            let dy = angle_unwrap(yaw_m1, yaw_now) / dt;
            (
                [
                    (pos[0] - pm1[0]) / dt,
                    (pos[1] - pm1[1]) / dt,
                    (pos[2] - pm1[2]) / dt,
                ],
                dy,
            )
        } else {
            let pm1 = [
                demo.positions[(i - 1) * 3],
                demo.positions[(i - 1) * 3 + 1],
                demo.positions[(i - 1) * 3 + 2],
            ];
            let p1 = [
                demo.positions[(i + 1) * 3],
                demo.positions[(i + 1) * 3 + 1],
                demo.positions[(i + 1) * 3 + 2],
            ];
            let yaw_m1 = yaw_from_quat([
                demo.rotations[(i - 1) * 4],
                demo.rotations[(i - 1) * 4 + 1],
                demo.rotations[(i - 1) * 4 + 2],
                demo.rotations[(i - 1) * 4 + 3],
            ]);
            let yaw_p1 = yaw_from_quat([
                demo.rotations[(i + 1) * 4],
                demo.rotations[(i + 1) * 4 + 1],
                demo.rotations[(i + 1) * 4 + 2],
                demo.rotations[(i + 1) * 4 + 3],
            ]);
            let two_dt = 2.0 * dt;
            let dy = angle_unwrap(yaw_m1, yaw_p1) / two_dt;
            (
                [
                    (p1[0] - pm1[0]) / two_dt,
                    (p1[1] - pm1[1]) / two_dt,
                    (p1[2] - pm1[2]) / two_dt,
                ],
                dy,
            )
        };

        states.push(SimState {
            position: pos,
            rotation: rot,
            linvel,
            angvel: [0.0, yaw_rate, 0.0],
        });
    }
    states
}

pub fn build_demo_frames(
    demo: &HumanDemo,
    track: &LoadedTrack,
) -> Vec<(Observation, CarInput)> {
    let states = reconstruct_sim_states(demo);
    let n = states.len();
    let mut frames: Vec<(Observation, CarInput)> = Vec::with_capacity(n);
    let mut obs_ctx = ObservationContext::new();
    let mut arc_cursor: usize = 0;

    for (i, state) in states.iter().enumerate() {
        let products = build_observation(track, state, arc_cursor, &mut obs_ctx);
        arc_cursor = products.near.nearest_index;

        let throttle = demo.throttles[i].clamp(0.0, 1.0);
        let brake_analog = demo.brakes[i].clamp(0.0, 1.0);
        let steer = demo.steer_angles[i].clamp(-1.0, 1.0);

        let input = CarInput {
            forward: throttle > 0.0,
            backward: false,
            left: false,
            right: false,
            brake: brake_analog > 0.5,
            handbrake: false,
            steer,
            throttle,
            brake_analog,
        };
        frames.push((products.obs, input));
    }
    frames
}

#[inline]
fn weighted_loss(predicted: &CarInput, target: &CarInput) -> f32 {
    let ds = predicted.steer - target.steer;
    let dt = predicted.throttle - target.throttle;
    let db = predicted.brake_analog - target.brake_analog;
    BC_LOSS_WEIGHT_STEER * ds * ds
        + BC_LOSS_WEIGHT_THROTTLE * dt * dt
        + BC_LOSS_WEIGHT_BRAKE * db * db
}

pub fn bc_loss(
    params: &[f32; LOOKAHEAD_PARAM_COUNT],
    frames: &[(Observation, CarInput)],
    ctx: &PolicyContext,
    training_frames: usize,
) -> f32 {
    if training_frames == 0 {
        return 0.0;
    }
    let mut policy = LookaheadPolicy::from_array(params);
    let mut accum: f32 = 0.0;
    let mut counted: f32 = 0.0;
    for (i, (obs, target_input)) in frames.iter().enumerate() {
        let predicted = policy.act(obs, ctx);
        if i < training_frames {
            accum += weighted_loss(&predicted, target_input);
            counted += 1.0;
        }
    }
    if counted < 1.0 {
        0.0
    } else {
        accum / counted
    }
}

pub fn holdout_rms(
    params: &[f32; LOOKAHEAD_PARAM_COUNT],
    frames: &[(Observation, CarInput)],
    ctx: &PolicyContext,
    training_frames: usize,
) -> (f32, f32, f32) {
    let total = frames.len();
    if total <= training_frames {
        return (0.0, 0.0, 0.0);
    }
    let mut policy = LookaheadPolicy::from_array(params);
    let mut ss_steer: f32 = 0.0;
    let mut ss_throttle: f32 = 0.0;
    let mut ss_brake: f32 = 0.0;
    let mut count: f32 = 0.0;
    for (i, (obs, target_input)) in frames.iter().enumerate() {
        let predicted = policy.act(obs, ctx);
        if i < training_frames {
            continue;
        }
        ss_steer += (predicted.steer - target_input.steer).powi(2);
        ss_throttle += (predicted.throttle - target_input.throttle).powi(2);
        ss_brake += (predicted.brake_analog - target_input.brake_analog).powi(2);
        count += 1.0;
    }
    if count < 1.0 {
        (0.0, 0.0, 0.0)
    } else {
        (
            (ss_steer / count).sqrt(),
            (ss_throttle / count).sqrt(),
            (ss_brake / count).sqrt(),
        )
    }
}

pub fn fit_bc(
    demo: &HumanDemo,
    track: &LoadedTrack,
    master_seed: u64,
    generations: u32,
) -> BcResult {
    let frames = build_demo_frames(demo, track);
    let total_arc = track
        .polyline
        .cumulative_arc
        .last()
        .copied()
        .unwrap_or(0.0)
        .max(1.0);
    let backward = track.race_direction == RaceDirection::Backward;
    let ctx = PolicyContext {
        polyline: &track.polyline,
        total_arc,
        backward,
    };

    let total = frames.len();
    let holdout_count = ((total as f32) * HOLDOUT_TAIL_FRACTION).floor() as usize;
    let training_frames = total.saturating_sub(holdout_count);

    let baseline_loss = bc_loss(&BASELINE_PARAMS_MONZA, &frames, &ctx, training_frames);

    let mut pop = Population::init(
        LOOKAHEAD_PARAM_COUNT,
        8,
        24,
        master_seed,
        &BASELINE_PARAMS_MONZA,
        &INITIAL_SIGMA_MONZA,
    );

    let mut best_params: [f32; LOOKAHEAD_PARAM_COUNT] = BASELINE_PARAMS_MONZA;
    let mut best_loss = baseline_loss;

    for _ in 0..generations {
        let frames_ref = &frames;
        let ctx_ref = &ctx;
        let gen = pop.step_par(move |params: &[f32], _idx: usize| -> f32 {
            if params.len() != LOOKAHEAD_PARAM_COUNT {
                return f32::NEG_INFINITY;
            }
            let mut arr = [0.0_f32; LOOKAHEAD_PARAM_COUNT];
            arr.copy_from_slice(params);
            -bc_loss(&arr, frames_ref, ctx_ref, training_frames)
        });
        let candidate_loss = -gen.best_fitness;
        if candidate_loss < best_loss {
            best_loss = candidate_loss;
            if gen.best_params.len() == LOOKAHEAD_PARAM_COUNT {
                best_params.copy_from_slice(&gen.best_params);
            }
        }
    }

    let (rms_steer, rms_throttle, rms_brake) =
        holdout_rms(&best_params, &frames, &ctx, training_frames);

    let report = BcFitReport {
        schema_version: BC_SCHEMA_VERSION,
        track_id: demo.track_id.clone(),
        demo_lap_time_s: demo.lap_time / 1000.0,
        demo_frame_count: demo.frame_count,
        generations_run: generations,
        training_loss: best_loss,
        training_frame_count: training_frames as u32,
        holdout_frame_count: holdout_count as u32,
        holdout_rms_steer: rms_steer,
        holdout_rms_throttle: rms_throttle,
        holdout_rms_brake: rms_brake,
        baseline_loss,
        champion_params: best_params.to_vec(),
    };

    BcResult {
        params: best_params,
        report,
    }
}

pub fn write_bc_report_atomic(path: &Path, report: &BcFitReport) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)?;
        }
    }
    let mut tmp: PathBuf = path.to_path_buf();
    let mut name = tmp
        .file_name()
        .map(|s| s.to_os_string())
        .unwrap_or_else(|| std::ffi::OsString::from("bc-report.tmp"));
    name.push(".tmp");
    tmp.set_file_name(name);

    let json =
        serde_json::to_string_pretty(report).map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;
    {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(json.as_bytes())?;
        f.flush()?;
        f.sync_data()?;
    }
    fs::rename(&tmp, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::track_loader::load_track;

    const MONZA_DEMO_PATH: &str =
        concat!(env!("CARGO_MANIFEST_DIR"), "/../apps/game/public/demos/f1_autodromo_nazionale_monza.demo.json");

    #[test]
    fn loads_monza_demo_json() {
        let path = Path::new(MONZA_DEMO_PATH);
        let demo = load_demo(path).expect("monza demo loads");
        assert_eq!(demo.schema_version, 1);
        assert_eq!(demo.track_id, "f1_autodromo_nazionale_monza");
        assert!(demo.frame_count > 1000, "frame_count={}", demo.frame_count);
        assert!(demo.lap_time > 50_000.0 && demo.lap_time < 200_000.0);
        assert_eq!(demo.positions.len(), demo.frame_count as usize * 3);
        assert_eq!(demo.throttles.len(), demo.frame_count as usize);
        assert_eq!(demo.brakes.len(), demo.frame_count as usize);
    }

    #[test]
    fn rejects_wrong_schema_version() {
        let mut demo_bytes = fs::read(MONZA_DEMO_PATH).unwrap();
        let s = std::str::from_utf8(&demo_bytes).unwrap().to_string();
        let mutated = s.replacen("\"schemaVersion\": 1", "\"schemaVersion\": 2", 1);
        demo_bytes = mutated.into_bytes();
        let tmp = std::env::temp_dir().join(format!(
            "ai-runner-bc-bad-schema-{}.json",
            std::process::id()
        ));
        fs::write(&tmp, &demo_bytes).unwrap();
        let err = load_demo(&tmp).unwrap_err();
        match err {
            BcError::SchemaMismatch { found, expected } => {
                assert_eq!(found, 2);
                assert_eq!(expected, 1);
            }
            other => panic!("expected SchemaMismatch, got {other:?}"),
        }
        let _ = fs::remove_file(&tmp);
    }

    #[test]
    fn reconstruct_states_returns_correct_length() {
        let path = Path::new(MONZA_DEMO_PATH);
        let demo = load_demo(path).expect("demo loads");
        let states = reconstruct_sim_states(&demo);
        assert_eq!(states.len(), demo.frame_count as usize);
        for s in &states {
            assert!(s.position[0].is_finite());
            assert!(s.linvel[0].is_finite());
            assert!(s.angvel[1].is_finite());
        }
    }

    #[test]
    fn baseline_loss_finite() {
        let path = Path::new(MONZA_DEMO_PATH);
        let demo = load_demo(path).expect("demo loads");
        let track = load_track("monza").expect("monza loads");
        let frames = build_demo_frames(&demo, &track);
        assert_eq!(frames.len(), demo.frame_count as usize);

        let total_arc = track
            .polyline
            .cumulative_arc
            .last()
            .copied()
            .unwrap_or(0.0)
            .max(1.0);
        let ctx = PolicyContext {
            polyline: &track.polyline,
            total_arc,
            backward: track.race_direction == RaceDirection::Backward,
        };

        let loss = bc_loss(&BASELINE_PARAMS_MONZA, &frames, &ctx, frames.len());
        assert!(loss.is_finite(), "loss must be finite: {loss}");
        assert!(loss > 0.0, "baseline loss should be positive, got {loss}");
    }

    #[test]
    fn bc_loss_decreases_with_short_run() {
        let path = Path::new(MONZA_DEMO_PATH);
        let demo = load_demo(path).expect("demo loads");
        let track = load_track("monza").expect("monza loads");
        let result = fit_bc(&demo, &track, 42, 5);
        assert!(result.report.training_loss <= result.report.baseline_loss + 1e-3,
            "BC must not regress against baseline after 5 generations \
             (baseline={} training={})",
            result.report.baseline_loss,
            result.report.training_loss);
    }

    #[test]
    fn bc_determinism() {
        let path = Path::new(MONZA_DEMO_PATH);
        let demo = load_demo(path).expect("demo loads");
        let track = load_track("monza").expect("monza loads");
        let a = fit_bc(&demo, &track, 7, 3);
        let b = fit_bc(&demo, &track, 7, 3);
        for i in 0..LOOKAHEAD_PARAM_COUNT {
            assert_eq!(
                a.params[i].to_bits(),
                b.params[i].to_bits(),
                "param {i} differs: a={} b={}",
                a.params[i],
                b.params[i]
            );
        }
    }

    #[test]
    fn bc_seed_path_does_not_exist_yields_io_error() {
        let path = Path::new("/nonexistent/definitely_no_demo_here.json");
        let err = load_demo(path).unwrap_err();
        match err {
            BcError::Io(_) => {}
            other => panic!("expected Io, got {other:?}"),
        }
    }

    #[test]
    #[ignore = "smoke: takes ~30s; runs 50-gen BC then replay verify on Monza"]
    fn bc_seed_smoke_replay_progress() {
        use crate::reward::evaluate;
        use car_physics_engine::engine::PhysicsEngine;

        let path = Path::new(MONZA_DEMO_PATH);
        let demo = load_demo(path).expect("demo loads");
        let track = load_track("monza").expect("monza loads");
        let bc_result = fit_bc(&demo, &track, 42, 50);
        let mut engine = PhysicsEngine::new();
        let eval = evaluate(&bc_result.params, &track, &mut engine, false, 300.0, 5.0);
        let mut baseline_engine = PhysicsEngine::new();
        let baseline = evaluate(
            &BASELINE_PARAMS_MONZA,
            &track,
            &mut baseline_engine,
            false,
            300.0,
            5.0,
        );
        assert!(
            eval.arc_length_progress_m > baseline.arc_length_progress_m,
            "BC must out-progress baseline (BC={}m, baseline={}m, lap_completed={})",
            eval.arc_length_progress_m,
            baseline.arc_length_progress_m,
            eval.lap_completed,
        );
    }
}
