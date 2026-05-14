use car_physics_engine::types::CarInput;

use crate::sim::{Observation, Policy, PolicyContext};

pub struct ConstantThrottle {
    pub gain: f32,
    pub throttle: f32,
}

impl Default for ConstantThrottle {
    fn default() -> Self {
        Self {
            gain: 1.0,
            throttle: 0.35,
        }
    }
}

impl Policy for ConstantThrottle {
    fn act(&mut self, obs: &Observation, _ctx: &PolicyContext) -> CarInput {
        let steer = (obs.heading_error_rad * self.gain).clamp(-1.0, 1.0);
        CarInput {
            forward: true,
            backward: false,
            left: false,
            right: false,
            brake: false,
            handbrake: false,
            steer,
            throttle: self.throttle,
            brake_analog: 0.0,
        }
    }
}
