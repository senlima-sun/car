use super::{CAR_MASS, CG_HEIGHT, TRACK_WIDTH, WEIGHT_DIST_FRONT, WHEELBASE};

const LONGITUDINAL_TRANSFER_FACTOR: f32 = 0.5;
const LATERAL_TRANSFER_FACTOR: f32 = 0.4;

#[derive(Debug, Clone, Copy)]
pub struct WeightTransferResult {
    pub front_load_change: f32,
    pub rear_load_change: f32,
    pub left_load_change: f32,
    pub right_load_change: f32,
    pub front_load_pct: f32,
    pub rear_load_pct: f32,
}

impl Default for WeightTransferResult {
    fn default() -> Self {
        Self {
            front_load_change: 0.0,
            rear_load_change: 0.0,
            left_load_change: 0.0,
            right_load_change: 0.0,
            front_load_pct: WEIGHT_DIST_FRONT,
            rear_load_pct: 1.0 - WEIGHT_DIST_FRONT,
        }
    }
}

/// Calculate weight transfer based on longitudinal and lateral G-forces
pub fn calculate_weight_transfer(longitudinal_g: f32, lateral_g: f32) -> WeightTransferResult {
    let total_weight = CAR_MASS * 9.81;
    let static_front_load = WEIGHT_DIST_FRONT * total_weight;
    let static_rear_load = (1.0 - WEIGHT_DIST_FRONT) * total_weight;

    // Longitudinal weight transfer (acceleration/braking)
    // Positive G = accelerating = weight shifts to rear
    // Negative G = braking = weight shifts to front
    let long_transfer = (longitudinal_g * CAR_MASS * CG_HEIGHT / WHEELBASE) * LONGITUDINAL_TRANSFER_FACTOR;

    // Lateral weight transfer (cornering)
    // Positive G = turning right = weight shifts to left
    // Negative G = turning left = weight shifts to right
    let lat_transfer = (lateral_g * CAR_MASS * CG_HEIGHT / TRACK_WIDTH) * LATERAL_TRANSFER_FACTOR;

    let front_load = static_front_load - long_transfer;
    let rear_load = static_rear_load + long_transfer;

    WeightTransferResult {
        front_load_change: -long_transfer,
        rear_load_change: long_transfer,
        left_load_change: lat_transfer,
        right_load_change: -lat_transfer,
        front_load_pct: (front_load / total_weight).clamp(0.1, 0.9),
        rear_load_pct: (rear_load / total_weight).clamp(0.1, 0.9),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_no_g_no_transfer() {
        let result = calculate_weight_transfer(0.0, 0.0);

        assert!((result.front_load_change - 0.0).abs() < 0.001);
        assert!((result.rear_load_change - 0.0).abs() < 0.001);
        assert!((result.left_load_change - 0.0).abs() < 0.001);
        assert!((result.right_load_change - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_acceleration_transfers_to_rear() {
        let result = calculate_weight_transfer(1.0, 0.0); // 1G acceleration

        assert!(result.rear_load_change > 0.0);
        assert!(result.front_load_change < 0.0);
        assert!((result.front_load_change + result.rear_load_change).abs() < 0.001);
    }

    #[test]
    fn test_braking_transfers_to_front() {
        let result = calculate_weight_transfer(-1.0, 0.0); // 1G braking

        assert!(result.front_load_change > 0.0);
        assert!(result.rear_load_change < 0.0);
    }

    #[test]
    fn test_right_turn_transfers_to_left() {
        let result = calculate_weight_transfer(0.0, 1.0); // 1G right turn

        assert!(result.left_load_change > 0.0);
        assert!(result.right_load_change < 0.0);
        assert!((result.left_load_change + result.right_load_change).abs() < 0.001);
    }

    #[test]
    fn test_left_turn_transfers_to_right() {
        let result = calculate_weight_transfer(0.0, -1.0); // 1G left turn

        assert!(result.right_load_change > 0.0);
        assert!(result.left_load_change < 0.0);
    }

    #[test]
    fn test_combined_g_forces() {
        let result = calculate_weight_transfer(0.5, 0.5);

        // Should have both longitudinal and lateral transfer
        assert!(result.rear_load_change > 0.0);
        assert!(result.left_load_change > 0.0);
    }

    #[test]
    fn test_static_weight_distribution_47_53() {
        let result = calculate_weight_transfer(0.0, 0.0);

        assert!(
            (result.front_load_pct - 0.47).abs() < 0.001,
            "Static front load should be 47%, got {}",
            result.front_load_pct
        );
        assert!(
            (result.rear_load_pct - 0.53).abs() < 0.001,
            "Static rear load should be 53%, got {}",
            result.rear_load_pct
        );
    }

    #[test]
    fn test_weight_distribution_asymmetric_under_braking() {
        let static_result = calculate_weight_transfer(0.0, 0.0);
        let braking_result = calculate_weight_transfer(-1.5, 0.0);

        assert!(
            braking_result.front_load_pct > static_result.front_load_pct,
            "Braking should shift load forward: braking front={}, static front={}",
            braking_result.front_load_pct, static_result.front_load_pct
        );
        assert!(
            braking_result.rear_load_pct < static_result.rear_load_pct,
            "Braking should reduce rear load: braking rear={}, static rear={}",
            braking_result.rear_load_pct, static_result.rear_load_pct
        );
        assert!(
            braking_result.front_load_change > 0.0,
            "Front load change should be positive under braking, got {}",
            braking_result.front_load_change
        );
    }
}
