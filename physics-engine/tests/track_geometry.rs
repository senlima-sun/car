#![cfg(feature = "headless")]

use car_physics_engine::track_geometry::{
    check_off_track, nearest_centerline_full, nearest_centerline_windowed, sample_path,
    sample_track_source, wheel_world_positions, Anchor, AnchorSlot, HandleType, OffTrackState,
    Path, Point, Polyline, TrackSource,
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

const HALF_WIDTH: f32 = 6.0;
const WHEELBASE: f32 = 3.40;
const TRACK_WIDTH_FRONT: f32 = 1.9;
const TRACK_WIDTH_REAR: f32 = 1.8;
const ENTER_TH: f32 = 0.0;
const EXIT_TH: f32 = 0.3;

fn straight_z_polyline(length: f32, spacing: f32) -> Polyline {
    let n = (length / spacing).ceil() as usize + 1;
    let mut points = Vec::with_capacity(n);
    let mut cumulative_arc = Vec::with_capacity(n);
    for i in 0..n {
        let z = (i as f32) * spacing;
        points.push([0.0, z]);
        cumulative_arc.push(z);
    }
    Polyline {
        points,
        cumulative_arc,
        closed: false,
    }
}

fn yaw_quat(yaw: f32) -> [f32; 4] {
    let h = yaw * 0.5;
    [0.0, h.sin(), 0.0, h.cos()]
}

fn seed_state(pl: &Polyline, x: f32, z: f32) -> OffTrackState {
    let r = nearest_centerline_full(pl, x, z);
    OffTrackState {
        is_off_track: false,
        arc_cursor: r.nearest_index,
    }
}

#[test]
fn off_track_centered_car_is_on_track() {
    let pl = straight_z_polyline(200.0, 1.0);
    let q = yaw_quat(0.0);
    let state = seed_state(&pl, 0.0, 50.0);
    let result = check_off_track(
        &pl, 0.0, 50.0, q[0], q[1], q[2], q[3], HALF_WIDTH, ENTER_TH, EXIT_TH, WHEELBASE,
        TRACK_WIDTH_FRONT, TRACK_WIDTH_REAR, state,
    );
    assert!(!result.is_off_track, "centered car must be on-track");
    assert!(
        result.max_lateral_distance_m <= TRACK_WIDTH_FRONT * 0.5 + 1e-4,
        "max_lat should equal half_track_width when centered, got {}",
        result.max_lateral_distance_m,
    );
}

#[test]
fn off_track_all_wheels_outside_triggers_violation() {
    let pl = straight_z_polyline(200.0, 1.0);
    let q = yaw_quat(0.0);
    let state = seed_state(&pl, 12.0, 50.0);
    let car_x = 12.0;
    let result = check_off_track(
        &pl, car_x, 50.0, q[0], q[1], q[2], q[3], HALF_WIDTH, ENTER_TH, EXIT_TH, WHEELBASE,
        TRACK_WIDTH_FRONT, TRACK_WIDTH_REAR, state,
    );
    let min_wheel_x = car_x - TRACK_WIDTH_FRONT * 0.5;
    assert!(min_wheel_x > HALF_WIDTH, "test setup: inner wheel must be outside");
    assert!(result.is_off_track, "all 4 wheels out => off-track");
    assert!(
        (result.max_lateral_distance_m - (car_x + TRACK_WIDTH_FRONT * 0.5)).abs() < 1e-3,
        "max_lat should be outer wheel offset",
    );
}

#[test]
fn off_track_one_wheel_in_does_not_trigger() {
    let pl = straight_z_polyline(200.0, 1.0);
    let q = yaw_quat(0.0);
    let car_x = HALF_WIDTH + TRACK_WIDTH_FRONT * 0.5 - 0.5;
    let state = seed_state(&pl, car_x, 50.0);
    let result = check_off_track(
        &pl, car_x, 50.0, q[0], q[1], q[2], q[3], HALF_WIDTH, ENTER_TH, EXIT_TH, WHEELBASE,
        TRACK_WIDTH_FRONT, TRACK_WIDTH_REAR, state,
    );
    let inner = car_x - TRACK_WIDTH_FRONT * 0.5;
    assert!(inner < HALF_WIDTH, "test setup: inner wheel must still be inside");
    assert!(!result.is_off_track, "4-wheel rule: 1 wheel in => not off-track");
}

#[test]
fn off_track_only_xz_matters_not_y_height() {
    let mut pl = straight_z_polyline(200.0, 1.0);
    pl.points[10][0] = 0.0;
    pl.points[10][1] = 10.0;
    let q = yaw_quat(0.0);
    let state = seed_state(&pl, 0.0, 10.0);
    let r1 = check_off_track(
        &pl, 0.0, 10.0, q[0], q[1], q[2], q[3], HALF_WIDTH, ENTER_TH, EXIT_TH, WHEELBASE,
        TRACK_WIDTH_FRONT, TRACK_WIDTH_REAR, state,
    );
    let q2 = {
        let yaw: f32 = 0.001;
        let h = yaw * 0.5;
        [0.0, h.sin(), 0.0, h.cos()]
    };
    let r2 = check_off_track(
        &pl, 0.0, 10.0, q2[0], q2[1], q2[2], q2[3], HALF_WIDTH, ENTER_TH, EXIT_TH, WHEELBASE,
        TRACK_WIDTH_FRONT, TRACK_WIDTH_REAR, state,
    );
    assert!(!r1.is_off_track && !r2.is_off_track);
    assert!((r1.max_lateral_distance_m - r2.max_lateral_distance_m).abs() < 0.01);
}

#[test]
fn off_track_hysteresis_holds_state_in_dead_zone() {
    let pl = straight_z_polyline(400.0, 1.0);
    let q = yaw_quat(0.0);
    let mut state = seed_state(&pl, 0.0, 50.0);

    let step = |state_in: OffTrackState, lat: f32| -> (OffTrackState, bool) {
        let car_x = lat + TRACK_WIDTH_FRONT * 0.5;
        let r = check_off_track(
            &pl, car_x, 50.0, q[0], q[1], q[2], q[3], HALF_WIDTH, ENTER_TH, EXIT_TH, WHEELBASE,
            TRACK_WIDTH_FRONT, TRACK_WIDTH_REAR, state_in,
        );
        (
            OffTrackState {
                is_off_track: r.is_off_track,
                arc_cursor: r.arc_cursor,
            },
            r.is_off_track,
        )
    };

    let (s1, off1) = step(state, 0.0);
    state = s1;
    assert!(!off1, "starts on-track");

    let big_car_x = HALF_WIDTH + TRACK_WIDTH_FRONT * 0.5 + 0.05;
    let r = check_off_track(
        &pl, big_car_x, 50.0, q[0], q[1], q[2], q[3], HALF_WIDTH, ENTER_TH, EXIT_TH, WHEELBASE,
        TRACK_WIDTH_FRONT, TRACK_WIDTH_REAR, state,
    );
    state = OffTrackState {
        is_off_track: r.is_off_track,
        arc_cursor: r.arc_cursor,
    };
    assert!(r.is_off_track, "all 4 wheels just outside => enter off-track");

    let car_x_inside_dead = HALF_WIDTH + TRACK_WIDTH_FRONT * 0.5 - 0.1;
    let r2 = check_off_track(
        &pl, car_x_inside_dead, 50.0, q[0], q[1], q[2], q[3], HALF_WIDTH, ENTER_TH, EXIT_TH,
        WHEELBASE, TRACK_WIDTH_FRONT, TRACK_WIDTH_REAR, state,
    );
    state = OffTrackState {
        is_off_track: r2.is_off_track,
        arc_cursor: r2.arc_cursor,
    };
    assert!(
        r2.is_off_track,
        "in dead zone (max_lat={}) above exit threshold => stays off-track",
        r2.max_lateral_distance_m,
    );

    let car_x_exit = HALF_WIDTH - EXIT_TH - TRACK_WIDTH_FRONT * 0.5 - 0.01;
    let r3 = check_off_track(
        &pl, car_x_exit, 50.0, q[0], q[1], q[2], q[3], HALF_WIDTH, ENTER_TH, EXIT_TH, WHEELBASE,
        TRACK_WIDTH_FRONT, TRACK_WIDTH_REAR, state,
    );
    assert!(!r3.is_off_track, "all 4 wheels back inside exit margin => exit off-track");
}

#[test]
fn off_track_flicker_dead_zone_blocks_oscillation() {
    let pl = straight_z_polyline(400.0, 1.0);
    let q = yaw_quat(0.0);
    let mut state = seed_state(&pl, HALF_WIDTH + TRACK_WIDTH_FRONT * 0.5, 100.0);
    let mut enter_events: u32 = 0;
    let base = HALF_WIDTH + TRACK_WIDTH_FRONT * 0.5;
    for frame in 0..60 {
        let phase = (frame as f32) * 0.5;
        let perturb = phase.sin() * 0.1;
        let car_x = base + perturb;
        let r = check_off_track(
            &pl, car_x, 100.0, q[0], q[1], q[2], q[3], HALF_WIDTH, ENTER_TH, EXIT_TH, WHEELBASE,
            TRACK_WIDTH_FRONT, TRACK_WIDTH_REAR, state,
        );
        if !state.is_off_track && r.is_off_track {
            enter_events += 1;
        }
        state = OffTrackState {
            is_off_track: r.is_off_track,
            arc_cursor: r.arc_cursor,
        };
    }
    assert!(
        enter_events <= 1,
        "hysteresis dead zone must prevent flicker; got {enter_events} enter events",
    );
}

#[test]
fn off_track_windowed_equals_full_for_local_query() {
    let pl = straight_z_polyline(500.0, 1.0);
    let mut fake_state = (1u64, 0u64);
    let mut next = || -> f32 {
        fake_state.0 = fake_state.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        fake_state.1 = fake_state.1.wrapping_add(fake_state.0);
        let bits = (fake_state.1 >> 11) as u32 & 0x00FF_FFFF;
        (bits as f32) / (0x0100_0000 as f32)
    };

    for _ in 0..100 {
        let z = next() * 480.0 + 10.0;
        let x = (next() - 0.5) * 10.0;
        let full = nearest_centerline_full(&pl, x, z);
        let windowed = nearest_centerline_windowed(&pl, x, z, full.nearest_index, 20);
        let lat_close = (full.lateral_distance - windowed.lateral_distance).abs() < 1e-4;
        let idx_match = full.nearest_index == windowed.nearest_index;
        assert!(
            lat_close && idx_match,
            "windowed (seeded at full's nearest_index) must equal full: full=(idx={}, lat={}) windowed=(idx={}, lat={})",
            full.nearest_index, full.lateral_distance, windowed.nearest_index, windowed.lateral_distance,
        );
    }
}

#[test]
fn sensor_regression_outer_tire_pressing_line_stays_on_track() {
    let pl = straight_z_polyline(200.0, 1.0);
    let q = yaw_quat(0.0);
    let car_x = HALF_WIDTH - TRACK_WIDTH_FRONT * 0.5;
    let state = seed_state(&pl, car_x, 50.0);
    let r = check_off_track(
        &pl, car_x, 50.0, q[0], q[1], q[2], q[3], HALF_WIDTH, ENTER_TH, EXIT_TH, WHEELBASE,
        TRACK_WIDTH_FRONT, TRACK_WIDTH_REAR, state,
    );
    assert!(
        !r.is_off_track,
        "outer wheel kissing the white line must not trigger (was a prod bug under sensor heuristic)",
    );
}

#[test]
fn sensor_regression_yaw_jitter_inside_ribbon_no_phantom_violations() {
    let pl = straight_z_polyline(200.0, 1.0);
    let mut state = seed_state(&pl, 0.0, 50.0);
    let mut violations: u32 = 0;
    for frame in 0..120 {
        let jitter = ((frame as f32) * 0.7).sin() * 0.02;
        let q = yaw_quat(jitter);
        let r = check_off_track(
            &pl, 0.0, 50.0 + jitter, q[0], q[1], q[2], q[3], HALF_WIDTH, ENTER_TH, EXIT_TH,
            WHEELBASE, TRACK_WIDTH_FRONT, TRACK_WIDTH_REAR, state,
        );
        if !state.is_off_track && r.is_off_track {
            violations += 1;
        }
        state = OffTrackState { is_off_track: r.is_off_track, arc_cursor: r.arc_cursor };
    }
    assert_eq!(
        violations, 0,
        "tiny yaw + position jitter inside ribbon must never trigger (sensor heuristic would fire here)",
    );
}

#[test]
fn wheel_positions_match_quat_construction() {
    let yaw = 0.4_f32;
    let pos = wheel_world_positions(10.0, 20.0, yaw, WHEELBASE, TRACK_WIDTH_FRONT, TRACK_WIDTH_REAR);
    let s = yaw.sin();
    let c = yaw.cos();
    let half_wb = WHEELBASE * 0.5;
    let half_tw_f = TRACK_WIDTH_FRONT * 0.5;
    let fwd_x = s;
    let fwd_z = c;
    let right_x = c;
    let right_z = -s;
    let expect_fl = [
        10.0 - right_x * half_tw_f + fwd_x * half_wb,
        20.0 - right_z * half_tw_f + fwd_z * half_wb,
    ];
    assert!((pos[0][0] - expect_fl[0]).abs() < 1e-4);
    assert!((pos[0][1] - expect_fl[1]).abs() < 1e-4);
}
