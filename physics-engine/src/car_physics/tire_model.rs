use super::weight_transfer::WeightTransferResult;
use super::CAR_MASS;

const OPTIMAL_SLIP_ANGLE: f32 = 8.0; // degrees
const HANDBRAKE_REAR_GRIP: f32 = 0.2;
const THROTTLE_OVERSTEER_FACTOR: f32 = 0.65;

/// Pacejka-inspired tire grip model
fn calculate_single_tire_grip(
    slip_angle: f32,
    normal_load: f32,
    base_grip_coeff: f32,
) -> f32 {
    let abs_slip = slip_angle.abs();

    // Lateral efficiency based on slip angle (Pacejka-inspired curve)
    let lateral_efficiency = if abs_slip < OPTIMAL_SLIP_ANGLE {
        // Build to peak
        0.7 + 0.3 * (abs_slip / OPTIMAL_SLIP_ANGLE)
    } else {
        // Falloff after peak
        let excess = abs_slip - OPTIMAL_SLIP_ANGLE;
        (1.0 - excess * 0.03).max(0.5)
    };

    // Load sensitivity (grip doesn't scale linearly with load)
    let base_load = CAR_MASS * 9.81 / 4.0; // Per wheel
    let load_factor = if normal_load > base_load {
        let excess_load = normal_load - base_load;
        1.0 - (excess_load * 0.015 / 10000.0)
    } else {
        1.0
    };

    base_grip_coeff * lateral_efficiency * load_factor.max(0.7)
}

/// Calculate front and rear tire grip considering weight transfer
pub fn calculate_tire_grip(
    slip_angle: f32,
    total_load: f32,
    grip_coefficient: f32,
    handbrake: bool,
    throttle: bool,
    weight_transfer: &WeightTransferResult,
) -> (f32, f32) {
    let base_load_per_wheel = total_load / 4.0;

    // Front tire grip (affected by weight transfer)
    let front_load = base_load_per_wheel + weight_transfer.front_load_change;
    let front_grip = calculate_single_tire_grip(slip_angle, front_load, grip_coefficient);

    // Rear tire grip (affected by weight transfer and special conditions)
    let rear_load = base_load_per_wheel + weight_transfer.rear_load_change;
    let mut rear_grip = calculate_single_tire_grip(slip_angle, rear_load, grip_coefficient);

    // Handbrake drastically reduces rear grip
    if handbrake {
        rear_grip *= HANDBRAKE_REAR_GRIP;
    }
    // Throttle causes slight rear grip reduction (throttle oversteer)
    else if throttle {
        rear_grip *= THROTTLE_OVERSTEER_FACTOR;
    }

    (front_grip, rear_grip)
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::weight_transfer::WeightTransferResult;

    #[test]
    fn test_optimal_slip_angle() {
        let base_load = CAR_MASS * 9.81 / 4.0;

        // Grip should be highest around optimal slip angle
        let grip_low = calculate_single_tire_grip(2.0, base_load, 1.7);
        let grip_optimal = calculate_single_tire_grip(8.0, base_load, 1.7);
        let grip_high = calculate_single_tire_grip(15.0, base_load, 1.7);

        assert!(grip_optimal > grip_low);
        assert!(grip_optimal > grip_high);
    }

    #[test]
    fn test_grip_coefficient_scaling() {
        let base_load = CAR_MASS * 9.81 / 4.0;

        let grip_low_coeff = calculate_single_tire_grip(8.0, base_load, 1.0);
        let grip_high_coeff = calculate_single_tire_grip(8.0, base_load, 1.7);

        assert!((grip_high_coeff / grip_low_coeff - 1.7).abs() < 0.1);
    }

    #[test]
    fn test_handbrake_reduces_rear() {
        let weight = WeightTransferResult::default();

        let (_, rear_normal) = calculate_tire_grip(8.0, CAR_MASS * 9.81, 1.7, false, false, &weight);
        let (_, rear_handbrake) = calculate_tire_grip(8.0, CAR_MASS * 9.81, 1.7, true, false, &weight);

        assert!(rear_handbrake < rear_normal * 0.3);
    }

    #[test]
    fn test_throttle_oversteer() {
        let weight = WeightTransferResult::default();

        let (_, rear_coast) = calculate_tire_grip(8.0, CAR_MASS * 9.81, 1.7, false, false, &weight);
        let (_, rear_throttle) = calculate_tire_grip(8.0, CAR_MASS * 9.81, 1.7, false, true, &weight);

        assert!(rear_throttle < rear_coast);
        assert!(rear_throttle > rear_coast * 0.5);
    }

    #[test]
    fn test_front_rear_balance() {
        let weight = WeightTransferResult::default();

        let (front, rear) = calculate_tire_grip(8.0, CAR_MASS * 9.81, 1.7, false, false, &weight);

        // Both should have grip
        assert!(front > 0.0);
        assert!(rear > 0.0);
    }
}
