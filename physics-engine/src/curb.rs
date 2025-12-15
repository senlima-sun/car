use crate::types::{CurbModifiers, CurbSide};

#[derive(Debug, Default)]
pub struct CurbState {
    is_on_curb: bool,
    side: Option<CurbSide>,
    modifiers: CurbModifiers,
}

impl CurbState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_on_curb(&mut self, is_on_curb: bool, side: Option<CurbSide>) {
        self.is_on_curb = is_on_curb;
        self.side = side;

        if is_on_curb {
            self.modifiers = CurbModifiers::default();
        }
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
