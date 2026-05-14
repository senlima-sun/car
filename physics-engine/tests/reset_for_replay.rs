use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::types::{CarInput, SurfaceType, TireCompound};

const DT: f32 = 1.0 / 120.0;
const STEPS: usize = 1000;

fn drive_input() -> CarInput {
    CarInput {
        forward: true,
        backward: false,
        left: false,
        right: false,
        brake: false,
        handbrake: false,
        steer: 0.1,
        throttle: 0.5,
        brake_analog: 0.0,
    }
}

fn drive_n_steps(engine: &mut PhysicsEngine, n: usize) {
    let mut position = [0.0_f32, 1.0, 0.0];
    let mut rotation = [0.0_f32, 0.0, 0.0, 1.0];
    let mut linvel = [0.0_f32; 3];
    let mut angvel = [0.0_f32; 3];
    for _ in 0..n {
        let out = engine.step(
            DT,
            drive_input(),
            position,
            rotation,
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
            None,
        );
        linvel = out.linear_velocity;
        angvel = out.angular_velocity;
        position[0] += linvel[0] * DT;
        position[1] += linvel[1] * DT;
        position[2] += linvel[2] * DT;
        let half = angvel[1] * DT * 0.5;
        let s = half.sin();
        let c = half.cos();
        let (qx, qy, qz, qw) = (rotation[0], rotation[1], rotation[2], rotation[3]);
        rotation[0] = qx * c + qz * s;
        rotation[1] = qy * c + qw * s;
        rotation[2] = qz * c - qx * s;
        rotation[3] = qw * c - qy * s;
        let len_sq = rotation[0].powi(2)
            + rotation[1].powi(2)
            + rotation[2].powi(2)
            + rotation[3].powi(2);
        if len_sq > 1e-8 {
            let inv = 1.0 / len_sq.sqrt();
            rotation[0] *= inv;
            rotation[1] *= inv;
            rotation[2] *= inv;
            rotation[3] *= inv;
        }
    }
}

fn arm_scenario(engine: &mut PhysicsEngine) {
    engine.set_surface(SurfaceType::Road);
    engine.set_tire_compound(TireCompound::Medium);
    engine.set_wind(0.4, 8.0);
    engine.set_wind_enabled(true);
}

#[test]
fn reset_for_replay_produces_identical_state_hash() {
    let mut engine = PhysicsEngine::new();
    arm_scenario(&mut engine);

    drive_n_steps(&mut engine, STEPS);
    let h1 = engine.state_hash();

    engine.reset_for_replay();
    arm_scenario(&mut engine);

    drive_n_steps(&mut engine, STEPS);
    let h2 = engine.state_hash();

    assert_eq!(
        h1, h2,
        "state_hash diverges after reset_for_replay (h1={h1:x}, h2={h2:x})",
    );
}

#[test]
fn reset_for_replay_yields_fresh_state_before_replay() {
    let mut engine = PhysicsEngine::new();
    arm_scenario(&mut engine);
    let h_fresh = engine.state_hash();

    drive_n_steps(&mut engine, STEPS);
    let h_after_drive = engine.state_hash();
    assert_ne!(
        h_fresh, h_after_drive,
        "driving 1000 steps did not change state hash — test fixture is broken",
    );

    engine.reset_for_replay();
    arm_scenario(&mut engine);
    let h_after_reset = engine.state_hash();
    assert_eq!(
        h_fresh, h_after_reset,
        "reset_for_replay did not restore initial state (h_fresh={h_fresh:x}, h_after_reset={h_after_reset:x})",
    );
}
