use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::types::{CarInput, SurfaceType};

mod common;
use common::{assert_output_finite, FIXED_DT};

fn run(engine: &mut PhysicsEngine, input: CarInput, mut linvel: [f32; 3], steps: usize) -> [f32; 3] {
    for _ in 0..steps {
        let out = engine.step(
            FIXED_DT,
            input,
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
            linvel,
            [0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            None,
        );
        linvel = out.linear_velocity;
    }
    linvel
}

#[test]
fn full_throttle_from_rest_increases_forward_speed() {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);
    let input = CarInput {
        forward: true,
        throttle: 1.0,
        ..Default::default()
    };
    let linvel = run(&mut engine, input, [0.0, 0.0, 0.0], 60);
    assert!(
        linvel[2] > 1.0,
        "After 0.5s of full throttle, forward speed should be > 1 m/s, got {:?}",
        linvel
    );
}

#[test]
fn full_brake_from_50ms_reduces_forward_speed() {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);
    let warmup_input = CarInput {
        forward: true,
        throttle: 1.0,
        ..Default::default()
    };
    let mut linvel = [0.0, 0.0, 50.0];
    linvel = run(&mut engine, warmup_input, linvel, 60);

    let initial_forward = linvel[2];
    assert!(initial_forward > 30.0);

    let brake_input = CarInput {
        brake: true,
        brake_analog: 1.0,
        ..Default::default()
    };
    linvel = run(&mut engine, brake_input, linvel, 120);

    assert!(
        linvel[2] < initial_forward * 0.5,
        "After 1s of full brake, forward speed should drop below half ({} → {})",
        initial_forward,
        linvel[2]
    );
}

#[test]
fn longitudinal_force_obeys_friction_envelope_at_rest() {
    // Sanity: at rest with full throttle, the per-step longitudinal_g
    // should not exceed ~1.5g (peak μ × downforce_grip_bonus ≈ 1).
    // This pins the new Pacejka path against unbounded wheelspin force.
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);
    let input = CarInput {
        forward: true,
        throttle: 1.0,
        ..Default::default()
    };
    let mut linvel = [0.0, 0.0, 0.0];
    for frame in 0..30 {
        let out = engine.step(
            FIXED_DT,
            input,
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
            linvel,
            [0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            None,
        );
        assert_output_finite(&out, frame);
        assert!(
            out.longitudinal_g.abs() < 3.0,
            "longitudinal_g spike beyond friction envelope: {}",
            out.longitudinal_g
        );
        linvel = out.linear_velocity;
    }
}
