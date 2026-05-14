#![cfg(feature = "headless")]

use car_physics_engine::track_geometry::{
    sample_path, sample_track_source, Anchor, AnchorSlot, HandleType, Path, Point, TrackSource,
};
use serde::Deserialize;

const SILVERSTONE_SRC: &[u8] =
    include_bytes!("../../apps/game/src/constants/tracks/sources/silverstone.json");
const SILVERSTONE_FIXTURE: &str = include_str!("fixtures/silverstone.ribbon.json");

const PARITY_EPS: f32 = 1e-5;

fn corner(id: &str, x: f32, y: f32) -> Anchor {
    Anchor {
        id: id.to_string(),
        point: Point { x, y },
        in_handle: Point { x, y },
        out_handle: Point { x, y },
        handle_type: HandleType::Corner,
    }
}

fn anchor_slot(a: Anchor) -> AnchorSlot {
    AnchorSlot::Inline(a)
}

#[test]
fn closed_square_samples_have_monotonic_arc_and_dedup_seam() {
    let path = Path {
        id: "square".to_string(),
        anchors: vec![
            anchor_slot(corner("a", 0.0, 0.0)),
            anchor_slot(corner("b", 100.0, 0.0)),
            anchor_slot(corner("c", 100.0, 100.0)),
            anchor_slot(corner("d", 0.0, 100.0)),
        ],
        closed: true,
        pit_lane_segments: Vec::new(),
    };
    let all = vec![path.clone()];
    let polyline = sample_path(&path, &all).expect("expected polyline");

    assert!(polyline.closed);
    assert!(polyline.points.len() >= 4);
    assert_eq!(polyline.points.len(), polyline.cumulative_arc.len());
    assert!((polyline.cumulative_arc[0] - 0.0).abs() < 1e-6);
    for i in 1..polyline.cumulative_arc.len() {
        assert!(
            polyline.cumulative_arc[i] >= polyline.cumulative_arc[i - 1] - 1e-5,
            "cumulative_arc must be non-decreasing at {i}",
        );
    }

    let last = polyline.points.last().expect("non-empty");
    let first = polyline.points[0];
    let seam = ((first[0] - last[0]).powi(2) + (first[1] - last[1]).powi(2)).sqrt();
    assert!(seam >= 0.6, "seam dedup should leave a gap >= 0.6 m, got {seam}");

    let total = polyline.cumulative_arc[polyline.cumulative_arc.len() - 1];
    assert!(total > 300.0 && total < 400.0, "perimeter ~ <400 m, got {total}");
}

#[test]
fn open_path_with_two_anchors_produces_at_least_two_points() {
    let path = Path {
        id: "line".to_string(),
        anchors: vec![
            anchor_slot(corner("a", 0.0, 0.0)),
            anchor_slot(corner("b", 50.0, 0.0)),
        ],
        closed: false,
        pit_lane_segments: Vec::new(),
    };
    let all = vec![path.clone()];
    let polyline = sample_path(&path, &all).expect("polyline");
    assert!(!polyline.closed);
    assert!(polyline.points.len() >= 2);
    let arc = polyline.cumulative_arc[polyline.cumulative_arc.len() - 1];
    assert!((arc - 50.0).abs() < 1e-3, "expected 50 m straight, got {arc}");
}

#[test]
fn single_anchor_path_returns_none() {
    let path = Path {
        id: "stub".to_string(),
        anchors: vec![anchor_slot(corner("a", 0.0, 0.0))],
        closed: false,
        pit_lane_segments: Vec::new(),
    };
    let all = vec![path.clone()];
    assert!(sample_path(&path, &all).is_none());
}

#[derive(Debug, Deserialize)]
struct FixturePolyline {
    path_id: String,
    closed: bool,
    points: Vec<[f32; 2]>,
    cumulative_arc: Vec<f32>,
}

#[derive(Debug, Deserialize)]
struct Fixture {
    polylines: Vec<FixturePolyline>,
}

#[test]
fn silverstone_polylines_match_ts_fixture_within_epsilon() {
    let src: TrackSource =
        serde_json::from_slice(SILVERSTONE_SRC).expect("parse silverstone.json");
    let actual = sample_track_source(&src, 1.0);

    let fixture: Fixture =
        serde_json::from_str(SILVERSTONE_FIXTURE).expect("parse silverstone.ribbon.json");

    assert_eq!(
        actual.len(),
        fixture.polylines.len(),
        "polyline count mismatch",
    );

    for (i, (got, want)) in actual.iter().zip(fixture.polylines.iter()).enumerate() {
        assert_eq!(got.closed, want.closed, "closed flag mismatch at polyline {i}");
        assert_eq!(
            got.points.len(),
            want.points.len(),
            "point count mismatch at polyline {i} (path_id={})",
            want.path_id,
        );
        assert_eq!(got.cumulative_arc.len(), want.cumulative_arc.len());

        for (j, (g, w)) in got.points.iter().zip(want.points.iter()).enumerate() {
            let dx = (g[0] - w[0]).abs();
            let dy = (g[1] - w[1]).abs();
            assert!(
                dx < PARITY_EPS && dy < PARITY_EPS,
                "point[{j}] drift at polyline {i}: rust=({:.7},{:.7}) ts=({:.7},{:.7}) dx={dx} dy={dy}",
                g[0],
                g[1],
                w[0],
                w[1],
            );
        }
        for (j, (g, w)) in got
            .cumulative_arc
            .iter()
            .zip(want.cumulative_arc.iter())
            .enumerate()
        {
            assert!(
                (g - w).abs() <= (1e-3_f32).max(w.abs() * 1e-5),
                "cumulative_arc[{j}] drift at polyline {i}: rust={g} ts={w}",
            );
        }
    }
}
