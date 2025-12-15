use super::{CAR_MASS, CG_HEIGHT, TRACK_WIDTH, WHEELBASE};

const LONGITUDINAL_TRANSFER_FACTOR: f32 = 0.5;
const LATERAL_TRANSFER_FACTOR: f32 = 0.4;

#[derive(Debug, Clone, Copy, Default)]
pub struct WeightTransferResult {
    pub front_load_change: f32,
    pub rear_load_change: f32,
    pub left_load_change: f32,
    pub right_load_change: f32,
}

/// Calculate weight transfer based on longitudinal and lateral G-forces
pub fn calculate_weight_transfer(longitudinal_g: f32, lateral_g: f32) -> WeightTransferResult {
    // Longitudinal weight transfer (acceleration/braking)
    // Positive G = accelerating = weight shifts to rear
    // Negative G = braking = weight shifts to front
    let long_transfer = (longitudinal_g * CAR_MASS * CG_HEIGHT / WHEELBASE) * LONGITUDINAL_TRANSFER_FACTOR;

    // Lateral weight transfer (cornering)
    // Positive G = turning right = weight shifts to left
    // Negative G = turning left = weight shifts to right
    let lat_transfer = (lateral_g * CAR_MASS * CG_HEIGHT / TRACK_WIDTH) * LATERAL_TRANSFER_FACTOR;

    WeightTransferResult {
        front_load_change: -long_transfer,  // Braking adds load to front
        rear_load_change: long_transfer,    // Acceleration adds load to rear
        left_load_change: lat_transfer,     // Right turn adds load to left
        right_load_change: -lat_transfer,   // Left turn adds load to right
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
}
