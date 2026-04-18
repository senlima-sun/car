use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::types::CarInput;

fn default_position() -> [f32; 3] {
    [0.0, 1.0, 0.0]
}

fn identity_rotation() -> [f32; 4] {
    [0.0, 0.0, 0.0, 1.0]
}

fn zero_velocity() -> [f32; 3] {
    [0.0, 0.0, 0.0]
}

fn assert_output_finite(output: &car_physics_engine::types::CarPhysicsOutput, frame: usize) {
    assert!(
        output.speed_kmh.is_finite(),
        "speed_kmh is not finite at frame {}",
        frame
    );
    for (i, v) in output.linear_velocity.iter().enumerate() {
        assert!(
            v.is_finite(),
            "linear_velocity[{}] is not finite at frame {}",
            i,
            frame
        );
    }
    for (i, v) in output.angular_velocity.iter().enumerate() {
        assert!(
            v.is_finite(),
            "angular_velocity[{}] is not finite at frame {}",
            i,
            frame
        );
    }
    assert!(
        output.slip_angle.is_finite(),
        "slip_angle is not finite at frame {}",
        frame
    );
    assert!(
        output.effective_grip.is_finite(),
        "effective_grip is not finite at frame {}",
        frame
    );
    assert!(
        output.lateral_g.is_finite(),
        "lateral_g is not finite at frame {}",
        frame
    );
    assert!(
        output.longitudinal_g.is_finite(),
        "longitudinal_g is not finite at frame {}",
        frame
    );
    assert!(
        output.skid_intensity.is_finite(),
        "skid_intensity is not finite at frame {}",
        frame
    );
    assert!(
        output.steer_angle.is_finite(),
        "steer_angle is not finite at frame {}",
        frame
    );
}

#[test]
fn test_extreme_small_dt() {
    let mut engine = PhysicsEngine::new();
    let input = CarInput {
        forward: true,
        ..Default::default()
    };

    let mut linvel = zero_velocity();
    let mut angvel = zero_velocity();

    for frame in 0..100 {
        let output = engine.step(
            0.001,
            input,
            default_position(),
            identity_rotation(),
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
        );
        assert_output_finite(&output, frame);
        linvel = output.linear_velocity;
        angvel = output.angular_velocity;
    }
}

#[test]
fn test_extreme_large_dt() {
    let mut engine = PhysicsEngine::new();
    let input = CarInput {
        forward: true,
        ..Default::default()
    };

    let mut linvel = zero_velocity();
    let mut angvel = zero_velocity();

    for frame in 0..10 {
        let output = engine.step(
            1.0,
            input,
            default_position(),
            identity_rotation(),
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
        );
        assert_output_finite(&output, frame);
        linvel = output.linear_velocity;
        angvel = output.angular_velocity;
    }
}

#[test]
fn test_zero_speed_no_division_by_zero() {
    let mut engine = PhysicsEngine::new();
    let input = CarInput::default();

    let output = engine.step(
        1.0 / 60.0,
        input,
        default_position(),
        identity_rotation(),
        zero_velocity(),
        zero_velocity(),
        [0.0, 1.0, 0.0],
    );
    assert_output_finite(&output, 0);

    assert!(
        output.speed_kmh >= 0.0,
        "speed_kmh should be non-negative at rest"
    );
}

#[test]
fn test_continuous_acceleration_100_frames() {
    let mut engine = PhysicsEngine::new();
    let input = CarInput {
        forward: true,
        ..Default::default()
    };

    let dt = 1.0 / 60.0;
    let mut linvel = zero_velocity();
    let mut angvel = zero_velocity();
    let mut prev_speed = 0.0_f32;

    for frame in 0..100 {
        let output = engine.step(
            dt,
            input,
            default_position(),
            identity_rotation(),
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
        );
        assert_output_finite(&output, frame);

        if frame > 5 {
            assert!(
                output.speed_kmh >= prev_speed - 0.5,
                "speed should increase monotonically (or near-monotonically) during acceleration: frame {} speed {} < prev {}",
                frame,
                output.speed_kmh,
                prev_speed
            );
        }

        prev_speed = output.speed_kmh;
        linvel = output.linear_velocity;
        angvel = output.angular_velocity;
    }

    assert!(
        prev_speed > 0.0,
        "speed should be positive after 100 frames of acceleration"
    );
}

#[test]
fn test_extreme_cold_temperature() {
    let mut engine = PhysicsEngine::new();
    engine.set_custom_weather(-40.0, 0.5, 0.0);

    let input = CarInput {
        forward: true,
        ..Default::default()
    };

    let dt = 1.0 / 60.0;
    let mut linvel = zero_velocity();
    let mut angvel = zero_velocity();

    for frame in 0..60 {
        let output = engine.step(
            dt,
            input,
            default_position(),
            identity_rotation(),
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
        );
        assert_output_finite(&output, frame);
        linvel = output.linear_velocity;
        angvel = output.angular_velocity;
    }
}

#[test]
fn test_extreme_hot_temperature() {
    let mut engine = PhysicsEngine::new();
    engine.set_custom_weather(60.0, 0.1, 0.0);

    let input = CarInput {
        forward: true,
        ..Default::default()
    };

    let dt = 1.0 / 60.0;
    let mut linvel = zero_velocity();
    let mut angvel = zero_velocity();

    for frame in 0..60 {
        let output = engine.step(
            dt,
            input,
            default_position(),
            identity_rotation(),
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
        );
        assert_output_finite(&output, frame);
        linvel = output.linear_velocity;
        angvel = output.angular_velocity;
    }
}

#[test]
fn test_full_tire_wear_continues_running() {
    let mut engine = PhysicsEngine::new();
    engine.set_tire_wear(1.0);

    let input = CarInput {
        forward: true,
        ..Default::default()
    };

    let dt = 1.0 / 60.0;
    let mut linvel = zero_velocity();
    let mut angvel = zero_velocity();

    for frame in 0..60 {
        let output = engine.step(
            dt,
            input,
            default_position(),
            identity_rotation(),
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
        );
        assert_output_finite(&output, frame);
        linvel = output.linear_velocity;
        angvel = output.angular_velocity;
    }
}

#[test]
fn test_simultaneous_brake_and_throttle() {
    let mut engine = PhysicsEngine::new();
    let input = CarInput {
        forward: true,
        brake: true,
        ..Default::default()
    };

    let dt = 1.0 / 60.0;
    let mut linvel = zero_velocity();
    let mut angvel = zero_velocity();

    for frame in 0..60 {
        let output = engine.step(
            dt,
            input,
            default_position(),
            identity_rotation(),
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
        );
        assert_output_finite(&output, frame);
        linvel = output.linear_velocity;
        angvel = output.angular_velocity;
    }
}

#[test]
fn test_max_steering_at_high_speed() {
    let mut engine = PhysicsEngine::new();
    let accel_input = CarInput {
        forward: true,
        ..Default::default()
    };

    let dt = 1.0 / 60.0;
    let mut linvel = [0.0, 0.0, -30.0];
    let mut angvel = zero_velocity();

    for _ in 0..30 {
        let output = engine.step(
            dt,
            accel_input,
            default_position(),
            identity_rotation(),
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
        );
        linvel = output.linear_velocity;
        angvel = output.angular_velocity;
    }

    let steer_input = CarInput {
        forward: true,
        left: true,
        ..Default::default()
    };

    for frame in 0..60 {
        let output = engine.step(
            dt,
            steer_input,
            default_position(),
            identity_rotation(),
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
        );
        assert_output_finite(&output, frame);
        linvel = output.linear_velocity;
        angvel = output.angular_velocity;
    }
}

#[test]
fn test_handbrake_at_speed() {
    let mut engine = PhysicsEngine::new();
    let accel_input = CarInput {
        forward: true,
        ..Default::default()
    };

    let dt = 1.0 / 60.0;
    let mut linvel = [0.0, 0.0, -20.0];
    let mut angvel = zero_velocity();

    for _ in 0..30 {
        let output = engine.step(
            dt,
            accel_input,
            default_position(),
            identity_rotation(),
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
        );
        linvel = output.linear_velocity;
        angvel = output.angular_velocity;
    }

    let handbrake_input = CarInput {
        handbrake: true,
        ..Default::default()
    };

    for frame in 0..60 {
        let output = engine.step(
            dt,
            handbrake_input,
            default_position(),
            identity_rotation(),
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
        );
        assert_output_finite(&output, frame);
        linvel = output.linear_velocity;
        angvel = output.angular_velocity;
    }
}
