use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::types::{CarInput, SurfaceType};

mod common;
use common::{assert_output_finite, FIXED_DT};

fn run(engine: &mut PhysicsEngine, input: CarInput, mut linvel: [f32; 3], steps: usize) -> [f32; 3] {
    for _ in 0..steps {
        let out = engine.step(
            FIXED_DT,
            input,
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
            linvel,
            [0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            None,
        );
        linvel = out.linear_velocity;
    }
    linvel
}

#[test]
fn full_throttle_from_rest_increases_forward_speed() {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);
    let input = CarInput {
        forward: true,
        throttle: 1.0,
        ..Default::default()
    };
    let linvel = run(&mut engine, input, [0.0, 0.0, 0.0], 60);
    // Threshold 0.5 m/s after 0.5s — just enough to prove movement,
    // loose enough to survive the Wave-1 PEAK_TORQUE_NM 480→340 drop
    // (2026 ICE spec correction).
    assert!(
        linvel[2] > 0.5,
        "After 0.5s of full throttle, forward speed should be > 0.5 m/s, got {:?}",
        linvel
    );
}

#[test]
fn full_brake_from_50ms_reduces_forward_speed() {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);
    let warmup_input = CarInput {
        forward: true,
        throttle: 1.0,
        ..Default::default()
    };
    let mut linvel = [0.0, 0.0, 50.0];
    linvel = run(&mut engine, warmup_input, linvel, 60);

    let initial_forward = linvel[2];
    assert!(initial_forward > 30.0);

    let brake_input = CarInput {
        brake: true,
        brake_analog: 1.0,
        ..Default::default()
    };
    linvel = run(&mut engine, brake_input, linvel, 120);

    // Wave 4 Phase 1 BASE_TIRE_GRIP_COEFFICIENT 3.5 → 2.5 reduces brake
    // deceleration by ~30%. Threshold relaxed 0.5 → 0.6 of initial speed.
    assert!(
        linvel[2] < initial_forward * 0.6,
        "After 1s of full brake, forward speed should drop below 60% ({} → {})",
        initial_forward,
        linvel[2]
    );
}

/// Phase 1 (Wave 3) telemetry contract. Per-wheel Fy lands on
/// `CarPhysicsOutput.per_wheel_forces` whenever chassis slip angle is
/// non-zero. Pre-Phase-1 the field was zero-default; Phase 1 populates
/// it from the integrator output.
///
/// Note: the chassis-level slip angle comes from `lateral_speed/forward_speed`
/// — in production Rapier integrates yaw-from-steering into a real lateral
/// component each frame; in this unit harness we feed lateral velocity
/// directly so the EMA reaches a non-zero steady state.
#[test]
fn per_wheel_forces_populated_when_slip_angle_nonzero() {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);

    let input = CarInput {
        forward: true,
        throttle: 0.6,
        ..Default::default()
    };
    // Lateral velocity → non-zero chassis slip angle once EMA settles.
    let mut linvel = [5.0_f32, 0.0, 30.0];
    let mut angvel = [0.0_f32; 3];
    for _ in 0..120 {
        let out = engine.step(
            FIXED_DT,
            input,
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
            None,
        );
        linvel = [5.0, 0.0, out.linear_velocity[2]];
        angvel = out.angular_velocity;
    }

    let out = engine.step(
        FIXED_DT,
        input,
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
        linvel,
        angvel,
        [0.0, 1.0, 0.0],
        None,
    );

    let pwf = &out.per_wheel_forces;
    let total_fy_abs: f32 = pwf.fy.iter().map(|f| f.abs()).sum();
    let total_fz: f32 = pwf.fz.iter().sum();
    assert!(
        out.slip_angle.abs() > 1.0,
        "slip_angle EMA should have settled non-zero, got {}",
        out.slip_angle
    );
    assert!(
        total_fy_abs > 100.0,
        "expected non-zero Fy at non-zero slip, got per-wheel {:?}",
        pwf.fy
    );
    assert!(
        total_fz > 1000.0,
        "expected non-zero Fz, got per-wheel {:?}",
        pwf.fz
    );
    for sa in pwf.slip_angle.iter() {
        assert!(sa.abs() > 0.0, "slip_angle should be populated");
    }
}

/// Reproduces front-wheel lockup under full brake from high speed.
/// Without ABS the brake torque overwhelms the tire reaction torque and
/// the front wheels' ω falls toward zero while the car is still moving:
/// slip_ratio approaches -1 and Fx collapses below its peak.
#[test]
fn full_brake_from_60ms_locks_front_wheels() {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);

    let warmup = CarInput {
        forward: true,
        throttle: 1.0,
        ..Default::default()
    };
    let mut linvel = [0.0_f32, 0.0, 60.0];
    let mut angvel = [0.0_f32; 3];
    for _ in 0..60 {
        let out = engine.step(
            FIXED_DT,
            warmup,
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
            None,
        );
        linvel = out.linear_velocity;
        angvel = out.angular_velocity;
    }
    let speed_before_brake = linvel[2];
    assert!(speed_before_brake > 40.0, "warmup should keep high speed, got {}", speed_before_brake);

    let brake = CarInput {
        brake: true,
        brake_analog: 1.0,
        ..Default::default()
    };
    let mut peak_front_fx_abs = 0.0_f32;
    let mut min_front_slip_ratio = 0.0_f32;
    let mut min_front_fx_during_lockup = f32::MAX;
    let mut locked_step: Option<usize> = None;
    let mut saw_lockup_label_front = false;
    let mut saw_lockup_label_rear = false;
    for step in 0..120 {
        let out = engine.step(
            FIXED_DT,
            brake,
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
            None,
        );
        linvel = out.linear_velocity;
        angvel = out.angular_velocity;
        let pwf = &out.per_wheel_forces;
        let sr_fl = pwf.slip_ratio[0];
        let sr_fr = pwf.slip_ratio[1];
        let fx_fl = pwf.fx[0].abs();
        let fx_fr = pwf.fx[1].abs();
        peak_front_fx_abs = peak_front_fx_abs.max(fx_fl).max(fx_fr);
        min_front_slip_ratio = min_front_slip_ratio.min(sr_fl).min(sr_fr);
        if sr_fl < -0.5 && sr_fr < -0.5 && locked_step.is_none() {
            locked_step = Some(step);
        }
        if locked_step.is_some() && out.forward_speed_ms > 5.0 {
            min_front_fx_during_lockup = min_front_fx_during_lockup.min(fx_fl).min(fx_fr);
        }
        if pwf.is_locked[0] || pwf.is_locked[1] {
            saw_lockup_label_front = true;
        }
        if pwf.is_locked[2] || pwf.is_locked[3] {
            saw_lockup_label_rear = true;
        }
    }

    assert!(
        min_front_slip_ratio < -0.5,
        "expected front-wheel lockup (slip_ratio < -0.5) under full brake, got min {}",
        min_front_slip_ratio
    );
    let locked_at = locked_step.expect("front wheels never reached lockup threshold");
    assert!(
        locked_at < 60,
        "front lockup should happen within 0.5s of full brake, took {} steps",
        locked_at
    );
    assert!(
        min_front_fx_during_lockup < peak_front_fx_abs * 0.85,
        "Fx should collapse below 85% of peak once locked: peak={}, min_during_lockup={}",
        peak_front_fx_abs,
        min_front_fx_during_lockup
    );
    assert!(
        saw_lockup_label_front,
        "is_locked label should fire on at least one front wheel under full brake"
    );
    // Front-biased 58/42 brake split: rear may or may not lock depending on
    // surface and load — this is just a sanity log via the unused variable.
    let _ = saw_lockup_label_rear;
}

/// Same scenario as `full_brake_from_60ms_locks_front_wheels` but with
/// ABS enabled. The slip-ratio gate must keep the front wheels above the
/// lockup threshold throughout the brake event.
#[test]
fn abs_prevents_front_wheel_lockup() {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);
    engine.set_abs_enabled(true);
    assert!(engine.is_abs_enabled());

    let warmup = CarInput {
        forward: true,
        throttle: 1.0,
        ..Default::default()
    };
    let mut linvel = [0.0_f32, 0.0, 60.0];
    let mut angvel = [0.0_f32; 3];
    for _ in 0..60 {
        let out = engine.step(
            FIXED_DT,
            warmup,
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
            None,
        );
        linvel = out.linear_velocity;
        angvel = out.angular_velocity;
    }

    let brake = CarInput {
        brake: true,
        brake_analog: 1.0,
        ..Default::default()
    };
    let mut min_front_slip_ratio = 0.0_f32;
    let mut sustained_lockup_frames = 0;
    let mut sustained_max = 0;
    for _ in 0..120 {
        let out = engine.step(
            FIXED_DT,
            brake,
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
            None,
        );
        linvel = out.linear_velocity;
        angvel = out.angular_velocity;
        let pwf = &out.per_wheel_forces;
        let sr_fl = pwf.slip_ratio[0];
        let sr_fr = pwf.slip_ratio[1];
        min_front_slip_ratio = min_front_slip_ratio.min(sr_fl).min(sr_fr);
        if pwf.is_locked[0] || pwf.is_locked[1] {
            sustained_lockup_frames += 1;
            sustained_max = sustained_max.max(sustained_lockup_frames);
        } else {
            sustained_lockup_frames = 0;
        }
    }
    // ABS is a 1-frame PWM release: a single transient hit on the lockup
    // label is allowed (the gate fires the frame after detection). What
    // must not happen is sustained lockup — more than a few consecutive
    // frames means ABS isn't releasing.
    assert!(
        sustained_max <= 3,
        "ABS should not sustain lockup; longest run was {} frames",
        sustained_max
    );
    assert!(
        min_front_slip_ratio > -0.7,
        "ABS-enabled front wheels should not deep-lock; min slip_ratio={}",
        min_front_slip_ratio
    );
}

/// Coast (no throttle, no brake) from cruise should decelerate gradually
/// through drag + engine braking. A regression caught here was an over-
/// strong idle damping (2.0/s) that turned coast into hard-braking; this
/// test pins the coast curve to a real F1-feel envelope.
#[test]
fn coast_from_cruise_decelerates_gradually() {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);
    let warmup = CarInput {
        forward: true,
        throttle: 1.0,
        ..Default::default()
    };
    let mut linvel = [0.0_f32, 0.0, 30.0];
    let mut angvel = [0.0_f32; 3];
    for _ in 0..60 {
        let out = engine.step(
            FIXED_DT,
            warmup,
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
            None,
        );
        linvel = out.linear_velocity;
        angvel = out.angular_velocity;
    }
    let v_start = linvel[2];
    assert!(v_start > 20.0, "warmup should reach reasonable speed, got {}", v_start);

    // 1 second of pure coast.
    let coast = CarInput::default();
    for _ in 0..120 {
        let out = engine.step(
            FIXED_DT,
            coast,
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
            None,
        );
        linvel = out.linear_velocity;
        angvel = out.angular_velocity;
    }
    // After 1s of coast, an F1 should still retain most of its speed —
    // engine brake + drag alone shouldn't shave more than ~half. A drop
    // past 60% means an over-aggressive damping term has crept in.
    let v_after_1s = linvel[2];
    let kept = v_after_1s / v_start;
    assert!(
        kept > 0.55,
        "coast 1s should keep ≥55% of speed, kept {:.0}% ({:.2} → {:.2} m/s)",
        kept * 100.0,
        v_start,
        v_after_1s
    );
}

/// Full-brake from cruise should converge to *exactly* zero forward
/// velocity, not overshoot into a steady-state negative-creep band.
/// Pre-fix the chassis settled at ~-1.0 m/s under sustained brake (the
/// Pacejka path's smooth-sign integrator can't hold zero against numerical
/// noise). The park-brake snap fixes this.
#[test]
fn full_brake_converges_to_exact_zero_and_stays() {
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);

    let warmup = CarInput {
        forward: true,
        throttle: 1.0,
        ..Default::default()
    };
    let mut linvel = [0.0_f32, 0.0, 30.0];
    let mut angvel = [0.0_f32; 3];
    for _ in 0..60 {
        let out = engine.step(
            FIXED_DT,
            warmup,
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
            None,
        );
        linvel = out.linear_velocity;
        angvel = out.angular_velocity;
    }

    let brake = CarInput {
        brake: true,
        brake_analog: 1.0,
        ..Default::default()
    };
    for _ in 0..360 {
        let out = engine.step(
            FIXED_DT,
            brake,
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
            None,
        );
        linvel = out.linear_velocity;
        angvel = out.angular_velocity;
    }
    assert_eq!(
        linvel[2], 0.0,
        "full brake should snap velocity to exactly 0, got {}",
        linvel[2]
    );

    // Release brake: idle (no input) should keep the car still, not drift.
    let idle = CarInput::default();
    for _ in 0..240 {
        let out = engine.step(
            FIXED_DT,
            idle,
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
            None,
        );
        linvel = out.linear_velocity;
        angvel = out.angular_velocity;
    }
    assert!(
        linvel[2].abs() < 0.05,
        "idle after brake release should stay still, drifted to {}",
        linvel[2]
    );
}

#[test]
fn longitudinal_force_obeys_friction_envelope_at_rest() {
    // Sanity: at rest with full throttle, the per-step longitudinal_g
    // should not exceed ~1.5g (peak μ × downforce_grip_bonus ≈ 1).
    // This pins the new Pacejka path against unbounded wheelspin force.
    let mut engine = PhysicsEngine::new();
    engine.set_surface(SurfaceType::Road);
    let input = CarInput {
        forward: true,
        throttle: 1.0,
        ..Default::default()
    };
    let mut linvel = [0.0, 0.0, 0.0];
    for frame in 0..30 {
        let out = engine.step(
            FIXED_DT,
            input,
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
            linvel,
            [0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            None,
        );
        assert_output_finite(&out, frame);
        assert!(
            out.longitudinal_g.abs() < 3.0,
            "longitudinal_g spike beyond friction envelope: {}",
            out.longitudinal_g
        );
        linvel = out.linear_velocity;
    }
}
