use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::types::{CarInput, CarPhysicsOutput};

const FIXED_DT: f32 = 1.0 / 120.0;
const SOAK_STEPS: usize = 10_000;

struct XorShift32 {
    state: u32,
}

impl XorShift32 {
    fn new(seed: u32) -> Self {
        let s = if seed == 0 { 0xDEAD_BEEF } else { seed };
        Self { state: s }
    }

    fn next_u32(&mut self) -> u32 {
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.state = x;
        x
    }

    fn unit_f32(&mut self) -> f32 {
        (self.next_u32() >> 8) as f32 / ((1u32 << 24) as f32)
    }

    fn signed_f32(&mut self) -> f32 {
        self.unit_f32() * 2.0 - 1.0
    }

    fn bool_with_prob(&mut self, p: f32) -> bool {
        self.unit_f32() < p
    }
}

fn assert_output_finite(output: &CarPhysicsOutput, frame: usize, tag: &str) {
    let checks: [(&str, f32); 8] = [
        ("speed_kmh", output.speed_kmh),
        ("forward_speed_ms", output.forward_speed_ms),
        ("slip_angle", output.slip_angle),
        ("effective_grip", output.effective_grip),
        ("lateral_g", output.lateral_g),
        ("longitudinal_g", output.longitudinal_g),
        ("skid_intensity", output.skid_intensity),
        ("steer_angle", output.steer_angle),
    ];
    for (name, v) in checks {
        assert!(
            v.is_finite(),
            "{tag}: {name} not finite at frame {frame} (got {v})",
        );
    }
    for (i, v) in output.linear_velocity.iter().enumerate() {
        assert!(
            v.is_finite(),
            "{tag}: linear_velocity[{i}] not finite at frame {frame} (got {v})",
        );
    }
    for (i, v) in output.angular_velocity.iter().enumerate() {
        assert!(
            v.is_finite(),
            "{tag}: angular_velocity[{i}] not finite at frame {frame} (got {v})",
        );
    }
}

fn build_input(rng: &mut XorShift32) -> CarInput {
    CarInput {
        forward: rng.bool_with_prob(0.55),
        backward: rng.bool_with_prob(0.05),
        left: rng.bool_with_prob(0.20),
        right: rng.bool_with_prob(0.20),
        brake: rng.bool_with_prob(0.15),
        handbrake: rng.bool_with_prob(0.02),
        steer: rng.signed_f32(),
        throttle: rng.unit_f32(),
        brake_analog: rng.unit_f32() * if rng.bool_with_prob(0.2) { 1.0 } else { 0.0 },
    }
}

fn pick_dt(rng: &mut XorShift32) -> f32 {
    let r = rng.unit_f32();
    if r < 0.02 {
        0.0
    } else if r < 0.05 {
        0.05
    } else {
        FIXED_DT
    }
}

fn pick_surface_normal(rng: &mut XorShift32) -> [f32; 3] {
    if rng.bool_with_prob(0.05) {
        [0.0, 0.0, 1.0]
    } else if rng.bool_with_prob(0.10) {
        let tilt = rng.signed_f32() * 0.30;
        let nx = tilt;
        let nz = tilt * 0.5;
        let ny = (1.0 - nx * nx - nz * nz).max(0.01).sqrt();
        [nx, ny, nz]
    } else {
        [0.0, 1.0, 0.0]
    }
}

#[test]
fn soak_step_handles_10k_adversarial_steps() {
    let mut engine = PhysicsEngine::new();
    let mut rng = XorShift32::new(0xA5A5_1234);

    let mut linvel = [0.0_f32; 3];
    let mut angvel = [0.0_f32; 3];
    let position = [0.0_f32, 1.0, 0.0];
    let rotation = [0.0_f32, 0.0, 0.0, 1.0];

    for frame in 0..SOAK_STEPS {
        let dt = pick_dt(&mut rng);
        let input = build_input(&mut rng);
        let surface_normal = pick_surface_normal(&mut rng);

        let output = engine.step(dt, input, position, rotation, linvel, angvel, surface_normal);
        assert_output_finite(&output, frame, "step");

        linvel = output.linear_velocity;
        angvel = output.angular_velocity;

        let lin_mag = (linvel[0] * linvel[0] + linvel[1] * linvel[1] + linvel[2] * linvel[2]).sqrt();
        assert!(
            lin_mag < 500.0,
            "linear velocity blow-up at frame {frame}: |v|={lin_mag}"
        );
    }
}

#[test]
fn soak_step_and_sync_handles_10k_adversarial_steps() {
    let mut engine = PhysicsEngine::new();
    let mut rng = XorShift32::new(0x5A5A_4321);

    let mut linvel = [0.0_f32; 3];
    let mut angvel = [0.0_f32; 3];
    let position = [0.0_f32, 1.0, 0.0];
    let rotation = [0.0_f32, 0.0, 0.0, 1.0];

    for frame in 0..SOAK_STEPS {
        let dt = pick_dt(&mut rng);
        let input = build_input(&mut rng);
        let surface_normal = pick_surface_normal(&mut rng);

        let bundle =
            engine.step_and_sync(dt, input, position, rotation, linvel, angvel, surface_normal);
        assert_output_finite(&bundle.physics, frame, "step_and_sync");

        assert!(
            bundle.world_downforce[0].is_finite()
                && bundle.world_downforce[1].is_finite()
                && bundle.world_downforce[2].is_finite(),
            "world_downforce not finite at frame {frame}: {:?}",
            bundle.world_downforce
        );
        assert!(
            bundle.brake_fade.is_finite(),
            "brake_fade not finite at frame {frame}: {}",
            bundle.brake_fade
        );

        linvel = bundle.physics.linear_velocity;
        angvel = bundle.physics.angular_velocity;
    }
}
