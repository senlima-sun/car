use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::types::CarInput;

mod common;
use common::FIXED_DT;

const FRAMES: usize = 300;
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

fn drive(engine: &mut PhysicsEngine, input: CarInput) -> ([f32; 3], [f32; 3]) {
    let mut linvel = [0.0_f32, 0.0, 30.0];
    let mut angvel = [0.0_f32; 3];
    let position = [0.0_f32, 1.0, 0.0];
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
    }
    (linvel, angvel)
}

fn assert_mirrored(left: ([f32; 3], [f32; 3]), right: ([f32; 3], [f32; 3]), label: &str) {
    let (lin_l, ang_l) = left;
    let (lin_r, ang_r) = right;
    // Mirror across vehicle forward axis (Z): X flips, Z preserved.
    let dvx = (lin_l[0] + lin_r[0]).abs();
    let dvz = (lin_l[2] - lin_r[2]).abs();
    // Yaw (+Y) sign flips, roll/pitch preserved.
    let dwy = (ang_l[1] + ang_r[1]).abs();
    assert!(
        dvx < TOLERANCE,
        "{}: lateral X velocities should mirror, left={} right={} sum_abs={}",
        label,
        lin_l[0],
        lin_r[0],
        dvx
    );
    assert!(
        dvz < TOLERANCE,
        "{}: forward Z velocities should match, left={} right={} diff_abs={}",
        label,
        lin_l[2],
        lin_r[2],
        dvz
    );
    assert!(
        dwy < TOLERANCE,
        "{}: yaw rates should mirror, left={} right={} sum_abs={}",
        label,
        ang_l[1],
        ang_r[1],
        dwy
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
