mod common;
use common::{measure_lat_g, measure_stop_distance, measure_zero_to_100};

const TOLERANCE_ZERO_TO_100: f32 = 0.20;
const TOLERANCE_STOP_DISTANCE: f32 = 0.25;
const TOLERANCE_LAT_G: f32 = 0.15;

fn read_baseline(key: &str) -> f32 {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/wave_1_baselines.json");
    let json = std::fs::read_to_string(&path).expect("baseline fixture exists");
    let value: serde_json::Value = serde_json::from_str(&json).expect("baseline fixture parses");
    value["scenarios"][key]
        .as_f64()
        .unwrap_or_else(|| panic!("scenarios.{} missing or not numeric", key)) as f32
}

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
    let baseline = read_baseline("zero_to_100_kmh_seconds");
    assert_within("0-100 km/h", actual, baseline, TOLERANCE_ZERO_TO_100);
}

#[test]
fn calibration_stop_distance_within_tolerance() {
    let actual = measure_stop_distance().expect("stop distance bounded");
    let baseline = read_baseline("fifty_ms_to_zero_stop_distance_m");
    assert_within("stop distance", actual, baseline, TOLERANCE_STOP_DISTANCE);
}

#[test]
fn calibration_lat_g_within_tolerance() {
    let actual = measure_lat_g().expect("lat-g sampled");
    let baseline = read_baseline("steady_state_80m_radius_peak_lat_g");
    assert_within("80m peak lat-g", actual, baseline, TOLERANCE_LAT_G);
}
