use std::path::PathBuf;
use std::process::ExitCode;

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
        "ai_runner: would run track={} policy={} mode={:?} out={} seed={}",
        args.track,
        args.policy,
        args.mode,
        args.out.display(),
        args.seed,
    );

    ExitCode::SUCCESS
}
