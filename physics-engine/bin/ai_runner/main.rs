mod bc;
mod evo;
mod ghost_writer;
mod obs;
mod parallel_eval;
mod perf;
mod policies;
mod reward;
mod sim;
mod telemetry;
mod track_loader;

use std::path::PathBuf;
use std::process::ExitCode;
use std::time::Instant;

use evo::{Population, INITIAL_SIGMA_MONZA};
use ghost_writer::{
    slug_from_track_id, subsample_telemetry, write_ghost_bin_atomic, write_ghost_meta_atomic,
    GhostMeta, GHOST_SCHEMA_VERSION, GHOST_STRIDE_120_TO_20_HZ,
};
use parallel_eval::{evaluate_on_thread_engine, make_par_eval_fn};
use policies::constant_throttle::ConstantThrottle;
use policies::lookahead::{LookaheadPolicy, BASELINE_PARAMS_MONZA, LOOKAHEAD_PARAM_COUNT};
use sim::{run_sim, Policy, TerminationReason};

const HELP: &str = "\
ai_runner — headless physics driver for AI policy evaluation

USAGE:
    ai_runner [OPTIONS]

OPTIONS:
    --track <name>             Circuit to load (default: silverstone)
    --policy <name>            Policy to drive (default: constant-throttle)
    --out <dir>                Output directory (default: target/ai-runner-outputs)
    --out-dir <dir>            Ghost output directory for --mode train
                               (default: apps/game/public/ai-replays)
    --seed <n>                 RNG seed (default: 42)
    --mode <run|perf|train>    Execution mode (default: run)
    --generations <n>          Number of evo generations (default: 200)
    --mu <n>                   Parents kept per generation (default: 8)
    --lambda <n>               Offspring per generation (default: 24)
    --bc-seed <path>           Path to human demo JSON to BC-seed ES
    --bc-generations <n>       BC inner generations when --bc-seed (default: 50)
    --bc-sigma-scale <f>       Sigma scale for ES after BC (default: 0.3)
    --bc-only                  Run BC fit + dump ghost, skip ES
    --auto-iterate             Train through staged-sigma schedule until quality gate
    --gate-lap-time <f>        Auto-iterate gate: max lap_time_s (default: 99.4)
    --gate-off-track <n>       Auto-iterate gate: max off_track_count (default: 1)
    -h, --help                 Print this help

EXAMPLES:
    ai_runner --track silverstone --policy constant-throttle
    ai_runner --mode perf
    ai_runner --mode train --track monza --seed 42 --generations 200
    ai_runner --mode train --track monza --bc-seed demo.json --generations 200
    ai_runner --mode train --track monza --bc-seed demo.json --auto-iterate
";

#[derive(Debug, Clone)]
struct Args {
    track: String,
    policy: String,
    out: PathBuf,
    out_dir: PathBuf,
    seed: u64,
    mode: Mode,
    generations: u32,
    mu: usize,
    lambda: usize,
    bc_seed: Option<PathBuf>,
    bc_generations: u32,
    bc_sigma_scale: f32,
    bc_only: bool,
    auto_iterate: bool,
    gate_lap_time: f32,
    gate_off_track: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Mode {
    Run,
    Perf,
    Train,
}

impl Mode {
    fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "run" => Ok(Mode::Run),
            "perf" => Ok(Mode::Perf),
            "train" => Ok(Mode::Train),
            other => Err(format!("unknown --mode value: {other}")),
        }
    }
}

fn parse_args() -> Result<Args, pico_args::Error> {
    let mut pargs = pico_args::Arguments::from_env();

    if pargs.contains(["-h", "--help"]) {
        print!("{HELP}");
        std::process::exit(0);
    }

    let track: Option<String> = pargs.opt_value_from_str("--track")?;
    let policy: Option<String> = pargs.opt_value_from_str("--policy")?;
    let out: Option<PathBuf> = pargs.opt_value_from_str("--out")?;
    let out_dir: Option<PathBuf> = pargs.opt_value_from_str("--out-dir")?;
    let seed: Option<u64> = pargs.opt_value_from_str("--seed")?;
    let mode_raw: Option<String> = pargs.opt_value_from_str("--mode")?;
    let generations: Option<u32> = pargs.opt_value_from_str("--generations")?;
    let mu: Option<usize> = pargs.opt_value_from_str("--mu")?;
    let lambda: Option<usize> = pargs.opt_value_from_str("--lambda")?;
    let bc_seed: Option<PathBuf> = pargs.opt_value_from_str("--bc-seed")?;
    let bc_generations: Option<u32> = pargs.opt_value_from_str("--bc-generations")?;
    let bc_sigma_scale: Option<f32> = pargs.opt_value_from_str("--bc-sigma-scale")?;
    let bc_only = pargs.contains("--bc-only");
    let auto_iterate = pargs.contains("--auto-iterate");
    let gate_lap_time: Option<f32> = pargs.opt_value_from_str("--gate-lap-time")?;
    let gate_off_track: Option<u32> = pargs.opt_value_from_str("--gate-off-track")?;

    let remaining = pargs.finish();
    if !remaining.is_empty() {
        return Err(pico_args::Error::Utf8ArgumentParsingFailed {
            value: format!("{:?}", remaining),
            cause: "unexpected positional arguments".into(),
        });
    }

    let mode = match mode_raw.as_deref() {
        Some(raw) => Mode::parse(raw).map_err(|cause| pico_args::Error::Utf8ArgumentParsingFailed {
            value: raw.into(),
            cause,
        })?,
        None => Mode::Run,
    };

    Ok(Args {
        track: track.unwrap_or_else(|| "silverstone".into()),
        policy: policy.unwrap_or_else(|| "constant-throttle".into()),
        out: out.unwrap_or_else(|| PathBuf::from("target/ai-runner-outputs")),
        out_dir: out_dir
            .unwrap_or_else(|| PathBuf::from("apps/game/public/ai-replays")),
        seed: seed.unwrap_or(42),
        mode,
        generations: generations.unwrap_or(200),
        mu: mu.unwrap_or(8),
        lambda: lambda.unwrap_or(24),
        bc_seed,
        bc_generations: bc_generations.unwrap_or(50),
        bc_sigma_scale: bc_sigma_scale.unwrap_or(0.3),
        bc_only,
        auto_iterate,
        gate_lap_time: gate_lap_time.unwrap_or(99.4),
        gate_off_track: gate_off_track.unwrap_or(1),
    })
}

fn main() -> ExitCode {
    let args = match parse_args() {
        Ok(a) => a,
        Err(err) => {
            eprintln!("ai_runner: argument error: {err}");
            eprintln!("\n{HELP}");
            return ExitCode::from(2);
        }
    };

    println!(
        "ai_runner: track={} policy={} mode={:?} out={} seed={}",
        args.track,
        args.policy,
        args.mode,
        args.out.display(),
        args.seed,
    );

    let track = match track_loader::load_track(&args.track) {
        Ok(t) => t,
        Err(err) => {
            eprintln!("ai_runner: track load failed: {err}");
            return ExitCode::FAILURE;
        }
    };

    let (spawn_pos, _spawn_rot, spawn_fwd) = track_loader::spawn_pose(&track);
    println!(
        "  loaded {} ({}): {} polyline points, {} sectors, raceDirection={:?}",
        track.name,
        track.id,
        track.polyline.points.len(),
        track.sector_checkpoints.len(),
        track.race_direction,
    );
    println!(
        "  spawn pos=({:.2}, {:.2}, {:.2}) fwd=({:.3}, {:.3})",
        spawn_pos[0], spawn_pos[1], spawn_pos[2], spawn_fwd[0], spawn_fwd[1],
    );

    match args.mode {
        Mode::Run => run_mode(&track, &args),
        Mode::Perf => perf_mode(&track),
        Mode::Train => train_mode(&track, &args),
    }
}

fn perf_mode(track: &track_loader::LoadedTrack) -> ExitCode {
    let report = perf::run_perf_benchmark(track);
    let text = perf::format_report(&report);
    print!("{text}");

    let out = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/perf-baseline.txt");
    if let Some(parent) = out.parent() {
        if let Err(err) = std::fs::create_dir_all(parent) {
            eprintln!("ai_runner: could not create {}: {err}", parent.display());
            return ExitCode::FAILURE;
        }
    }
    match std::fs::write(&out, &text) {
        Ok(()) => {
            println!("  wrote: {}", out.display());
            ExitCode::SUCCESS
        }
        Err(err) => {
            eprintln!("ai_runner: perf write failed: {err}");
            ExitCode::FAILURE
        }
    }
}

fn run_mode(track: &track_loader::LoadedTrack, args: &Args) -> ExitCode {
    let mut policy: Box<dyn Policy> = match args.policy.as_str() {
        "constant-throttle" => Box::new(ConstantThrottle::default()),
        "lookahead-baseline" => Box::new(LookaheadPolicy::baseline_monza()),
        "lookahead-champion" => Box::new(LookaheadPolicy::from_array(
            &policies::lookahead::BASELINE_PARAMS_MONZA_CHAMPION,
        )),
        other => {
            eprintln!(
                "ai_runner: unknown policy '{other}'; expected 'constant-throttle', 'lookahead-baseline', or 'lookahead-champion'",
            );
            return ExitCode::FAILURE;
        }
    };
    let result = run_sim(track, policy.as_mut(), 600.0, 5.0);
    print_run_summary(&result);

    let out_path = args
        .out
        .join(format!("{}-baseline.json", args.track));
    match telemetry::write_telemetry_atomic(&out_path, &result) {
        Ok(()) => {
            println!("  wrote telemetry: {}", out_path.display());
            ExitCode::SUCCESS
        }
        Err(err) => {
            eprintln!("ai_runner: telemetry write failed: {err}");
            ExitCode::FAILURE
        }
    }
}

fn train_mode(track: &track_loader::LoadedTrack, args: &Args) -> ExitCode {
    if args.mu == 0 || args.lambda == 0 || args.lambda < args.mu {
        eprintln!(
            "ai_runner: invalid --mu/--lambda (mu={}, lambda={}); require 1 <= mu <= lambda",
            args.mu, args.lambda
        );
        return ExitCode::FAILURE;
    }

    let max_t_s = 300.0_f32;
    let off_track_kill_s = 5.0_f32;

    let slug = slug_from_track_id(&track.id);
    let bin_path = args.out_dir.join(format!("{slug}.ghost.bin"));
    let json_path = args.out_dir.join(format!("{slug}.ghost.json"));

    let (baseline_params, baseline_sigma, bc_seeded) = match args.bc_seed.as_ref() {
        Some(path) => match run_bc_phase(track, &args, path, &bin_path, &json_path) {
            BcPhaseOutcome::Success { params } => {
                if args.bc_only {
                    println!(
                        "ai_runner: --bc-only set; skipping ES. BC ghost written: bin={} json={}",
                        bin_path.display(),
                        json_path.display(),
                    );
                    return ExitCode::SUCCESS;
                }
                let scale = args.bc_sigma_scale.max(1e-6);
                let mut sigma = INITIAL_SIGMA_MONZA;
                for s in sigma.iter_mut() {
                    *s *= scale;
                }
                (params, sigma, true)
            }
            BcPhaseOutcome::Fatal(code) => return code,
        },
        None => (BASELINE_PARAMS_MONZA, INITIAL_SIGMA_MONZA, false),
    };

    if args.auto_iterate {
        return auto_iterate(
            track,
            args,
            &baseline_params,
            &bin_path,
            &json_path,
            max_t_s,
            off_track_kill_s,
        );
    }

    let mut pop = Population::init(
        LOOKAHEAD_PARAM_COUNT,
        args.mu,
        args.lambda,
        args.seed,
        &baseline_params,
        &baseline_sigma,
    );
    let eval = make_par_eval_fn(track, max_t_s, off_track_kill_s);

    println!(
        "ai_runner: train start track={} slug={} generations={} mu={} lambda={} seed={} bc_seeded={}",
        track.id, slug, args.generations, args.mu, args.lambda, args.seed, bc_seeded
    );
    println!(
        "  output: bin={} json={}",
        bin_path.display(),
        json_path.display()
    );

    let start = Instant::now();
    let mut best_fitness = f32::NEG_INFINITY;
    let mut best_lap_completed = false;
    let mut last_dump_fitness = f32::NEG_INFINITY;
    let mut dumps_written: u32 = 0;
    let mut champion_params: Vec<f32> = pop.parents[0].params.clone();
    let mut champion_lap_time: f32 = f32::INFINITY;
    let mut champion_off_track: u32 = u32::MAX;

    for _ in 0..args.generations {
        let gen = pop.step_par(&eval);
        let gen_wall = start.elapsed().as_secs_f32();

        let improved_meaningfully =
            gen.best_fitness >= last_dump_fitness * 1.01 && gen.best_fitness > last_dump_fitness;
        // Best fitness gating is necessary-but-not-sufficient: we re-evaluate
        // the champion with telemetry to learn lap_completed; that single
        // telemetry-on eval is the source of truth for lap_time / off_track /
        // ghost frames (Phase 4 review Important #5: no double-eval).
        let should_dump = improved_meaningfully || !best_lap_completed;

        if !should_dump {
            println!(
                "  gen={:4} best_fitness={:.2} (no champion change) wall={:.1}s",
                gen.generation, gen.best_fitness, gen_wall,
            );
            if gen.best_fitness > best_fitness {
                best_fitness = gen.best_fitness;
            }
            continue;
        }

        match write_dump(
            &gen.best_params,
            track,
            &slug,
            &bin_path,
            &json_path,
            max_t_s,
            off_track_kill_s,
            "ai_runner",
        ) {
            Ok(dump) => {
                let first_lap_complete = dump.lap_completed && !best_lap_completed;
                println!(
                    "  gen={:4} best_fitness={:.2} lap_completed={} lap_time={:.2}s off_track_count={} wall={:.1}s frames={}",
                    gen.generation,
                    gen.best_fitness,
                    dump.lap_completed,
                    if dump.lap_completed { dump.lap_time_s } else { -1.0 },
                    dump.off_track_count,
                    gen_wall,
                    dump.frame_count,
                );
                dumps_written += 1;
                last_dump_fitness = gen.best_fitness;
                if gen.best_fitness > best_fitness {
                    best_fitness = gen.best_fitness;
                }
                if first_lap_complete {
                    best_lap_completed = true;
                }
                champion_params = gen.best_params.clone();
                champion_lap_time = dump.lap_time_s;
                champion_off_track = dump.off_track_count;
            }
            Err(err) => {
                eprintln!("  gen={} dump failed: {err}", gen.generation);
            }
        }
    }

    let total_wall = start.elapsed().as_secs_f32();
    println!(
        "ai_runner: train done dumps={} best_fitness={:.2} lap_completed={} lap_time={} off_track={} wall={:.1}s",
        dumps_written,
        best_fitness,
        best_lap_completed,
        if champion_lap_time.is_finite() {
            format!("{:.2}s", champion_lap_time)
        } else {
            "-".into()
        },
        if champion_off_track == u32::MAX {
            "-".into()
        } else {
            format!("{champion_off_track}")
        },
        total_wall
    );
    println!("  champion_params: {:?}", champion_params);

    if dumps_written == 0 {
        eprintln!("ai_runner: no ghost was dumped (no fitness improvement of >=1% beyond initial)");
        return ExitCode::FAILURE;
    }
    if !best_lap_completed {
        eprintln!("ai_runner: training did not converge to a completed lap");
        return ExitCode::FAILURE;
    }
    ExitCode::SUCCESS
}

const AUTO_ITERATE_SCHEDULE: &[(f32, u32)] = &[
    (0.50, 300),
    (0.40, 300),
    (0.30, 400),
    (0.20, 500),
    (0.15, 600),
    (0.10, 800),
    (0.07, 800),
    (0.05, 1000),
];

fn auto_iterate(
    track: &track_loader::LoadedTrack,
    args: &Args,
    bc_seed_params: &[f32; LOOKAHEAD_PARAM_COUNT],
    bin_path: &std::path::Path,
    json_path: &std::path::Path,
    max_t_s: f32,
    off_track_kill_s: f32,
) -> ExitCode {
    let slug = slug_from_track_id(&track.id);
    let eval = make_par_eval_fn(track, max_t_s, off_track_kill_s);

    println!(
        "ai_runner: auto-iterate start gate_lap_time={:.2}s gate_off_track={} mu={} lambda={} seed={}",
        args.gate_lap_time, args.gate_off_track, args.mu, args.lambda, args.seed,
    );

    let start = Instant::now();
    let mut current_params: [f32; LOOKAHEAD_PARAM_COUNT] = *bc_seed_params;
    let mut last_probe_lap_time = f32::INFINITY;
    let mut last_probe_off_track = u32::MAX;
    let mut last_probe_lap_complete = false;

    for (iteration_idx, (sigma_scale, gens)) in AUTO_ITERATE_SCHEDULE.iter().enumerate() {
        let iteration = (iteration_idx + 1) as u64;
        let iter_wall_start = start.elapsed().as_secs_f32();
        println!(
            "=== iteration {} sigma_scale={} gens={} (cumulative_wall={:.1}s) ===",
            iteration, sigma_scale, gens, iter_wall_start,
        );

        let mut initial_sigma = INITIAL_SIGMA_MONZA;
        for s in initial_sigma.iter_mut() {
            *s *= *sigma_scale;
        }

        let mut pop = Population::init(
            LOOKAHEAD_PARAM_COUNT,
            args.mu,
            args.lambda,
            args.seed.wrapping_add(iteration),
            &current_params,
            &initial_sigma,
        );

        let mut iter_best_fitness = f32::NEG_INFINITY;
        let mut iter_best_params: Vec<f32> = current_params.to_vec();

        for _ in 0..*gens {
            let gen = pop.step_par(&eval);
            if gen.best_fitness > iter_best_fitness {
                iter_best_fitness = gen.best_fitness;
                iter_best_params = gen.best_params.clone();
            }
        }

        if iter_best_params.len() == LOOKAHEAD_PARAM_COUNT {
            current_params.copy_from_slice(&iter_best_params);
        }

        let probe = parallel_eval::evaluate_on_thread_engine(
            &current_params,
            track,
            true,
            max_t_s,
            off_track_kill_s,
        );
        last_probe_lap_complete = probe.lap_completed;
        last_probe_lap_time = probe.lap_time_s;
        last_probe_off_track = probe.off_track_count;

        let lap_display = if probe.lap_completed {
            format!("{:.2}s", probe.lap_time_s)
        } else {
            "-".to_string()
        };
        println!(
            "  iter {} best: fitness={:.2} lap_completed={} lap_time={} off_track_count={} off_track_s={:.2} severe_s={:.2} progress={:.1}m",
            iteration,
            iter_best_fitness,
            probe.lap_completed,
            lap_display,
            probe.off_track_count,
            probe.off_track_seconds,
            probe.severe_off_track_seconds,
            probe.arc_length_progress_m,
        );

        if gate_passes(
            probe.lap_completed,
            probe.off_track_count,
            probe.lap_time_s,
            args.gate_off_track,
            args.gate_lap_time,
        ) {
            println!(
                "  *** QUALITY GATE PASSED at iteration {} (lap_time={:.2}s, off_track={}) ***",
                iteration, probe.lap_time_s, probe.off_track_count,
            );
            match write_dump(
                &current_params,
                track,
                &slug,
                bin_path,
                json_path,
                max_t_s,
                off_track_kill_s,
                "ai_runner_auto",
            ) {
                Ok(dump) => {
                    let total_wall = start.elapsed().as_secs_f32();
                    println!(
                        "  ghost written: bin={} json={} frames={} wall={:.1}s",
                        bin_path.display(),
                        json_path.display(),
                        dump.frame_count,
                        total_wall,
                    );
                    print_champion_params(&current_params);
                    return ExitCode::SUCCESS;
                }
                Err(err) => {
                    eprintln!("ai_runner: auto-iterate dump failed: {err}");
                    return ExitCode::FAILURE;
                }
            }
        }
    }

    let total_wall = start.elapsed().as_secs_f32();
    eprintln!(
        "ai_runner: auto-iterate exhausted schedule without passing quality gate (last_lap_complete={} last_lap_time={} last_off_track={} wall={:.1}s)",
        last_probe_lap_complete,
        if last_probe_lap_time.is_finite() {
            format!("{:.2}s", last_probe_lap_time)
        } else {
            "-".into()
        },
        if last_probe_off_track == u32::MAX {
            "-".into()
        } else {
            format!("{last_probe_off_track}")
        },
        total_wall,
    );
    match write_dump(
        &current_params,
        track,
        &slug,
        bin_path,
        json_path,
        max_t_s,
        off_track_kill_s,
        "ai_runner_auto_fallback",
    ) {
        Ok(dump) => {
            println!(
                "  fallback ghost written: bin={} json={} frames={}",
                bin_path.display(),
                json_path.display(),
                dump.frame_count,
            );
            print_champion_params(&current_params);
        }
        Err(err) => {
            eprintln!("ai_runner: auto-iterate fallback dump failed: {err}");
        }
    }
    ExitCode::FAILURE
}

fn print_champion_params(params: &[f32; LOOKAHEAD_PARAM_COUNT]) {
    println!("  champion_params: [");
    for (i, p) in params.iter().enumerate() {
        let sep = if i + 1 == params.len() { "" } else { "," };
        println!("    {}{}", p, sep);
    }
    println!("  ]");
}

#[inline]
fn gate_passes(lap_completed: bool, off_track_count: u32, lap_time_s: f32, gate_off_track: u32, gate_lap_time: f32) -> bool {
    lap_completed && off_track_count <= gate_off_track && lap_time_s <= gate_lap_time
}

#[inline]
fn auto_iterate_total_generations() -> u64 {
    AUTO_ITERATE_SCHEDULE.iter().map(|(_, g)| *g as u64).sum()
}

#[inline]
fn auto_iterate_sigma_for_iteration(iteration_idx: usize) -> f32 {
    AUTO_ITERATE_SCHEDULE[iteration_idx].0
}

enum BcPhaseOutcome {
    Success { params: [f32; LOOKAHEAD_PARAM_COUNT] },
    Fatal(ExitCode),
}

fn run_bc_phase(
    track: &track_loader::LoadedTrack,
    args: &Args,
    demo_path: &std::path::Path,
    bin_path: &std::path::Path,
    json_path: &std::path::Path,
) -> BcPhaseOutcome {
    let demo = match bc::load_demo(demo_path) {
        Ok(d) => d,
        Err(bc::BcError::Io(e)) if e.kind() == std::io::ErrorKind::NotFound => {
            eprintln!("ai_runner: --bc-seed path not found: {}", demo_path.display());
            return BcPhaseOutcome::Fatal(ExitCode::from(2));
        }
        Err(bc::BcError::SchemaMismatch { found, expected }) => {
            eprintln!(
                "ai_runner: unsupported demo schemaVersion = {found} (expected {expected})"
            );
            return BcPhaseOutcome::Fatal(ExitCode::from(2));
        }
        Err(e) => {
            eprintln!("ai_runner: BC demo load failed: {e}");
            return BcPhaseOutcome::Fatal(ExitCode::from(2));
        }
    };

    if demo.track_id != track.id {
        eprintln!(
            "ai_runner: warning: demo trackId='{}' but loaded track.id='{}'; continuing anyway",
            demo.track_id, track.id
        );
    }

    println!(
        "ai_runner: BC fit start frames={} lapTime={:.2}ms generations={} seed={}",
        demo.frame_count, demo.lap_time, args.bc_generations, args.seed,
    );
    let bc_start = Instant::now();
    let bc_result = bc::fit_bc(&demo, track, args.seed, args.bc_generations);
    let bc_wall = bc_start.elapsed().as_secs_f32();
    let r = &bc_result.report;
    println!(
        "  BC fit done in {:.2}s: baseline_loss={:.5} training_loss={:.5} \
         training_frames={} holdout_frames={} \
         rms_steer={:.4} rms_throttle={:.4} rms_brake={:.4}",
        bc_wall,
        r.baseline_loss,
        r.training_loss,
        r.training_frame_count,
        r.holdout_frame_count,
        r.holdout_rms_steer,
        r.holdout_rms_throttle,
        r.holdout_rms_brake,
    );

    let report_path = args
        .out
        .join(format!("{}-bc-fit.json", slug_from_track_id(&track.id)));
    if let Err(err) = bc::write_bc_report_atomic(&report_path, &bc_result.report) {
        eprintln!("ai_runner: failed to write BC report: {err}");
    } else {
        println!("  wrote BC report: {}", report_path.display());
    }

    let eval_result = evaluate_on_thread_engine(
        &bc_result.params,
        track,
        true,
        300.0,
        5.0,
    );
    let lap_time_display = if eval_result.lap_completed {
        format!("{:.2}s", eval_result.lap_time_s)
    } else {
        "-".to_string()
    };
    println!(
        "  BC replay: lap_completed={} lap_time={} off_track_count={} sim_time={:.2}s arc_progress={:.1}m terminated={:?}",
        eval_result.lap_completed,
        lap_time_display,
        eval_result.off_track_count,
        eval_result.sim_time_s,
        eval_result.arc_length_progress_m,
        eval_result.terminated_by,
    );

    let telemetry = match eval_result.telemetry {
        Some(t) => t,
        None => {
            eprintln!("ai_runner: BC replay produced no telemetry");
            return BcPhaseOutcome::Fatal(ExitCode::FAILURE);
        }
    };
    let subs = subsample_telemetry(&telemetry, GHOST_STRIDE_120_TO_20_HZ);
    let frame_count = subs.len() as u32;

    if let Err(err) = write_ghost_bin_atomic(bin_path, &subs) {
        eprintln!("ai_runner: BC ghost bin write failed: {err}");
        return BcPhaseOutcome::Fatal(ExitCode::FAILURE);
    }
    let meta = GhostMeta {
        schema_version: GHOST_SCHEMA_VERSION,
        track_id: track.id.clone(),
        lap_time: if eval_result.lap_completed {
            eval_result.lap_time_s
        } else {
            0.0
        },
        frame_count,
        recorder_type: "ai_runner_bc".into(),
        recorded_at: ghost_writer::now_iso8601_utc(),
    };
    if let Err(err) = write_ghost_meta_atomic(json_path, &meta) {
        eprintln!("ai_runner: BC ghost meta write failed: {err}");
        return BcPhaseOutcome::Fatal(ExitCode::FAILURE);
    }
    println!(
        "  BC ghost written: bin={} json={} frames={}",
        bin_path.display(),
        json_path.display(),
        frame_count,
    );

    BcPhaseOutcome::Success {
        params: bc_result.params,
    }
}

struct DumpResult {
    frame_count: u32,
    lap_completed: bool,
    lap_time_s: f32,
    off_track_count: u32,
}

fn write_dump(
    params: &[f32],
    track: &track_loader::LoadedTrack,
    slug: &str,
    bin_path: &std::path::Path,
    json_path: &std::path::Path,
    max_t_s: f32,
    off_track_kill_s: f32,
    recorder_type: &str,
) -> Result<DumpResult, String> {
    let mut arr = [0.0_f32; LOOKAHEAD_PARAM_COUNT];
    if params.len() != LOOKAHEAD_PARAM_COUNT {
        return Err(format!(
            "dump: expected {} params, got {}",
            LOOKAHEAD_PARAM_COUNT,
            params.len()
        ));
    }
    arr.copy_from_slice(params);
    let result = evaluate_on_thread_engine(&arr, track, true, max_t_s, off_track_kill_s);
    let lap_completed = result.lap_completed;
    let lap_time_s = result.lap_time_s;
    let off_track_count = result.off_track_count;
    let telemetry = result
        .telemetry
        .ok_or_else(|| "dump: telemetry was not recorded".to_string())?;
    let subs = subsample_telemetry(&telemetry, GHOST_STRIDE_120_TO_20_HZ);
    let frame_count = subs.len() as u32;
    write_ghost_bin_atomic(bin_path, &subs).map_err(|e| format!("write ghost bin: {e}"))?;

    let recorded_at = ghost_writer::now_iso8601_utc();
    let meta = GhostMeta {
        schema_version: GHOST_SCHEMA_VERSION,
        track_id: track.id.clone(),
        lap_time: if lap_time_s.is_finite() { lap_time_s } else { 0.0 },
        frame_count,
        recorder_type: recorder_type.into(),
        recorded_at,
    };
    let _ = slug;
    write_ghost_meta_atomic(json_path, &meta).map_err(|e| format!("write ghost meta: {e}"))?;
    Ok(DumpResult {
        frame_count,
        lap_completed,
        lap_time_s,
        off_track_count,
    })
}

fn print_run_summary(result: &sim::SimResult) {
    let frames = result.telemetry.len();
    let last_t = result.telemetry.last().map(|f| f.t_s).unwrap_or(0.0);
    println!(
        "  sim done: frames={} sim_time={:.2}s lap={} off_track_count={} off_track_s={:.2} terminated={:?}",
        frames,
        last_t,
        result.lap_completed,
        result.off_track_count,
        result.off_track_seconds,
        result.terminated_by,
    );
    println!(
        "  final pos=({:.2}, {:.2}) distance_from_spawn={:.2}m",
        result.final_xz[0], result.final_xz[1], result.distance_to_spawn_m,
    );
    let _ = TerminationReason::Timeout;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::evo::{child_seed, Population};
    use crate::policies::lookahead::BASELINE_PARAMS_MONZA;

    #[test]
    fn gate_passes_requires_lap_completed() {
        assert!(!gate_passes(false, 0, 90.0, 1, 99.4));
        assert!(gate_passes(true, 0, 90.0, 1, 99.4));
    }

    #[test]
    fn gate_passes_enforces_off_track_ceiling() {
        assert!(gate_passes(true, 1, 95.0, 1, 99.4));
        assert!(!gate_passes(true, 2, 95.0, 1, 99.4));
    }

    #[test]
    fn gate_passes_enforces_lap_time_ceiling() {
        assert!(gate_passes(true, 0, 99.4, 1, 99.4));
        assert!(!gate_passes(true, 0, 99.41, 1, 99.4));
    }

    #[test]
    fn auto_iterate_schedule_is_monotonic_sigma() {
        for w in AUTO_ITERATE_SCHEDULE.windows(2) {
            let (s0, _) = w[0];
            let (s1, _) = w[1];
            assert!(
                s1 <= s0,
                "sigma_scale must be non-increasing across iterations: {s0} -> {s1}",
            );
        }
    }

    #[test]
    fn auto_iterate_schedule_total_generations_matches_plan() {
        let total = auto_iterate_total_generations();
        assert_eq!(total, 4700, "schedule must total 4700 generations, got {total}");
    }

    #[test]
    fn auto_iterate_schedule_first_iteration_sigma_is_05() {
        let s = auto_iterate_sigma_for_iteration(0);
        assert!((s - 0.50).abs() < 1e-6, "first sigma should be 0.50, got {s}");
    }

    #[test]
    fn auto_iterate_inner_loop_with_stub_eval_runs_to_completion() {
        // Smoke-test the inner ES iteration shape: a stub eval that returns a
        // deterministic finite fitness function of params[0]. Verifies the
        // population steps and best_params tracking are wired correctly without
        // actually running physics (Phase 4.8.2 contract).
        let mut params: [f32; LOOKAHEAD_PARAM_COUNT] = BASELINE_PARAMS_MONZA;
        let stub_eval = |p: &[f32], _idx: usize| -> f32 { -p[0].abs() };
        let mut initial_sigma = INITIAL_SIGMA_MONZA;
        for s in initial_sigma.iter_mut() {
            *s *= 0.50;
        }
        let mut pop = Population::init(LOOKAHEAD_PARAM_COUNT, 4, 8, 42, &params, &initial_sigma);
        let mut iter_best_fitness = f32::NEG_INFINITY;
        let mut iter_best_params: Vec<f32> = params.to_vec();
        for _ in 0..5 {
            let gen = pop.step_par(&stub_eval);
            assert!(gen.best_fitness.is_finite());
            if gen.best_fitness > iter_best_fitness {
                iter_best_fitness = gen.best_fitness;
                iter_best_params = gen.best_params.clone();
            }
        }
        params.copy_from_slice(&iter_best_params);
        for v in params.iter() {
            assert!(v.is_finite(), "param became NaN/Inf during inner loop");
        }
        assert!(iter_best_fitness.is_finite());
        assert!(iter_best_fitness > f32::NEG_INFINITY);
        // child_seed must still be deterministic after the loop
        assert_eq!(child_seed(42, 0, 0), 0xbdd732262feb6e95);
    }
}

