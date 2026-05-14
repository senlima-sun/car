use car_physics_engine::track_geometry::{
    nearest_centerline_full, sample_track_source, segment_endpoints, Anchor, AnchorSlot, Path,
    Polyline, TrackSource,
};
use serde::{Deserialize, Serialize};

const SILVERSTONE_JSON: &[u8] =
    include_bytes!("../../../apps/game/src/constants/tracks/sources/silverstone.json");
const MONZA_JSON: &[u8] =
    include_bytes!("../../../apps/game/src/constants/tracks/sources/monza.json");

const TRACK_REGISTRY: &[(&str, &[u8])] = &[
    ("silverstone", SILVERSTONE_JSON),
    ("monza", MONZA_JSON),
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RaceDirection {
    Forward,
    Backward,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CheckpointKind {
    StartFinish,
    Sector,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CheckpointJson {
    #[allow(dead_code)]
    id: String,
    kind: CheckpointKind,
    path_id: String,
    segment_index: usize,
    t: f32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TrackSourceJson {
    id: String,
    name: String,
    paths: Vec<Path>,
    #[serde(default)]
    checkpoints: Vec<CheckpointJson>,
    #[serde(default = "default_race_direction")]
    race_direction: RaceDirection,
}

fn default_race_direction() -> RaceDirection {
    RaceDirection::Forward
}

#[derive(Debug, Clone, Copy)]
#[allow(dead_code)]
pub struct CheckpointMark {
    pub kind: CheckpointKind,
    pub path_id_hash: u64,
    pub polyline_index: usize,
    pub world_xz: [f32; 2],
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct LoadedTrack {
    pub id: String,
    pub name: String,
    pub polyline: Polyline,
    pub start_finish: CheckpointMark,
    pub sector_checkpoints: Vec<CheckpointMark>,
    pub race_direction: RaceDirection,
}

pub fn available_tracks() -> impl Iterator<Item = &'static str> {
    TRACK_REGISTRY.iter().map(|(name, _)| *name)
}

pub fn load_track(name: &str) -> Result<LoadedTrack, String> {
    let bytes = TRACK_REGISTRY
        .iter()
        .find(|(n, _)| *n == name)
        .map(|(_, b)| *b)
        .ok_or_else(|| {
            let available: Vec<&str> = available_tracks().collect();
            format!("unknown track '{name}'; available: {available:?}")
        })?;

    let root: TrackSourceJson = serde_json::from_slice(bytes)
        .map_err(|err| format!("failed to parse track '{name}' JSON: {err}"))?;

    let src = TrackSource { paths: root.paths };

    let polylines = sample_track_source(&src, 1.0);
    let polyline = polylines
        .into_iter()
        .next()
        .ok_or_else(|| format!("track '{name}' produced no polylines"))?;

    if polyline.points.len() < 2 {
        return Err(format!(
            "track '{name}' polyline too short ({} points)",
            polyline.points.len()
        ));
    }

    let mut start_finish: Option<CheckpointMark> = None;
    let mut sector_checkpoints: Vec<CheckpointMark> = Vec::new();

    for cp in &root.checkpoints {
        let world = match resolve_checkpoint_world_xz(&src, &cp.path_id, cp.segment_index, cp.t) {
            Some(p) => p,
            None => continue,
        };
        let nearest = nearest_centerline_full(&polyline, world[0], world[1]);
        let mark = CheckpointMark {
            kind: cp.kind,
            path_id_hash: fxhash(&cp.path_id),
            polyline_index: nearest.nearest_index,
            world_xz: world,
        };
        match cp.kind {
            CheckpointKind::StartFinish => {
                start_finish = Some(mark);
            }
            CheckpointKind::Sector => {
                sector_checkpoints.push(mark);
            }
        }
    }

    let start_finish = start_finish
        .ok_or_else(|| format!("track '{name}' has no start-finish checkpoint"))?;

    Ok(LoadedTrack {
        id: root.id,
        name: root.name,
        polyline,
        start_finish,
        sector_checkpoints,
        race_direction: root.race_direction,
    })
}

fn resolve_checkpoint_world_xz(
    src: &TrackSource,
    path_id: &str,
    segment_index: usize,
    t: f32,
) -> Option<[f32; 2]> {
    let path = src.paths.iter().find(|p| p.id == path_id)?;
    if path.anchors.len() < 2 || segment_index + 1 >= path.anchors.len() {
        return None;
    }

    let from = resolve_anchor_inline(&path.anchors[segment_index], &src.paths)?;
    let to = resolve_anchor_inline(&path.anchors[segment_index + 1], &src.paths)?;
    let (p0, c1, c2, p3) = segment_endpoints(from, to);
    let pt = car_physics_engine::track_geometry::cubic_point(p0, c1, c2, p3, t);
    Some([pt.x, pt.y])
}

fn resolve_anchor_inline<'a>(slot: &'a AnchorSlot, paths: &'a [Path]) -> Option<&'a Anchor> {
    match slot {
        AnchorSlot::Inline(a) => Some(a),
        AnchorSlot::Ref { path_id, anchor_index } => {
            let path = paths.iter().find(|p| &p.id == path_id)?;
            let next = path.anchors.get(*anchor_index)?;
            resolve_anchor_inline(next, paths)
        }
    }
}

#[inline]
fn fxhash(s: &str) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.as_bytes() {
        h ^= *b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

/// Spawn pose derived from start-finish checkpoint + race direction.
/// Returns `(position_xyz, rotation_quat_xyzw, forward_xz)`.
pub fn spawn_pose(track: &LoadedTrack) -> ([f32; 3], [f32; 4], [f32; 2]) {
    let polyline = &track.polyline;
    let idx = track.start_finish.polyline_index.min(polyline.points.len() - 1);
    let here = polyline.points[idx];
    let next_idx = if idx + 1 < polyline.points.len() {
        idx + 1
    } else if polyline.closed {
        0
    } else {
        idx.saturating_sub(1)
    };
    let next = polyline.points[next_idx];

    let (dx, dz) = if next_idx > idx || (polyline.closed && idx + 1 >= polyline.points.len()) {
        (next[0] - here[0], next[1] - here[1])
    } else {
        (here[0] - next[0], here[1] - next[1])
    };
    let len = (dx * dx + dz * dz).sqrt().max(f32::EPSILON);
    let mut tangent = [dx / len, dz / len];

    if track.race_direction == RaceDirection::Backward {
        tangent = [-tangent[0], -tangent[1]];
    }

    let yaw = tangent[0].atan2(tangent[1]);
    let half = yaw * 0.5;
    let rotation = [0.0_f32, half.sin(), 0.0_f32, half.cos()];

    let world_xz = track.start_finish.world_xz;
    ([world_xz[0], 0.0, world_xz[1]], rotation, tangent)
}
