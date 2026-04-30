mod common;
use common::{measure_lat_g, measure_stop_distance, measure_zero_to_100};

#[test]
#[ignore]
fn capture_wave_1_baselines() {
    let zero_to_100 = measure_zero_to_100();
    let stop_distance = measure_stop_distance();
    let lat_g = measure_lat_g();

    let json = format!(
        r#"{{
  "schema_version": 1,
  "captured_at": "post-wave-2-phase-5",
  "scenarios": {{
    "zero_to_100_kmh_seconds": {},
    "fifty_ms_to_zero_stop_distance_m": {},
    "steady_state_80m_radius_peak_lat_g": {}
  }}
}}
"#,
        zero_to_100
            .map(|v| format!("{:.4}", v))
            .unwrap_or_else(|| "null".into()),
        stop_distance
            .map(|v| format!("{:.4}", v))
            .unwrap_or_else(|| "null".into()),
        lat_g
            .map(|v| format!("{:.4}", v))
            .unwrap_or_else(|| "null".into()),
    );

    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/wave_1_baselines.json");
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(&path, json).expect("write baseline fixture");

    println!("zero_to_100_kmh_seconds = {:?}", zero_to_100);
    println!("fifty_ms_to_zero_stop_distance_m = {:?}", stop_distance);
    println!("steady_state_80m_radius_peak_lat_g = {:?}", lat_g);
    println!("wrote {}", path.display());
}
