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

/// Wave 3 calibration drift sanity check. Read-only — runs the Wave 3
/// entry baselines through the post-Phase-N engine and reports drift.
/// Bounds reflect the cumulative behaviour change scope through each
/// phase:
///
///   0-100 km/h dry          : ±30% (Phase 5 engine inertia adds ~25%)
///   50 m/s -> 0 stop dry    : ±25% (Phase 5 engine braking shortens stop)
///   80m radius lat-g dry    : ±20%
///   DRS 200-300 km/h dry    : ±35% (Phase 5 reflected inertia hits hardest in low gears)
///   100 km/h -> 0 stop dry  : ±30%
///   50 m/s -> 0 stop wet    : ±30%
///   80m radius lat-g wet    : ±25%
///   80m radius lat-g oil    : ±25%
///
/// Stays separate from `calibration_strict.rs` so it doesn't gate the
/// build during Phase 2-6 (which deliberately re-baseline). Phase 7
/// promotes the new numbers to the strict ±0.5% gate.

#[test]
fn phase_n_dry_zero_to_100_drift_within_bounds() {
    let actual = measure_zero_to_100().expect("0-100 reachable");
    let baseline = read_baseline_scenario_from(DRY_FIXTURE, "zero_to_100_kmh_seconds");
    assert_drift_within("0-100 km/h", actual, baseline, 0.30);
}

#[test]
fn phase_n_dry_50ms_stop_distance_drift_within_bounds() {
    let actual = measure_stop_distance().expect("stop reachable");
    let baseline =
        read_baseline_scenario_from(DRY_FIXTURE, "fifty_ms_to_zero_stop_distance_m");
    assert_drift_within("50 m/s stop", actual, baseline, 0.25);
}

#[test]
fn phase_n_dry_80m_lat_g_drift_within_bounds() {
    let actual = measure_lat_g().expect("lat-g sampled");
    let baseline =
        read_baseline_scenario_from(DRY_FIXTURE, "steady_state_80m_radius_peak_lat_g");
    assert_drift_within("80m lat-g", actual, baseline, 0.20);
}

#[test]
fn phase_n_dry_drs_200_to_300_drift_within_bounds() {
    let actual = measure_drs_200_to_300().expect("DRS 200-300 reachable");
    let baseline =
        read_baseline_scenario_from(DRY_FIXTURE, "drs_active_200_to_300_kmh_seconds");
    assert_drift_within("DRS 200-300", actual, baseline, 0.35);
}

#[test]
fn phase_n_dry_100kmh_stop_distance_drift_within_bounds() {
    let actual = measure_stop_distance_100kmh().expect("100->0 stop reachable");
    let baseline =
        read_baseline_scenario_from(DRY_FIXTURE, "hundred_kmh_to_zero_stop_distance_m");
    assert_drift_within("100 km/h stop", actual, baseline, 0.30);
}

#[test]
fn phase_n_wet_50ms_stop_distance_drift_within_bounds() {
    let actual =
        measure_stop_distance_with(make_wet_road_engine(), 50.0).expect("wet stop reachable");
    let baseline = read_baseline_scenario_from(
        WET_FIXTURE,
        "wet_fifty_ms_to_zero_stop_distance_m",
    );
    assert_drift_within("wet 50 m/s stop", actual, baseline, 0.30);
}

#[test]
fn phase_n_wet_80m_lat_g_drift_within_bounds() {
    let actual = measure_lat_g_with(make_wet_road_engine()).expect("wet lat-g sampled");
    let baseline = read_baseline_scenario_from(
        WET_FIXTURE,
        "wet_steady_state_80m_radius_peak_lat_g",
    );
    assert_drift_within("wet 80m lat-g", actual, baseline, 0.25);
}

#[test]
fn phase_n_oil_80m_lat_g_drift_within_bounds() {
    let actual = measure_lat_g_with(make_oil_proxy_engine()).expect("oil lat-g sampled");
    let baseline = read_baseline_scenario_from(
        WET_FIXTURE,
        "oil_steady_state_80m_radius_peak_lat_g",
    );
    assert_drift_within("oil 80m lat-g", actual, baseline, 0.25);
}

/// Phase 4 contract: DRS-active rear-axle Fz should be significantly lower
/// than Corner-mode rear-axle Fz at the same speed (rear-only unloading is
/// the contract). Body-frame lat_g saturates at the friction limit so it
/// doesn't show the asymmetry; per-wheel Fz from `per_wheel_forces`
/// telemetry is the cleaner signal.
#[test]
fn phase_4_drs_unloads_rear_axle_at_speed() {
    use car_physics_engine::engine::PhysicsEngine;
    use car_physics_engine::types::{AeroMode, CarInput, SurfaceType};
    let measure_rear_fz = |drs: bool| -> f32 {
        let mut engine = PhysicsEngine::new();
        engine.set_surface(SurfaceType::Road);
        if drs {
            engine.set_drs_zone(true);
            engine.set_aero_mode(AeroMode::Drs);
        }
        let input = CarInput {
            forward: true,
            throttle: 0.6,
            ..Default::default()
        };
        let mut linvel = [0.0_f32, 0.0, 60.0];
        let mut angvel = [0.0_f32; 3];
        // Drive long enough for downforce to settle (60 frames at 120Hz).
        for _ in 0..120 {
            if drs {
                engine.set_drs_zone(true);
                engine.set_aero_mode(AeroMode::Drs);
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
        out.per_wheel_forces.fz[2] + out.per_wheel_forces.fz[3]
    };
    // Use the const we just consumed — pull dt from common.
    use common::FIXED_DT;
    let corner_rear_fz = measure_rear_fz(false);
    let drs_rear_fz = measure_rear_fz(true);
    let drop_pct = ((corner_rear_fz - drs_rear_fz) / corner_rear_fz) * 100.0;
    eprintln!(
        "DRS rear-axle Fz drop: corner={:.1} N, drs={:.1} N, drop {:.2}%",
        corner_rear_fz, drs_rear_fz, drop_pct
    );
    // Acceptance: rear Fz should drop measurably (DRS rear mult = 0.42 vs
    // 1.0 in Corner). At 60 m/s the rear-aero contribution is ~50% of total
    // rear load, so a 58% rear-mult drop should produce ~25-35% rear-axle Fz
    // reduction. Bounds set wide (5-50%) to avoid flake.
    assert!(
        drop_pct >= 5.0 && drop_pct <= 50.0,
        "DRS rear Fz drop {}% outside [5%, 50%] — tune DRS_REAR_DOWNFORCE_MULT",
        drop_pct
    );
}
