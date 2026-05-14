use super::{point_eq, Anchor, Point, SAMPLE_SPACING_METERS};

#[inline]
pub fn cubic_point(p0: Point, c1: Point, c2: Point, p3: Point, t: f32) -> Point {
    let u = 1.0 - t;
    let uu = u * u;
    let tt = t * t;
    let uuu = uu * u;
    let ttt = tt * t;
    let w1 = 3.0 * uu * t;
    let w2 = 3.0 * u * tt;
    Point {
        x: uuu * p0.x + w1 * c1.x + w2 * c2.x + ttt * p3.x,
        y: uuu * p0.y + w1 * c1.y + w2 * c2.y + ttt * p3.y,
    }
}

#[inline]
pub fn segment_endpoints(from: &Anchor, to: &Anchor) -> (Point, Point, Point, Point) {
    let has_out = !point_eq(from.out_handle, from.point);
    let has_in = !point_eq(to.in_handle, to.point);
    let p0 = from.point;
    let c1 = if has_out { from.out_handle } else { from.point };
    let c2 = if has_in { to.in_handle } else { to.point };
    let p3 = to.point;
    (p0, c1, c2, p3)
}

#[inline]
fn hypot(dx: f32, dy: f32) -> f32 {
    (dx * dx + dy * dy).sqrt()
}

pub fn segment_length(from: &Anchor, to: &Anchor) -> f32 {
    let (p0, c1, c2, p3) = segment_endpoints(from, to);
    let is_straight = point_eq(c1, p0) && point_eq(c2, p3);
    if is_straight {
        return hypot(p3.x - p0.x, p3.y - p0.y);
    }
    const SAMPLES: usize = 32;
    let mut total: f32 = 0.0;
    let mut prev = p0;
    for i in 1..=SAMPLES {
        let t = (i as f32) / (SAMPLES as f32);
        let cur = cubic_point(p0, c1, c2, p3, t);
        total += hypot(cur.x - prev.x, cur.y - prev.y);
        prev = cur;
    }
    total
}

pub fn sample_segment_dense(from: &Anchor, to: &Anchor, include_start: bool) -> Vec<Point> {
    let (p0, c1, c2, p3) = segment_endpoints(from, to);
    let is_straight = point_eq(c1, p0) && point_eq(c2, p3);
    let length = segment_length(from, to);
    let raw = (length / SAMPLE_SPACING_METERS).ceil();
    let steps = if raw < 2.0 { 2usize } else { raw as usize };
    let start_i: usize = if include_start { 0 } else { 1 };
    let mut out: Vec<Point> = Vec::with_capacity(steps + 1 - start_i);
    for i in start_i..=steps {
        let t = (i as f32) / (steps as f32);
        let pt = if is_straight {
            Point {
                x: p0.x + (p3.x - p0.x) * t,
                y: p0.y + (p3.y - p0.y) * t,
            }
        } else {
            cubic_point(p0, c1, c2, p3, t)
        };
        out.push(pt);
    }
    out
}
