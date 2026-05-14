use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::types::CarInput;

mod common;
use common::FIXED_DT;

const FRAMES: usize = 600;
const TOLERANCE: f32 = 1e-3;

fn make_engine(force_shaped: bool) -> PhysicsEngine {
    let mut e = PhysicsEngine::new();
    e.set_force_shaped_lateral(force_shaped);
    e
}

fn left_input() -> CarInput {
    CarInput {
        forward: true,
        left: true,
        throttle: 0.4,
        steer: -0.5,
        ..Default::default()
    }
}

fn right_input() -> CarInput {
    CarInput {
        forward: true,
        right: true,
        throttle: 0.4,
        steer: 0.5,
        ..Default::default()
    }
}

struct State {
    linvel: [f32; 3],
    angvel: [f32; 3],
    position: [f32; 3],
}

fn drive(engine: &mut PhysicsEngine, input: CarInput) -> State {
    let mut linvel = [0.0_f32, 0.0, 30.0];
    let mut angvel = [0.0_f32; 3];
    let mut position = [0.0_f32, 1.0, 0.0];
    let rotation = [0.0_f32, 0.0, 0.0, 1.0];

    for _ in 0..FRAMES {
        let out = engine.step(
            FIXED_DT,
            input,
            position,
            rotation,
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
            None,
        );
        linvel = out.linear_velocity;
        angvel = out.angular_velocity;
        position[0] += linvel[0] * FIXED_DT;
        position[1] += linvel[1] * FIXED_DT;
        position[2] += linvel[2] * FIXED_DT;
    }
    State {
        linvel,
        angvel,
        position,
    }
}

fn assert_mirrored(left: State, right: State, label: &str) {
    // Mirror across vehicle forward axis (Z): X flips, Z preserved.
    let dvx = (left.linvel[0] + right.linvel[0]).abs();
    let dvz = (left.linvel[2] - right.linvel[2]).abs();
    let dpx = (left.position[0] + right.position[0]).abs();
    let dpz = (left.position[2] - right.position[2]).abs();
    // Yaw (+Y) sign flips, roll/pitch preserved.
    let dwy = (left.angvel[1] + right.angvel[1]).abs();
    assert!(
        dvx < TOLERANCE,
        "{label}: lateral X velocities should mirror, left={} right={} sum_abs={dvx}",
        left.linvel[0],
        right.linvel[0]
    );
    assert!(
        dvz < TOLERANCE,
        "{label}: forward Z velocities should match, left={} right={} diff_abs={dvz}",
        left.linvel[2],
        right.linvel[2]
    );
    assert!(
        dwy < TOLERANCE,
        "{label}: yaw rates should mirror, left={} right={} sum_abs={dwy}",
        left.angvel[1],
        right.angvel[1]
    );
    // Position checks are coarser since they integrate frame-to-frame
    // velocity differences; lateral asymmetries surface earliest in
    // position, which is why they're the primary symmetry signal.
    assert!(
        dpx < TOLERANCE * (FRAMES as f32 * FIXED_DT) * 10.0,
        "{label}: lateral X positions should mirror, left={} right={} sum_abs={dpx}",
        left.position[0],
        right.position[0]
    );
    assert!(
        dpz < TOLERANCE * (FRAMES as f32 * FIXED_DT) * 10.0,
        "{label}: forward Z positions should match, left={} right={} diff_abs={dpz}",
        left.position[2],
        right.position[2]
    );
}

/// Left-right symmetry under the legacy (pre-Wave-2) path. The
/// existing dynamics should already pass this — the test pins that
/// invariant.
#[test]
fn left_right_symmetry_legacy_path() {
    let left = drive(&mut make_engine(false), left_input());
    let right = drive(&mut make_engine(false), right_input());
    assert_mirrored(left, right, "legacy");
}

/// Left-right symmetry under the force-shaped Wave-2 path. Per-axle
/// slip, force-driven yaw, and force-driven lateral integration must
/// preserve mirror invariance.
#[test]
fn left_right_symmetry_force_shaped_path() {
    let left = drive(&mut make_engine(true), left_input());
    let right = drive(&mut make_engine(true), right_input());
    assert_mirrored(left, right, "force-shaped");
}
