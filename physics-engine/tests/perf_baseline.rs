use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::types::{CarInput, SurfaceType};
use std::time::Instant;

mod common;
use common::FIXED_DT;

const SAMPLE_COUNT: usize = 100_000;

#[test]
#[ignore]
fn capture_step_and_sync_perf_baseline() {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);

    let input = CarInput {
        forward: true,
        throttle: 0.6,
        steer: 0.3,
        ..Default::default()
    };
    let position = [0.0_f32, 1.0, 0.0];
    let rotation = [0.0_f32, 0.0, 0.0, 1.0];
    let mut linvel = [0.0_f32, 0.0, 30.0];
    let mut angvel = [0.0_f32; 3];
    let surface_normal = [0.0_f32, 0.999, 0.04];
    let wheel_loads = Some([2200.0_f32, 1800.0, 2100.0, 1900.0]);

    let mut samples_ns = Vec::with_capacity(SAMPLE_COUNT);
    for _ in 0..SAMPLE_COUNT {
        let t0 = Instant::now();
        let bundle = engine.step_and_sync(
            FIXED_DT,
            input,
            position,
            rotation,
            linvel,
            angvel,
            surface_normal,
            wheel_loads,
        );
        let elapsed = t0.elapsed().as_nanos() as u64;
        samples_ns.push(elapsed);
        linvel = bundle.physics.linear_velocity;
        angvel = bundle.physics.angular_velocity;
    }

    samples_ns.sort_unstable();
    let min = samples_ns[0];
    let p50 = samples_ns[SAMPLE_COUNT / 2];
    let p99 = samples_ns[SAMPLE_COUNT * 99 / 100];

    let json = format!(
        r#"{{
  "schema_version": 1,
  "captured_at": "wave-2-entry",
  "samples": {},
  "step_and_sync_ns": {{
    "min": {},
    "p50": {},
    "p99": {}
  }},
  "notes": "lib.rs::step_and_sync deserializes 6 separate JsValue args via serde-wasm-bindgen::from_value plus parse_wheel_loads helper; replacing this with Float32Array payload is Wave 2 Phase 3."
}}
"#,
        SAMPLE_COUNT, min, p50, p99
    );

    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/perf_baseline.json");
    std::fs::write(&path, json).expect("write perf fixture");

    println!("step_and_sync ns — min={}, p50={}, p99={}", min, p50, p99);
    println!("wrote {}", path.display());
}
