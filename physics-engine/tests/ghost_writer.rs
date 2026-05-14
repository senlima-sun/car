#![cfg(feature = "headless")]
#![allow(dead_code, unused_imports, unused_variables)]

use std::env;
use std::fs;
use std::path::PathBuf;

#[path = "../bin/ai_runner/obs.rs"]
mod obs;

#[path = "../bin/ai_runner/policies/mod.rs"]
mod policies;

#[path = "../bin/ai_runner/sim.rs"]
mod sim;

#[path = "../bin/ai_runner/track_loader.rs"]
mod track_loader;

#[path = "../bin/ai_runner/ghost_writer.rs"]
mod ghost_writer;

use ghost_writer::{
    encode_ghost_meta_json, pack_ghost_bin, slug_from_track_id, subsample_telemetry,
    write_ghost_bin_atomic, write_ghost_meta_atomic, GhostMeta, GHOST_SCHEMA_VERSION,
    MAX_GHOST_SAMPLES,
};
use sim::TelemetryFrame;

fn make_frame(i: usize) -> TelemetryFrame {
    TelemetryFrame {
        t_s: (i as f32) / 120.0,
        x: i as f32 * 0.5,
        y: 0.5,
        z: i as f32 * -0.25,
        qx: 0.0,
        qy: (i as f32 * 0.001).sin(),
        qz: 0.0,
        qw: (i as f32 * 0.001).cos(),
        speed_kmh: 100.0 + i as f32 * 0.1,
        throttle: 0.5,
        brake: 0.0,
        steer: (i as f32 * 0.01).sin(),
        is_off_track: false,
        lateral_distance_m: 0.0,
        arc_length_m: i as f32 * 0.5,
    }
}

#[test]
fn synthetic_100_frame_round_trip_to_temp_files() {
    let pid = std::process::id();
    let bin_path = env::temp_dir().join(format!("ai-runner-rt-{pid}.ghost.bin"));
    let json_path = env::temp_dir().join(format!("ai-runner-rt-{pid}.ghost.json"));

    let frames: Vec<TelemetryFrame> = (0..100).map(make_frame).collect();
    let subs = subsample_telemetry(&frames, 6);
    assert_eq!(subs.len(), 17);

    write_ghost_bin_atomic(&bin_path, &subs).unwrap();

    let meta = GhostMeta {
        schema_version: GHOST_SCHEMA_VERSION,
        track_id: "f1_monza".into(),
        lap_time: 87.42,
        frame_count: subs.len() as u32,
        recorder_type: "ai_runner".into(),
        recorded_at: "2026-05-14T00:00:00Z".into(),
    };
    write_ghost_meta_atomic(&json_path, &meta).unwrap();

    let bytes = fs::read(&bin_path).unwrap();
    let n = u32::from_le_bytes(bytes[0..4].try_into().unwrap()) as usize;
    assert_eq!(n, 17);

    let f32_at = |offset: usize| -> f32 {
        f32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap())
    };

    let positions_off = 4;
    let rotations_off = positions_off + n * 3 * 4;
    let steer_off = rotations_off + n * 4 * 4;
    let wheels_off = steer_off + n * 4;
    let ts_off = wheels_off + n * 4 * 4;
    let total_len = ts_off + n * 4;

    assert_eq!(bytes.len(), total_len);

    for (j, f) in subs.iter().enumerate() {
        assert!((f32_at(positions_off + j * 12) - f.x).abs() < 1e-6);
        assert!((f32_at(positions_off + j * 12 + 4) - f.y).abs() < 1e-6);
        assert!((f32_at(positions_off + j * 12 + 8) - f.z).abs() < 1e-6);

        assert!((f32_at(rotations_off + j * 16) - f.qx).abs() < 1e-6);
        assert!((f32_at(rotations_off + j * 16 + 4) - f.qy).abs() < 1e-6);
        assert!((f32_at(rotations_off + j * 16 + 8) - f.qz).abs() < 1e-6);
        assert!((f32_at(rotations_off + j * 16 + 12) - f.qw).abs() < 1e-6);

        assert!((f32_at(steer_off + j * 4) - f.steer).abs() < 1e-6);

        for w in 0..4 {
            assert_eq!(f32_at(wheels_off + j * 16 + w * 4), 0.0);
        }

        let ts_expected_ms = f.t_s * 1000.0;
        assert!((f32_at(ts_off + j * 4) - ts_expected_ms).abs() < 1e-3);
    }

    let json = fs::read_to_string(&json_path).unwrap();
    assert!(json.contains("\"schemaVersion\": 1"));
    assert!(json.contains("\"trackId\": \"f1_monza\""));
    assert!(json.contains("\"recorderType\": \"ai_runner\""));
    assert!(json.contains("\"frameCount\": 17"));

    let _ = fs::remove_file(&bin_path);
    let _ = fs::remove_file(&json_path);
}

#[test]
fn slug_from_track_id_is_identity() {
    // Slug == track_id verbatim to match TS LoadAiGhostButton.resolveTrackSlug()
    // which returns the preset's raw `id` field. See Phase 4 review Critical #3.
    assert_eq!(slug_from_track_id("f1_monza"), "f1_monza");
    assert_eq!(slug_from_track_id("f1_silverstone_circuit"), "f1_silverstone_circuit");
}
