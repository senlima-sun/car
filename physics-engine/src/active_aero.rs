use crate::types::{AeroMode, ActiveAeroState};

// Active Aero Constants (2026 F1-style regulations)

// Corner Mode: Max downforce, high drag (default configuration)
const CORNER_DRAG_MULT: f32 = 1.0;
const CORNER_DOWNFORCE_MULT: f32 = 1.0;

// Straight Mode: Low drag, reduced downforce (wings open)
const STRAIGHT_DRAG_MULT: f32 = 0.65; // 35% drag reduction
const STRAIGHT_DOWNFORCE_MULT: f32 = 0.55; // 45% downforce reduction

// Wing transition speed
const WING_LERP_SPEED: f32 = 2.0; // ~0.5 seconds for full transition
const REAR_WING_SPEED_MULT: f32 = 1.2; // Rear wing moves 20% faster than front

/// Active Aero Physics State Machine
#[derive(Debug, Default)]
pub struct ActiveAeroPhysicsState {
    current: ActiveAeroState,
}

impl ActiveAeroPhysicsState {
    pub fn new() -> Self {
        Self {
            current: ActiveAeroState {
                mode: AeroMode::Corner,
                front_wing_angle: 0.0, // Closed = max downforce
                rear_wing_angle: 0.0,  // Closed = max downforce
                drag_multiplier: CORNER_DRAG_MULT,
                downforce_multiplier: CORNER_DOWNFORCE_MULT,
            },
        }
    }

    /// Update active aero state, transitioning wing angles toward target mode
    pub fn update(&mut self, delta: f32) -> ActiveAeroState {
        let dt = delta.min(0.05);

        // Determine target wing angles based on mode
        let target_angle = match self.current.mode {
            AeroMode::Corner => 0.0,   // Closed (max downforce)
            AeroMode::Straight => 1.0, // Open (low drag)
        };

        // Lerp front wing toward target
        let front_delta = (target_angle - self.current.front_wing_angle) * WING_LERP_SPEED * dt;
        self.current.front_wing_angle = (self.current.front_wing_angle + front_delta).clamp(0.0, 1.0);

        // Lerp rear wing toward target (slightly faster)
        let rear_delta = (target_angle - self.current.rear_wing_angle) * WING_LERP_SPEED * REAR_WING_SPEED_MULT * dt;
        self.current.rear_wing_angle = (self.current.rear_wing_angle + rear_delta).clamp(0.0, 1.0);

        // Calculate average wing angle for multiplier interpolation
        let avg_wing_angle = (self.current.front_wing_angle + self.current.rear_wing_angle) / 2.0;

        // Interpolate drag multiplier: 1.0 (corner) -> 0.65 (straight)
        self.current.drag_multiplier = lerp(CORNER_DRAG_MULT, STRAIGHT_DRAG_MULT, avg_wing_angle);

        // Interpolate downforce multiplier: 1.0 (corner) -> 0.55 (straight)
        self.current.downforce_multiplier = lerp(CORNER_DOWNFORCE_MULT, STRAIGHT_DOWNFORCE_MULT, avg_wing_angle);

        self.current
    }

    /// Get current active aero state
    pub fn get_state(&self) -> ActiveAeroState {
        self.current
    }

    /// Set aero mode
    pub fn set_mode(&mut self, mode: AeroMode) {
        self.current.mode = mode;
    }

    /// Get current mode
    pub fn get_mode(&self) -> AeroMode {
        self.current.mode
    }

    /// Toggle between Corner and Straight modes
    pub fn toggle_mode(&mut self) {
        self.current.mode = match self.current.mode {
            AeroMode::Corner => AeroMode::Straight,
            AeroMode::Straight => AeroMode::Corner,
        };
    }

    /// Get drag multiplier for aerodynamics calculations
    pub fn get_drag_multiplier(&self) -> f32 {
        self.current.drag_multiplier
    }

    /// Get downforce multiplier for aerodynamics calculations
    pub fn get_downforce_multiplier(&self) -> f32 {
        self.current.downforce_multiplier
    }

    /// Reset to default state
    pub fn reset(&mut self) {
        *self = Self::new();
    }
}

/// Linear interpolation helper
#[inline]
fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_active_aero_default() {
        let state = ActiveAeroPhysicsState::new();
        assert_eq!(state.current.mode, AeroMode::Corner);
        assert!((state.current.front_wing_angle - 0.0).abs() < 0.01);
        assert!((state.current.rear_wing_angle - 0.0).abs() < 0.01);
        assert!((state.current.drag_multiplier - 1.0).abs() < 0.01);
        assert!((state.current.downforce_multiplier - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_mode_toggle() {
        let mut state = ActiveAeroPhysicsState::new();
        assert_eq!(state.get_mode(), AeroMode::Corner);

        state.toggle_mode();
        assert_eq!(state.get_mode(), AeroMode::Straight);

        state.toggle_mode();
        assert_eq!(state.get_mode(), AeroMode::Corner);
    }

    #[test]
    fn test_wing_transition_to_straight() {
        let mut state = ActiveAeroPhysicsState::new();
        state.set_mode(AeroMode::Straight);

        for _ in 0..120 {
            state.update(1.0 / 60.0);
        }

        assert!(state.current.front_wing_angle > 0.9);
        assert!(state.current.rear_wing_angle > 0.95);

        // Multipliers should be close to straight mode values
        assert!((state.current.drag_multiplier - STRAIGHT_DRAG_MULT).abs() < 0.1);
        assert!((state.current.downforce_multiplier - STRAIGHT_DOWNFORCE_MULT).abs() < 0.1);
    }

    #[test]
    fn test_wing_transition_to_corner() {
        let mut state = ActiveAeroPhysicsState::new();

        // First transition to straight mode
        state.set_mode(AeroMode::Straight);
        for _ in 0..60 {
            state.update(1.0 / 60.0);
        }

        state.set_mode(AeroMode::Corner);
        for _ in 0..120 {
            state.update(1.0 / 60.0);
        }

        assert!(state.current.front_wing_angle < 0.1);
        assert!(state.current.rear_wing_angle < 0.05);

        // Multipliers should be back to corner mode values
        assert!((state.current.drag_multiplier - CORNER_DRAG_MULT).abs() < 0.1);
        assert!((state.current.downforce_multiplier - CORNER_DOWNFORCE_MULT).abs() < 0.1);
    }

    #[test]
    fn test_rear_wing_faster_than_front() {
        let mut state = ActiveAeroPhysicsState::new();
        state.set_mode(AeroMode::Straight);

        // Update once
        state.update(1.0 / 60.0);

        // Rear wing should have moved more than front wing
        assert!(state.current.rear_wing_angle > state.current.front_wing_angle);
    }

    #[test]
    fn test_drag_reduction() {
        let mut state = ActiveAeroPhysicsState::new();

        // Start in corner mode
        let corner_drag = state.get_drag_multiplier();
        assert!((corner_drag - 1.0).abs() < 0.01);

        // Transition to straight mode
        state.set_mode(AeroMode::Straight);
        for _ in 0..60 {
            state.update(1.0 / 60.0);
        }

        let straight_drag = state.get_drag_multiplier();

        // Should have ~35% drag reduction
        assert!(straight_drag < corner_drag);
        assert!((straight_drag - 0.65).abs() < 0.1);
    }

    #[test]
    fn test_downforce_reduction() {
        let mut state = ActiveAeroPhysicsState::new();

        // Start in corner mode
        let corner_downforce = state.get_downforce_multiplier();
        assert!((corner_downforce - 1.0).abs() < 0.01);

        // Transition to straight mode
        state.set_mode(AeroMode::Straight);
        for _ in 0..60 {
            state.update(1.0 / 60.0);
        }

        let straight_downforce = state.get_downforce_multiplier();

        // Should have ~45% downforce reduction
        assert!(straight_downforce < corner_downforce);
        assert!((straight_downforce - 0.55).abs() < 0.1);
    }

    #[test]
    fn test_gradual_transition() {
        let mut state = ActiveAeroPhysicsState::new();
        state.set_mode(AeroMode::Straight);

        let initial_drag = state.get_drag_multiplier();

        // Take a small step
        state.update(1.0 / 60.0);
        let after_one_frame = state.get_drag_multiplier();

        // Drag should have changed but not completed transition
        assert!(after_one_frame < initial_drag);
        assert!(after_one_frame > STRAIGHT_DRAG_MULT);
    }

    #[test]
    fn test_reset() {
        let mut state = ActiveAeroPhysicsState::new();

        // Transition to straight mode
        state.set_mode(AeroMode::Straight);
        for _ in 0..60 {
            state.update(1.0 / 60.0);
        }

        // Reset
        state.reset();

        // Should be back to default corner mode
        assert_eq!(state.get_mode(), AeroMode::Corner);
        assert!((state.current.front_wing_angle - 0.0).abs() < 0.01);
        assert!((state.current.rear_wing_angle - 0.0).abs() < 0.01);
    }
}
