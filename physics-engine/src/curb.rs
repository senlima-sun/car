use crate::constants::curb::{amplitude_for_type, grip_for_type, TOOTH_SPACING};
use crate::types::{CurbModifiers, CurbSide, CurbType};

#[derive(Debug, Default)]
pub struct CurbState {
    is_on_curb: bool,
    side: Option<CurbSide>,
    curb_type: CurbType,
    modifiers: CurbModifiers,
    time_on_curb: f32,
}

impl CurbState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_on_curb(&mut self, is_on_curb: bool, side: Option<CurbSide>, curb_type: CurbType) {
        self.is_on_curb = is_on_curb;
        self.side = side;
        self.curb_type = curb_type;

        if is_on_curb {
            self.modifiers = CurbModifiers::for_type(curb_type);
        } else {
            self.time_on_curb = 0.0;
        }
    }

    pub fn update(&mut self, dt: f32, speed_ms: f32) -> f32 {
        if !self.is_on_curb {
            return 0.0;
        }

        self.time_on_curb += dt;

        let vibration_amplitude = amplitude_for_type(self.curb_type);

        if vibration_amplitude < 0.001 {
            return 0.0;
        }

        let frequency = speed_ms / TOOTH_SPACING;
        let speed_factor = (speed_ms / 50.0).min(0.8).max(0.15);
        let oscillation = (self.time_on_curb * frequency * std::f32::consts::TAU).sin();

        vibration_amplitude * oscillation * speed_factor
    }

    pub fn is_on_curb(&self) -> bool {
        self.is_on_curb
    }

    pub fn get_side(&self) -> Option<CurbSide> {
        self.side
    }

    pub fn get_curb_type(&self) -> CurbType {
        self.curb_type
    }

    pub fn get_modifiers(&self) -> &CurbModifiers {
        &self.modifiers
    }

    pub fn get_turn_grip_modifier(&self, _steering_direction: f32) -> f32 {
        if !self.is_on_curb {
            return 1.0;
        }
        grip_for_type(self.curb_type)
    }

    pub fn get_turn_stability_modifier(&self, _steering_direction: f32) -> f32 {
        if !self.is_on_curb {
            return 1.0;
        }
        self.modifiers.lateral_stability
    }

    pub fn get_speed_effect(&self, current_speed: f32, car_mass: f32) -> f32 {
        if !self.is_on_curb || current_speed.abs() < 1.0 {
            return 0.0;
        }

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
        state.set_on_curb(true, Some(CurbSide::Left), CurbType::Apex);

        assert!(state.is_on_curb());
        assert_eq!(state.get_side(), Some(CurbSide::Left));
        assert_eq!(state.get_curb_type(), CurbType::Apex);
    }

    #[test]
    fn test_apex_grip() {
        let mut state = CurbState::new();
        state.set_on_curb(true, Some(CurbSide::Left), CurbType::Apex);
        let grip = state.get_turn_grip_modifier(-1.0);
        assert!((grip - 0.97).abs() < 0.01);
    }

    #[test]
    fn test_exit_grip_lower_than_apex() {
        let mut state_apex = CurbState::new();
        state_apex.set_on_curb(true, Some(CurbSide::Left), CurbType::Apex);
        let grip_apex = state_apex.get_turn_grip_modifier(-1.0);

        let mut state_exit = CurbState::new();
        state_exit.set_on_curb(true, Some(CurbSide::Left), CurbType::Exit);
        let grip_exit = state_exit.get_turn_grip_modifier(-1.0);

        assert!(grip_apex > grip_exit);
    }

    #[test]
    fn test_speed_effect() {
        let mut state = CurbState::new();
        state.set_on_curb(true, None, CurbType::Apex);

        let drag = state.get_speed_effect(30.0, 600.0);
        assert!(drag > 0.0);

        state.set_on_curb(false, None, CurbType::Apex);
        let drag = state.get_speed_effect(30.0, 600.0);
        assert!((drag - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_speed_dependent_frequency() {
        let mut state = CurbState::new();
        state.set_on_curb(true, None, CurbType::Exit);

        state.time_on_curb = 0.5;

        let bump_slow = state.update(1.0 / 120.0, 10.0);
        state.time_on_curb = 0.5;
        let bump_fast = state.update(1.0 / 120.0, 40.0);

        assert!(bump_slow.abs() > 0.0 || bump_fast.abs() > 0.0);
    }

    #[test]
    fn test_flat_zero_bump() {
        let mut state = CurbState::new();
        state.set_on_curb(true, None, CurbType::Flat);

        state.time_on_curb = 0.5;

        let bump = state.update(1.0 / 120.0, 30.0);
        assert!((bump).abs() < 0.001);
    }

    #[test]
    fn test_exit_higher_amplitude() {
        assert!(amplitude_for_type(CurbType::Exit) > amplitude_for_type(CurbType::Apex));
    }

    #[test]
    fn test_vibration_zero_when_off_curb() {
        let mut state = CurbState::new();
        let vib = state.update(1.0 / 120.0, 30.0);
        assert!((vib).abs() < 0.001);
    }

    #[test]
    fn test_vibration_increases_with_speed() {
        let mut state = CurbState::new();
        state.set_on_curb(true, None, CurbType::Exit);
        state.time_on_curb = 0.25;

        let vib_slow = state.update(1.0 / 120.0, 5.0).abs();
        state.time_on_curb = 0.25;
        let vib_fast = state.update(1.0 / 120.0, 45.0).abs();

        assert!(vib_fast > vib_slow);
    }
}
