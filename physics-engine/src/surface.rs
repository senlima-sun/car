use crate::constants::surface::TRANSITION_DURATION;
use crate::types::{SurfaceModifiers, SurfaceType};

#[derive(Debug)]
pub struct SurfaceState {
    current_surface: SurfaceType,
    target_modifiers: SurfaceModifiers,
    previous_modifiers: SurfaceModifiers,
    active_modifiers: SurfaceModifiers,
    transition_timer: f32,
    is_transitioning: bool,
}

impl Default for SurfaceState {
    fn default() -> Self {
        Self::new()
    }
}

impl SurfaceState {
    pub fn new() -> Self {
        let modifiers = SurfaceModifiers::grass();
        Self {
            current_surface: SurfaceType::Grass,
            target_modifiers: modifiers,
            previous_modifiers: modifiers,
            active_modifiers: modifiers,
            transition_timer: 0.0,
            is_transitioning: false,
        }
    }

    pub fn set_surface(&mut self, surface: SurfaceType) {
        if self.current_surface != surface {
            self.current_surface = surface;
            self.previous_modifiers = self.active_modifiers;
            self.target_modifiers = SurfaceModifiers::for_surface(surface);
            self.transition_timer = 0.0;
            self.is_transitioning = true;
        }
    }

    pub fn update(&mut self, dt: f32) {
        if !self.is_transitioning {
            return;
        }

        self.transition_timer += dt;
        let t = (self.transition_timer / TRANSITION_DURATION).min(1.0);
        let smoothed = t * t * (3.0 - 2.0 * t);

        self.active_modifiers =
            SurfaceModifiers::lerp(&self.previous_modifiers, &self.target_modifiers, smoothed);

        if t >= 1.0 {
            self.is_transitioning = false;
            self.active_modifiers = self.target_modifiers;
        }
    }

    pub fn get_surface(&self) -> SurfaceType {
        self.current_surface
    }

    pub fn get_modifiers(&self) -> &SurfaceModifiers {
        &self.active_modifiers
    }

    pub fn is_on_road(&self) -> bool {
        self.current_surface == SurfaceType::Road
    }

    pub fn is_off_track(&self) -> bool {
        self.current_surface == SurfaceType::Grass
    }

    pub fn is_on_pit_road(&self) -> bool {
        self.current_surface == SurfaceType::PitRoad
    }

    pub fn is_on_gravel(&self) -> bool {
        self.current_surface == SurfaceType::Gravel
    }

    pub fn is_on_painted_area(&self) -> bool {
        self.current_surface == SurfaceType::PaintedArea
    }

    /// Apply wetness blending for surfaces sensitive to water (currently painted run-off).
    /// `wetness` is 0.0 (dry) to 1.0 (saturated).
    pub fn apply_wetness(&mut self, wetness: f32) {
        if self.current_surface != SurfaceType::PaintedArea {
            return;
        }
        let t = wetness.clamp(0.0, 1.0);
        let dry = SurfaceModifiers::painted_area();
        let wet = SurfaceModifiers::painted_area_wet();
        let blended = SurfaceModifiers::lerp(&dry, &wet, t);
        self.target_modifiers = blended;
        if !self.is_transitioning {
            self.active_modifiers = blended;
        }
    }

    pub fn is_transitioning(&self) -> bool {
        self.is_transitioning
    }

    pub fn get_transition_progress(&self) -> f32 {
        if self.is_transitioning {
            (self.transition_timer / TRANSITION_DURATION).min(1.0)
        } else {
            1.0
        }
    }

    pub fn get_grip_modifier(&self) -> f32 {
        self.active_modifiers.grip_multiplier
    }

    pub fn get_speed_modifier(&self) -> f32 {
        self.active_modifiers.speed_multiplier
    }

    pub fn get_tire_wear_modifier(&self) -> f32 {
        self.active_modifiers.tire_wear_multiplier
    }

    pub fn get_drag_modifier(&self) -> f32 {
        self.active_modifiers.drag_multiplier
    }

    pub fn get_brake_efficiency(&self) -> f32 {
        self.active_modifiers.brake_efficiency
    }

    pub fn get_steer_response(&self) -> f32 {
        self.active_modifiers.steer_response
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
        state.update(TRANSITION_DURATION + 0.01);
        assert_eq!(state.get_surface(), SurfaceType::Road);
        assert!(state.is_on_road());
        assert!(!state.is_off_track());

        assert!((state.get_grip_modifier() - 1.0).abs() < 0.01);
        assert!((state.get_speed_modifier() - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_grass_penalties() {
        let state = SurfaceState::new();

        assert!(state.get_grip_modifier() < 0.5);
        assert!(state.get_speed_modifier() < 1.0);
        assert!(state.get_tire_wear_modifier() < 1.0);
    }

    #[test]
    fn test_curb_modifiers() {
        let mut state = SurfaceState::new();
        state.set_surface(SurfaceType::Curb);
        state.update(TRANSITION_DURATION + 0.01);

        assert!(state.get_grip_modifier() < 1.0);
        assert!(state.get_grip_modifier() > 0.9);
        assert!(state.get_speed_modifier() < 1.0);
    }

    #[test]
    fn test_surface_change() {
        let mut state = SurfaceState::new();

        assert_eq!(state.get_surface(), SurfaceType::Grass);
        let grass_grip = state.get_grip_modifier();

        state.set_surface(SurfaceType::Road);
        state.update(TRANSITION_DURATION + 0.01);
        let road_grip = state.get_grip_modifier();

        assert!(road_grip > grass_grip);
    }

    #[test]
    fn test_transition_interpolation() {
        let mut state = SurfaceState::new();
        state.set_surface(SurfaceType::Road);
        state.update(0.0);
        let grass_grip = SurfaceModifiers::grass().grip_multiplier;
        let road_grip = SurfaceModifiers::road().grip_multiplier;

        assert!(state.is_transitioning());

        state.update(TRANSITION_DURATION * 0.5);
        let mid_grip = state.get_grip_modifier();
        assert!(mid_grip > grass_grip);
        assert!(mid_grip < road_grip);

        state.update(TRANSITION_DURATION);
        assert!(!state.is_transitioning());
        assert!((state.get_grip_modifier() - road_grip).abs() < 0.01);
    }

    #[test]
    fn test_transition_progress() {
        let mut state = SurfaceState::new();
        assert!((state.get_transition_progress() - 1.0).abs() < 0.01);

        state.set_surface(SurfaceType::Road);
        assert!((state.get_transition_progress() - 0.0).abs() < 0.01);

        state.update(TRANSITION_DURATION * 0.5);
        let progress = state.get_transition_progress();
        assert!(progress > 0.4 && progress < 0.6);

        state.update(TRANSITION_DURATION);
        assert!((state.get_transition_progress() - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_painted_area_dry_grip() {
        let mut state = SurfaceState::new();
        state.set_surface(SurfaceType::PaintedArea);
        state.update(TRANSITION_DURATION + 0.01);

        let painted = SurfaceModifiers::painted_area();
        assert!((state.get_grip_modifier() - painted.grip_multiplier).abs() < 0.01);
        assert!(state.is_on_painted_area());
    }

    #[test]
    fn test_painted_area_wet_grip_drops() {
        let mut state = SurfaceState::new();
        state.set_surface(SurfaceType::PaintedArea);
        state.update(TRANSITION_DURATION + 0.01);
        let dry_grip = state.get_grip_modifier();

        state.apply_wetness(1.0);
        assert!(state.get_grip_modifier() < dry_grip);

        let wet = SurfaceModifiers::painted_area_wet();
        assert!((state.get_grip_modifier() - wet.grip_multiplier).abs() < 0.01);
    }

    #[test]
    fn test_apply_wetness_ignored_for_road() {
        let mut state = SurfaceState::new();
        state.set_surface(SurfaceType::Road);
        state.update(TRANSITION_DURATION + 0.01);
        let road_grip = state.get_grip_modifier();

        state.apply_wetness(1.0);
        assert!((state.get_grip_modifier() - road_grip).abs() < 0.01);
    }

    #[test]
    fn test_rapid_surface_changes() {
        let mut state = SurfaceState::new();

        state.set_surface(SurfaceType::Road);
        state.update(TRANSITION_DURATION * 0.3);
        let mid_transition_grip = state.get_grip_modifier();

        state.set_surface(SurfaceType::Gravel);
        assert!(state.is_transitioning());
        let restart_grip = state.get_grip_modifier();
        assert!((restart_grip - mid_transition_grip).abs() < 0.01);

        state.update(TRANSITION_DURATION + 0.01);
        let gravel_grip = SurfaceModifiers::gravel().grip_multiplier;
        assert!((state.get_grip_modifier() - gravel_grip).abs() < 0.01);
    }
}
