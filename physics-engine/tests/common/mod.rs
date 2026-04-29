#![allow(dead_code)]

use car_physics_engine::types::CarPhysicsOutput;

pub const FIXED_DT: f32 = 1.0 / 120.0;

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
