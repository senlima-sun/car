use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::types::{CarInput, SurfaceType};

mod common;
use common::FIXED_DT;

const MAX_SECONDS: usize = 240;
const MAX_STEPS: usize = MAX_SECONDS * 120;
const WARMUP_STEPS: usize = 60;
const BRAKE_STOP_THRESHOLD_MS: f32 = 0.5;

const TOLERANCE_ZERO_TO_100: f32 = 0.20;
const TOLERANCE_STOP_DISTANCE: f32 = 0.25;
const TOLERANCE_LAT_G: f32 = 0.15;

fn make_road_engine() -> PhysicsEngine {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);
    engine
}

fn step_engine(
    engine: &mut PhysicsEngine,
    input: CarInput,
    linvel: &mut [f32; 3],
    angvel: &mut [f32; 3],
    rotation: [f32; 4],
) -> car_physics_engine::types::CarPhysicsOutput {
    let out = engine.step(
        FIXED_DT,
        input,
        [0.0, 1.0, 0.0],
        rotation,
        *linvel,
        *angvel,
        [0.0, 1.0, 0.0],
        None,
    );
    *linvel = out.linear_velocity;
    *angvel = out.angular_velocity;
    out
}

fn rotation_for_yaw(yaw: f32) -> [f32; 4] {
    let half = yaw * 0.5;
    [0.0, half.sin(), 0.0, half.cos()]
}

fn measure_zero_to_100() -> Option<f32> {
    let mut engine = make_road_engine();
    let target_ms = 100.0 / 3.6;
    let input = CarInput {
        forward: true,
        throttle: 1.0,
        ..Default::default()
    };
    let mut linvel = [0.0_f32; 3];
    let mut angvel = [0.0_f32; 3];
    for n in 0..MAX_STEPS {
        let out = step_engine(&mut engine, input, &mut linvel, &mut angvel, [0.0, 0.0, 0.0, 1.0]);
        if out.forward_speed_ms >= target_ms {
            return Some((n as f32 + 1.0) * FIXED_DT);
        }
    }
    None
}

fn measure_stop_distance() -> Option<f32> {
    let mut engine = make_road_engine();
    let warmup = CarInput {
        forward: true,
        throttle: 1.0,
        ..Default::default()
    };
    let mut linvel = [0.0_f32, 0.0, 50.0];
    let mut angvel = [0.0_f32; 3];
    let mut z = 0.0_f32;
    for _ in 0..WARMUP_STEPS {
        step_engine(&mut engine, warmup, &mut linvel, &mut angvel, [0.0, 0.0, 0.0, 1.0]);
        z += linvel[2] * FIXED_DT;
    }
    let brake = CarInput {
        brake: true,
        brake_analog: 1.0,
        ..Default::default()
    };
    let start_z = z;
    for _ in 0..MAX_STEPS {
        let out = step_engine(&mut engine, brake, &mut linvel, &mut angvel, [0.0, 0.0, 0.0, 1.0]);
        z += linvel[2] * FIXED_DT;
        if out.forward_speed_ms.abs() <= BRAKE_STOP_THRESHOLD_MS {
            return Some(z - start_z);
        }
    }
    None
}

fn measure_lat_g() -> Option<f32> {
    let mut engine = make_road_engine();
    let radius = 80.0_f32;
    let target_speed = 50.0_f32;
    let yaw_rate = target_speed / radius;
    let input = CarInput {
        forward: true,
        right: true,
        throttle: 0.6,
        steer: 1.0,
        ..Default::default()
    };
    let mut linvel = [0.0_f32, 0.0, target_speed];
    let mut angvel = [0.0_f32, yaw_rate, 0.0];
    let mut yaw = 0.0_f32;
    let mut peak = 0.0_f32;
    let measure_steps = 240;
    for n in 0..(WARMUP_STEPS + measure_steps) {
        let rot = rotation_for_yaw(yaw);
        let out = step_engine(&mut engine, input, &mut linvel, &mut angvel, rot);
        yaw += angvel[1] * FIXED_DT;
        if n >= WARMUP_STEPS {
            peak = peak.max(out.lateral_g.abs());
        }
    }
    Some(peak)
}

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
