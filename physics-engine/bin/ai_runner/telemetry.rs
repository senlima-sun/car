use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::sim::{SimResult, TelemetryFrame, TerminationReason};

#[derive(Serialize)]
struct FrameOut {
    t_s: f32,
    x: f32,
    y: f32,
    z: f32,
    qx: f32,
    qy: f32,
    qz: f32,
    qw: f32,
    speed_kmh: f32,
    throttle: f32,
    brake: f32,
    steer: f32,
    is_off_track: bool,
    lateral_distance_m: f32,
    arc_length_m: f32,
}

impl From<&TelemetryFrame> for FrameOut {
    fn from(f: &TelemetryFrame) -> Self {
        Self {
            t_s: f.t_s,
            x: f.x,
            y: f.y,
            z: f.z,
            qx: f.qx,
            qy: f.qy,
            qz: f.qz,
            qw: f.qw,
            speed_kmh: f.speed_kmh,
            throttle: f.throttle,
            brake: f.brake,
            steer: f.steer,
            is_off_track: f.is_off_track,
            lateral_distance_m: f.lateral_distance_m,
            arc_length_m: f.arc_length_m,
        }
    }
}

#[derive(Serialize)]
struct Header<'a> {
    track_id: &'a str,
    lap_completed: bool,
    off_track_count: u32,
    off_track_seconds: f32,
    terminated_by: &'a str,
    total_frames: usize,
    final_xz: [f32; 2],
    distance_from_spawn_m: f32,
}

#[derive(Serialize)]
struct Doc<'a> {
    header: Header<'a>,
    frames: Vec<FrameOut>,
}

#[inline]
fn terminated_str(r: TerminationReason) -> &'static str {
    match r {
        TerminationReason::LapComplete => "lap_complete",
        TerminationReason::Timeout => "timeout",
        TerminationReason::ExtendedOffTrack => "extended_off_track",
    }
}

pub fn write_telemetry_atomic(path: &Path, result: &SimResult) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)?;
        }
    }

    let frames: Vec<FrameOut> = result.telemetry.iter().map(FrameOut::from).collect();
    let doc = Doc {
        header: Header {
            track_id: &result.track_id,
            lap_completed: result.lap_completed,
            off_track_count: result.off_track_count,
            off_track_seconds: result.off_track_seconds,
            terminated_by: terminated_str(result.terminated_by),
            total_frames: result.telemetry.len(),
            final_xz: result.final_xz,
            distance_from_spawn_m: result.distance_to_spawn_m,
        },
        frames,
    };

    let mut tmp: PathBuf = path.to_path_buf();
    let mut name = tmp.file_name()
        .map(|s| s.to_os_string())
        .unwrap_or_else(|| std::ffi::OsString::from("telemetry.json"));
    name.push(".tmp");
    tmp.set_file_name(name);

    {
        let mut f = fs::File::create(&tmp)?;
        serde_json::to_writer(&mut f, &doc).map_err(io::Error::other)?;
        f.flush()?;
    }
    fs::rename(&tmp, path)?;
    Ok(())
}
