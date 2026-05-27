//! F1 2026-spec realism anchor tests.
//!
//! These tests anchor the physics engine to publicly-known properties of
//! the 2026 F1 regulations. Each assertion cites its source in a comment.
//! Tolerances are deliberately wide (±15–30%) because:
//!
//!   1. 2026 numbers are still settling — pre-season testing only just
//!      happened; teams' simulations diverged by tens of percent.
//!   2. The engine intentionally tweaks several values for playability
//!      (electric harvesting rate, peak tire μ, etc.). These tests mark
//!      the *anchor* — a controlled deviation, not a regression.
//!
//! Failures here are not necessarily bugs. They're signals that the
//! delta between this engine and reality has grown, and someone should
//! decide whether to retune or to update the anchor (with a note in
//! `docs/realism_deltas.md` — TODO when this file gets its first
//! intentional miss).
//!
//! Each test prints `MEASURED: <value>` and `TARGET: <value>` for visibility.
//! Run with `cargo test --test realism_anchors_2026 -- --nocapture` to see them.

mod common;
use common::{
    make_road_engine, measure_drs_200_to_300, measure_lat_g_with, measure_stop_distance_100kmh,
    measure_stop_distance_with, measure_zero_to_100,
};
use car_physics_engine::types::CarInput;

mod common_helpers {
    pub fn assert_within_pct(label: &str, measured: f32, target: f32, tolerance_pct: f32) {
        let delta = (measured - target).abs();
        let allowed = target.abs() * tolerance_pct;
        eprintln!(
            "  {label}: MEASURED={measured:.3}  TARGET={target:.3}  delta={delta:.3}  allowed=±{:.3} ({:.0}%)",
            allowed,
            tolerance_pct * 100.0
        );
        assert!(
            delta <= allowed,
            "{label}: measured {measured:.3}, target {target:.3}, delta {delta:.3} > {:.0}% tolerance ({:.3})",
            tolerance_pct * 100.0,
            allowed
        );
    }
}
use common_helpers::assert_within_pct;

// ============================================================================
// Anchor 1: Minimum mass — 768 kg dry (2026 reg, down from 800 kg in 2025).
// Source: FIA 2026 F1 Technical Regulations
// https://www.formula1.com/en/latest/article/the-beginners-guide-to-the-2026-regulations.6j0tS0hrHG2T01tpmK6XYz
// ============================================================================
#[test]
fn anchor_2026_dry_mass_is_768_kg() {
    use car_physics_engine::constants::car::CAR_MASS_DRY;
    assert_within_pct("dry mass (kg)", CAR_MASS_DRY, 768.0, 0.01);
}

// ============================================================================
// Anchor 2: Wheelbase — 3.40 m max (2026 reg, down from 3.60 m in 2025).
// Source: same as anchor 1.
// ============================================================================
#[test]
fn anchor_2026_wheelbase_is_3400_mm() {
    use car_physics_engine::constants::car::WHEELBASE;
    assert_within_pct("wheelbase (m)", WHEELBASE, 3.40, 0.02);
}

// ============================================================================
// Anchor 3: 0–100 km/h — 2.4–2.7 s.
// 2025 cars hit 0–100 in ~2.4 s. 2026 cars are similar or slightly slower
// off the line (50/50 ICE/electric split with same dry mass means slightly
// less peak combined power), but instant electric torque helps recovery.
// Target midpoint 2.55 s, tolerance ±25% (wide because the harness uses
// warm-tire warmup, real F1 0-100 is also surface- and driver-dependent).
// Sources:
//   https://www.grixme.com/how-fast-formula-1-car/
//   https://www.formula1.com/en/latest/article/the-beginners-guide-to-the-2026-regulations.6j0tS0hrHG2T01tpmK6XYz
// ============================================================================
#[test]
fn anchor_2026_zero_to_100_within_window() {
    let measured = measure_zero_to_100().expect("0-100 should complete");
    assert_within_pct("0–100 km/h (s)", measured, 2.55, 0.25);
}

// ============================================================================
// Anchor 4: 100 km/h → 0 stop distance — ~17 m for 2025 cars.
// 2026 cars have ~30% less downforce + narrower tires → ~20–25% longer
// braking distances (Brembo). Target ~21 m. Tolerance ±30%.
// Sources:
//   https://www.brembo.com/en/motorsport/formula1/f1-rules-2026
//   https://scuderiafans.com/brembo-data-shows-major-braking-changes-for-2026-f1-cars/
// ============================================================================
#[test]
fn anchor_2026_stop_distance_100kmh_within_window() {
    let measured = measure_stop_distance_100kmh().expect("100km/h stop should complete");
    assert_within_pct("100 km/h → 0 stop dist (m)", measured, 21.0, 0.30);
}

// ============================================================================
// Anchor 5: 200 km/h → 0 stop distance — ~55 m baseline (2025 reference ~45 m
// per Brembo, +20–25% for 2026 = ~55 m). Tolerance ±35%.
// Source: Brembo 2026 braking analysis (links above).
// ============================================================================
#[test]
fn anchor_2026_stop_distance_200kmh_within_window() {
    let engine = make_road_engine();
    let measured =
        measure_stop_distance_with(engine, 200.0 / 3.6).expect("200 km/h stop should complete");
    assert_within_pct("200 km/h → 0 stop dist (m)", measured, 55.0, 0.35);
}

// ============================================================================
// Anchor 6: Peak longitudinal G under full braking from 200 km/h.
// 2025 peaks were 5–6.5 G in the highest-downforce zones. 2026 regs cut
// downforce ~30% → peaks predicted to drop to 3.7–4.5 G in real braking
// zones (Brembo: 4G Miami T17, 3.7G Canada). Target 4.2 G, tolerance ±35%.
//
// Implementation note: `output.longitudinal_g` is computed from
// `prev_forward_speed` which the engine updates to its own post-step
// value. In a unit-harness loop that round-trips `out.linear_velocity`
// straight back in, that delta collapses to ~0 (a known quirk of the
// off-Rapier test harness — in production, Rapier integrates external
// forces between steps and the two values diverge enough for `long_g`
// to be meaningful). This test sidesteps the quirk by computing the G
// from forward-speed deltas the harness can actually see.
// Sources:
//   https://scuderiafans.com/miami-gp-2026-analysis-why-braking-zones-matter-more-than-ever-with-new-f1-cars/
//   https://scuderiafans.com/f1-canadian-gp-2026-brembo-analysis-reveals-montreals-biggest-technical-challenge/
// ============================================================================
#[test]
fn anchor_2026_peak_braking_g_from_200kmh() {
    let mut engine = make_road_engine();

    let warmup = CarInput {
        forward: true,
        throttle: 1.0,
        ..Default::default()
    };
    let mut linvel = [0.0_f32, 0.0, 200.0 / 3.6];
    let mut angvel = [0.0_f32; 3];
    // 5s warmup is enough to settle the speed-from-rest spool-up; tire
    // temperature also approaches the optimal window so peak brake G is
    // not floored by cold-tire μ.
    for _ in 0..600 {
        let out = engine.step(
            1.0 / 120.0,
            warmup,
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
            None,
        );
        linvel = out.linear_velocity;
        angvel = out.angular_velocity;
    }

    let brake = CarInput {
        brake: true,
        brake_analog: 1.0,
        ..Default::default()
    };
    let mut peak_long_g_from_delta = 0.0_f32;
    let mut peak_long_g_reported = 0.0_f32;
    let mut prev_fwd = linvel[2];
    let dt = 1.0_f32 / 120.0;
    for _ in 0..480 {
        let out = engine.step(
            dt,
            brake,
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
            linvel,
            angvel,
            [0.0, 1.0, 0.0],
            None,
        );
        linvel = out.linear_velocity;
        angvel = out.angular_velocity;
        let g_from_delta = ((prev_fwd - linvel[2]) / dt / 9.81).abs();
        peak_long_g_from_delta = peak_long_g_from_delta.max(g_from_delta);
        peak_long_g_reported = peak_long_g_reported.max(out.longitudinal_g.abs());
        prev_fwd = linvel[2];
        if linvel[2] < 2.0 {
            break;
        }
    }
    eprintln!(
        "  (note: out.longitudinal_g in this harness peaked at {:.3} G — see test doc)",
        peak_long_g_reported
    );
    assert_within_pct(
        "peak longitudinal G (200 km/h brake, from Δv)",
        peak_long_g_from_delta,
        4.2,
        0.35,
    );
}

// ============================================================================
// Anchor 7: Peak steady-state lateral G at 80m radius, 50 m/s.
//
// This is a **kinematic** anchor as much as a tire-grip one: pure circular
// motion at v=50, r=80 demands a_c = v²/r = 31.25 m/s² ≈ 3.19 G. The
// engine must be able to *sustain* this without skidding, so the test
// passes if measured ≈ kinematic requirement (the tires have enough μ).
//
// 2026 high-DF corners peak at 4.5–5.5 G, but those happen at higher
// speeds on bigger radii — 80m × 50 m/s tests the *envelope*, not the
// ceiling. Target 3.5 G mid-range, ±25% tolerance covers both kinematic
// floor (3.19 G) and Pacejka-overhead headroom (~4 G).
// Sources:
//   https://thepost.co.za/motoring/f1-grand-prix/2026-02-20-evolution-or-extinction-the-end-of-f1s-high-speed-cornering-supremacy/
//   https://www.f1technical.net/forum/viewtopic.php?t=8697
// ============================================================================
#[test]
fn anchor_2026_peak_lateral_g_steady_state() {
    let measured = measure_lat_g_with(make_road_engine()).expect("lat-g should sample");
    assert_within_pct("peak steady-state lateral G (80m, 50m/s)", measured, 3.5, 0.25);
}

// ============================================================================
// Anchor 8: DRS-active 200→300 km/h time on a flat straight.
// 2026 removes DRS in favour of "X-mode" active aero (low-drag straight
// mode reducing drag by 25–40%). The harness still uses the DRS knob as
// a stand-in for X-mode. With ICE peaking at lower kW (400 from 550+)
// but with much higher electric (350 kW battery) the combined accel
// pattern shifts: stronger out-of-corner punch, slightly softer top-end.
// Target ~7.0 s, tolerance ±35%. This is a soft anchor — the source
// number is a 2025-era estimate; 2026 trap speeds are expected similar
// or slightly higher on most circuits.
// Sources:
//   https://www.formula1.com/en/latest/article/explained-2026-aerodynamic-regulations-fia-twitter-mode-z-mode-.26c1CtOzCmN3GfLMywrgb2
//   https://www.skysports.com/f1/news/12028/13441475/f1-2026-what-are-the-new-regulations-engine-changes-and-how-will-the-racing-be-with-no-drs
// ============================================================================
#[test]
fn anchor_2026_drs_200_to_300_kmh() {
    let measured = measure_drs_200_to_300().expect("200→300 reachable in DRS");
    assert_within_pct("DRS 200→300 km/h (s)", measured, 7.0, 0.35);
}

// ============================================================================
// Anchor 9: ICE peak power — 400 kW (down from ~550–560 kW in 2025).
// MGU-K peak — 350 kW battery (vs 120 kW in 2025).
// Combined peak with ERS — ~750 kW (vs ~700 in 2025) but with a flatter
// torque curve over the lap budget.
// Source: https://www.formula1.com/en/latest/article/the-beginners-guide-to-the-2026-regulations.6j0tS0hrHG2T01tpmK6XYz
//
// We don't have a direct constant for these; this test just documents
// the target in source form so future power-train retunes have an anchor.
// ============================================================================
#[test]
fn anchor_2026_power_unit_split_documented() {
    // ICE peak (W) and MGU-K peak (W) are the regulatory anchors. The
    // physics engine doesn't expose them as constants today (powertrain
    // mixes ICE+ERS into a single drive-torque curve). If/when split-out
    // constants land, replace this body with `assert_within_pct` calls.
    let ice_peak_kw_target = 400.0_f32;
    let mguk_peak_kw_target = 350.0_f32;
    let combined_kw_target = ice_peak_kw_target + mguk_peak_kw_target;
    eprintln!(
        "  Anchor: ICE peak ≈ {ice_peak_kw_target} kW; MGU-K peak ≈ {mguk_peak_kw_target} kW; combined ≈ {combined_kw_target} kW (no engine constants to assert against yet)"
    );
}
