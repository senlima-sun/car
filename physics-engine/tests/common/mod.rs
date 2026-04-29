#![allow(dead_code)]

use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::types::{CarInput, CarPhysicsOutput, SurfaceType};

pub const FIXED_DT: f32 = 1.0 / 120.0;
pub const MAX_SECONDS: usize = 240;
pub const MAX_STEPS: usize = MAX_SECONDS * 120;
pub const WARMUP_STEPS: usize = 60;
pub const BRAKE_STOP_THRESHOLD_MS: f32 = 0.5;

pub fn assert_output_finite(output: &CarPhysicsOutput, frame: usize) {
    let scalars: [(&str, f32); 8] = [
        ("speed_kmh", output.speed_kmh),
        ("forward_speed_ms", output.forward_speed_ms),
        ("slip_angle", output.slip_angle),
        ("effective_grip", output.effective_grip),
        ("lateral_g", output.lateral_g),
        ("longitudinal_g", output.longitudinal_g),
        ("skid_intensity", output.skid_intensity),
        ("steer_angle", output.steer_angle),
    ];
    for (name, v) in scalars {
        assert!(
            v.is_finite(),
            "{name} not finite at frame {frame} (got {v})",
        );
    }
    for (i, v) in output.linear_velocity.iter().enumerate() {
        assert!(
            v.is_finite(),
            "linear_velocity[{i}] not finite at frame {frame} (got {v})",
        );
    }
    for (i, v) in output.angular_velocity.iter().enumerate() {
        assert!(
            v.is_finite(),
            "angular_velocity[{i}] not finite at frame {frame} (got {v})",
        );
    }
}

pub fn make_road_engine() -> PhysicsEngine {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);
    engine
}

pub fn rotation_for_yaw(yaw: f32) -> [f32; 4] {
    let half = yaw * 0.5;
    [0.0, half.sin(), 0.0, half.cos()]
}

pub fn step_engine(
    engine: &mut PhysicsEngine,
    input: CarInput,
    linvel: &mut [f32; 3],
    angvel: &mut [f32; 3],
    rotation: [f32; 4],
) -> CarPhysicsOutput {
    let out = engine.step(
        FIXED_DT,
        input,
        [0.0, 1.0, 0.0],
        rotation,
        *linvel,
        *angvel,
        [0.0, 1.0, 0.0],
        None,
    );
    *linvel = out.linear_velocity;
    *angvel = out.angular_velocity;
    out
}

pub fn measure_zero_to_100() -> Option<f32> {
    let mut engine = make_road_engine();
    let target_ms = 100.0 / 3.6;
    let input = CarInput {
        forward: true,
        throttle: 1.0,
        ..Default::default()
    };
    let mut linvel = [0.0_f32; 3];
    let mut angvel = [0.0_f32; 3];
    for n in 0..MAX_STEPS {
        let out = step_engine(&mut engine, input, &mut linvel, &mut angvel, [0.0, 0.0, 0.0, 1.0]);
        if out.forward_speed_ms >= target_ms {
            return Some((n as f32 + 1.0) * FIXED_DT);
        }
    }
    None
}

pub fn measure_stop_distance() -> Option<f32> {
    let mut engine = make_road_engine();
    let warmup = CarInput {
        forward: true,
        throttle: 1.0,
        ..Default::default()
    };
    let mut linvel = [0.0_f32, 0.0, 50.0];
    let mut angvel = [0.0_f32; 3];
    let mut z = 0.0_f32;
    for _ in 0..WARMUP_STEPS {
        step_engine(&mut engine, warmup, &mut linvel, &mut angvel, [0.0, 0.0, 0.0, 1.0]);
        z += linvel[2] * FIXED_DT;
    }
    let brake = CarInput {
        brake: true,
        brake_analog: 1.0,
        ..Default::default()
    };
    let start_z = z;
    for _ in 0..MAX_STEPS {
        let out = step_engine(&mut engine, brake, &mut linvel, &mut angvel, [0.0, 0.0, 0.0, 1.0]);
        z += linvel[2] * FIXED_DT;
        if out.forward_speed_ms.abs() <= BRAKE_STOP_THRESHOLD_MS {
            return Some(z - start_z);
        }
    }
    None
}

pub fn measure_lat_g() -> Option<f32> {
    let mut engine = make_road_engine();
    let radius = 80.0_f32;
    let target_speed = 50.0_f32;
    let yaw_rate = target_speed / radius;
    let input = CarInput {
        forward: true,
        right: true,
        throttle: 0.6,
        steer: 1.0,
        ..Default::default()
    };
    let mut linvel = [0.0_f32, 0.0, target_speed];
    let mut angvel = [0.0_f32, yaw_rate, 0.0];
    let mut yaw = 0.0_f32;
    let mut peak = 0.0_f32;
    let measure_steps = 240;
    for n in 0..(WARMUP_STEPS + measure_steps) {
        let rot = rotation_for_yaw(yaw);
        let out = step_engine(&mut engine, input, &mut linvel, &mut angvel, rot);
        yaw += angvel[1] * FIXED_DT;
        if n >= WARMUP_STEPS {
            peak = peak.max(out.lateral_g.abs());
        }
    }
    Some(peak)
}
