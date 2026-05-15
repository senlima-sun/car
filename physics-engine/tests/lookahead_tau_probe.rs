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

use policies::lookahead::BASELINE_PARAMS_MONZA_CHAMPION;
use reward::evaluate;
use sim::TelemetryFrame;

fn max_straight_steer_std(frames: &[TelemetryFrame]) -> (f32, usize, usize) {
    const WINDOW: usize = 60;
    const SPEED_THRESHOLD: f32 = 200.0;
    let mut max_std = 0.0_f32;
    let mut wobble_windows = 0usize;
    let mut total_windows = 0usize;
    if frames.len() < WINDOW + 1 {
        return (0.0, 0, 0);
    }
    for i in 0..(frames.len() - WINDOW) {
        let window = &frames[i..i + WINDOW];
        if window.iter().any(|f| f.speed_kmh <= SPEED_THRESHOLD) {
            continue;
        }
        total_windows += 1;
        let mean: f32 = window.iter().map(|f| f.steer).sum::<f32>() / WINDOW as f32;
        let var: f32 =
            window.iter().map(|f| (f.steer - mean).powi(2)).sum::<f32>() / WINDOW as f32;
        let std = var.sqrt();
        if std > max_std {
            max_std = std;
        }
        if std > 0.1 {
            wobble_windows += 1;
        }
    }
    (max_std, wobble_windows, total_windows)
}

fn max_steer_zero_crossings(frames: &[TelemetryFrame]) -> (u32, f32, usize) {
    const WINDOW: usize = 60;
    const SPEED_THRESHOLD: f32 = 200.0;
    let mut max_zc = 0u32;
    let mut zc_sum = 0u64;
    let mut total_windows = 0usize;
    if frames.len() < WINDOW + 1 {
        return (0, 0.0, 0);
    }
    for i in 0..(frames.len() - WINDOW) {
        let window = &frames[i..i + WINDOW];
        if window.iter().any(|f| f.speed_kmh <= SPEED_THRESHOLD) {
            continue;
        }
        total_windows += 1;
        let deltas: Vec<f32> = window.windows(2).map(|w| w[1].steer - w[0].steer).collect();
        let mut zc = 0u32;
        for j in 0..(deltas.len().saturating_sub(1)) {
            if deltas[j] * deltas[j + 1] < -1e-8 {
                zc += 1;
            }
        }
        zc_sum += zc as u64;
        if zc > max_zc {
            max_zc = zc;
        }
    }
    let mean = if total_windows == 0 {
        0.0
    } else {
        zc_sum as f32 / total_windows as f32
    };
    (max_zc, mean, total_windows)
}

#[test]
#[ignore]
fn probe_tau_values_against_champion() {
    let track = track_loader::load_track("monza").expect("monza loads");
    let mut engine = PhysicsEngine::new();
    let taus = [
        0.0_f32, 0.005, 0.008, 0.010, 0.012, 0.015, 0.018, 0.020, 0.025, 0.030,
    ];

    println!(
        "{:>6} {:>10} {:>4} {:>6} {:>8} {:>8} {:>7} {:>6}",
        "tau_s", "lap_time", "off", "sev", "max_std", "max_zc", "mean_zc", "win"
    );
    for tau in taus.iter() {
        let mut params = BASELINE_PARAMS_MONZA_CHAMPION;
        params[20] = *tau;
        let result = evaluate(&params, &track, &mut engine, true, 300.0, 5.0);
        let frames = result.telemetry.as_deref().unwrap_or(&[]);
        let (max_std, _wobble, total_std) = max_straight_steer_std(frames);
        let (max_zc, mean_zc, _total_zc) = max_steer_zero_crossings(frames);
        let lap_str = if result.lap_completed {
            format!("{:.2}", result.lap_time_s)
        } else {
            "-".into()
        };
        println!(
            "{:>6.3} {:>10} {:>4} {:>6.2} {:>8.4} {:>8} {:>7.2} {:>6}",
            tau,
            lap_str,
            result.off_track_count,
            result.severe_off_track_seconds,
            max_std,
            max_zc,
            mean_zc,
            total_std
        );
    }
}
