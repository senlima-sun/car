use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::types::{CarInput, CarPhysicsOutput};

mod common;
use common::FIXED_DT;

const MAX_SECONDS: usize = 240;
const MAX_STEPS: usize = MAX_SECONDS * 120;
const WARMUP_STEPS: usize = 60;
const BRAKE_STOP_THRESHOLD_MS: f32 = 0.5;

fn step(
    engine: &mut PhysicsEngine,
    input: CarInput,
    linvel: &mut [f32; 3],
    angvel: &mut [f32; 3],
    position: [f32; 3],
    rotation: [f32; 4],
) -> CarPhysicsOutput {
    let out = engine.step(
        FIXED_DT,
        input,
        position,
        rotation,
        *linvel,
        *angvel,
        [0.0, 1.0, 0.0],
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
    let mut engine = PhysicsEngine::new();
    let target_ms = 100.0 / 3.6;
    let input = CarInput {
        forward: true,
        throttle: 1.0,
        ..Default::default()
    };
    let mut linvel = [0.0_f32; 3];
    let mut angvel = [0.0_f32; 3];
    let mut position = [0.0_f32, 1.0, 0.0];

    for n in 0..MAX_STEPS {
        let out = step(
            &mut engine,
            input,
            &mut linvel,
            &mut angvel,
            position,
            [0.0, 0.0, 0.0, 1.0],
        );
        position[0] += linvel[0] * FIXED_DT;
        position[2] += linvel[2] * FIXED_DT;
        if out.forward_speed_ms >= target_ms {
            return Some((n as f32 + 1.0) * FIXED_DT);
        }
    }
    None
}

fn measure_50_to_zero_stop_distance() -> Option<f32> {
    let mut engine = PhysicsEngine::new();

    // Forward direction is +Z (Quat::IDENTITY.forward() = (0,0,1)).
    let warmup_input = CarInput {
        forward: true,
        throttle: 1.0,
        ..Default::default()
    };
    let mut linvel = [0.0_f32, 0.0, 50.0];
    let mut angvel = [0.0_f32; 3];
    let mut position = [0.0_f32, 1.0, 0.0];

    for _ in 0..WARMUP_STEPS {
        step(
            &mut engine,
            warmup_input,
            &mut linvel,
            &mut angvel,
            position,
            [0.0, 0.0, 0.0, 1.0],
        );
        position[2] += linvel[2] * FIXED_DT;
    }

    let brake_input = CarInput {
        brake: true,
        brake_analog: 1.0,
        ..Default::default()
    };
    let start_z = position[2];

    for _ in 0..MAX_STEPS {
        let out = step(
            &mut engine,
            brake_input,
            &mut linvel,
            &mut angvel,
            position,
            [0.0, 0.0, 0.0, 1.0],
        );
        position[2] += linvel[2] * FIXED_DT;
        if out.forward_speed_ms <= BRAKE_STOP_THRESHOLD_MS {
            return Some(position[2] - start_z);
        }
    }
    None
}

fn measure_steady_state_lat_g_at_80m_radius() -> Option<f32> {
    let mut engine = PhysicsEngine::new();
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
    let mut position = [0.0_f32, 1.0, 0.0];
    let mut yaw = 0.0_f32;

    let mut peak_lat_g = 0.0_f32;
    let measure_steps = 240;

    for n in 0..(WARMUP_STEPS + measure_steps) {
        let rot = rotation_for_yaw(yaw);
        let out = step(&mut engine, input, &mut linvel, &mut angvel, position, rot);
        position[0] += linvel[0] * FIXED_DT;
        position[2] += linvel[2] * FIXED_DT;
        yaw += angvel[1] * FIXED_DT;

        if n >= WARMUP_STEPS {
            let lat = out.lateral_g.abs();
            if lat > peak_lat_g {
                peak_lat_g = lat;
            }
        }
    }
    Some(peak_lat_g)
}

#[test]
#[ignore]
fn capture_wave_1_baselines() {
    let zero_to_100 = measure_zero_to_100();
    let stop_distance = measure_50_to_zero_stop_distance();
    let lat_g = measure_steady_state_lat_g_at_80m_radius();

    let json = format!(
        r#"{{
  "schema_version": 1,
  "captured_at": "pre-wave-1",
  "scenarios": {{
    "zero_to_100_kmh_seconds": {},
    "fifty_ms_to_zero_stop_distance_m": {},
    "steady_state_80m_radius_peak_lat_g": {}
  }}
}}
"#,
        zero_to_100
            .map(|v| format!("{:.4}", v))
            .unwrap_or_else(|| "null".into()),
        stop_distance
            .map(|v| format!("{:.4}", v))
            .unwrap_or_else(|| "null".into()),
        lat_g
            .map(|v| format!("{:.4}", v))
            .unwrap_or_else(|| "null".into()),
    );

    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/wave_1_baselines.json");
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(&path, json).expect("write baseline fixture");

    println!("zero_to_100_kmh_seconds = {:?}", zero_to_100);
    println!("fifty_ms_to_zero_stop_distance_m = {:?}", stop_distance);
    println!("steady_state_80m_radius_peak_lat_g = {:?}", lat_g);
    println!("wrote {}", path.display());
}
