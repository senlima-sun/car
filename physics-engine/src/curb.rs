use crate::types::{CurbModifiers, CurbSide};

// Curb bump parameters - pitch-based for realistic front-to-back motion
const BUMP_FREQUENCY: f32 = 18.0; // Hz - rumble strip frequency
const PITCH_AMPLITUDE: f32 = 0.15; // rad/s - pitch angular velocity amplitude
const ENTRY_PITCH_STRENGTH: f32 = 0.4; // rad/s - initial pitch when entering curb (nose up)
const ENTRY_PITCH_DURATION: f32 = 0.1; // seconds

#[derive(Debug, Default)]
pub struct CurbState {
    is_on_curb: bool,
    was_on_curb: bool, // Track previous frame state for entry detection
    side: Option<CurbSide>,
    modifiers: CurbModifiers,
    time_on_curb: f32, // Time spent on curb for oscillation
    entry_bump_timer: f32, // Timer for entry bump
}

impl CurbState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_on_curb(&mut self, is_on_curb: bool, side: Option<CurbSide>) {
        self.was_on_curb = self.is_on_curb;
        self.is_on_curb = is_on_curb;
        self.side = side;

        if is_on_curb {
            self.modifiers = CurbModifiers::default();
            // Detect entry - trigger entry bump
            if !self.was_on_curb {
                self.entry_bump_timer = ENTRY_PITCH_DURATION;
                self.time_on_curb = 0.0;
            }
        } else {
            self.time_on_curb = 0.0;
            self.entry_bump_timer = 0.0;
        }
    }

    /// Update curb timers and return pitch angular velocity for realistic bump effect
    /// Positive = nose up, negative = nose down
    pub fn update(&mut self, dt: f32, speed_ms: f32) -> f32 {
        if !self.is_on_curb {
            return 0.0;
        }

        self.time_on_curb += dt;

        // Entry pitch - nose lifts up when front wheels hit curb
        if self.entry_bump_timer > 0.0 {
            self.entry_bump_timer -= dt;
            // Start with nose up, then transition to nose down (rear wheels hitting)
            let progress = 1.0 - (self.entry_bump_timer / ENTRY_PITCH_DURATION);
            // Sine curve: 0->1 gives nose up then down
            let pitch_curve = (progress * std::f32::consts::PI).sin();
            let speed_factor = (speed_ms / 40.0).min(1.0);
            return ENTRY_PITCH_STRENGTH * pitch_curve * speed_factor;
        }

        // Continuous rumble - pitch oscillation simulating rumble strips
        let speed_factor = (speed_ms / 50.0).min(0.8).max(0.15);
        let oscillation = (self.time_on_curb * BUMP_FREQUENCY * std::f32::consts::TAU).sin();

        PITCH_AMPLITUDE * oscillation * speed_factor
    }

    pub fn is_on_curb(&self) -> bool {
        self.is_on_curb
    }

    pub fn get_side(&self) -> Option<CurbSide> {
        self.side
    }

    pub fn get_modifiers(&self) -> &CurbModifiers {
        &self.modifiers
    }

    /// Get grip modifier based on curb position relative to turn direction
    pub fn get_turn_grip_modifier(&self, steering_direction: f32) -> f32 {
        if !self.is_on_curb {
            return 1.0;
        }

        match self.side {
            Some(CurbSide::Left) => {
                if steering_direction < 0.0 {
                    // Entry curb (outside of turn) - more grip for turn-in
                    1.2
                } else {
                    // Exit curb (inside of turn)
                    1.1
                }
            }
            Some(CurbSide::Right) => {
                if steering_direction > 0.0 {
                    // Entry curb
                    1.2
                } else {
                    // Exit curb
                    1.1
                }
            }
            None => self.modifiers.grip_multiplier,
        }
    }

    /// Get lateral stability modifier based on curb position
    pub fn get_turn_stability_modifier(&self, steering_direction: f32) -> f32 {
        if !self.is_on_curb {
            return 1.0;
        }

        match self.side {
            Some(CurbSide::Left) => {
                if steering_direction < 0.0 {
                    1.15 // Entry curb - more stability
                } else {
                    1.05 // Exit curb
                }
            }
            Some(CurbSide::Right) => {
                if steering_direction > 0.0 {
                    1.15
                } else {
                    1.05
                }
            }
            None => self.modifiers.lateral_stability,
        }
    }

    /// Calculate speed reduction from curb
    pub fn get_speed_effect(&self, current_speed: f32, car_mass: f32) -> f32 {
        if !self.is_on_curb || current_speed.abs() < 1.0 {
            return 0.0;
        }

        // Drag force from curb
        let curb_drag = current_speed.abs() * car_mass * (1.0 - self.modifiers.speed_multiplier) * 0.5;
        curb_drag * current_speed.signum()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_curb_default() {
        let state = CurbState::new();
        assert!(!state.is_on_curb());
        assert!(state.get_side().is_none());
    }

    #[test]
    fn test_curb_set() {
        let mut state = CurbState::new();
        state.set_on_curb(true, Some(CurbSide::Left));

        assert!(state.is_on_curb());
        assert_eq!(state.get_side(), Some(CurbSide::Left));
    }

    #[test]
    fn test_entry_curb_grip() {
        let mut state = CurbState::new();
        state.set_on_curb(true, Some(CurbSide::Left));

        // Left curb, steering left (entry)
        let grip = state.get_turn_grip_modifier(-1.0);
        assert!((grip - 1.2).abs() < 0.01);

        // Left curb, steering right (exit)
        let grip = state.get_turn_grip_modifier(1.0);
        assert!((grip - 1.1).abs() < 0.01);
    }

    #[test]
    fn test_speed_effect() {
        let mut state = CurbState::new();
        state.set_on_curb(true, None);

        let drag = state.get_speed_effect(30.0, 600.0);
        assert!(drag > 0.0);

        // No effect when not on curb
        state.set_on_curb(false, None);
        let drag = state.get_speed_effect(30.0, 600.0);
        assert!((drag - 0.0).abs() < 0.001);
    }
}
