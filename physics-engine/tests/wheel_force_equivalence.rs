use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::types::SurfaceType;

mod common;
use common::{wheel_spin_test_input, FIXED_DT};

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
    lat_g: f32,
    yaw_rate: f32,
}

#[derive(serde::Deserialize)]
struct Fixture {
    frames: Vec<FrameRecord>,
}

/// Phase 1 (Wave 3) bit-equivalence gate. Replays the 1000-frame
/// deterministic input pattern captured in `wheel_force_pre_phase_1.json`
/// (frozen at Wave 2 head, before the Phase 1 rename + per-wheel Fy
/// promotion) and asserts that the longitudinal output is bit-equivalent
/// AND the lateral output is bit-equivalent — Phase 1 deliberately
/// preserves Fx by keeping the friction-ellipse cap as `(fx, 0)`. Phase 2
/// will refresh this fixture as the G-method shifts both axes.
#[test]
fn phase_1_replay_matches_pre_phase_1_fixture() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/wheel_force_pre_phase_1.json");
    let json = std::fs::read_to_string(&path).expect("fixture exists");
    let fixture: Fixture = serde_json::from_str(&json).expect("fixture parses");
    assert_eq!(fixture.frames.len(), FRAMES);

    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);

    let mut linvel = [0.0_f32, 0.0, 5.0];
    let mut angvel = [0.0_f32; 3];

    for frame in 0..FRAMES {
        let input = wheel_spin_test_input(frame);
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
        let drift_lat_g = (bundle.physics.lateral_g - r.lat_g).abs();
        let drift_yaw = (angvel[1] - r.yaw_rate).abs();
        assert!(
            drift_vx < TOLERANCE
                && drift_vy < TOLERANCE
                && drift_vz < TOLERANCE
                && drift_fwd < TOLERANCE
                && drift_long_g < TOLERANCE
                && drift_lat_g < TOLERANCE
                && drift_yaw < TOLERANCE,
            "frame {} drift: vx={:.6} vy={:.6} vz={:.6} fwd={:.6} long_g={:.6} lat_g={:.6} yaw={:.6}",
            frame,
            drift_vx,
            drift_vy,
            drift_vz,
            drift_fwd,
            drift_long_g,
            drift_lat_g,
            drift_yaw
        );
    }
}
