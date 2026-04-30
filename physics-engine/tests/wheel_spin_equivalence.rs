use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::types::{CarInput, SurfaceType};

mod common;
use common::FIXED_DT;

const FRAMES: usize = 1000;
const TOLERANCE: f32 = 1e-5;

#[derive(serde::Deserialize)]
struct FrameRecord {
    f: usize,
    vx: f32,
    vy: f32,
    vz: f32,
    fwd: f32,
    long_g: f32,
}

#[derive(serde::Deserialize)]
struct Fixture {
    frames: Vec<FrameRecord>,
}

#[test]
fn wheel_spin_extraction_matches_pre_extraction_fixture() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/wheel_spin_pre_extraction.json");
    let json = std::fs::read_to_string(&path).expect("fixture exists");
    let fixture: Fixture = serde_json::from_str(&json).expect("fixture parses");
    assert_eq!(fixture.frames.len(), FRAMES);

    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);

    let mut linvel = [0.0_f32, 0.0, 5.0];
    let mut angvel = [0.0_f32; 3];

    for frame in 0..FRAMES {
        let phase = (frame as f32 / 60.0).sin();
        let input = CarInput {
            forward: true,
            throttle: (0.5 + 0.4 * phase).clamp(0.0, 1.0),
            steer: phase * 0.3,
            brake_analog: if (frame / 200) % 2 == 1 { 0.6 } else { 0.0 },
            brake: (frame / 200) % 2 == 1,
            ..Default::default()
        };
        let bundle = engine.step_and_sync(
            FIXED_DT,
            input,
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
            None,
        );
        linvel = bundle.physics.linear_velocity;
        angvel = bundle.physics.angular_velocity;

        let r = &fixture.frames[frame];
        assert_eq!(r.f, frame);
        let drift_vx = (linvel[0] - r.vx).abs();
        let drift_vy = (linvel[1] - r.vy).abs();
        let drift_vz = (linvel[2] - r.vz).abs();
        let drift_fwd = (bundle.physics.forward_speed_ms - r.fwd).abs();
        let drift_long_g = (bundle.physics.longitudinal_g - r.long_g).abs();
        assert!(
            drift_vx < TOLERANCE
                && drift_vy < TOLERANCE
                && drift_vz < TOLERANCE
                && drift_fwd < TOLERANCE
                && drift_long_g < TOLERANCE,
            "frame {} drift: vx={:.6} vy={:.6} vz={:.6} fwd={:.6} long_g={:.6}",
            frame,
            drift_vx,
            drift_vy,
            drift_vz,
            drift_fwd,
            drift_long_g
        );
    }
}
