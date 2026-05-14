#![allow(dead_code)]

use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::sim::TelemetryFrame;

pub const MAX_GHOST_SAMPLES: usize = 12000;
pub const GHOST_STRIDE_120_TO_20_HZ: usize = 6;
pub const GHOST_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone)]
pub struct GhostMeta {
    pub schema_version: u32,
    pub track_id: String,
    pub lap_time: f32,
    pub frame_count: u32,
    pub recorder_type: String,
    pub recorded_at: String,
}

pub fn subsample_telemetry<'a>(
    frames: &'a [TelemetryFrame],
    stride: usize,
) -> Vec<&'a TelemetryFrame> {
    if frames.is_empty() || stride == 0 {
        return Vec::new();
    }
    let mut out: Vec<&TelemetryFrame> = Vec::with_capacity(frames.len() / stride + 1);
    for (i, f) in frames.iter().enumerate() {
        if i % stride != 0 {
            continue;
        }
        out.push(f);
        if out.len() >= MAX_GHOST_SAMPLES {
            break;
        }
    }
    out
}

pub fn now_iso8601_utc() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let (year, month, day, hh, mm, ss) = epoch_to_utc(secs);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hh, mm, ss
    )
}

fn epoch_to_utc(secs: u64) -> (u32, u32, u32, u32, u32, u32) {
    let ss = (secs % 60) as u32;
    let total_minutes = secs / 60;
    let mm = (total_minutes % 60) as u32;
    let total_hours = total_minutes / 60;
    let hh = (total_hours % 24) as u32;
    let mut days = (total_hours / 24) as i64;

    let mut year: i64 = 1970;
    loop {
        let len = if is_leap(year) { 366 } else { 365 };
        if days < len {
            break;
        }
        days -= len;
        year += 1;
    }

    let month_lengths = [31, if is_leap(year) { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut month: usize = 0;
    while month < 12 && days >= month_lengths[month] {
        days -= month_lengths[month];
        month += 1;
    }
    (year as u32, (month + 1) as u32, (days + 1) as u32, hh, mm, ss)
}

fn is_leap(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

fn atomic_write(path: &Path, contents: &[u8]) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)?;
        }
    }
    let mut tmp: PathBuf = path.to_path_buf();
    let mut name = tmp
        .file_name()
        .map(|s| s.to_os_string())
        .unwrap_or_else(|| std::ffi::OsString::from("ghost.tmp"));
    name.push(".tmp");
    tmp.set_file_name(name);

    {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(contents)?;
        f.flush()?;
        f.sync_data()?;
    }
    fs::rename(&tmp, path)?;
    Ok(())
}

pub fn pack_ghost_bin(frames: &[&TelemetryFrame]) -> Vec<u8> {
    let n = frames.len().min(MAX_GHOST_SAMPLES);
    let total_floats = n * 3 + n * 4 + n + n * 4 + n;
    let mut buf: Vec<u8> = Vec::with_capacity(4 + total_floats * 4);
    buf.extend_from_slice(&(n as u32).to_le_bytes());

    for f in frames.iter().take(n) {
        buf.extend_from_slice(&f.x.to_le_bytes());
        buf.extend_from_slice(&f.y.to_le_bytes());
        buf.extend_from_slice(&f.z.to_le_bytes());
    }
    for f in frames.iter().take(n) {
        buf.extend_from_slice(&f.qx.to_le_bytes());
        buf.extend_from_slice(&f.qy.to_le_bytes());
        buf.extend_from_slice(&f.qz.to_le_bytes());
        buf.extend_from_slice(&f.qw.to_le_bytes());
    }
    for f in frames.iter().take(n) {
        buf.extend_from_slice(&f.steer.to_le_bytes());
    }
    let zero_bytes = 0.0_f32.to_le_bytes();
    for _ in 0..n {
        buf.extend_from_slice(&zero_bytes);
        buf.extend_from_slice(&zero_bytes);
        buf.extend_from_slice(&zero_bytes);
        buf.extend_from_slice(&zero_bytes);
    }
    for f in frames.iter().take(n) {
        let ts_ms = f.t_s * 1000.0;
        buf.extend_from_slice(&ts_ms.to_le_bytes());
    }
    buf
}

pub fn write_ghost_bin_atomic(path: &Path, frames: &[&TelemetryFrame]) -> io::Result<()> {
    let buf = pack_ghost_bin(frames);
    atomic_write(path, &buf)
}

pub fn encode_ghost_meta_json(meta: &GhostMeta) -> String {
    fn escape(s: &str) -> String {
        let mut out = String::with_capacity(s.len() + 2);
        for c in s.chars() {
            match c {
                '"' => out.push_str("\\\""),
                '\\' => out.push_str("\\\\"),
                '\n' => out.push_str("\\n"),
                '\r' => out.push_str("\\r"),
                '\t' => out.push_str("\\t"),
                c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
                c => out.push(c),
            }
        }
        out
    }
    format!(
        concat!(
            "{{\n",
            "  \"schemaVersion\": {schema},\n",
            "  \"trackId\": \"{track_id}\",\n",
            "  \"lapTime\": {lap_time},\n",
            "  \"frameCount\": {frame_count},\n",
            "  \"recorderType\": \"{recorder_type}\",\n",
            "  \"recordedAt\": \"{recorded_at}\"\n",
            "}}\n",
        ),
        schema = meta.schema_version,
        track_id = escape(&meta.track_id),
        lap_time = meta.lap_time,
        frame_count = meta.frame_count,
        recorder_type = escape(&meta.recorder_type),
        recorded_at = escape(&meta.recorded_at),
    )
}

pub fn write_ghost_meta_atomic(path: &Path, meta: &GhostMeta) -> io::Result<()> {
    let json = encode_ghost_meta_json(meta);
    atomic_write(path, json.as_bytes())
}

// The file slug is the full track_id verbatim. The TS LoadAiGhostButton
// fetches `<presetId>.ghost.{bin,json}` where presetId == raw JSON `id`
// field == this track_id. Phase 4 review Critical #3 flagged the previous
// strip-prefix/strip-suffix dance as silently 404-ing on compound names
// like "f1_silverstone_circuit".
pub fn slug_from_track_id(track_id: &str) -> String {
    track_id.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_frame(i: usize) -> TelemetryFrame {
        let t = (i as f32) / 120.0;
        TelemetryFrame {
            t_s: t,
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
    fn subsample_picks_every_sixth_frame() {
        let frames: Vec<TelemetryFrame> = (0..100).map(make_frame).collect();
        let out = subsample_telemetry(&frames, 6);
        assert_eq!(out.len(), 17);
        for (j, f) in out.iter().enumerate() {
            assert_eq!(f.t_s, (j as f32 * 6.0) / 120.0);
        }
    }

    #[test]
    fn subsample_caps_at_max_ghost_samples() {
        let frames: Vec<TelemetryFrame> = (0..(MAX_GHOST_SAMPLES * 6 + 100)).map(make_frame).collect();
        let out = subsample_telemetry(&frames, 6);
        assert_eq!(out.len(), MAX_GHOST_SAMPLES);
    }

    #[test]
    fn pack_ghost_bin_round_trip_positions_and_timestamps() {
        let frames: Vec<TelemetryFrame> = (0..50).map(make_frame).collect();
        let subs = subsample_telemetry(&frames, 6);
        let buf = pack_ghost_bin(&subs);
        let frame_count = u32::from_le_bytes(buf[0..4].try_into().unwrap()) as usize;
        assert_eq!(frame_count, subs.len());

        let mut cursor = 4;
        let read_f32 = |buf: &[u8], cursor: &mut usize| -> f32 {
            let v = f32::from_le_bytes(buf[*cursor..*cursor + 4].try_into().unwrap());
            *cursor += 4;
            v
        };
        for f in &subs {
            let x = read_f32(&buf, &mut cursor);
            let y = read_f32(&buf, &mut cursor);
            let z = read_f32(&buf, &mut cursor);
            assert!((x - f.x).abs() < 1e-6);
            assert!((y - f.y).abs() < 1e-6);
            assert!((z - f.z).abs() < 1e-6);
        }
        for f in &subs {
            let qx = read_f32(&buf, &mut cursor);
            let qy = read_f32(&buf, &mut cursor);
            let qz = read_f32(&buf, &mut cursor);
            let qw = read_f32(&buf, &mut cursor);
            assert!((qx - f.qx).abs() < 1e-6);
            assert!((qy - f.qy).abs() < 1e-6);
            assert!((qz - f.qz).abs() < 1e-6);
            assert!((qw - f.qw).abs() < 1e-6);
        }
        for f in &subs {
            let s = read_f32(&buf, &mut cursor);
            assert!((s - f.steer).abs() < 1e-6);
        }
        for _ in &subs {
            for _ in 0..4 {
                let w = read_f32(&buf, &mut cursor);
                assert_eq!(w, 0.0);
            }
        }
        for f in &subs {
            let ts_ms = read_f32(&buf, &mut cursor);
            let expected_ms = f.t_s * 1000.0;
            assert!(
                (ts_ms - expected_ms).abs() < 1e-3,
                "ts mismatch {} vs {}",
                ts_ms,
                expected_ms
            );
        }
        assert_eq!(cursor, buf.len(), "byte cursor must land at end of buffer");
    }

    #[test]
    fn meta_json_contains_schema_version_one() {
        let meta = GhostMeta {
            schema_version: GHOST_SCHEMA_VERSION,
            track_id: "f1_monza".into(),
            lap_time: 87.42,
            frame_count: 1234,
            recorder_type: "ai_runner".into(),
            recorded_at: "2026-05-14T00:00:00Z".into(),
        };
        let s = encode_ghost_meta_json(&meta);
        assert!(s.contains("\"schemaVersion\": 1"), "missing version: {s}");
        assert!(s.contains("\"trackId\": \"f1_monza\""));
        assert!(s.contains("\"recorderType\": \"ai_runner\""));
        assert!(s.contains("\"frameCount\": 1234"));
    }

    #[test]
    fn write_round_trip_via_tempdir() {
        let mut bin_path = std::env::temp_dir();
        bin_path.push(format!("ai-runner-test-{}-monza.ghost.bin", std::process::id()));
        let mut json_path = std::env::temp_dir();
        json_path.push(format!("ai-runner-test-{}-monza.ghost.json", std::process::id()));

        let frames: Vec<TelemetryFrame> = (0..100).map(make_frame).collect();
        let subs = subsample_telemetry(&frames, 6);
        write_ghost_bin_atomic(&bin_path, &subs).unwrap();

        let meta = GhostMeta {
            schema_version: GHOST_SCHEMA_VERSION,
            track_id: "f1_monza".into(),
            lap_time: 87.42,
            frame_count: subs.len() as u32,
            recorder_type: "ai_runner".into(),
            recorded_at: now_iso8601_utc(),
        };
        write_ghost_meta_atomic(&json_path, &meta).unwrap();

        let bin = fs::read(&bin_path).unwrap();
        let json = fs::read_to_string(&json_path).unwrap();
        let frame_count = u32::from_le_bytes(bin[0..4].try_into().unwrap()) as usize;
        assert_eq!(frame_count, subs.len());
        assert!(json.contains("\"schemaVersion\": 1"));
        assert!(json.contains("\"recorderType\": \"ai_runner\""));

        let _ = fs::remove_file(&bin_path);
        let _ = fs::remove_file(&json_path);
    }

    #[test]
    fn slug_from_track_id_is_identity() {
        // Slug == track_id verbatim so it matches the TS LoadAiGhostButton's
        // resolveTrackSlug() which returns the preset's raw `id` field.
        assert_eq!(slug_from_track_id("f1_monza"), "f1_monza");
        assert_eq!(slug_from_track_id("f1_silverstone_circuit"), "f1_silverstone_circuit");
        assert_eq!(slug_from_track_id("custom_track_123"), "custom_track_123");
    }

    #[test]
    fn iso8601_format_is_well_formed() {
        let s = now_iso8601_utc();
        assert!(s.len() == 20, "got: {s}");
        assert!(s.ends_with("Z"));
        let bytes = s.as_bytes();
        assert_eq!(bytes[4], b'-');
        assert_eq!(bytes[7], b'-');
        assert_eq!(bytes[10], b'T');
        assert_eq!(bytes[13], b':');
        assert_eq!(bytes[16], b':');
    }
}
