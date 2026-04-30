mod common;
use common::{
    make_oil_proxy_engine, make_wet_road_engine, measure_drs_200_to_300, measure_lat_g,
    measure_lat_g_with, measure_stop_distance, measure_stop_distance_100kmh,
    measure_stop_distance_with, measure_zero_to_100,
};

fn fmt(v: Option<f32>) -> String {
    v.map(|x| format!("{:.4}", x))
        .unwrap_or_else(|| "null".into())
}

/// Wave 4 Phase 0 Step 0.2: pre-Wave-4 anchor for cumulative-drift
/// reporting through Phases 1-6. Numbers should match
/// `wave_3_baselines.json` within FP noise (Phase 0 is a no-op
/// behaviour-wise). Phase 7 captures the final post-Wave-4 baseline.
#[test]
#[ignore]
fn capture_wave_4_pre_baselines() {
    let zero_to_100 = measure_zero_to_100();
    let stop_50_to_0 = measure_stop_distance();
    let lat_g_80m = measure_lat_g();
    let drs_200_to_300 = measure_drs_200_to_300();
    let stop_100_to_0 = measure_stop_distance_100kmh();
    let wet_stop_50_to_0 = measure_stop_distance_with(make_wet_road_engine(), 50.0);
    let wet_lat_g_80m = measure_lat_g_with(make_wet_road_engine());
    let oil_lat_g_80m = measure_lat_g_with(make_oil_proxy_engine());

    let json = format!(
        r#"{{
  "schema_version": 1,
  "captured_at": "wave-4-phase-0-pre",
  "scenarios": {{
    "zero_to_100_kmh_seconds": {},
    "fifty_ms_to_zero_stop_distance_m": {},
    "steady_state_80m_radius_peak_lat_g": {},
    "drs_active_200_to_300_kmh_seconds": {},
    "hundred_kmh_to_zero_stop_distance_m": {},
    "wet_fifty_ms_to_zero_stop_distance_m": {},
    "wet_steady_state_80m_radius_peak_lat_g": {},
    "oil_steady_state_80m_radius_peak_lat_g": {}
  }},
  "notes": "Pre-Wave-4 anchor. Should match wave_3_baselines.json within FP noise. Cumulative drift through Phases 1-6 is measured against this fixture."
}}
"#,
        fmt(zero_to_100),
        fmt(stop_50_to_0),
        fmt(lat_g_80m),
        fmt(drs_200_to_300),
        fmt(stop_100_to_0),
        fmt(wet_stop_50_to_0),
        fmt(wet_lat_g_80m),
        fmt(oil_lat_g_80m),
    );

    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/wave_4_pre_baselines.json");
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(&path, json).expect("write Wave 4 pre-baselines");

    println!("zero_to_100_kmh_seconds = {:?}", zero_to_100);
    println!("fifty_ms_to_zero_stop_distance_m = {:?}", stop_50_to_0);
    println!("steady_state_80m_radius_peak_lat_g = {:?}", lat_g_80m);
    println!("drs_active_200_to_300_kmh_seconds = {:?}", drs_200_to_300);
    println!("hundred_kmh_to_zero_stop_distance_m = {:?}", stop_100_to_0);
    println!("wet_fifty_ms_to_zero_stop_distance_m = {:?}", wet_stop_50_to_0);
    println!("wet_steady_state_80m_radius_peak_lat_g = {:?}", wet_lat_g_80m);
    println!("oil_steady_state_80m_radius_peak_lat_g = {:?}", oil_lat_g_80m);
    println!("wrote {}", path.display());
}
