use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::types::{CarInput, SurfaceType, TireCompound};

const DT: f32 = 1.0 / 60.0;
const IDENTITY_QUAT: [f32; 4] = [0.0, 0.0, 0.0, 1.0];
const ORIGIN: [f32; 3] = [0.0, 0.0, 0.0];
const ZERO_VEL: [f32; 3] = [0.0, 0.0, 0.0];

fn make_engine() -> PhysicsEngine {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);
    engine.set_tire_compound(TireCompound::Medium);
    engine
}

fn throttle_input() -> CarInput {
    CarInput {
        forward: true,
        ..Default::default()
    }
}

fn brake_input() -> CarInput {
    CarInput {
        backward: true,
        brake: true,
        ..Default::default()
    }
}

struct SimState {
    position: [f32; 3],
    linvel: [f32; 3],
    angvel: [f32; 3],
    rotation: [f32; 4],
}

impl SimState {
    fn new() -> Self {
        Self {
            position: ORIGIN,
            linvel: ZERO_VEL,
            angvel: ZERO_VEL,
            rotation: IDENTITY_QUAT,
        }
    }

    fn speed_ms(&self) -> f32 {
        (self.linvel[0].powi(2) + self.linvel[2].powi(2)).sqrt()
    }

    fn speed_kmh(&self) -> f32 {
        self.speed_ms() * 3.6
    }

    fn forward_speed(&self) -> f32 {
        self.linvel[2]
    }
}

fn step_sim(
    engine: &mut PhysicsEngine,
    state: &mut SimState,
    input: &CarInput,
) -> car_physics_engine::types::CarPhysicsOutput {
    let output = engine.step(
        DT,
        *input,
        state.position,
        state.rotation,
        state.linvel,
        state.angvel,
        [0.0, 1.0, 0.0],
    );

    state.linvel = output.linear_velocity;
    state.angvel = output.angular_velocity;

    state.position[0] += state.linvel[0] * DT;
    state.position[1] += state.linvel[1] * DT;
    state.position[2] += state.linvel[2] * DT;

    let yaw_rate = state.angvel[1];
    let half_angle = yaw_rate * DT * 0.5;
    let sin_h = half_angle.sin();
    let cos_h = half_angle.cos();
    let (qx, qy, qz, qw) = (
        state.rotation[0],
        state.rotation[1],
        state.rotation[2],
        state.rotation[3],
    );
    state.rotation = [
        qx * cos_h + qz * sin_h,
        qy * cos_h + qw * sin_h,
        qz * cos_h - qx * sin_h,
        qw * cos_h - qy * sin_h,
    ];
    let len = (state.rotation[0].powi(2)
        + state.rotation[1].powi(2)
        + state.rotation[2].powi(2)
        + state.rotation[3].powi(2))
    .sqrt();
    if len > 0.0001 {
        for r in &mut state.rotation {
            *r /= len;
        }
    }

    output
}

#[test]
fn test_acceleration_0_to_100_reasonable_time() {
    let mut engine = make_engine();
    let mut state = SimState::new();
    let input = throttle_input();

    let mut reached_100 = false;
    let mut frame_at_100 = 0;

    for frame in 0..180 {
        step_sim(&mut engine, &mut state, &input);
        if state.speed_kmh() >= 100.0 && !reached_100 {
            reached_100 = true;
            frame_at_100 = frame;
        }
    }

    let final_speed = state.speed_kmh();

    assert!(
        reached_100,
        "Should reach 100 km/h within 3 seconds, max speed was {:.1} km/h",
        final_speed
    );

    let time_to_100 = (frame_at_100 + 1) as f32 * DT;
    assert!(
        time_to_100 > 0.5,
        "0-100 km/h should take more than 0.5s (not teleporting), took {:.2}s",
        time_to_100
    );
    assert!(
        time_to_100 < 5.0,
        "0-100 km/h should take less than 5.0s for a 798kg race car with 14kN, took {:.2}s",
        time_to_100
    );

    assert!(
        final_speed > 120.0,
        "After 3s full throttle, speed should exceed 120 km/h, got {:.1} km/h",
        final_speed
    );
    assert!(
        final_speed < 310.0,
        "After 3s, speed should be below max (310 km/h), got {:.1} km/h",
        final_speed
    );
}

#[test]
fn test_braking_from_100_reasonable_distance() {
    let mut engine = make_engine();
    let mut state = SimState::new();
    let input = throttle_input();

    for _ in 0..300 {
        step_sim(&mut engine, &mut state, &input);
        if state.speed_kmh() >= 100.0 {
            break;
        }
    }

    assert!(
        state.speed_kmh() >= 95.0,
        "Should reach ~100 km/h before braking, got {:.1} km/h",
        state.speed_kmh()
    );

    let braking_start_pos = state.position[2];
    let brake = brake_input();

    for _ in 0..300 {
        step_sim(&mut engine, &mut state, &brake);
        if state.speed_ms() < 0.5 {
            break;
        }
    }

    let braking_distance = (state.position[2] - braking_start_pos).abs();

    assert!(
        braking_distance > 3.0,
        "Braking distance from 100 km/h should be > 3m (not instant), got {:.1}m",
        braking_distance
    );
    assert!(
        braking_distance < 100.0,
        "Braking distance from 100 km/h should be < 100m, got {:.1}m",
        braking_distance
    );
    assert!(
        state.speed_ms() < 3.0,
        "Car should be nearly stopped after braking, speed = {:.1} m/s",
        state.speed_ms()
    );
}

#[test]
fn test_circular_turning_lateral_g() {
    let mut engine = make_engine();
    let mut state = SimState::new();
    let input = throttle_input();

    for _ in 0..60 {
        step_sim(&mut engine, &mut state, &input);
    }

    assert!(
        state.speed_kmh() > 40.0,
        "Should reach driving speed before turning, got {:.1} km/h",
        state.speed_kmh()
    );

    let steer_throttle = CarInput {
        forward: true,
        right: true,
        ..Default::default()
    };

    let mut max_lateral_g: f32 = 0.0;
    for _ in 0..120 {
        let output = step_sim(&mut engine, &mut state, &steer_throttle);
        max_lateral_g = max_lateral_g.max(output.lateral_g.abs());
    }

    assert!(
        max_lateral_g > 0.1,
        "Lateral G under steering should be > 0.1G, got {:.2}G",
        max_lateral_g
    );
    assert!(
        max_lateral_g < 11.0,
        "Lateral G should stay within engine clamp range, got {:.2}G",
        max_lateral_g
    );
}

#[test]
fn test_tire_wear_increases_over_laps() {
    let mut engine = make_engine();
    let mut state = SimState::new();

    let initial_wear = engine.get_tire_wear();

    for frame in 0..1000 {
        let input = if frame % 200 < 100 {
            CarInput {
                forward: true,
                right: true,
                ..Default::default()
            }
        } else {
            CarInput {
                forward: true,
                left: true,
                ..Default::default()
            }
        };
        step_sim(&mut engine, &mut state, &input);
    }

    let final_wear = engine.get_tire_wear();

    assert!(
        final_wear > initial_wear,
        "Tire wear should increase after aggressive driving: initial={:.4}, final={:.4}",
        initial_wear,
        final_wear
    );
    assert!(
        final_wear < 0.5,
        "Tire wear should not exceed 0.5 after ~17s of driving, got {:.4}",
        final_wear
    );
}

#[test]
fn test_rain_reduces_grip() {
    let mut engine_dry = make_engine();
    let mut state_dry = SimState::new();
    let input = throttle_input();

    for _ in 0..120 {
        step_sim(&mut engine_dry, &mut state_dry, &input);
    }
    let dry_grip = engine_dry.get_effective_grip();

    let mut engine_rain = make_engine();
    engine_rain.set_custom_weather(15.0, 0.9, 1.0);
    for _ in 0..5 {
        engine_rain.step(
            DT,
            CarInput::default(),
            ORIGIN,
            IDENTITY_QUAT,
            ZERO_VEL,
            ZERO_VEL,
            [0.0, 1.0, 0.0],
        );
    }
    let mut state_rain = SimState::new();

    for _ in 0..120 {
        step_sim(&mut engine_rain, &mut state_rain, &input);
    }
    let rain_grip = engine_rain.get_effective_grip();

    assert!(
        rain_grip < dry_grip,
        "Rain grip ({:.3}) should be less than dry grip ({:.3})",
        rain_grip,
        dry_grip
    );
}

#[test]
fn test_speed_capped_by_max_speed() {
    let mut engine = make_engine();
    let mut state = SimState::new();
    let input = throttle_input();

    let mut max_speed_seen: f32 = 0.0;
    for _ in 0..600 {
        step_sim(&mut engine, &mut state, &input);
        max_speed_seen = max_speed_seen.max(state.speed_kmh());
    }

    assert!(
        max_speed_seen > 200.0,
        "Should reach significant speed after 10s of throttle, got {:.1} km/h",
        max_speed_seen
    );
    assert!(
        max_speed_seen < 320.0,
        "Speed should be capped below 320 km/h (BASE_MAX_SPEED=310), got {:.1} km/h",
        max_speed_seen
    );
}

#[test]
fn test_reverse_works() {
    let mut engine = make_engine();
    let mut state = SimState::new();
    let input = CarInput {
        backward: true,
        ..Default::default()
    };

    for _ in 0..120 {
        step_sim(&mut engine, &mut state, &input);
    }

    assert!(
        state.forward_speed() < -0.5,
        "After 2s of reverse, car should move backward (negative forward vel), got {:.2} m/s",
        state.forward_speed()
    );
}

#[test]
fn test_handbrake_induces_drift() {
    let mut engine = make_engine();
    let mut state = SimState::new();

    for _ in 0..120 {
        step_sim(&mut engine, &mut state, &throttle_input());
    }

    let speed = state.speed_ms();
    assert!(speed > 20.0, "Need speed for drift test, got {:.1} m/s", speed);

    let yaw_offset = 50.0_f32.to_radians();
    let half = yaw_offset * 0.5;
    state.rotation = [0.0, half.sin(), 0.0, half.cos()];

    let handbrake_steer = CarInput {
        forward: true,
        handbrake: true,
        right: true,
        ..Default::default()
    };

    let mut drift_detected = false;
    let mut max_slip: f32 = 0.0;
    for _ in 0..120 {
        let output = step_sim(&mut engine, &mut state, &handbrake_steer);
        max_slip = max_slip.max(output.slip_angle.abs());
        if output.is_drifting {
            drift_detected = true;
            break;
        }
    }

    assert!(
        drift_detected,
        "Handbrake with heading offset should trigger drift (max slip={:.1}°, threshold=15°)",
        max_slip
    );
}
