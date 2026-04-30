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

/// Wave 3 wheel-force replay-equivalence gate. From Phase 2 onward this
/// reads `wheel_force_post_phase_2.json` (the post-G-method baseline)
/// rather than the pre-Phase-1 fixture, so any future drift is measured
/// against the live G-method behaviour. The Phase 1 fixture is preserved
/// in tree as a record of what the model produced before the deliberate
/// behaviour change. (Phase 2 input pattern happens to bit-match Phase 1
/// to within 1e-5 — `wheel_spin_test_input` doesn't excite enough off-
/// axis slip on the chassis to surface G-method drift.)
#[test]
fn wheel_force_replay_matches_active_fixture() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/wheel_force_post_phase_2.json");
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
