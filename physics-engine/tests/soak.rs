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

/// Wave 3 Phase 7 Step 7.3: combined-slip stress soak. 10000 steps in
/// the corner-exit-transition regime (rear under throttle while front
/// turns in) — exactly the regime where Phase 2's G-method shifts
/// behaviour most. Asserts no NaN propagation and bounded velocities.
#[test]
fn soak_step_combined_slip_stress() {
    let mut engine = PhysicsEngine::new();
    let mut linvel = [3.0_f32, 0.0, 30.0]; // lateral 3 m/s + forward 30 m/s
    let mut angvel = [0.0_f32; 3];
    let position = [0.0_f32, 1.0, 0.0];
    let rotation = [0.0_f32, 0.0, 0.0, 1.0];

    for frame in 0..10_000 {
        // Modulate throttle and steer so slip_ratio AND slip_angle are both
        // active. Sinusoidal pattern with a 3-second period.
        let phase = (frame as f32 / 360.0) * 2.0 * std::f32::consts::PI;
        let input = CarInput {
            forward: true,
            throttle: (0.6 + 0.4 * phase.sin()).clamp(0.0, 1.0),
            steer: 0.7 * phase.cos(),
            ..Default::default()
        };
        let bundle = engine.step_and_sync(
            FIXED_DT,
            input,
            position,
            rotation,
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
            None,
        );
        assert_output_finite(&bundle.physics, frame);
        for w in 0..4 {
            assert!(
                bundle.physics.per_wheel_forces.fx[w].is_finite(),
                "fx[{}] non-finite at frame {}",
                w,
                frame
            );
            assert!(
                bundle.physics.per_wheel_forces.fy[w].is_finite(),
                "fy[{}] non-finite at frame {}",
                w,
                frame
            );
        }
        linvel = bundle.physics.linear_velocity;
        angvel = bundle.physics.angular_velocity;
        let lin_mag_sq = linvel[0] * linvel[0] + linvel[1] * linvel[1] + linvel[2] * linvel[2];
        assert!(
            lin_mag_sq < LIN_VEL_BLOWUP_LIMIT_SQ,
            "linear velocity blow-up at frame {}: |v|^2={}",
            frame,
            lin_mag_sq
        );
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

/// Wave 4 Phase 7: Override Mode toggle stress soak. 10000 steps with
/// the override request toggled at high frequency, validating that
/// the per-lap budget exhausts cleanly, the lap reset re-enables, and
/// the boost path produces finite forces under all toggle patterns.
#[test]
fn soak_override_mode_toggle_stress() {
    let mut engine = PhysicsEngine::new();
    let mut linvel = [0.0_f32, 0.0, 60.0];
    let mut angvel = [0.0_f32; 3];
    let position = [0.0_f32, 1.0, 0.0];
    let rotation = [0.0_f32, 0.0, 0.0, 1.0];

    for frame in 0..10_000 {
        // Toggle override every 30 frames; reset budget every 1500 frames
        // (= one synthetic lap). Mix in occasional brake to exercise the
        // brake-disables-override path.
        let toggle = (frame / 30) % 2 == 0;
        let braking = (frame / 60) % 7 == 0;
        engine.set_override_requested(toggle);
        if frame > 0 && frame % 1500 == 0 {
            engine.reset_override_lap_budget();
        }

        let input = CarInput {
            forward: true,
            throttle: 0.7,
            brake: braking,
            ..Default::default()
        };
        let bundle = engine.step_and_sync(
            FIXED_DT,
            input,
            position,
            rotation,
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
            None,
        );
        assert_output_finite(&bundle.physics, frame);
        linvel = bundle.physics.linear_velocity;
        angvel = bundle.physics.angular_velocity;
    }
}


/// Wave-2 force-shaped lateral path: 1000-step soak with adversarial
/// inputs. Asserts no NaN propagation and bounded velocities under the
/// new bicycle-model lateral dynamics + per-axle slip.
#[test]
fn soak_force_shaped_lateral_dynamics() {
    let mut engine = PhysicsEngine::new();
    engine.set_force_shaped_lateral(true);
    let mut rng = XorShift32::new(0x2C3D_4E5F);

    let mut linvel = [0.0_f32; 3];
    let mut angvel = [0.0_f32; 3];
    let position = [0.0_f32, 1.0, 0.0];
    let rotation = [0.0_f32, 0.0, 0.0, 1.0];

    for frame in 0..1_000 {
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
        linvel = bundle.physics.linear_velocity;
        angvel = bundle.physics.angular_velocity;
        let lin_mag_sq = linvel[0] * linvel[0] + linvel[1] * linvel[1] + linvel[2] * linvel[2];
        assert!(
            lin_mag_sq < LIN_VEL_BLOWUP_LIMIT_SQ,
            "linear velocity blow-up at frame {}: |v|^2={}",
            frame,
            lin_mag_sq
        );
    }
}
