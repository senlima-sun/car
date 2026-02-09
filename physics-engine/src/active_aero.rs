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

// Auto mode speed thresholds (km/h)
const AUTO_LOW_SPEED: f32 = 150.0;  // Below: full downforce
const AUTO_HIGH_SPEED: f32 = 250.0; // Above: minimum drag

/// Active Aero Physics State Machine
#[derive(Debug)]
pub struct ActiveAeroPhysicsState {
    current: ActiveAeroState,
    auto_mode: bool,
}

impl Default for ActiveAeroPhysicsState {
    fn default() -> Self {
        Self::new()
    }
}

impl ActiveAeroPhysicsState {
    pub fn new() -> Self {
        Self {
            current: ActiveAeroState {
                mode: AeroMode::Corner,
                front_wing_angle: 0.0,
                rear_wing_angle: 0.0,
                drag_multiplier: CORNER_DRAG_MULT,
                downforce_multiplier: CORNER_DOWNFORCE_MULT,
                auto_mode: true,
            },
            auto_mode: true,
        }
    }

    /// Update active aero state. In auto mode, adjusts wings based on speed.
    pub fn update(&mut self, delta: f32, speed_ms: f32) -> ActiveAeroState {
        let dt = delta.min(0.05);
        let speed_kmh = speed_ms * 3.6;

        // In auto mode, determine target based on speed
        if self.auto_mode {
            if speed_kmh < AUTO_LOW_SPEED {
                self.current.mode = AeroMode::Corner;
            } else if speed_kmh > AUTO_HIGH_SPEED {
                self.current.mode = AeroMode::Straight;
            } else {
                // Transition zone: use Straight mode but wing angle will interpolate
                self.current.mode = AeroMode::Straight;
            }
        }

        // Determine target wing angle
        let target_angle = if self.auto_mode {
            if speed_kmh <= AUTO_LOW_SPEED {
                0.0
            } else if speed_kmh >= AUTO_HIGH_SPEED {
                1.0
            } else {
                // Smooth transition between thresholds
                (speed_kmh - AUTO_LOW_SPEED) / (AUTO_HIGH_SPEED - AUTO_LOW_SPEED)
            }
        } else {
            match self.current.mode {
                AeroMode::Corner => 0.0,
                AeroMode::Straight => 1.0,
            }
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

    /// Set aero mode (manual override)
    pub fn set_mode(&mut self, mode: AeroMode) {
        self.current.mode = mode;
        // Setting mode explicitly disables auto
        self.auto_mode = false;
        self.current.auto_mode = false;
    }

    /// Get current mode
    pub fn get_mode(&self) -> AeroMode {
        self.current.mode
    }

    /// Toggle between auto and manual modes. In manual, falls back to toggle Corner/Straight.
    pub fn toggle_mode(&mut self) {
        if self.auto_mode {
            // Switch to manual, keep current effective mode
            self.auto_mode = false;
            self.current.auto_mode = false;
        } else {
            // In manual mode, toggle Corner/Straight
            self.current.mode = match self.current.mode {
                AeroMode::Corner => AeroMode::Straight,
                AeroMode::Straight => AeroMode::Corner,
            };
        }
    }

    /// Toggle auto mode on/off
    pub fn toggle_auto(&mut self) {
        self.auto_mode = !self.auto_mode;
        self.current.auto_mode = self.auto_mode;
    }

    /// Check if in auto mode
    pub fn is_auto(&self) -> bool {
        self.auto_mode
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
        assert!(state.is_auto());
    }

    #[test]
    fn test_mode_toggle() {
        let mut state = ActiveAeroPhysicsState::new();
        // First toggle: auto -> manual
        state.toggle_mode();
        assert!(!state.is_auto());

        // In manual mode, toggle Corner/Straight
        state.toggle_mode();
        assert_eq!(state.get_mode(), AeroMode::Straight);

        state.toggle_mode();
        assert_eq!(state.get_mode(), AeroMode::Corner);
    }

    #[test]
    fn test_wing_transition_to_straight() {
        let mut state = ActiveAeroPhysicsState::new();
        state.set_mode(AeroMode::Straight); // Sets manual mode

        for _ in 0..120 {
            state.update(1.0 / 60.0, 0.0);
        }

        assert!(state.current.front_wing_angle > 0.9);
        assert!(state.current.rear_wing_angle > 0.95);
        assert!((state.current.drag_multiplier - STRAIGHT_DRAG_MULT).abs() < 0.1);
        assert!((state.current.downforce_multiplier - STRAIGHT_DOWNFORCE_MULT).abs() < 0.1);
    }

    #[test]
    fn test_wing_transition_to_corner() {
        let mut state = ActiveAeroPhysicsState::new();
        state.set_mode(AeroMode::Straight);
        for _ in 0..60 {
            state.update(1.0 / 60.0, 0.0);
        }

        state.set_mode(AeroMode::Corner);
        for _ in 0..120 {
            state.update(1.0 / 60.0, 0.0);
        }

        assert!(state.current.front_wing_angle < 0.1);
        assert!(state.current.rear_wing_angle < 0.05);
        assert!((state.current.drag_multiplier - CORNER_DRAG_MULT).abs() < 0.1);
        assert!((state.current.downforce_multiplier - CORNER_DOWNFORCE_MULT).abs() < 0.1);
    }

    #[test]
    fn test_rear_wing_faster_than_front() {
        let mut state = ActiveAeroPhysicsState::new();
        state.set_mode(AeroMode::Straight);
        state.update(1.0 / 60.0, 0.0);
        assert!(state.current.rear_wing_angle > state.current.front_wing_angle);
    }

    #[test]
    fn test_drag_reduction() {
        let mut state = ActiveAeroPhysicsState::new();
        let corner_drag = state.get_drag_multiplier();
        assert!((corner_drag - 1.0).abs() < 0.01);

        state.set_mode(AeroMode::Straight);
        for _ in 0..60 {
            state.update(1.0 / 60.0, 0.0);
        }

        let straight_drag = state.get_drag_multiplier();
        assert!(straight_drag < corner_drag);
        assert!((straight_drag - 0.65).abs() < 0.1);
    }

    #[test]
    fn test_downforce_reduction() {
        let mut state = ActiveAeroPhysicsState::new();
        let corner_downforce = state.get_downforce_multiplier();
        assert!((corner_downforce - 1.0).abs() < 0.01);

        state.set_mode(AeroMode::Straight);
        for _ in 0..60 {
            state.update(1.0 / 60.0, 0.0);
        }

        let straight_downforce = state.get_downforce_multiplier();
        assert!(straight_downforce < corner_downforce);
        assert!((straight_downforce - 0.55).abs() < 0.1);
    }

    #[test]
    fn test_gradual_transition() {
        let mut state = ActiveAeroPhysicsState::new();
        state.set_mode(AeroMode::Straight);
        let initial_drag = state.get_drag_multiplier();

        state.update(1.0 / 60.0, 0.0);
        let after_one_frame = state.get_drag_multiplier();
        assert!(after_one_frame < initial_drag);
        assert!(after_one_frame > STRAIGHT_DRAG_MULT);
    }

    #[test]
    fn test_auto_mode_low_speed() {
        let mut state = ActiveAeroPhysicsState::new();
        assert!(state.is_auto());

        // Low speed: should stay in corner mode (max downforce)
        for _ in 0..60 {
            state.update(1.0 / 60.0, 30.0); // ~108 km/h
        }
        assert!((state.current.drag_multiplier - CORNER_DRAG_MULT).abs() < 0.1);
    }

    #[test]
    fn test_auto_mode_high_speed() {
        let mut state = ActiveAeroPhysicsState::new();
        assert!(state.is_auto());

        // High speed: should switch to straight mode (low drag)
        for _ in 0..120 {
            state.update(1.0 / 60.0, 80.0); // ~288 km/h
        }
        assert!((state.current.drag_multiplier - STRAIGHT_DRAG_MULT).abs() < 0.15);
    }

    #[test]
    fn test_auto_mode_mid_speed() {
        let mut state = ActiveAeroPhysicsState::new();

        // Mid speed: should be between corner and straight
        for _ in 0..120 {
            state.update(1.0 / 60.0, 55.0); // ~200 km/h (50% between 150-250)
        }
        // Should be roughly halfway between corner and straight
        assert!(state.current.drag_multiplier < CORNER_DRAG_MULT);
        assert!(state.current.drag_multiplier > STRAIGHT_DRAG_MULT);
    }

    #[test]
    fn test_reset() {
        let mut state = ActiveAeroPhysicsState::new();
        state.set_mode(AeroMode::Straight);
        for _ in 0..60 {
            state.update(1.0 / 60.0, 0.0);
        }

        state.reset();
        assert_eq!(state.get_mode(), AeroMode::Corner);
        assert!((state.current.front_wing_angle - 0.0).abs() < 0.01);
        assert!((state.current.rear_wing_angle - 0.0).abs() < 0.01);
        assert!(state.is_auto());
    }
}
