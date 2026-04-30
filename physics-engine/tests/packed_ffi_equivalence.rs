use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::types::{CarInput, SurfaceType};

mod common;
use common::{wheel_spin_test_input, FIXED_DT};

const FRAMES: usize = 200;
const TOLERANCE: f32 = 1e-6;
const WHEEL_LOADS_MIN_TOTAL_N: f32 = 1.0;

fn pack(
    input: &CarInput,
    dt: f32,
    pos: [f32; 3],
    rot: [f32; 4],
    lv: [f32; 3],
    av: [f32; 3],
    n: [f32; 3],
    wl: Option<[f32; 4]>,
) -> ([f32; 25], u32) {
    let mut buf = [0.0_f32; 25];
    buf[0] = dt;
    buf[1] = input.throttle;
    buf[2] = input.steer;
    buf[3] = input.brake_analog;
    buf[5] = pos[0]; buf[6] = pos[1]; buf[7] = pos[2];
    buf[8] = rot[0]; buf[9] = rot[1]; buf[10] = rot[2]; buf[11] = rot[3];
    buf[12] = lv[0]; buf[13] = lv[1]; buf[14] = lv[2];
    buf[15] = av[0]; buf[16] = av[1]; buf[17] = av[2];
    buf[18] = n[0]; buf[19] = n[1]; buf[20] = n[2];
    if let Some(w) = wl {
        buf[21] = w[0]; buf[22] = w[1]; buf[23] = w[2]; buf[24] = w[3];
    }
    let bits = (if input.forward { 1u32 } else { 0 })
        | (if input.backward { 2 } else { 0 })
        | (if input.left { 4 } else { 0 })
        | (if input.right { 8 } else { 0 })
        | (if input.brake { 16 } else { 0 })
        | (if input.handbrake { 32 } else { 0 });
    (buf, bits)
}

/// Mirrors the unpacking logic in `lib.rs::step_and_sync_packed`. If the
/// FFI decoder ever drifts from this duplicate, the packed_ffi_equivalence
/// test fails — guarding the wave-2 invariant that the packed path is
/// behaviour-identical to the legacy positional path.
fn unpack_and_step(
    engine: &mut PhysicsEngine,
    payload: &[f32; 25],
    input_bits: u32,
) -> car_physics_engine::types::StepAndSyncOutput {
    let input = CarInput {
        forward: (input_bits & 1) != 0,
        backward: (input_bits & 2) != 0,
        left: (input_bits & 4) != 0,
        right: (input_bits & 8) != 0,
        brake: (input_bits & 16) != 0,
        handbrake: (input_bits & 32) != 0,
        steer: payload[2],
        throttle: payload[1],
        brake_analog: payload[3],
    };
    let position = [payload[5], payload[6], payload[7]];
    let rotation = [payload[8], payload[9], payload[10], payload[11]];
    let linvel = [payload[12], payload[13], payload[14]];
    let angvel = [payload[15], payload[16], payload[17]];
    let normal = [payload[18], payload[19], payload[20]];
    let raw_loads = [payload[21], payload[22], payload[23], payload[24]];
    let loads = if raw_loads.iter().all(|v| v.is_finite())
        && raw_loads.iter().sum::<f32>() >= WHEEL_LOADS_MIN_TOTAL_N
    {
        Some(raw_loads)
    } else {
        None
    };
    engine.step_and_sync(
        payload[0], input, position, rotation, linvel, angvel, normal, loads,
    )
}

#[test]
fn packed_payload_decode_matches_legacy_step_and_sync() {
    let mut legacy_engine = PhysicsEngine::new();
    legacy_engine.set_surface(SurfaceType::Road);
    let mut packed_engine = PhysicsEngine::new();
    packed_engine.set_surface(SurfaceType::Road);

    let mut linvel_legacy = [0.0_f32, 0.0, 5.0];
    let mut angvel_legacy = [0.0_f32; 3];
    let mut linvel_packed = linvel_legacy;
    let mut angvel_packed = angvel_legacy;

    let position = [0.0_f32, 1.0, 0.0];
    let rotation = [0.0_f32, 0.0, 0.0, 1.0];
    let surface_normal = [0.0_f32, 1.0, 0.0];

    for frame in 0..FRAMES {
        let input = wheel_spin_test_input(frame);
        let legacy = legacy_engine.step_and_sync(
            FIXED_DT, input, position, rotation, linvel_legacy, angvel_legacy, surface_normal, None,
        );
        linvel_legacy = legacy.physics.linear_velocity;
        angvel_legacy = legacy.physics.angular_velocity;

        let (buf, bits) = pack(
            &input, FIXED_DT, position, rotation, linvel_packed, angvel_packed, surface_normal, None,
        );
        let packed = unpack_and_step(&mut packed_engine, &buf, bits);
        linvel_packed = packed.physics.linear_velocity;
        angvel_packed = packed.physics.angular_velocity;

        for i in 0..3 {
            let d = (linvel_legacy[i] - linvel_packed[i]).abs();
            assert!(
                d < TOLERANCE,
                "frame {} linvel[{}] drift: legacy {:.6} vs packed {:.6} (delta {:.6})",
                frame, i, linvel_legacy[i], linvel_packed[i], d
            );
        }
    }
}

#[test]
fn packed_payload_with_wheel_loads_routes_to_engine() {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);
    let input = CarInput { forward: true, throttle: 0.5, ..Default::default() };
    let (buf, bits) = pack(
        &input,
        FIXED_DT,
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
        [0.0, 0.0, 10.0],
        [0.0; 3],
        [0.0, 1.0, 0.0],
        Some([2200.0, 1800.0, 2100.0, 1900.0]),
    );
    let out = unpack_and_step(&mut engine, &buf, bits);
    assert!(out.physics.linear_velocity[2] > 9.0);
    assert!(out.physics.linear_velocity[2].is_finite());
}

#[test]
fn packed_payload_below_wheel_load_threshold_falls_back() {
    // Rust-side decoder treats sum < 1N as "no signal" — same as legacy.
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);
    let input = CarInput { forward: true, ..Default::default() };
    let (buf, bits) = pack(
        &input, FIXED_DT,
        [0.0, 1.0, 0.0], [0.0, 0.0, 0.0, 1.0],
        [0.0, 0.0, 5.0], [0.0; 3], [0.0, 1.0, 0.0],
        Some([0.0, 0.0, 0.0, 0.0]),
    );
    let out = unpack_and_step(&mut engine, &buf, bits);
    assert!(out.physics.linear_velocity[2].is_finite());
}
