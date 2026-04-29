use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::types::CarInput;

mod common;
use common::{assert_output_finite, FIXED_DT};

const SOAK_SECONDS: usize = 600;
const SOAK_STEPS: usize = SOAK_SECONDS * 120;
const LIN_VEL_BLOWUP_LIMIT_MS: f32 = 500.0;
const LIN_VEL_BLOWUP_LIMIT_SQ: f32 = LIN_VEL_BLOWUP_LIMIT_MS * LIN_VEL_BLOWUP_LIMIT_MS;

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
        let nz = tilt * 0.5;
        let ny = (1.0 - tilt * tilt - nz * nz).max(0.01).sqrt();
        [tilt, ny, nz]
    } else {
        [0.0, 1.0, 0.0]
    }
}

#[test]
fn soak_step_handles_adversarial_steps() {
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

        let output = engine.step(
            dt,
            input,
            position,
            rotation,
            linvel,
            angvel,
            surface_normal,
            None,
        );
        assert_output_finite(&output, frame);

        linvel = output.linear_velocity;
        angvel = output.angular_velocity;

        let lin_mag_sq = linvel[0] * linvel[0] + linvel[1] * linvel[1] + linvel[2] * linvel[2];
        assert!(
            lin_mag_sq < LIN_VEL_BLOWUP_LIMIT_SQ,
            "linear velocity blow-up at frame {frame}: |v|^2={lin_mag_sq}"
        );
    }
}

#[test]
fn step_with_real_wheel_loads_produces_finite_output() {
    let mut engine = PhysicsEngine::new();
    let input = CarInput {
        forward: true,
        throttle: 0.5,
        ..Default::default()
    };
    let mut linvel = [0.0_f32, 0.0, 20.0];
    let mut angvel = [0.0_f32; 3];
    let position = [0.0_f32, 1.0, 0.0];
    let rotation = [0.0_f32, 0.0, 0.0, 1.0];
    let surface_normal = [0.0_f32, 1.0, 0.0];

    for frame in 0..240 {
        let nominal_corner = 750.0 * 9.81 * 0.25;
        let front_load_factor = 1.0 + 0.15 * (frame as f32 / 60.0).sin();
        let real_loads = [
            nominal_corner * front_load_factor,
            nominal_corner * front_load_factor,
            nominal_corner * (2.0 - front_load_factor),
            nominal_corner * (2.0 - front_load_factor),
        ];
        let out = engine.step(
            FIXED_DT,
            input,
            position,
            rotation,
            linvel,
            angvel,
            surface_normal,
            Some(real_loads),
        );
        assert_output_finite(&out, frame);
        linvel = out.linear_velocity;
        angvel = out.angular_velocity;
    }
}

#[test]
fn soak_step_and_sync_handles_adversarial_steps() {
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

        let bundle = engine.step_and_sync(
            dt,
            input,
            position,
            rotation,
            linvel,
            angvel,
            surface_normal,
            None,
        );
        assert_output_finite(&bundle.physics, frame);

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
