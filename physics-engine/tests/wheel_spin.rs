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

/// Phase 1 (Wave 3) telemetry contract. Per-wheel Fy lands on
/// `CarPhysicsOutput.per_wheel_forces` whenever chassis slip angle is
/// non-zero. Pre-Phase-1 the field was zero-default; Phase 1 populates
/// it from the integrator output.
///
/// Note: the chassis-level slip angle comes from `lateral_speed/forward_speed`
/// — in production Rapier integrates yaw-from-steering into a real lateral
/// component each frame; in this unit harness we feed lateral velocity
/// directly so the EMA reaches a non-zero steady state.
#[test]
fn per_wheel_forces_populated_when_slip_angle_nonzero() {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);

    let input = CarInput {
        forward: true,
        throttle: 0.6,
        ..Default::default()
    };
    // Lateral velocity → non-zero chassis slip angle once EMA settles.
    let mut linvel = [5.0_f32, 0.0, 30.0];
    let mut angvel = [0.0_f32; 3];
    for _ in 0..120 {
        let out = engine.step(
            FIXED_DT,
            input,
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
            None,
        );
        linvel = [5.0, 0.0, out.linear_velocity[2]];
        angvel = out.angular_velocity;
    }

    let out = engine.step(
        FIXED_DT,
        input,
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
        linvel,
        angvel,
        [0.0, 1.0, 0.0],
        None,
    );

    let pwf = &out.per_wheel_forces;
    let total_fy_abs: f32 = pwf.fy.iter().map(|f| f.abs()).sum();
    let total_fz: f32 = pwf.fz.iter().sum();
    assert!(
        out.slip_angle.abs() > 1.0,
        "slip_angle EMA should have settled non-zero, got {}",
        out.slip_angle
    );
    assert!(
        total_fy_abs > 100.0,
        "expected non-zero Fy at non-zero slip, got per-wheel {:?}",
        pwf.fy
    );
    assert!(
        total_fz > 1000.0,
        "expected non-zero Fz, got per-wheel {:?}",
        pwf.fz
    );
    for sa in pwf.slip_angle.iter() {
        assert!(sa.abs() > 0.0, "slip_angle should be populated");
    }
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
