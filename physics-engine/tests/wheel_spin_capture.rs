use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::types::{CarInput, SurfaceType};

mod common;
use common::FIXED_DT;

const FRAMES: usize = 1000;

#[test]
#[ignore]
fn capture_pre_extraction_wheel_spin_fixture() {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);

    let mut linvel = [0.0_f32, 0.0, 5.0];
    let mut angvel = [0.0_f32; 3];

    let mut linvels = Vec::with_capacity(FRAMES);
    let mut speeds = Vec::with_capacity(FRAMES);
    let mut long_g = Vec::with_capacity(FRAMES);

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
        linvels.push(linvel);
        speeds.push(bundle.physics.forward_speed_ms);
        long_g.push(bundle.physics.longitudinal_g);
    }

    let mut json = String::from("{\n  \"schema_version\": 1,\n  \"frames\": [\n");
    for i in 0..FRAMES {
        json.push_str(&format!(
            "    {{\"f\":{},\"vx\":{:.6},\"vy\":{:.6},\"vz\":{:.6},\"fwd\":{:.6},\"long_g\":{:.6}}}{}\n",
            i,
            linvels[i][0], linvels[i][1], linvels[i][2],
            speeds[i], long_g[i],
            if i + 1 == FRAMES { "" } else { "," },
        ));
    }
    json.push_str("  ]\n}\n");

    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/wheel_spin_pre_extraction.json");
    std::fs::write(&path, json).expect("write fixture");
    println!("wrote {}", path.display());
}
