use car_physics_engine::track_geometry::{
    check_off_track, nearest_centerline_full, polyline_from_flat, OffTrackState, Polyline,
    DEFAULT_ENTER_THRESHOLD_M, DEFAULT_EXIT_THRESHOLD_M,
};

const WHEELBASE: f32 = 3.40;
const TRACK_WIDTH_FRONT: f32 = 1.9;
const TRACK_WIDTH_REAR: f32 = 1.8;
const TIRE_HALF_WIDTH_FRONT: f32 = 0.1905;
const TIRE_HALF_WIDTH_REAR: f32 = 0.200;
const HALF_WIDTH: f32 = 6.0;

#[test]
fn polyline_from_flat_rejects_short_input() {
    assert!(polyline_from_flat(&[], true).is_none());
    assert!(polyline_from_flat(&[0.0, 0.0], true).is_none());
}

#[test]
fn polyline_from_flat_rejects_odd_length() {
    assert!(polyline_from_flat(&[0.0, 0.0, 1.0], true).is_none());
    assert!(polyline_from_flat(&[0.0, 0.0, 1.0, 1.0, 2.0], false).is_none());
}

#[test]
fn polyline_from_flat_rejects_non_finite_values() {
    assert!(polyline_from_flat(&[0.0, 0.0, f32::NAN, 1.0], true).is_none());
    assert!(polyline_from_flat(&[0.0, 0.0, f32::INFINITY, 1.0], true).is_none());
}

#[test]
fn polyline_from_flat_builds_cumulative_arc_for_unit_square() {
    let flat = [0.0_f32, 0.0, 10.0, 0.0, 10.0, 10.0, 0.0, 10.0];
    let polyline = polyline_from_flat(&flat, true).expect("valid polyline");
    assert_eq!(polyline.points.len(), 4);
    assert!(polyline.closed);
    assert_eq!(polyline.cumulative_arc.len(), 4);
    assert!((polyline.cumulative_arc[0]).abs() < 1e-6);
    assert!((polyline.cumulative_arc[1] - 10.0).abs() < 1e-4);
    assert!((polyline.cumulative_arc[2] - 20.0).abs() < 1e-4);
    assert!((polyline.cumulative_arc[3] - 30.0).abs() < 1e-4);
}

#[test]
fn polyline_from_flat_preserves_open_flag() {
    let flat = [0.0_f32, 0.0, 5.0, 0.0];
    let open = polyline_from_flat(&flat, false).expect("valid polyline");
    assert!(!open.closed);
    let closed = polyline_from_flat(&flat, true).expect("valid polyline");
    assert!(closed.closed);
}

fn straight_z_axis_polyline(length: f32, spacing: f32) -> Polyline {
    let n = (length / spacing) as usize + 1;
    let mut flat: Vec<f32> = Vec::with_capacity(n * 2);
    for i in 0..n {
        flat.push(0.0);
        flat.push(i as f32 * spacing);
    }
    polyline_from_flat(&flat, false).expect("valid polyline")
}

fn seed_state(pl: &Polyline, x: f32, z: f32) -> OffTrackState {
    let r = nearest_centerline_full(pl, x, z);
    OffTrackState {
        is_off_track: false,
        arc_cursor: r.nearest_index,
    }
}

#[test]
fn check_off_track_centered_car_is_on_track() {
    let polyline = straight_z_axis_polyline(200.0, 1.0);
    let state = seed_state(&polyline, 0.0, 50.0);
    let result = check_off_track(
        &polyline,
        0.0,
        50.0,
        0.0,
        0.0,
        0.0,
        1.0,
        HALF_WIDTH,
        DEFAULT_ENTER_THRESHOLD_M,
        DEFAULT_EXIT_THRESHOLD_M,
        WHEELBASE,
        TRACK_WIDTH_FRONT,
        TRACK_WIDTH_REAR,
        TIRE_HALF_WIDTH_FRONT,
        TIRE_HALF_WIDTH_REAR,
        state,
    );
    assert!(!result.is_off_track, "centered car should be on-track");
}

#[test]
fn check_off_track_wheels_outside_triggers_violation() {
    let polyline = straight_z_axis_polyline(200.0, 1.0);
    let state = seed_state(&polyline, 20.0, 50.0);
    let result = check_off_track(
        &polyline,
        20.0,
        50.0,
        0.0,
        0.0,
        0.0,
        1.0,
        HALF_WIDTH,
        DEFAULT_ENTER_THRESHOLD_M,
        DEFAULT_EXIT_THRESHOLD_M,
        WHEELBASE,
        TRACK_WIDTH_FRONT,
        TRACK_WIDTH_REAR,
        TIRE_HALF_WIDTH_FRONT,
        TIRE_HALF_WIDTH_REAR,
        state,
    );
    assert!(result.is_off_track, "car 20m off centerline should be off-track");
    assert!(result.max_lateral_distance_m > HALF_WIDTH);
}
