mod common;
use common::{measure_lat_g, measure_stop_distance, measure_zero_to_100};

const STRICT_TOLERANCE: f32 = 0.005;

fn read_baseline(key: &str) -> f32 {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/wave_1_baselines.json");
    let json = std::fs::read_to_string(&path).expect("baseline fixture exists");
    let value: serde_json::Value = serde_json::from_str(&json).expect("baseline fixture parses");
    value["scenarios"][key]
        .as_f64()
        .unwrap_or_else(|| panic!("scenarios.{} missing or not numeric", key)) as f32
}

fn assert_strict(label: &str, actual: f32, baseline: f32) {
    let delta = (actual - baseline).abs();
    let allowed = baseline.abs() * STRICT_TOLERANCE;
    assert!(
        delta <= allowed,
        "{} (Wave 2 strict ±0.5%): actual {:.5}, baseline {:.5}, delta {:.5} > allowed {:.5}",
        label,
        actual,
        baseline,
        delta,
        allowed
    );
}

#[test]
fn strict_zero_to_100_no_behaviour_drift() {
    let actual = measure_zero_to_100().expect("0-100 km/h reachable");
    let baseline = read_baseline("zero_to_100_kmh_seconds");
    assert_strict("0-100 km/h", actual, baseline);
}

#[test]
fn strict_stop_distance_no_behaviour_drift() {
    let actual = measure_stop_distance().expect("stop distance bounded");
    let baseline = read_baseline("fifty_ms_to_zero_stop_distance_m");
    assert_strict("stop distance", actual, baseline);
}

#[test]
fn strict_lat_g_no_behaviour_drift() {
    let actual = measure_lat_g().expect("lat-g sampled");
    let baseline = read_baseline("steady_state_80m_radius_peak_lat_g");
    assert_strict("80m peak lat-g", actual, baseline);
}
