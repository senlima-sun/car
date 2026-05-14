use std::collections::HashSet;

use super::bezier::sample_segment_dense;
use super::{Anchor, AnchorSlot, Path, Polyline, TrackSource, SAMPLE_SPACING_METERS, SEAM_DEDUP_FACTOR};

pub fn resolve_anchor<'a>(
    paths: &'a [Path],
    slot: &'a AnchorSlot,
    visited: &mut HashSet<(String, usize)>,
) -> Option<&'a Anchor> {
    match slot {
        AnchorSlot::Inline(a) => Some(a),
        AnchorSlot::Ref { path_id, anchor_index } => {
            let key = (path_id.clone(), *anchor_index);
            if visited.contains(&key) {
                return None;
            }
            visited.insert(key);
            let path = paths.iter().find(|p| &p.id == path_id)?;
            let next = path.anchors.get(*anchor_index)?;
            resolve_anchor(paths, next, visited)
        }
    }
}

pub fn sample_path(path: &Path, all_paths: &[Path]) -> Option<Polyline> {
    if path.anchors.len() < 2 {
        return None;
    }
    let mut resolved: Vec<Option<&Anchor>> = Vec::with_capacity(path.anchors.len());
    for slot in &path.anchors {
        let mut visited: HashSet<(String, usize)> = HashSet::new();
        resolved.push(resolve_anchor(all_paths, slot, &mut visited));
    }

    let mut points: Vec<[f32; 2]> = Vec::new();
    for i in 1..path.anchors.len() {
        let from = resolved[i - 1];
        let to = resolved[i];
        if from.is_none() || to.is_none() {
            continue;
        }
        let include_start = i == 1;
        let seg = sample_segment_dense(from.unwrap(), to.unwrap(), include_start);
        for p in seg {
            points.push([p.x, p.y]);
        }
    }

    if path.closed && path.anchors.len() > 1 {
        let closing_index = path.anchors.len() - 1;
        let from = resolved[closing_index];
        let to = resolved[0];
        if let (Some(f), Some(t)) = (from, to) {
            for p in sample_segment_dense(f, t, false) {
                points.push([p.x, p.y]);
            }
        }
    }

    if points.len() < 2 {
        return None;
    }

    if path.closed && points.len() > 1 {
        let first = points[0];
        let last = points[points.len() - 1];
        let dx = first[0] - last[0];
        let dy = first[1] - last[1];
        let seam_dist = (dx * dx + dy * dy).sqrt();
        if seam_dist < SAMPLE_SPACING_METERS * SEAM_DEDUP_FACTOR {
            points.pop();
        }
    }

    let mut cumulative_arc: Vec<f32> = Vec::with_capacity(points.len());
    cumulative_arc.push(0.0);
    for i in 1..points.len() {
        let dx = points[i][0] - points[i - 1][0];
        let dy = points[i][1] - points[i - 1][1];
        let prev = cumulative_arc[i - 1];
        cumulative_arc.push(prev + (dx * dx + dy * dy).sqrt());
    }

    Some(Polyline {
        points,
        cumulative_arc,
        closed: path.closed,
    })
}

pub fn sample_track_source(src: &TrackSource, _spacing_m: f32) -> Vec<Polyline> {
    let mut out: Vec<Polyline> = Vec::with_capacity(src.paths.len());
    for path in &src.paths {
        if let Some(pl) = sample_path(path, &src.paths) {
            out.push(pl);
        }
    }
    out
}
