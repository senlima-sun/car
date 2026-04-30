mod common;
use common::{
    make_oil_proxy_engine, make_wet_road_engine, measure_drs_200_to_300, measure_lat_g,
    measure_lat_g_with, measure_stop_distance, measure_stop_distance_100kmh,
    measure_stop_distance_with, measure_zero_to_100, read_baseline_scenario_from,
};

const DRY_FIXTURE: &str = "tests/fixtures/wave_3_dry_baselines.json";
const WET_FIXTURE: &str = "tests/fixtures/wave_3_wet_baselines.json";

fn pct_drift(actual: f32, baseline: f32) -> f32 {
    ((actual - baseline) / baseline).abs()
}

fn assert_drift_within(label: &str, actual: f32, baseline: f32, max_drift: f32) {
    let drift = pct_drift(actual, baseline);
    eprintln!(
        "{}: actual {:.4}, baseline {:.4}, drift {:.2}% (max {:.0}%)",
        label,
        actual,
        baseline,
        drift * 100.0,
        max_drift * 100.0
    );
    assert!(
        drift < max_drift,
        "{}: drift {:.2}% exceeds {:.0}% (actual {:.4} vs baseline {:.4})",
        label,
        drift * 100.0,
        max_drift * 100.0,
        actual,
        baseline
    );
}

/// Phase 2 (Wave 3) calibration drift sanity check. Read-only — runs the
/// Wave 3 entry baselines through the post-G-method engine and reports
/// drift. Bounds reflect the deliberate behaviour change scope:
///
///   0-100 km/h dry          : ±10%
///   50 m/s -> 0 stop dry    : ±10%
///   80m radius lat-g dry    : ±15%
///   DRS 200-300 km/h dry    : ±10%
///   100 km/h -> 0 stop dry  : ±10%
///
/// Stays separate from `calibration_strict.rs` so it doesn't gate the
/// build during Phase 2-6 (which deliberately re-baseline). Phase 7
/// promotes the new numbers to the strict ±0.5% gate.

#[test]
fn phase_2_dry_zero_to_100_drift_within_bounds() {
    let actual = measure_zero_to_100().expect("0-100 reachable");
    let baseline = read_baseline_scenario_from(DRY_FIXTURE, "zero_to_100_kmh_seconds");
    assert_drift_within("0-100 km/h", actual, baseline, 0.10);
}

#[test]
fn phase_2_dry_50ms_stop_distance_drift_within_bounds() {
    let actual = measure_stop_distance().expect("stop reachable");
    let baseline =
        read_baseline_scenario_from(DRY_FIXTURE, "fifty_ms_to_zero_stop_distance_m");
    assert_drift_within("50 m/s stop", actual, baseline, 0.10);
}

#[test]
fn phase_2_dry_80m_lat_g_drift_within_bounds() {
    let actual = measure_lat_g().expect("lat-g sampled");
    let baseline =
        read_baseline_scenario_from(DRY_FIXTURE, "steady_state_80m_radius_peak_lat_g");
    assert_drift_within("80m lat-g", actual, baseline, 0.15);
}

#[test]
fn phase_2_dry_drs_200_to_300_drift_within_bounds() {
    let actual = measure_drs_200_to_300().expect("DRS 200-300 reachable");
    let baseline =
        read_baseline_scenario_from(DRY_FIXTURE, "drs_active_200_to_300_kmh_seconds");
    assert_drift_within("DRS 200-300", actual, baseline, 0.10);
}

#[test]
fn phase_2_dry_100kmh_stop_distance_drift_within_bounds() {
    let actual = measure_stop_distance_100kmh().expect("100->0 stop reachable");
    let baseline =
        read_baseline_scenario_from(DRY_FIXTURE, "hundred_kmh_to_zero_stop_distance_m");
    assert_drift_within("100 km/h stop", actual, baseline, 0.10);
}

#[test]
fn phase_2_wet_50ms_stop_distance_drift_within_bounds() {
    let actual =
        measure_stop_distance_with(make_wet_road_engine(), 50.0).expect("wet stop reachable");
    let baseline = read_baseline_scenario_from(
        WET_FIXTURE,
        "wet_fifty_ms_to_zero_stop_distance_m",
    );
    assert_drift_within("wet 50 m/s stop", actual, baseline, 0.25);
}

#[test]
fn phase_2_wet_80m_lat_g_drift_within_bounds() {
    let actual = measure_lat_g_with(make_wet_road_engine()).expect("wet lat-g sampled");
    let baseline = read_baseline_scenario_from(
        WET_FIXTURE,
        "wet_steady_state_80m_radius_peak_lat_g",
    );
    assert_drift_within("wet 80m lat-g", actual, baseline, 0.25);
}

#[test]
fn phase_2_oil_80m_lat_g_drift_within_bounds() {
    let actual = measure_lat_g_with(make_oil_proxy_engine()).expect("oil lat-g sampled");
    let baseline = read_baseline_scenario_from(
        WET_FIXTURE,
        "oil_steady_state_80m_radius_peak_lat_g",
    );
    assert_drift_within("oil 80m lat-g", actual, baseline, 0.25);
}
