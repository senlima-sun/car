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
    --track <name>         Circuit to load (default: silverstone)
    --policy <name>        Policy to drive (default: constant-throttle)
    --out <dir>            Output directory (default: target/ai-runner-outputs)
    --out-dir <dir>        Ghost output directory for --mode train
                           (default: apps/game/public/ai-replays)
    --seed <n>             RNG seed (default: 42)
    --mode <run|perf|train> Execution mode (default: run)
    --generations <n>      Number of evo generations (default: 200)
    --mu <n>               Parents kept per generation (default: 8)
    --lambda <n>           Offspring per generation (default: 24)
    -h, --help             Print this help

EXAMPLES:
    ai_runner --track silverstone --policy constant-throttle
    ai_runner --mode perf
    ai_runner --mode train --track monza --seed 42 --generations 200
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
        other => {
            eprintln!(
                "ai_runner: unknown policy '{other}'; expected 'constant-throttle' or 'lookahead-baseline'",
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

    let mut pop = Population::init(
        LOOKAHEAD_PARAM_COUNT,
        args.mu,
        args.lambda,
        args.seed,
        &BASELINE_PARAMS_MONZA,
        &INITIAL_SIGMA_MONZA,
    );
    let max_t_s = 300.0_f32;
    let off_track_kill_s = 5.0_f32;
    let eval = make_par_eval_fn(track, max_t_s, off_track_kill_s);

    let slug = slug_from_track_id(&track.id);
    let bin_path = args.out_dir.join(format!("{slug}.ghost.bin"));
    let json_path = args.out_dir.join(format!("{slug}.ghost.json"));

    println!(
        "ai_runner: train start track={} slug={} generations={} mu={} lambda={} seed={}",
        track.id, slug, args.generations, args.mu, args.lambda, args.seed
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

        let probe = probe_eval_for_dump(&gen.best_params, track, max_t_s, off_track_kill_s);
        let lap_completed = probe.lap_completed;
        let lap_time_s = if lap_completed {
            probe.lap_time_s
        } else {
            f32::INFINITY
        };
        let off_track_count = probe.off_track_count;

        let improved_meaningfully =
            gen.best_fitness >= last_dump_fitness * 1.01 && gen.best_fitness > last_dump_fitness;
        let first_lap_complete = lap_completed && !best_lap_completed;
        let should_dump = first_lap_complete || improved_meaningfully;

        println!(
            "  gen={:4} best_fitness={:.2} lap_completed={} lap_time={:.2}s off_track_count={} wall={:.1}s dump={}",
            gen.generation,
            gen.best_fitness,
            lap_completed,
            if lap_completed { lap_time_s } else { -1.0 },
            off_track_count,
            gen_wall,
            should_dump
        );

        if should_dump {
            match write_dump(
                &gen.best_params,
                track,
                &slug,
                &bin_path,
                &json_path,
                lap_time_s,
                max_t_s,
                off_track_kill_s,
            ) {
                Ok(frame_count) => {
                    dumps_written += 1;
                    last_dump_fitness = gen.best_fitness;
                    if gen.best_fitness > best_fitness {
                        best_fitness = gen.best_fitness;
                    }
                    if first_lap_complete {
                        best_lap_completed = true;
                    }
                    champion_params = gen.best_params.clone();
                    champion_lap_time = lap_time_s;
                    champion_off_track = off_track_count;
                    println!("    wrote ghost ({frame_count} frames) -> {}", bin_path.display());
                }
                Err(err) => {
                    eprintln!("    dump failed: {err}");
                }
            }
        } else if gen.best_fitness > best_fitness {
            best_fitness = gen.best_fitness;
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

struct DumpProbe {
    lap_completed: bool,
    lap_time_s: f32,
    off_track_count: u32,
}

fn probe_eval_for_dump(
    params: &[f32],
    track: &track_loader::LoadedTrack,
    max_t_s: f32,
    off_track_kill_s: f32,
) -> DumpProbe {
    let mut arr = [0.0_f32; LOOKAHEAD_PARAM_COUNT];
    if params.len() == LOOKAHEAD_PARAM_COUNT {
        arr.copy_from_slice(params);
    }
    let result = evaluate_on_thread_engine(&arr, track, false, max_t_s, off_track_kill_s);
    DumpProbe {
        lap_completed: result.lap_completed,
        lap_time_s: result.lap_time_s,
        off_track_count: result.off_track_count,
    }
}

fn write_dump(
    params: &[f32],
    track: &track_loader::LoadedTrack,
    slug: &str,
    bin_path: &std::path::Path,
    json_path: &std::path::Path,
    lap_time_s: f32,
    max_t_s: f32,
    off_track_kill_s: f32,
) -> Result<u32, String> {
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
        recorder_type: "ai_runner".into(),
        recorded_at,
    };
    let _ = slug;
    write_ghost_meta_atomic(json_path, &meta).map_err(|e| format!("write ghost meta: {e}"))?;
    Ok(frame_count)
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
