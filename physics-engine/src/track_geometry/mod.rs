use serde::{Deserialize, Serialize};

pub mod bezier;
pub mod off_track;
pub mod sample;

pub use bezier::{cubic_point, sample_segment_dense, segment_endpoints, segment_length};
pub use off_track::{
    check_off_track, forward_right_from_quat, nearest_centerline_full, nearest_centerline_windowed,
    wheel_world_positions, wheel_world_positions_quat, NearestResult, OffTrackResult, OffTrackState,
    DEFAULT_ENTER_THRESHOLD_M, DEFAULT_EXIT_THRESHOLD_M, DEFAULT_WINDOW,
};
pub use sample::{sample_path, sample_track_source};

pub const POINT_EPS: f32 = 1e-6;
pub const SAMPLE_SPACING_METERS: f32 = 1.0;
pub const SEAM_DEDUP_FACTOR: f32 = 0.6;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Point {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HandleType {
    Corner,
    Smooth,
    Mirror,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Anchor {
    pub id: String,
    pub point: Point,
    pub in_handle: Point,
    pub out_handle: Point,
    pub handle_type: HandleType,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(untagged)]
pub enum AnchorSlot {
    Inline(Anchor),
    Ref {
        #[serde(rename = "pathId")]
        path_id: String,
        #[serde(rename = "anchorIndex")]
        anchor_index: usize,
    },
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Path {
    pub id: String,
    pub anchors: Vec<AnchorSlot>,
    #[serde(default)]
    pub closed: bool,
    #[serde(default, rename = "pitLaneSegments")]
    pub pit_lane_segments: Vec<usize>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TrackSource {
    pub paths: Vec<Path>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Polyline {
    pub points: Vec<[f32; 2]>,
    pub cumulative_arc: Vec<f32>,
    pub closed: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CheckpointKind {
    StartFinish,
    Sector,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CheckpointMark {
    pub index_in_polyline: usize,
    pub kind: CheckpointKind,
}

#[inline]
pub fn point_eq(a: Point, b: Point) -> bool {
    (a.x - b.x).abs() < POINT_EPS && (a.y - b.y).abs() < POINT_EPS
}
