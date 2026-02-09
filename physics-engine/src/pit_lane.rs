use crate::types::SurfaceType;

const PIT_LANE_SPEED_LIMIT_MS: f32 = 22.222; // 80 km/h

#[derive(Debug)]
pub struct PitLaneState {
    is_in_pit_lane: bool,
    speed_limit_ms: f32,
    limiter_blend: f32, // 0.0 = no limit, 1.0 = full limit
}

impl Default for PitLaneState {
    fn default() -> Self {
        Self::new()
    }
}

impl PitLaneState {
    pub fn new() -> Self {
        Self {
            is_in_pit_lane: false,
            speed_limit_ms: PIT_LANE_SPEED_LIMIT_MS,
            limiter_blend: 0.0,
        }
    }

    pub fn set_active(&mut self, active: bool) {
        self.is_in_pit_lane = active;
    }

    pub fn is_active(&self) -> bool {
        self.is_in_pit_lane
    }

    pub fn get_speed_limit_ms(&self) -> f32 {
        self.speed_limit_ms
    }

    pub fn get_speed_limit_kmh(&self) -> f32 {
        self.speed_limit_ms * 3.6
    }

    pub fn set_speed_limit_kmh(&mut self, kmh: f32) {
        self.speed_limit_ms = kmh / 3.6;
    }

    pub fn is_speed_limited(&self) -> bool {
        self.is_in_pit_lane && self.limiter_blend > 0.01
    }

    pub fn get_limiter_blend(&self) -> f32 {
        self.limiter_blend
    }

    /// Update the speed limiter state. Call every frame.
    /// Returns a throttle multiplier (0.0-1.0) to apply to engine output.
    pub fn update(&mut self, dt: f32, current_speed_ms: f32) -> f32 {
        // Blend in/out the limiter smoothly
        let target_blend = if self.is_in_pit_lane { 1.0 } else { 0.0 };
        let blend_rate = 4.0; // Transition over ~0.25 seconds
        self.limiter_blend += (target_blend - self.limiter_blend) * (blend_rate * dt).min(1.0);

        if self.limiter_blend < 0.01 {
            self.limiter_blend = 0.0;
            return 1.0;
        }

        let speed_ratio = current_speed_ms / self.speed_limit_ms;

        if speed_ratio < 0.85 {
            // Well under limit - allow full throttle
            1.0
        } else if speed_ratio < 1.0 {
            // Approaching limit - gradually reduce throttle
            let t = (speed_ratio - 0.85) / 0.15;
            let reduction = t * t; // Quadratic curve for smooth feel
            let throttle = 1.0 - reduction * 0.8;
            1.0 - (1.0 - throttle) * self.limiter_blend
        } else {
            // Over limit - apply strong braking reduction
            let over_ratio = (speed_ratio - 1.0).min(0.5);
            let throttle = 0.2 - over_ratio * 0.4;
            let throttle = throttle.max(0.0);
            1.0 - (1.0 - throttle) * self.limiter_blend
        }
    }

    /// Get additional braking force when over speed limit.
    /// Returns a braking force multiplier (0.0 = no extra braking, positive = apply braking).
    pub fn get_braking_force(&self, current_speed_ms: f32) -> f32 {
        if !self.is_in_pit_lane || self.limiter_blend < 0.01 {
            return 0.0;
        }

        let speed_ratio = current_speed_ms / self.speed_limit_ms;
        if speed_ratio <= 1.0 {
            return 0.0;
        }

        // Progressive braking force when over limit
        let over_amount = (speed_ratio - 1.0).min(1.0);
        let braking = over_amount * 0.5; // Up to 50% additional braking
        braking * self.limiter_blend
    }

    /// Update based on surface type - auto-activate when on pitroad surface
    pub fn update_from_surface(&mut self, surface: SurfaceType) {
        self.is_in_pit_lane = surface == SurfaceType::PitRoad;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_state() {
        let state = PitLaneState::new();
        assert!(!state.is_active());
        assert!(!state.is_speed_limited());
        assert!((state.get_speed_limit_kmh() - 80.0).abs() < 0.1);
    }

    #[test]
    fn test_activation() {
        let mut state = PitLaneState::new();
        state.set_active(true);
        assert!(state.is_active());

        // After update, should be limited
        let _ = state.update(0.1, 25.0);
        assert!(state.is_speed_limited());
    }

    #[test]
    fn test_speed_limit_below() {
        let mut state = PitLaneState::new();
        state.set_active(true);
        state.limiter_blend = 1.0; // Force full blend for test

        // 60 km/h = 16.67 m/s, well below 80 km/h limit
        let throttle = state.update(1.0 / 60.0, 16.67);
        assert!((throttle - 1.0).abs() < 0.01, "Should allow full throttle below limit, got {}", throttle);
    }

    #[test]
    fn test_speed_limit_at_limit() {
        let mut state = PitLaneState::new();
        state.set_active(true);
        state.limiter_blend = 1.0;

        // At 80 km/h = 22.22 m/s
        let throttle = state.update(1.0 / 60.0, 22.22);
        assert!(throttle < 0.5, "Should heavily reduce throttle at limit, got {}", throttle);
    }

    #[test]
    fn test_speed_limit_over() {
        let mut state = PitLaneState::new();
        state.set_active(true);
        state.limiter_blend = 1.0;

        // At 100 km/h = 27.78 m/s (over limit)
        let throttle = state.update(1.0 / 60.0, 27.78);
        assert!(throttle < 0.2, "Should cut throttle when over limit, got {}", throttle);
    }

    #[test]
    fn test_braking_force_over_limit() {
        let mut state = PitLaneState::new();
        state.set_active(true);
        state.limiter_blend = 1.0;

        // Below limit - no extra braking
        assert!((state.get_braking_force(20.0) - 0.0).abs() < 0.01);

        // Over limit - should have braking force
        let braking = state.get_braking_force(27.78);
        assert!(braking > 0.0, "Should have braking force over limit, got {}", braking);
    }

    #[test]
    fn test_smooth_blend() {
        let mut state = PitLaneState::new();
        state.set_active(true);

        // Multiple frames to blend in
        for _ in 0..30 {
            let _ = state.update(1.0 / 60.0, 20.0);
        }
        assert!(state.get_limiter_blend() > 0.5, "Should blend in over time");

        // Deactivate
        state.set_active(false);
        for _ in 0..30 {
            let _ = state.update(1.0 / 60.0, 20.0);
        }
        assert!(state.get_limiter_blend() < 0.5, "Should blend out over time");
    }

    #[test]
    fn test_surface_auto_activation() {
        let mut state = PitLaneState::new();

        state.update_from_surface(SurfaceType::PitRoad);
        assert!(state.is_active());

        state.update_from_surface(SurfaceType::Road);
        assert!(!state.is_active());
    }
}
