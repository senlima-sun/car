#![allow(dead_code)]

use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::types::{
    AeroMode, AmbientEnvironment, CarInput, CarPhysicsOutput, SurfaceType,
};

pub const FIXED_DT: f32 = 1.0 / 120.0;
pub const MAX_SECONDS: usize = 240;
pub const MAX_STEPS: usize = MAX_SECONDS * 120;
pub const WARMUP_STEPS: usize = 60;
pub const BRAKE_STOP_THRESHOLD_MS: f32 = 0.5;

pub fn assert_output_finite(output: &CarPhysicsOutput, frame: usize) {
    let scalars: [(&str, f32); 8] = [
        ("speed_kmh", output.speed_kmh),
        ("forward_speed_ms", output.forward_speed_ms),
        ("slip_angle", output.slip_angle),
        ("effective_grip", output.effective_grip),
        ("lateral_g", output.lateral_g),
        ("longitudinal_g", output.longitudinal_g),
        ("skid_intensity", output.skid_intensity),
        ("steer_angle", output.steer_angle),
    ];
    for (name, v) in scalars {
        assert!(
            v.is_finite(),
            "{name} not finite at frame {frame} (got {v})",
        );
    }
    for (i, v) in output.linear_velocity.iter().enumerate() {
        assert!(
            v.is_finite(),
            "linear_velocity[{i}] not finite at frame {frame} (got {v})",
        );
    }
    for (i, v) in output.angular_velocity.iter().enumerate() {
        assert!(
            v.is_finite(),
            "angular_velocity[{i}] not finite at frame {frame} (got {v})",
        );
    }
}

pub fn make_road_engine() -> PhysicsEngine {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);
    engine
}

pub fn make_wet_road_engine() -> PhysicsEngine {
    let mut engine = make_road_engine();
    engine.set_environment(AmbientEnvironment::new(15.0, 0.95, 20.0));
    engine
}

/// Oil-like proxy: painted run-off + heavy rain. PaintedArea+wet drops grip to ~0.55.
/// Closest available stand-in for "oil-patch" without introducing a new SurfaceType.
pub fn make_oil_proxy_engine() -> PhysicsEngine {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::PaintedArea);
    engine.set_environment(AmbientEnvironment::new(15.0, 0.95, 30.0));
    engine
}

pub fn rotation_for_yaw(yaw: f32) -> [f32; 4] {
    let half = yaw * 0.5;
    [0.0, half.sin(), 0.0, half.cos()]
}

pub fn step_engine(
    engine: &mut PhysicsEngine,
    input: CarInput,
    linvel: &mut [f32; 3],
    angvel: &mut [f32; 3],
    rotation: [f32; 4],
) -> CarPhysicsOutput {
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

pub fn measure_zero_to_100() -> Option<f32> {
    measure_zero_to_100_with(make_road_engine())
}

/// Warm tires by running a 20-second cruise at moderate throttle
/// before the measurement, then reset the powertrain to 1st-gear
/// launch state. Real F1 launches happen on warm tires (formation
/// lap raises tire temperature into the optimal window). Without
/// this, `material_grip_avg` sits at the Gaussian cold floor (~0.4)
/// and the launch is unrealistically slow. The powertrain reset is
/// needed because the warmup leaves the car in 4-6th gear; the
/// downshift logic can't catch up on a cold launch from rest.
fn warm_up_tires(engine: &mut PhysicsEngine, linvel: &mut [f32; 3], angvel: &mut [f32; 3]) {
    let cruise = CarInput {
        forward: true,
        throttle: 0.6,
        ..Default::default()
    };
    linvel[2] = 50.0;
    for _ in 0..(20 * 120) {
        step_engine(engine, cruise, linvel, angvel, [0.0, 0.0, 0.0, 1.0]);
    }
    engine.reset_powertrain_for_launch();
}

pub fn measure_zero_to_100_with(mut engine: PhysicsEngine) -> Option<f32> {
    let target_ms = 100.0 / 3.6;
    let input = CarInput {
        forward: true,
        throttle: 1.0,
        ..Default::default()
    };
    let mut linvel = [0.0_f32; 3];
    let mut angvel = [0.0_f32; 3];
    // Warm tires (formation-lap proxy) before the launch measurement.
    warm_up_tires(&mut engine, &mut linvel, &mut angvel);
    // Reset to standstill for the launch.
    linvel = [0.0_f32; 3];
    angvel = [0.0_f32; 3];
    for n in 0..MAX_STEPS {
        let out = step_engine(&mut engine, input, &mut linvel, &mut angvel, [0.0, 0.0, 0.0, 1.0]);
        if out.forward_speed_ms >= target_ms {
            return Some((n as f32 + 1.0) * FIXED_DT);
        }
    }
    None
}

pub fn measure_stop_distance() -> Option<f32> {
    measure_stop_distance_with(make_road_engine(), 50.0)
}

pub fn measure_stop_distance_with(mut engine: PhysicsEngine, start_speed_ms: f32) -> Option<f32> {
    let warmup = CarInput {
        forward: true,
        throttle: 1.0,
        ..Default::default()
    };
    let mut linvel = [0.0_f32, 0.0, start_speed_ms];
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

/// 100 km/h -> 0 emergency-brake stop distance. Pure longitudinal anchor for
/// Phase 2 G-method comparison (no combined slip during this measurement).
pub fn measure_stop_distance_100kmh() -> Option<f32> {
    measure_stop_distance_with(make_road_engine(), 100.0 / 3.6)
}

/// DRS-active 200 -> 300 km/h time on a flat straight. Captures rear-aero
/// balance baseline. The aero mode is forced to Drs and the DRS zone is set
/// active (test-only helper bypassing zone-eligibility gate).
pub fn measure_drs_200_to_300() -> Option<f32> {
    let mut engine = make_road_engine();
    engine.set_drs_zone(true);
    engine.set_aero_mode(AeroMode::Drs);

    let input = CarInput {
        forward: true,
        throttle: 1.0,
        ..Default::default()
    };
    let start_ms = 200.0 / 3.6;
    let target_ms = 300.0 / 3.6;
    let mut linvel = [0.0_f32, 0.0, start_ms];
    let mut angvel = [0.0_f32; 3];
    // Re-assert aero mode every step so any auto downgrade is countered.
    for n in 0..MAX_STEPS {
        engine.set_drs_zone(true);
        engine.set_aero_mode(AeroMode::Drs);
        let out = step_engine(&mut engine, input, &mut linvel, &mut angvel, [0.0, 0.0, 0.0, 1.0]);
        if out.forward_speed_ms >= target_ms {
            return Some((n as f32 + 1.0) * FIXED_DT);
        }
    }
    None
}

/// Deterministic input pattern shared by `wheel_spin_capture` (writes the
/// fixture) and `wheel_spin_equivalence` (verifies post-extraction
/// behaviour against the fixture). Keeping the two callers in lockstep
/// lives here so future refactors update both at once.
pub fn wheel_spin_test_input(frame: usize) -> CarInput {
    let phase = (frame as f32 / 60.0).sin();
    let braking_window = (frame / 200) % 2 == 1;
    CarInput {
        forward: true,
        throttle: (0.5 + 0.4 * phase).clamp(0.0, 1.0),
        steer: phase * 0.3,
        brake_analog: if braking_window { 0.6 } else { 0.0 },
        brake: braking_window,
        ..Default::default()
    }
}

pub fn read_baseline_scenario(key: &str) -> f32 {
    read_baseline_scenario_from("tests/fixtures/wave_1_baselines.json", key)
}

pub fn read_baseline_scenario_from(fixture_path: &str, key: &str) -> f32 {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(fixture_path);
    let json = std::fs::read_to_string(&path).expect("baseline fixture exists");
    let value: serde_json::Value = serde_json::from_str(&json).expect("baseline fixture parses");
    value["scenarios"][key]
        .as_f64()
        .unwrap_or_else(|| panic!("scenarios.{} missing or not numeric", key)) as f32
}

pub fn measure_lat_g() -> Option<f32> {
    measure_lat_g_with(make_road_engine())
}

pub fn measure_lat_g_with(mut engine: PhysicsEngine) -> Option<f32> {
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
