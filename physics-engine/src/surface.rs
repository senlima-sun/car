use crate::types::{SurfaceModifiers, SurfaceType};

/// Tracks the current surface the car is driving on
#[derive(Debug, Default)]
pub struct SurfaceState {
    current_surface: SurfaceType,
    modifiers: SurfaceModifiers,
}

impl SurfaceState {
    pub fn new() -> Self {
        Self {
            current_surface: SurfaceType::Grass,
            modifiers: SurfaceModifiers::grass(),
        }
    }

    /// Set the current surface type
    pub fn set_surface(&mut self, surface: SurfaceType) {
        if self.current_surface != surface {
            self.current_surface = surface;
            self.modifiers = SurfaceModifiers::for_surface(surface);
        }
    }

    /// Get the current surface type
    pub fn get_surface(&self) -> SurfaceType {
        self.current_surface
    }

    /// Get the current surface modifiers
    pub fn get_modifiers(&self) -> &SurfaceModifiers {
        &self.modifiers
    }

    /// Check if currently on road
    pub fn is_on_road(&self) -> bool {
        self.current_surface == SurfaceType::Road
    }

    /// Check if currently off-track (grass)
    pub fn is_off_track(&self) -> bool {
        self.current_surface == SurfaceType::Grass
    }

    /// Get grip modifier for current surface
    pub fn get_grip_modifier(&self) -> f32 {
        self.modifiers.grip_multiplier
    }

    /// Get speed modifier for current surface
    pub fn get_speed_modifier(&self) -> f32 {
        self.modifiers.speed_multiplier
    }

    /// Get tire wear modifier for current surface
    pub fn get_tire_wear_modifier(&self) -> f32 {
        self.modifiers.tire_wear_multiplier
    }

    /// Get drag modifier for current surface
    pub fn get_drag_modifier(&self) -> f32 {
        self.modifiers.drag_multiplier
    }

    /// Get brake efficiency for current surface
    pub fn get_brake_efficiency(&self) -> f32 {
        self.modifiers.brake_efficiency
    }

    /// Get steering response for current surface
    pub fn get_steer_response(&self) -> f32 {
        self.modifiers.steer_response
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_surface() {
        let state = SurfaceState::new();
        assert_eq!(state.get_surface(), SurfaceType::Grass);
        assert!(state.is_off_track());
        assert!(!state.is_on_road());
    }

    #[test]
    fn test_set_surface() {
        let mut state = SurfaceState::new();

        state.set_surface(SurfaceType::Road);
        assert_eq!(state.get_surface(), SurfaceType::Road);
        assert!(state.is_on_road());
        assert!(!state.is_off_track());

        // Check road modifiers
        assert!((state.get_grip_modifier() - 1.0).abs() < 0.01);
        assert!((state.get_speed_modifier() - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_grass_penalties() {
        let mut state = SurfaceState::new();
        state.set_surface(SurfaceType::Grass);

        // Grass should have severe grip penalty
        assert!(state.get_grip_modifier() < 0.5);
        // Grass should slow down the car
        assert!(state.get_speed_modifier() < 1.0);
        // Grass should have less tire wear
        assert!(state.get_tire_wear_modifier() < 1.0);
    }

    #[test]
    fn test_curb_modifiers() {
        let mut state = SurfaceState::new();
        state.set_surface(SurfaceType::Curb);

        // Curb should have increased grip
        assert!(state.get_grip_modifier() > 1.0);
        // Curb should have slight speed reduction
        assert!(state.get_speed_modifier() < 1.0);
    }

    #[test]
    fn test_surface_change() {
        let mut state = SurfaceState::new();

        // Start on grass
        assert_eq!(state.get_surface(), SurfaceType::Grass);
        let grass_grip = state.get_grip_modifier();

        // Move to road
        state.set_surface(SurfaceType::Road);
        let road_grip = state.get_grip_modifier();

        // Road should have more grip than grass
        assert!(road_grip > grass_grip);
    }
}
