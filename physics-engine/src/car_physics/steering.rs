use super::WHEELBASE;
use crate::utils::smoothstep;

/// Get maximum steering angle based on speed (degrees)
pub fn get_max_steer_angle(speed_kmh: f32) -> f32 {
    if speed_kmh < 40.0 {
        // Full steering at low speed
        22.0
    } else if speed_kmh < 120.0 {
        // Progressive reduction
        let t = smoothstep((speed_kmh - 40.0) / 80.0);
        22.0 - t * 10.0 // 22° -> 12°
    } else if speed_kmh < 220.0 {
        // Further reduction at high speed
        let t = smoothstep((speed_kmh - 120.0) / 100.0);
        12.0 - t * 8.0 // 12° -> 4°
    } else {
        // Minimum steering for stability
        4.0
    }
}

/// Calculate angular velocity from steering using Ackermann geometry
pub fn calculate_turn_dynamics(
    steer_angle: f32, // radians
    speed_ms: f32,
    grip_influence: f32,
    is_drifting: bool,
) -> f32 {
    // Guard clauses
    if steer_angle.abs() < 0.005 || speed_ms.abs() < 0.3 {
        return 0.0;
    }

    let tan_steer = steer_angle.tan();
    if tan_steer.abs() < 0.001 {
        return 0.0;
    }

    // Ackermann steering geometry: turn_radius = wheelbase / tan(steer_angle)
    let turn_radius = (WHEELBASE / tan_steer).abs();
    if turn_radius > 1000.0 {
        return 0.0;
    }

    // Angular velocity = speed / turn_radius
    let base_angular_velocity = speed_ms / turn_radius;

    // Apply grip influence
    let grip_factor = if is_drifting { 0.5 } else { 0.4 };
    let final_angular_velocity = base_angular_velocity * (1.0 + (grip_influence - 1.0) * grip_factor);

    // Apply steering direction
    final_angular_velocity * -steer_angle.signum()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::PI;

    #[test]
    fn test_max_steer_low_speed() {
        let angle = get_max_steer_angle(20.0);
        assert!((angle - 22.0).abs() < 0.1);
    }

    #[test]
    fn test_max_steer_high_speed() {
        let angle = get_max_steer_angle(250.0);
        assert!((angle - 4.0).abs() < 0.1);
    }

    #[test]
    fn test_max_steer_mid_speed() {
        let angle = get_max_steer_angle(100.0);
        assert!(angle < 22.0);
        assert!(angle > 4.0);
    }

    #[test]
    fn test_turn_dynamics_no_steer() {
        let ang_vel = calculate_turn_dynamics(0.0, 20.0, 1.0, false);
        assert!((ang_vel - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_turn_dynamics_no_speed() {
        let ang_vel = calculate_turn_dynamics(0.1, 0.0, 1.0, false);
        assert!((ang_vel - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_turn_dynamics_direction() {
        // Steering left (negative angle) should produce positive angular velocity (turn left)
        let steer_left = -10.0_f32.to_radians();
        let ang_vel_left = calculate_turn_dynamics(steer_left, 20.0, 1.0, false);
        assert!(ang_vel_left > 0.0);

        // Steering right (positive angle) should produce negative angular velocity
        let steer_right = 10.0_f32.to_radians();
        let ang_vel_right = calculate_turn_dynamics(steer_right, 20.0, 1.0, false);
        assert!(ang_vel_right < 0.0);
    }

    #[test]
    fn test_turn_dynamics_speed_relationship() {
        let steer = 10.0_f32.to_radians();

        let ang_vel_slow = calculate_turn_dynamics(steer, 10.0, 1.0, false).abs();
        let ang_vel_fast = calculate_turn_dynamics(steer, 20.0, 1.0, false).abs();

        // Higher speed should produce higher angular velocity
        assert!(ang_vel_fast > ang_vel_slow);
    }

    #[test]
    fn test_turn_dynamics_grip_influence() {
        let steer = 10.0_f32.to_radians();

        let ang_vel_low_grip = calculate_turn_dynamics(steer, 20.0, 0.5, false).abs();
        let ang_vel_high_grip = calculate_turn_dynamics(steer, 20.0, 1.5, false).abs();

        // Higher grip should allow more angular velocity
        assert!(ang_vel_high_grip > ang_vel_low_grip);
    }
}
