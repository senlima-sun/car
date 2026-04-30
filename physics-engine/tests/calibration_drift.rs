mod common;
use common::{
    make_oil_proxy_engine, make_wet_road_engine, measure_drs_200_to_300, measure_lat_g,
    measure_lat_g_with, measure_stop_distance, measure_stop_distance_100kmh,
    measure_stop_distance_with, measure_zero_to_100, read_baseline_scenario_from,
};

// Wave 4: drift is now measured against `wave_4_pre_baselines.json`
// (= Wave 3 strict-gate values), which is the anchor for cumulative
// Phase 1-6 drift reporting. The original Wave 3 phase-0-pre fixtures
// stay in tree as historical records.
const FIXTURE: &str = "tests/fixtures/wave_4_pre_baselines.json";

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

/// Wave 3/4 calibration drift sanity check. Read-only — runs the
/// Wave 4 pre-baselines (= Wave 3 strict-gate values) through the
/// post-Phase-N engine and reports drift. Bounds reflect cumulative
/// behaviour change scope through each phase:
///
///   0-100 km/h dry          : ±50% (Wave 4 Phase 1 BASE reset shifts launch heavily)
///   50 m/s -> 0 stop dry    : ±40% (Wave 4 Phase 1 BASE reset shifts stop heavily)
///   80m radius lat-g dry    : ±20%
///   DRS 200-300 km/h dry    : ±40% (Phase 5 reflected inertia + Phase 1 cold-rubber)
///   100 km/h -> 0 stop dry  : ±40%
///   50 m/s -> 0 stop wet    : ±40%
///   80m radius lat-g wet    : ±25%
///   80m radius lat-g oil    : ±25%
///
/// Stays separate from `calibration_strict.rs` so it doesn't gate the
/// build during Phase 1-6 (which deliberately re-baseline). Phase 7
/// promotes the new numbers to the strict ±0.5% gate.

#[test]
fn phase_n_dry_zero_to_100_drift_within_bounds() {
    let actual = measure_zero_to_100().expect("0-100 reachable");
    let baseline = read_baseline_scenario_from(FIXTURE, "zero_to_100_kmh_seconds");
    assert_drift_within("0-100 km/h", actual, baseline, 0.50);
}

#[test]
fn phase_n_dry_50ms_stop_distance_drift_within_bounds() {
    let actual = measure_stop_distance().expect("stop reachable");
    let baseline = read_baseline_scenario_from(FIXTURE, "fifty_ms_to_zero_stop_distance_m");
    assert_drift_within("50 m/s stop", actual, baseline, 0.40);
}

#[test]
fn phase_n_dry_80m_lat_g_drift_within_bounds() {
    let actual = measure_lat_g().expect("lat-g sampled");
    let baseline = read_baseline_scenario_from(FIXTURE, "steady_state_80m_radius_peak_lat_g");
    assert_drift_within("80m lat-g", actual, baseline, 0.20);
}

#[test]
fn phase_n_dry_drs_200_to_300_drift_within_bounds() {
    let actual = measure_drs_200_to_300().expect("DRS 200-300 reachable");
    let baseline = read_baseline_scenario_from(FIXTURE, "drs_active_200_to_300_kmh_seconds");
    assert_drift_within("DRS 200-300", actual, baseline, 0.40);
}

#[test]
fn phase_n_dry_100kmh_stop_distance_drift_within_bounds() {
    let actual = measure_stop_distance_100kmh().expect("100->0 stop reachable");
    let baseline = read_baseline_scenario_from(FIXTURE, "hundred_kmh_to_zero_stop_distance_m");
    assert_drift_within("100 km/h stop", actual, baseline, 0.40);
}

#[test]
fn phase_n_wet_50ms_stop_distance_drift_within_bounds() {
    let actual =
        measure_stop_distance_with(make_wet_road_engine(), 50.0).expect("wet stop reachable");
    let baseline = read_baseline_scenario_from(FIXTURE, "wet_fifty_ms_to_zero_stop_distance_m");
    assert_drift_within("wet 50 m/s stop", actual, baseline, 0.40);
}

#[test]
fn phase_n_wet_80m_lat_g_drift_within_bounds() {
    let actual = measure_lat_g_with(make_wet_road_engine()).expect("wet lat-g sampled");
    let baseline =
        read_baseline_scenario_from(FIXTURE, "wet_steady_state_80m_radius_peak_lat_g");
    assert_drift_within("wet 80m lat-g", actual, baseline, 0.25);
}

#[test]
fn phase_n_oil_80m_lat_g_drift_within_bounds() {
    let actual = measure_lat_g_with(make_oil_proxy_engine()).expect("oil lat-g sampled");
    let baseline =
        read_baseline_scenario_from(FIXTURE, "oil_steady_state_80m_radius_peak_lat_g");
    assert_drift_within("oil 80m lat-g", actual, baseline, 0.25);
}

/// 2026 X-mode flattens BOTH wings symmetrically (front_mult = rear_mult = 0.55).
/// The DRS `AeroMode` variant is preserved for serde compat but now behaves
/// identically to Straight. Asserts symmetric per-axle Fz drop, not rear-only.
#[test]
fn phase_5_x_mode_symmetric_downforce() {
    use car_physics_engine::engine::PhysicsEngine;
    use car_physics_engine::types::{AeroMode, CarInput, SurfaceType};
    use common::FIXED_DT;
    let measure_axle_fz = |straight: bool| -> (f32, f32) {
        let mut engine = PhysicsEngine::new();
        engine.set_surface(SurfaceType::Road);
        if straight {
            engine.set_aero_mode(AeroMode::Straight);
        }
        let input = CarInput {
            forward: true,
            throttle: 0.6,
            ..Default::default()
        };
        let mut linvel = [0.0_f32, 0.0, 60.0];
        let mut angvel = [0.0_f32; 3];
        for _ in 0..120 {
            let out = engine.step(
                FIXED_DT,
                input,
                [0.0, 1.0, 0.0],
                [0.0, 0.0, 0.0, 1.0],
                linvel,
                angvel,
                [0.0, 1.0, 0.0],
                None,
            );
            linvel = out.linear_velocity;
            angvel = out.angular_velocity;
        }
        let out = engine.step(
            FIXED_DT,
            input,
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
            None,
        );
        let front = out.per_wheel_forces.fz[0] + out.per_wheel_forces.fz[1];
        let rear = out.per_wheel_forces.fz[2] + out.per_wheel_forces.fz[3];
        (front, rear)
    };
    let (corner_front, corner_rear) = measure_axle_fz(false);
    let (x_front, x_rear) = measure_axle_fz(true);
    let front_drop = (corner_front - x_front) / corner_front;
    let rear_drop = (corner_rear - x_rear) / corner_rear;
    eprintln!(
        "X-mode axle drops: front={:.2}%, rear={:.2}%",
        front_drop * 100.0,
        rear_drop * 100.0
    );
    let asymmetry = (front_drop - rear_drop).abs();
    assert!(
        asymmetry < 0.10,
        "X-mode should be symmetric: front_drop={:.2}%, rear_drop={:.2}% (asymmetry {:.2}%)",
        front_drop * 100.0,
        rear_drop * 100.0,
        asymmetry * 100.0
    );
    assert!(front_drop > 0.0, "X-mode front should unload vs Z-mode");
    assert!(rear_drop > 0.0, "X-mode rear should unload vs Z-mode");
}
