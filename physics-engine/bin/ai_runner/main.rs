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

use policies::constant_throttle::ConstantThrottle;
use policies::lookahead::LookaheadPolicy;
use sim::{run_sim, Policy, TerminationReason};

const HELP: &str = "\
ai_runner — headless physics driver for AI policy evaluation

USAGE:
    ai_runner [OPTIONS]

OPTIONS:
    --track <name>      Circuit to load (default: silverstone)
    --policy <name>     Policy to drive (default: constant-throttle)
    --out <dir>         Output directory (default: target/ai-runner-outputs)
    --seed <n>          RNG seed (default: 42)
    --mode <run|perf>   Execution mode (default: run)
    -h, --help          Print this help

EXAMPLES:
    ai_runner --track silverstone --policy constant-throttle
    ai_runner --mode perf
";

#[derive(Debug, Clone)]
struct Args {
    track: String,
    policy: String,
    out: PathBuf,
    seed: u64,
    mode: Mode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Mode {
    Run,
    Perf,
}

impl Mode {
    fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "run" => Ok(Mode::Run),
            "perf" => Ok(Mode::Perf),
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
    let seed: Option<u64> = pargs.opt_value_from_str("--seed")?;
    let mode_raw: Option<String> = pargs.opt_value_from_str("--mode")?;

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
        seed: seed.unwrap_or(42),
        mode,
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
