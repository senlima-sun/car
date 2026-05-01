// Wave 4 Phase 3: 2026 F1 tire spec. Pirelli 720mm OD → 0.36 m radius
// (was 0.33 m = 2025 660mm OD). Cascades into slip-ratio, drive-force
// scaling, and suspension geometry. ~9% larger rolling circumference,
// so engine RPM at a given road speed drops ~9%.
pub const TIRE_RADIUS: f32 = 0.36;
const TRANSMISSION_EFFICIENCY: f32 = 0.85;
// Engine-side rotational inertia (kg·m²). Wave 3 Phase 5 reflects this
// through gear ratio² and clutch engagement into driven-wheel inertia
// inside `WheelForceIntegrator`. Public so the integrator can consume it
// without re-declaring the constant.
pub const ENGINE_INERTIA: f32 = 0.15;
const REDLINE_RPM: f32 = 15000.0;
const IDLE_RPM: f32 = 4000.0;
const PEAK_TORQUE_RPM: f32 = 10500.0;
// Wave 4 Phase 4: 2026 F1 ICE peak torque ≈ 480 Nm (1.6L V6 turbo
// hybrid; published spec). Was 380 Nm = 2025-spec.
const PEAK_TORQUE_NM: f32 = 480.0;
const SHIFT_TIME_S: f32 = 0.05;
const UPSHIFT_RPM_THRESHOLD: f32 = 13500.0;
const DOWNSHIFT_RPM_THRESHOLD: f32 = 6500.0;
const ENGINE_BRAKE_COEFFICIENT: f32 = 0.012;
const SPEED_CAP_UPSHIFT_FACTOR: f32 = 0.97;
const CAP_ASSIST_UPSHIFT_COOLDOWN_S: f32 = 0.2;

const GEAR_RATIOS: [f32; 8] = [3.6, 2.6, 2.0, 1.6, 1.3, 1.1, 0.95, 0.85];
const FINAL_DRIVE: f32 = 2.9;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShiftState {
    Engaged,
    Shifting,
}

/// Per-step inputs to `PowertrainState::update`. Bundled to avoid a
/// growing list of positional `f32` parameters (added during turbo
/// integration; fuel-flow factor lands as a named field next).
#[derive(Debug, Clone, Copy)]
pub struct PowertrainInput {
    pub dt: f32,
    pub speed_ms: f32,
    pub max_speed_ms: f32,
    pub is_throttle: bool,
    pub ers_boost_n: f32,
    pub engine_efficiency: f32,
    pub engine_power_mult: f32,
    pub boost_multiplier: f32,
}

impl PowertrainInput {
    /// Build a minimal input with the multiplier knobs at their no-op
    /// defaults (`1.0`). Tests use this as a baseline, then tweak named
    /// fields rather than re-listing all parameters.
    pub fn baseline(dt: f32, speed_ms: f32, max_speed_ms: f32, is_throttle: bool) -> Self {
        Self {
            dt,
            speed_ms,
            max_speed_ms,
            is_throttle,
            ers_boost_n: 0.0,
            engine_efficiency: 1.0,
            engine_power_mult: 1.0,
            boost_multiplier: 1.0,
        }
    }
}

#[derive(Debug)]
pub struct PowertrainState {
    current_gear: u8,
    engine_rpm: f32,
    shift_timer: f32,
    cap_assist_upshift_cooldown: f32,
    shift_state: ShiftState,
}

impl Default for PowertrainState {
    fn default() -> Self {
        Self {
            current_gear: 0,
            engine_rpm: IDLE_RPM,
            shift_timer: 0.0,
            cap_assist_upshift_cooldown: 0.0,
            shift_state: ShiftState::Engaged,
        }
    }
}

impl PowertrainState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Reset to launch state: 1st gear, idle RPM, engaged. Used by test
    /// scenarios that simulate a race start after a formation-lap warmup
    /// — without this, the warmup leaves the car in 4-6th gear and the
    /// launch from rest can't downshift fast enough to use peak torque.
    pub fn reset_for_launch(&mut self) {
        *self = Self::default();
    }

    pub fn update(&mut self, input: &PowertrainInput) -> PowertrainOutput {
        let PowertrainInput {
            dt,
            speed_ms,
            max_speed_ms,
            is_throttle,
            ers_boost_n,
            engine_efficiency,
            engine_power_mult,
            boost_multiplier,
        } = *input;
        let boost_multiplier = if boost_multiplier.is_finite() {
            boost_multiplier.clamp(
                crate::car_physics::turbo::MULTIPLIER_FLOOR,
                crate::car_physics::turbo::MULTIPLIER_CEILING,
            )
        } else {
            1.0
        };
        self.update_shift(dt, speed_ms, is_throttle, max_speed_ms);
        let gear_ratio = GEAR_RATIOS[self.current_gear as usize];
        let total_ratio = gear_ratio * FINAL_DRIVE;

        let wheel_rpm = speed_ms / (TIRE_RADIUS * 2.0 * std::f32::consts::PI) * 60.0;
        let kinematic_rpm = wheel_rpm * total_ratio;
        // Wave 4 launch fix: when the wheel-derived engine RPM would be
        // below IDLE (i.e., we're at or near standstill), target peak-
        // torque RPM under full throttle. Real cars rev the engine while
        // the clutch slips during launch — the clutch decouples engine
        // and wheels until they synchronise. Without this, the engine
        // sits at IDLE for the first ~2.5s of a launch, the clutch
        // never engages, and 0-100 stretches to ~5s.
        let target_rpm = if is_throttle && kinematic_rpm < IDLE_RPM {
            // Launch: spin engine up to peak-torque RPM proportional to
            // throttle. Clutch engagement (in `clutch.rs`) handles the
            // disconnect between this and the wheel-derived RPM.
            PEAK_TORQUE_RPM
        } else {
            kinematic_rpm.clamp(IDLE_RPM, REDLINE_RPM)
        };
        let rpm_response = if self.shift_state == ShiftState::Shifting {
            5.0
        } else {
            15.0
        };
        self.engine_rpm = lerp_f32(self.engine_rpm, target_rpm, dt * rpm_response);
        self.engine_rpm = self.engine_rpm.clamp(IDLE_RPM, REDLINE_RPM);

        let torque = if self.shift_state == ShiftState::Shifting {
            0.0
        } else if is_throttle {
            self.torque_curve(self.engine_rpm) * engine_efficiency * engine_power_mult * boost_multiplier
        } else {
            0.0
        };

        let wheel_torque = torque * total_ratio * TRANSMISSION_EFFICIENCY;
        let drive_force = wheel_torque / TIRE_RADIUS;

        let engine_brake = if !is_throttle && speed_ms > 1.0 {
            ENGINE_BRAKE_COEFFICIENT * self.engine_rpm * gear_ratio
        } else {
            0.0
        };

        let gear_display = if speed_ms < 0.0 {
            -1i8
        } else {
            (self.current_gear + 1) as i8
        };

        PowertrainOutput {
            drive_force: drive_force + ers_boost_n,
            engine_brake_force: engine_brake,
            rpm: self.engine_rpm,
            gear: gear_display,
            gear_ratio,
            total_gear_ratio: total_ratio,
            shift_state: self.shift_state,
            boost_multiplier,
        }
    }

    fn torque_curve(&self, rpm: f32) -> f32 {
        let x = rpm / PEAK_TORQUE_RPM;
        if x < 0.4 {
            PEAK_TORQUE_NM * (x / 0.4) * 0.7
        } else if x <= 1.0 {
            let t = (x - 0.4) / 0.6;
            PEAK_TORQUE_NM * (0.7 + t * 0.3)
        } else {
            let over = x - 1.0;
            let falloff = 1.0 - over * over * 0.9;
            PEAK_TORQUE_NM * falloff.max(0.3)
        }
    }

    fn effective_upshift_threshold(&self, max_speed_ms: f32) -> f32 {
        let gear_ratio = GEAR_RATIOS[self.current_gear as usize];
        let wheel_rpm_at_cap =
            max_speed_ms.max(0.0) / (TIRE_RADIUS * 2.0 * std::f32::consts::PI) * 60.0;
        let rpm_at_cap = wheel_rpm_at_cap * gear_ratio * FINAL_DRIVE;
        let cap_adjusted_threshold = rpm_at_cap * SPEED_CAP_UPSHIFT_FACTOR;

        UPSHIFT_RPM_THRESHOLD.min(cap_adjusted_threshold)
    }

    fn next_gear_rpm(&self, speed_ms: f32) -> Option<f32> {
        let next_gear_index = self.current_gear as usize + 1;
        if next_gear_index >= GEAR_RATIOS.len() {
            return None;
        }

        let next_ratio = GEAR_RATIOS[next_gear_index] * FINAL_DRIVE;
        let wheel_rpm = speed_ms / (TIRE_RADIUS * 2.0 * std::f32::consts::PI) * 60.0;
        Some((wheel_rpm * next_ratio).clamp(IDLE_RPM, REDLINE_RPM))
    }

    fn update_shift(&mut self, dt: f32, speed_ms: f32, is_throttle: bool, max_speed_ms: f32) {
        self.cap_assist_upshift_cooldown = (self.cap_assist_upshift_cooldown - dt).max(0.0);

        if self.shift_state == ShiftState::Shifting {
            self.shift_timer -= dt;
            if self.shift_timer <= 0.0 {
                self.shift_state = ShiftState::Engaged;
                self.shift_timer = 0.0;
            }
            return;
        }

        if !is_throttle {
            if self.engine_rpm < DOWNSHIFT_RPM_THRESHOLD && self.current_gear > 0 {
                self.current_gear -= 1;
                self.shift_state = ShiftState::Shifting;
                self.shift_timer = SHIFT_TIME_S;
            }
            return;
        }

        let upshift_threshold = self.effective_upshift_threshold(max_speed_ms);
        let rpm_based_upshift = self.engine_rpm > UPSHIFT_RPM_THRESHOLD;
        let cap_assist_upshift = self.engine_rpm > upshift_threshold
            && !rpm_based_upshift
            && self.cap_assist_upshift_cooldown <= 0.0;
        let next_gear_stable = self
            .next_gear_rpm(speed_ms)
            .is_some_and(|rpm| rpm >= DOWNSHIFT_RPM_THRESHOLD);

        if (rpm_based_upshift || cap_assist_upshift)
            && (self.current_gear as usize) < GEAR_RATIOS.len() - 1
            && next_gear_stable
        {
            self.current_gear += 1;
            self.shift_state = ShiftState::Shifting;
            self.shift_timer = SHIFT_TIME_S;
            if cap_assist_upshift {
                self.cap_assist_upshift_cooldown = CAP_ASSIST_UPSHIFT_COOLDOWN_S;
            }
        } else if self.engine_rpm < DOWNSHIFT_RPM_THRESHOLD && self.current_gear > 0 {
            self.current_gear -= 1;
            self.shift_state = ShiftState::Shifting;
            self.shift_timer = SHIFT_TIME_S;
        }
    }

    pub fn get_rpm(&self) -> f32 {
        self.engine_rpm
    }

    pub fn get_gear(&self) -> u8 {
        self.current_gear
    }
}

#[derive(Debug, Clone, Copy)]
pub struct PowertrainOutput {
    pub drive_force: f32,
    pub engine_brake_force: f32,
    pub rpm: f32,
    pub gear: i8,
    /// Current gear ratio (without final drive).
    pub gear_ratio: f32,
    /// Total transmission ratio: `gear_ratio × FINAL_DRIVE`. Wave 3
    /// Phase 5 consumes this for engine-inertia reflection at the
    /// driven wheels.
    pub total_gear_ratio: f32,
    pub shift_state: ShiftState,
    /// Multiplier on ICE torque from the turbo subsystem (`[0.5, 1.0]`).
    /// `1.0` at full boost (= calibrated peak-torque baseline); drops to
    /// 0.5 at atmospheric pressure during spool-up. `1.0` is also the
    /// default when boost is not turbo-driven.
    pub boost_multiplier: f32,
}

#[inline]
fn lerp_f32(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t.clamp(0.0, 1.0)
}

pub fn max_speed_in_gear(gear_index: u8) -> f32 {
    let ratio = GEAR_RATIOS[gear_index as usize] * FINAL_DRIVE;
    REDLINE_RPM / 60.0 * (TIRE_RADIUS * 2.0 * std::f32::consts::PI) / ratio
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_torque_curve_peaks_near_peak_rpm() {
        let pt = PowertrainState::new();
        let at_peak = pt.torque_curve(PEAK_TORQUE_RPM);
        let before_peak = pt.torque_curve(PEAK_TORQUE_RPM * 0.8);
        let after_peak = pt.torque_curve(REDLINE_RPM);
        assert!(
            at_peak >= before_peak,
            "Torque at peak RPM ({}) should be >= before peak ({})",
            at_peak,
            before_peak
        );
        assert!(
            at_peak > after_peak,
            "Torque at peak RPM ({}) should be > at redline ({})",
            at_peak,
            after_peak
        );
    }

    #[test]
    fn test_torque_curve_redline_drops() {
        let pt = PowertrainState::new();
        let at_redline = pt.torque_curve(REDLINE_RPM);
        assert!(
            at_redline < PEAK_TORQUE_NM,
            "Torque at redline ({}) should be < peak torque ({})",
            at_redline,
            PEAK_TORQUE_NM
        );
    }

    #[test]
    fn test_gear_1_more_force_than_gear_8() {
        let mut pt1 = PowertrainState::new();
        pt1.current_gear = 0;
        let out1 = pt1.update(&PowertrainInput::baseline(1.0 / 60.0, 10.0, 97.0, true));

        let mut pt8 = PowertrainState::new();
        pt8.current_gear = 7;
        let out8 = pt8.update(&PowertrainInput::baseline(1.0 / 60.0, 10.0, 97.0, true));

        assert!(
            out1.drive_force > out8.drive_force,
            "1st gear force ({}) should be > 8th gear force ({})",
            out1.drive_force,
            out8.drive_force
        );
    }

    #[test]
    fn test_max_speed_increases_with_gear() {
        for i in 0..7 {
            let lower = max_speed_in_gear(i);
            let higher = max_speed_in_gear(i + 1);
            assert!(
                higher > lower,
                "Gear {} max speed ({}) should be < gear {} max speed ({})",
                i + 1,
                lower,
                i + 2,
                higher
            );
        }
    }

    #[test]
    fn test_shift_interrupts_power() {
        let mut pt = PowertrainState::new();
        pt.current_gear = 3;
        pt.engine_rpm = UPSHIFT_RPM_THRESHOLD + 100.0;
        pt.update(&PowertrainInput::baseline(1.0 / 60.0, 95.0, 97.0, true));
        assert_eq!(pt.shift_state, ShiftState::Shifting);

        let out = pt.update(&PowertrainInput::baseline(1.0 / 60.0, 95.0, 97.0, true));
        assert!(
            out.drive_force.abs() < 1.0,
            "Drive force should be ~0 during shift, got {}",
            out.drive_force
        );
    }

    #[test]
    fn test_rpm_from_wheel_speed() {
        let mut pt = PowertrainState::new();
        pt.current_gear = 3;
        let out = pt.update(&PowertrainInput::baseline(1.0 / 60.0, 30.0, 97.0, true));
        assert!(
            out.rpm > IDLE_RPM,
            "RPM at 30m/s in 4th gear should be above idle, got {}",
            out.rpm
        );
        assert!(
            out.rpm <= REDLINE_RPM,
            "RPM should not exceed redline, got {}",
            out.rpm
        );
    }

    #[test]
    fn test_engine_braking_increases_with_rpm() {
        let mut pt_low = PowertrainState::new();
        pt_low.current_gear = 5;
        pt_low.engine_rpm = 7000.0;
        let out_low = pt_low.update(&PowertrainInput::baseline(1.0 / 60.0, 40.0, 97.0, false));

        let mut pt_high = PowertrainState::new();
        pt_high.current_gear = 2;
        pt_high.engine_rpm = 12000.0;
        let out_high = pt_high.update(&PowertrainInput::baseline(1.0 / 60.0, 40.0, 97.0, false));

        assert!(
            out_high.engine_brake_force > out_low.engine_brake_force,
            "High RPM engine brake ({}) should be > low RPM ({})",
            out_high.engine_brake_force,
            out_low.engine_brake_force
        );
    }

    #[test]
    fn test_ers_boost_adds_to_drive_force() {
        let mut pt = PowertrainState::new();
        pt.current_gear = 3;
        let out_no_ers = pt.update(&PowertrainInput::baseline(1.0 / 60.0, 30.0, 97.0, true));

        let mut pt2 = PowertrainState::new();
        pt2.current_gear = 3;
        let out_ers = pt2.update(&PowertrainInput {
            ers_boost_n: 2000.0,
            ..PowertrainInput::baseline(1.0 / 60.0, 30.0, 97.0, true)
        });

        assert!(
            (out_ers.drive_force - out_no_ers.drive_force - 2000.0).abs() < 1.0,
            "ERS boost should add exactly to drive force"
        );
    }

    #[test]
    fn test_idle_rpm_when_stationary() {
        let mut pt = PowertrainState::new();
        let out = pt.update(&PowertrainInput::baseline(1.0, 0.0, 97.0, false));
        assert!(
            (out.rpm - IDLE_RPM).abs() < 500.0,
            "RPM when stationary should be near idle ({}), got {}",
            IDLE_RPM,
            out.rpm
        );
    }

    #[test]
    fn test_upshifts_near_speed_cap_even_below_base_threshold() {
        let mut pt = PowertrainState::new();
        pt.current_gear = 3;
        pt.engine_rpm = 12700.0;

        pt.update(&PowertrainInput::baseline(1.0 / 60.0, 94.5, 97.0, true));

        assert_eq!(
            pt.get_gear(),
            4,
            "Powertrain should upshift from 4th to 5th near speed cap"
        );
        assert_eq!(pt.shift_state, ShiftState::Shifting);
    }

    #[test]
    fn test_no_upshift_if_next_gear_would_immediately_downshift() {
        let mut pt = PowertrainState::new();
        pt.current_gear = 6;
        pt.engine_rpm = 7000.0;

        pt.update(&PowertrainInput::baseline(1.0 / 60.0, 81.5, 81.5, true));

        assert_eq!(pt.get_gear(), 6);
        assert_eq!(pt.shift_state, ShiftState::Engaged);
    }

    // Wave-1 Phase-2 (Step 2.5) replaces this baseline with an
    // `engine_torque_nm` assertion once drive force routes through per-wheel
    // slip ratio. Until then, lock the legacy scalar `drive_force` value.
    #[test]
    fn test_pre_goal2_drive_force_baseline_at_30ms_gear2() {
        let mut pt = PowertrainState::new();
        pt.current_gear = 1;
        pt.engine_rpm = 8500.0;
        let out = pt.update(&PowertrainInput::baseline(1.0 / 60.0, 30.0, 97.0, true));

        assert_eq!(
            pt.shift_state,
            ShiftState::Engaged,
            "Baseline expects Engaged shift state, got {:?}",
            pt.shift_state
        );

        // Wave 4 Phase 3 dropped 6505 → 5919 (radius 0.33 → 0.36).
        // Wave 4 Phase 4 lifts to 7477 (PEAK_TORQUE_NM 380 → 480 = +26%).
        const BASELINE_DRIVE_FORCE_N: f32 = 7477.1807;
        const TOLERANCE_PCT: f32 = 0.01;
        let delta = (out.drive_force - BASELINE_DRIVE_FORCE_N).abs();
        let allowed = BASELINE_DRIVE_FORCE_N.abs() * TOLERANCE_PCT;
        assert!(
            delta <= allowed,
            "drive_force drifted: got {}, baseline {}, allowed delta {} (1%)",
            out.drive_force,
            BASELINE_DRIVE_FORCE_N,
            allowed
        );
    }

    #[test]
    fn test_drive_force_with_zero_boost_at_30ms_gear2() {
        let mut pt = PowertrainState::new();
        pt.current_gear = 1;
        pt.engine_rpm = 8500.0;
        let out = pt.update(&PowertrainInput {
            boost_multiplier: 0.5,
            ..PowertrainInput::baseline(1.0 / 60.0, 30.0, 97.0, true)
        });
        let baseline_at_unit_boost: f32 = 7477.1807;
        let expected = baseline_at_unit_boost * 0.5;
        let delta = (out.drive_force - expected).abs();
        assert!(
            delta <= expected.abs() * 0.01,
            "zero-boost drive_force: got {}, want {}",
            out.drive_force,
            expected
        );
    }

    #[test]
    fn test_drive_force_invariant_at_unit_boost_at_30ms_gear2() {
        let mut pt = PowertrainState::new();
        pt.current_gear = 1;
        pt.engine_rpm = 8500.0;
        let out = pt.update(&PowertrainInput::baseline(1.0 / 60.0, 30.0, 97.0, true));
        let baseline: f32 = 7477.1807;
        let delta = (out.drive_force - baseline).abs();
        assert!(
            delta <= baseline.abs() * 0.01,
            "unit-boost drive_force should equal mechanical baseline: got {}, want {}",
            out.drive_force,
            baseline
        );
    }

    #[test]
    fn test_boost_multiplier_is_finite_or_one() {
        let mut pt = PowertrainState::new();
        pt.current_gear = 1;
        pt.engine_rpm = 8500.0;
        let out_nan = pt.update(&PowertrainInput {
            boost_multiplier: f32::NAN,
            ..PowertrainInput::baseline(1.0 / 60.0, 30.0, 97.0, true)
        });
        let baseline: f32 = 7477.1807;
        let delta = (out_nan.drive_force - baseline).abs();
        assert!(
            delta <= baseline.abs() * 0.01,
            "NaN boost_multiplier should fall back to 1.0; got drive_force {}",
            out_nan.drive_force
        );
    }

    #[test]
    fn test_cap_assist_upshift_does_not_chain_immediately() {
        let mut pt = PowertrainState::new();
        pt.current_gear = 3;
        pt.engine_rpm = 12700.0;

        pt.update(&PowertrainInput::baseline(1.0 / 60.0, 94.5, 97.0, true));
        assert_eq!(pt.get_gear(), 4);

        for _ in 0..8 {
            pt.update(&PowertrainInput::baseline(1.0 / 60.0, 94.5, 97.0, true));
        }

        assert_eq!(pt.get_gear(), 4);
        assert_eq!(pt.shift_state, ShiftState::Engaged);
    }
}
