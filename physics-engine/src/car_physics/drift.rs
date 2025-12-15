use super::{DRIFT_ENTRY_SLIP_ANGLE, DRIFT_EXIT_SLIP_ANGLE, MIN_DRIFT_SPEED};

const DRIFT_LATERAL_CORRECTION: f32 = 0.55;
const NORMAL_LATERAL_CORRECTION: f32 = 0.92;

#[derive(Debug, Default)]
pub struct DriftState {
    is_drifting: bool,
}

impl DriftState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Update drift state based on slip angle and speed
    pub fn update(&mut self, abs_slip_angle: f32, speed_kmh: f32, weather_multiplier: f32) {
        let entry_threshold = DRIFT_ENTRY_SLIP_ANGLE * weather_multiplier;
        let exit_threshold = DRIFT_EXIT_SLIP_ANGLE * weather_multiplier;

        if !self.is_drifting {
            // Check for drift entry
            if abs_slip_angle > entry_threshold && speed_kmh > MIN_DRIFT_SPEED {
                self.is_drifting = true;
            }
        } else {
            // Check for drift exit
            if abs_slip_angle < exit_threshold {
                self.is_drifting = false;
            }
        }
    }

    pub fn is_drifting(&self) -> bool {
        self.is_drifting
    }

    /// Get lateral correction factor (how much slide is corrected each frame)
    pub fn get_lateral_correction(
        &self,
        grip: f32,
        weather_multiplier: f32,
        curb_stability: f32,
    ) -> f32 {
        let base_correction = if self.is_drifting {
            DRIFT_LATERAL_CORRECTION
        } else {
            // Grip affects correction when not drifting
            (0.88 + grip * 0.05).min(NORMAL_LATERAL_CORRECTION)
        };

        let corrected = base_correction * weather_multiplier;

        // Curb stability clamps to max 1.0
        (corrected * curb_stability).min(1.0)
    }

    /// Force exit drift state (e.g., when stopping)
    pub fn reset(&mut self) {
        self.is_drifting = false;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_drift_default() {
        let state = DriftState::new();
        assert!(!state.is_drifting());
    }

    #[test]
    fn test_drift_entry() {
        let mut state = DriftState::new();

        // High slip angle, sufficient speed
        state.update(20.0, 50.0, 1.0);
        assert!(state.is_drifting());
    }

    #[test]
    fn test_drift_no_entry_low_speed() {
        let mut state = DriftState::new();

        // High slip angle, but too slow
        state.update(20.0, 20.0, 1.0);
        assert!(!state.is_drifting());
    }

    #[test]
    fn test_drift_exit() {
        let mut state = DriftState::new();

        // Enter drift
        state.update(20.0, 50.0, 1.0);
        assert!(state.is_drifting());

        // Exit drift with low slip angle
        state.update(5.0, 50.0, 1.0);
        assert!(!state.is_drifting());
    }

    #[test]
    fn test_drift_hysteresis() {
        let mut state = DriftState::new();

        // Enter drift at 16° (> 15°)
        state.update(16.0, 50.0, 1.0);
        assert!(state.is_drifting());

        // Still drifting at 10° (between 8° and 15°)
        state.update(10.0, 50.0, 1.0);
        assert!(state.is_drifting()); // Should still be drifting due to hysteresis

        // Exit at 7° (< 8°)
        state.update(7.0, 50.0, 1.0);
        assert!(!state.is_drifting());
    }

    #[test]
    fn test_weather_affects_thresholds() {
        let mut state = DriftState::new();

        // Normal weather: 16° triggers drift (> 15°)
        state.update(16.0, 50.0, 1.0);
        assert!(state.is_drifting());

        state.reset();

        // Rain (0.5 multiplier): 8° should trigger drift (> 7.5°)
        state.update(8.0, 50.0, 0.5);
        assert!(state.is_drifting());
    }

    #[test]
    fn test_lateral_correction() {
        let mut state = DriftState::new();

        // Normal driving
        let correction = state.get_lateral_correction(1.0, 1.0, 1.0);
        assert!(correction > 0.9);

        // Enter drift
        state.update(20.0, 50.0, 1.0);
        let drift_correction = state.get_lateral_correction(1.0, 1.0, 1.0);
        assert!(drift_correction < 0.6);
    }
}
