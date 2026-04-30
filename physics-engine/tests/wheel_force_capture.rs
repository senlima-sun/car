use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::types::SurfaceType;

mod common;
use common::{wheel_spin_test_input, FIXED_DT};

const FRAMES: usize = 1000;

/// Wave 3 Phase 1 entry capture. Records the deterministic 1000-frame
/// rollout of the (still-named) `WheelSpinIntegrator` BEFORE any rename,
/// signature change, or per-wheel Fy promotion. The Wave 2 fixture
/// (`wheel_spin_pre_extraction.json`) only locks `vx/vy/vz/fwd/long_g`;
/// this one adds `lateral_g` and `angular_velocity_y` so Phase 2's
/// G-method behaviour change is observable end-to-end.
#[test]
#[ignore]
fn capture_pre_phase_1_wheel_force_fixture() {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);

    let mut linvel = [0.0_f32, 0.0, 5.0];
    let mut angvel = [0.0_f32; 3];

    let mut json = String::from("{\n  \"schema_version\": 1,\n  \"frames\": [\n");
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
        json.push_str(&format!(
            "    {{\"f\":{},\"vx\":{:.6},\"vy\":{:.6},\"vz\":{:.6},\"fwd\":{:.6},\"long_g\":{:.6},\"lat_g\":{:.6},\"yaw_rate\":{:.6}}}{}\n",
            frame,
            linvel[0], linvel[1], linvel[2],
            bundle.physics.forward_speed_ms,
            bundle.physics.longitudinal_g,
            bundle.physics.lateral_g,
            angvel[1],
            if frame + 1 == FRAMES { "" } else { "," },
        ));
    }
    json.push_str("  ]\n}\n");

    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/wheel_force_pre_phase_1.json");
    std::fs::write(&path, json).expect("write fixture");
    println!("wrote {}", path.display());
}

/// Phase 2 (Wave 3) refresh capture. Replays the same deterministic
/// 1000-frame input through the post-G-method engine and records the
/// new envelope. The replay-equivalence test
/// (`wheel_force_equivalence`) switches its baseline fixture from
/// `wheel_force_pre_phase_1.json` to `wheel_force_post_phase_2.json`
/// at this step so any future drift is measured against the active
/// (G-method) behaviour.
#[test]
#[ignore]
fn capture_post_phase_2_wheel_force_fixture() {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);

    let mut linvel = [0.0_f32, 0.0, 5.0];
    let mut angvel = [0.0_f32; 3];

    let mut json = String::from("{\n  \"schema_version\": 1,\n  \"frames\": [\n");
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
        json.push_str(&format!(
            "    {{\"f\":{},\"vx\":{:.6},\"vy\":{:.6},\"vz\":{:.6},\"fwd\":{:.6},\"long_g\":{:.6},\"lat_g\":{:.6},\"yaw_rate\":{:.6}}}{}\n",
            frame,
            linvel[0], linvel[1], linvel[2],
            bundle.physics.forward_speed_ms,
            bundle.physics.longitudinal_g,
            bundle.physics.lateral_g,
            angvel[1],
            if frame + 1 == FRAMES { "" } else { "," },
        ));
    }
    json.push_str("  ]\n}\n");

    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/wheel_force_post_phase_2.json");
    std::fs::write(&path, json).expect("write fixture");
    println!("wrote {}", path.display());
}
