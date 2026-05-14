#![cfg(feature = "headless")]

#[path = "../bin/ai_runner/track_loader.rs"]
mod track_loader;

use track_loader::{load_track, spawn_pose, CheckpointKind, RaceDirection};

#[test]
fn load_silverstone_succeeds() {
    let track = load_track("silverstone").expect("silverstone must load");
    assert_eq!(track.id, "f1_silverstone_circuit");
    assert!(
        track.polyline.points.len() > 5000,
        "expected dense polyline; got {}",
        track.polyline.points.len()
    );
    assert_eq!(track.start_finish.kind, CheckpointKind::StartFinish);
    assert!(
        track.start_finish.polyline_index < track.polyline.points.len(),
        "start_finish index {} out of bounds (len={})",
        track.start_finish.polyline_index,
        track.polyline.points.len(),
    );
    assert_eq!(track.race_direction, RaceDirection::Backward);
    assert!(
        !track.sector_checkpoints.is_empty(),
        "silverstone has sector checkpoints"
    );
}

#[test]
fn unknown_track_errors() {
    let err = load_track("nope").unwrap_err();
    assert!(err.contains("unknown track"), "got: {err}");
}

#[test]
fn spawn_pose_is_finite_and_oriented() {
    let track = load_track("silverstone").unwrap();
    let (pos, rot, fwd) = spawn_pose(&track);
    for v in pos.iter().chain(rot.iter()).chain(fwd.iter()) {
        assert!(v.is_finite(), "non-finite spawn component: {v}");
    }
    let fwd_len = (fwd[0] * fwd[0] + fwd[1] * fwd[1]).sqrt();
    assert!(
        (fwd_len - 1.0).abs() < 1e-3,
        "forward vector not unit length: {fwd_len}"
    );
    let quat_len = (rot[0].powi(2) + rot[1].powi(2) + rot[2].powi(2) + rot[3].powi(2)).sqrt();
    assert!(
        (quat_len - 1.0).abs() < 1e-3,
        "spawn quat not unit: {quat_len}"
    );
    assert!(
        pos[0].abs() + pos[2].abs() > 1.0,
        "spawn position trivially zero — likely not derived from start-finish"
    );
}
