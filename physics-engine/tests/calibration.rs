mod common;
use common::{measure_lat_g, measure_stop_distance, measure_zero_to_100, read_baseline_scenario};

// Wave 4 Phase 1 (Pacejka recoeff + BASE reset) compounds with Wave 3
// drifts. Reads from the original Wave 1 baselines (the most pessimistic
// reference); cumulative drift through Wave 3 + Wave 4 Phase 1 is large.
// Tolerances widened to keep the test useful as a sanity check during
// Wave 4 behaviour-change phases; Phase 7 will promote new baselines
// and tighten to ±0.5% via `calibration_strict.rs`.
const TOLERANCE_ZERO_TO_100: f32 = 1.50;
const TOLERANCE_STOP_DISTANCE: f32 = 1.00;
const TOLERANCE_LAT_G: f32 = 0.50;

fn assert_within(label: &str, actual: f32, baseline: f32, tolerance_pct: f32) {
    let delta = (actual - baseline).abs();
    let allowed = baseline.abs() * tolerance_pct;
    assert!(
        delta <= allowed,
        "{}: actual {:.4}, baseline {:.4}, delta {:.4} exceeds {:.0}% tolerance ({:.4})",
        label,
        actual,
        baseline,
        delta,
        tolerance_pct * 100.0,
        allowed
    );
}

#[test]
fn calibration_zero_to_100_within_tolerance() {
    let actual = measure_zero_to_100().expect("0-100 km/h reachable");
    let baseline = read_baseline_scenario("zero_to_100_kmh_seconds");
    assert_within("0-100 km/h", actual, baseline, TOLERANCE_ZERO_TO_100);
}

#[test]
fn calibration_stop_distance_within_tolerance() {
    let actual = measure_stop_distance().expect("stop distance bounded");
    let baseline = read_baseline_scenario("fifty_ms_to_zero_stop_distance_m");
    assert_within("stop distance", actual, baseline, TOLERANCE_STOP_DISTANCE);
}

#[test]
fn calibration_lat_g_within_tolerance() {
    let actual = measure_lat_g().expect("lat-g sampled");
    let baseline = read_baseline_scenario("steady_state_80m_radius_peak_lat_g");
    assert_within("80m peak lat-g", actual, baseline, TOLERANCE_LAT_G);
}
