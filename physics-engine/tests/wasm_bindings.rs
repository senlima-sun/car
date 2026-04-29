use car_physics_engine::engine::PhysicsEngine;
use car_physics_engine::types::{CarInput, CarPhysicsOutput, StepAndSyncOutput};

mod common;
use common::FIXED_DT;

// `lib.rs::step_and_sync` deserializes each positional arg via
// `serde_wasm_bindgen::from_value` (a JsValue → typed-struct round-trip) and
// re-serializes the output via `to_value`. We can't exercise the JsValue path
// from `cargo test` without `wasm-pack test --node`, but the schema being
// round-trippable is the load-bearing property: if Phase 1 adds a `wheel_loads`
// arg or extends `CarInput`, the serde derive must remain consistent. This test
// uses `serde_json` (already in dev-deps) as a deterministic stand-in for the
// JsValue serializer — both go through the same `Serialize`/`Deserialize`
// derives — and verifies the engine produces a finite output bundle.

#[test]
fn ffi_inputs_roundtrip_through_serde() {
    let input_json = r#"{
        "forward": true,
        "backward": false,
        "left": false,
        "right": true,
        "brake": false,
        "handbrake": false,
        "steer": 0.25,
        "throttle": 0.8,
        "brake_analog": 0.0
    }"#;
    let input: CarInput = serde_json::from_str(input_json).expect("CarInput deserializes");

    let position: [f32; 3] = serde_json::from_str("[0.0, 1.0, 0.0]").unwrap();
    let rotation: [f32; 4] = serde_json::from_str("[0.0, 0.0, 0.0, 1.0]").unwrap();
    let linvel: [f32; 3] = serde_json::from_str("[10.0, 0.0, 0.0]").unwrap();
    let angvel: [f32; 3] = serde_json::from_str("[0.0, 0.0, 0.0]").unwrap();
    let surface_normal: [f32; 3] = serde_json::from_str("[0.0, 1.0, 0.0]").unwrap();

    let mut engine = PhysicsEngine::new();
    let bundle = engine.step_and_sync(
        FIXED_DT,
        input,
        position,
        rotation,
        linvel,
        angvel,
        surface_normal,
        None,
    );

    let serialized = serde_json::to_string(&bundle).expect("StepAndSyncOutput serializes");
    let _: StepAndSyncOutput =
        serde_json::from_str(&serialized).expect("StepAndSyncOutput round-trips");

    assert!(bundle.physics.speed_kmh.is_finite());
    assert!(bundle.physics.lateral_g.is_finite());
    assert!(bundle.world_downforce.iter().all(|v| v.is_finite()));
}

#[test]
fn missing_optional_input_fields_default_to_zero() {
    let input_json = r#"{
        "forward": true,
        "backward": false,
        "left": false,
        "right": false,
        "brake": false,
        "handbrake": false
    }"#;
    let input: CarInput = serde_json::from_str(input_json)
        .expect("CarInput deserializes with omitted optional fields");

    assert_eq!(input.steer, 0.0);
    assert_eq!(input.throttle, 0.0);
    assert_eq!(input.brake_analog, 0.0);
    assert!(input.forward);

    let mut engine = PhysicsEngine::new();
    let out: CarPhysicsOutput = engine.step(
        FIXED_DT,
        input,
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
        [0.0, 0.0, 0.0],
        [0.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        None,
    );
    assert!(out.speed_kmh.is_finite());
}

#[test]
fn output_schema_is_stable_for_js_consumers() {
    let mut engine = PhysicsEngine::new();
    let bundle = engine.step_and_sync(
        FIXED_DT,
        CarInput::default(),
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
        [0.0, 0.0, 0.0],
        [0.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        None,
    );

    let json = serde_json::to_value(&bundle).expect("StepAndSyncOutput → Value");
    let obj = json.as_object().expect("bundle is an object");

    for key in [
        "physics",
        "wind_state",
        "aero_state",
        "brake_state",
        "brake_disc_temps_celsius",
        "brake_fade",
        "input_throttle",
        "input_brake",
        "input_steer",
        "ambient",
        "world_downforce",
    ] {
        assert!(
            obj.contains_key(key),
            "StepAndSyncOutput missing top-level key `{key}` — JS consumers in PhysicsBridge.ts will break"
        );
    }

    let physics = obj.get("physics").and_then(|v| v.as_object()).unwrap();
    for key in [
        "linear_velocity",
        "angular_velocity",
        "speed_kmh",
        "forward_speed_ms",
        "gear",
        "rpm",
        "slip_angle",
        "effective_grip",
        "lateral_g",
        "longitudinal_g",
    ] {
        assert!(
            physics.contains_key(key),
            "CarPhysicsOutput missing key `{key}`"
        );
    }
}
