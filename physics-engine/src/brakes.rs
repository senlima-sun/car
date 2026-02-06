use crate::types::{BrakeConfig, BrakeState, EngineBrakingLevel};

pub const DEFAULT_FRONT_BIAS: f32 = 0.58;
pub const MIN_FRONT_BIAS: f32 = 0.50;
pub const MAX_FRONT_BIAS: f32 = 0.70;
pub const BIAS_ADJUSTMENT_STEP: f32 = 0.02;
pub const ENGINE_BRAKE_LOW: f32 = 1500.0;
pub const ENGINE_BRAKE_MEDIUM: f32 = 2500.0;
pub const ENGINE_BRAKE_HIGH: f32 = 4000.0;

const DISC_MASS_KG: f32 = 3.0;
const DISC_CP: f32 = 1000.0;
const DISC_AREA: f32 = 0.06;
const DISC_EMISSIVITY: f32 = 0.85;
const STEFAN_BOLTZMANN: f32 = 5.67e-8;
const AMBIENT_TEMP_K: f32 = 298.0;
const BASE_CONV_H: f32 = 25.0;
const SPEED_CONV_FACTOR: f32 = 3.0;
const BRAKE_TO_TIRE_K: f32 = 0.002;

#[derive(Debug, Clone, Copy, Default)]
pub struct BrakeDiscTemperatures {
    pub temps: [f32; 4],
    pub wear: [f32; 4],
}

impl BrakeDiscTemperatures {
    pub fn new() -> Self {
        Self {
            temps: [AMBIENT_TEMP_K; 4],
            wear: [0.0; 4],
        }
    }

    pub fn update(
        &mut self,
        dt: f32,
        speed_ms: f32,
        brake_forces: [f32; 4],
        ambient_celsius: f32,
    ) {
        let ambient_k = ambient_celsius + 273.15;
        for i in 0..4 {
            let q_in = brake_forces[i] * speed_ms;
            let h = BASE_CONV_H + SPEED_CONV_FACTOR * speed_ms;
            let q_conv = h * DISC_AREA * (self.temps[i] - ambient_k);
            let t4_diff = self.temps[i].powi(4) - ambient_k.powi(4);
            let q_rad = DISC_EMISSIVITY * STEFAN_BOLTZMANN * DISC_AREA * t4_diff;
            let q_net = q_in - q_conv - q_rad;
            let dt_temp = q_net / (DISC_MASS_KG * DISC_CP);
            self.temps[i] = (self.temps[i] + dt_temp * dt).clamp(ambient_k, 1200.0);

            if self.temps[i] > 1100.0 {
                self.wear[i] = (self.wear[i] + 0.001 * dt).min(1.0);
            }
        }
    }

    pub fn get_fade_multiplier(&self, wheel: usize) -> f32 {
        let celsius = self.temps[wheel] - 273.15;
        brake_friction_mu(celsius) / 0.45
    }

    pub fn get_overall_fade(&self) -> f32 {
        let mut total = 0.0;
        for i in 0..4 {
            total += self.get_fade_multiplier(i);
        }
        total / 4.0
    }

    pub fn heat_to_tires(&self, tire_temps_celsius: &[f32; 4]) -> [f32; 4] {
        let mut deltas = [0.0f32; 4];
        for i in 0..4 {
            let disc_c = self.temps[i] - 273.15;
            let diff = disc_c - tire_temps_celsius[i];
            deltas[i] = diff * BRAKE_TO_TIRE_K;
        }
        deltas
    }

    pub fn celsius(&self) -> [f32; 4] {
        [
            self.temps[0] - 273.15,
            self.temps[1] - 273.15,
            self.temps[2] - 273.15,
            self.temps[3] - 273.15,
        ]
    }
}

pub fn brake_friction_mu(celsius: f32) -> f32 {
    if celsius < 200.0 {
        0.3 + (celsius / 200.0) * 0.15
    } else if celsius <= 600.0 {
        0.45
    } else if celsius <= 900.0 {
        0.45 - 0.15 * ((celsius - 600.0) / 300.0)
    } else {
        let over = ((celsius - 900.0) / 200.0).min(1.0);
        0.3 - 0.1 * over
    }
}

#[derive(Debug)]
pub struct BrakePhysicsState {
    config: BrakeConfig,
    pub disc_temps: BrakeDiscTemperatures,
}

impl Default for BrakePhysicsState {
    fn default() -> Self {
        Self::new()
    }
}

impl BrakePhysicsState {
    pub fn new() -> Self {
        Self {
            config: BrakeConfig {
                front_bias: DEFAULT_FRONT_BIAS,
                engine_braking: EngineBrakingLevel::Medium,
            },
            disc_temps: BrakeDiscTemperatures::new(),
        }
    }

    // ========================================================================
    // Configuration API
    // ========================================================================

    /// Set front brake bias (clamped to 0.50-0.70)
    pub fn set_brake_bias(&mut self, bias: f32) {
        self.config.front_bias = bias.clamp(MIN_FRONT_BIAS, MAX_FRONT_BIAS);
    }

    /// Get current front brake bias
    pub fn get_brake_bias(&self) -> f32 {
        self.config.front_bias
    }

    /// Increase brake bias by 2% (clamped to max)
    pub fn increase_brake_bias(&mut self) {
        self.config.front_bias = (self.config.front_bias + BIAS_ADJUSTMENT_STEP).min(MAX_FRONT_BIAS);
    }

    /// Decrease brake bias by 2% (clamped to min)
    pub fn decrease_brake_bias(&mut self) {
        self.config.front_bias = (self.config.front_bias - BIAS_ADJUSTMENT_STEP).max(MIN_FRONT_BIAS);
    }

    /// Set engine braking level
    pub fn set_engine_braking_level(&mut self, level: EngineBrakingLevel) {
        self.config.engine_braking = level;
    }

    /// Get current engine braking level
    pub fn get_engine_braking_level(&self) -> EngineBrakingLevel {
        self.config.engine_braking
    }

    /// Cycle through engine braking levels (Low -> Medium -> High -> Low)
    pub fn cycle_engine_braking_level(&mut self) {
        self.config.engine_braking = match self.config.engine_braking {
            EngineBrakingLevel::Low => EngineBrakingLevel::Medium,
            EngineBrakingLevel::Medium => EngineBrakingLevel::High,
            EngineBrakingLevel::High => EngineBrakingLevel::Low,
        };
    }

    // ========================================================================
    // Physics Calculations
    // ========================================================================

    /// Calculate front and rear brake forces from total brake force
    pub fn calculate_forces(&self, total_brake_force: f32) -> (f32, f32) {
        let front_force = total_brake_force * self.config.front_bias;
        let rear_force = total_brake_force * (1.0 - self.config.front_bias);
        (front_force, rear_force)
    }

    /// Get engine braking force for current level
    pub fn get_engine_braking_force(&self) -> f32 {
        match self.config.engine_braking {
            EngineBrakingLevel::Low => ENGINE_BRAKE_LOW,
            EngineBrakingLevel::Medium => ENGINE_BRAKE_MEDIUM,
            EngineBrakingLevel::High => ENGINE_BRAKE_HIGH,
        }
    }

    pub fn update_disc_temps(
        &mut self,
        dt: f32,
        speed_ms: f32,
        is_braking: bool,
        total_brake_force: f32,
        ambient_celsius: f32,
    ) {
        let forces = if is_braking {
            let (front, rear) = self.calculate_forces(total_brake_force);
            [front / 2.0, front / 2.0, rear / 2.0, rear / 2.0]
        } else {
            [0.0; 4]
        };
        self.disc_temps.update(dt, speed_ms, forces, ambient_celsius);
    }

    pub fn get_brake_temperatures(&self) -> [f32; 4] {
        self.disc_temps.celsius()
    }

    pub fn get_brake_wear(&self) -> [f32; 4] {
        self.disc_temps.wear
    }

    pub fn get_fade_multiplier(&self) -> f32 {
        self.disc_temps.get_overall_fade()
    }

    pub fn get_state(&self) -> BrakeState {
        BrakeState {
            front_bias: self.config.front_bias,
            engine_braking: self.config.engine_braking,
            front_brake_force: 0.0,  // Will be set during physics step
            rear_brake_force: 0.0,   // Will be set during physics step
        }
    }

    /// Get current brake state with calculated forces
    pub fn get_state_with_forces(&self, total_brake_force: f32) -> BrakeState {
        let (front_force, rear_force) = self.calculate_forces(total_brake_force);
        BrakeState {
            front_bias: self.config.front_bias,
            engine_braking: self.config.engine_braking,
            front_brake_force: front_force,
            rear_brake_force: rear_force,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let brakes = BrakePhysicsState::new();
        assert_eq!(brakes.get_brake_bias(), DEFAULT_FRONT_BIAS);
        assert_eq!(brakes.get_engine_braking_level(), EngineBrakingLevel::Medium);
    }

    #[test]
    fn test_brake_bias_clamping() {
        let mut brakes = BrakePhysicsState::new();

        // Test setting below minimum
        brakes.set_brake_bias(0.4);
        assert_eq!(brakes.get_brake_bias(), MIN_FRONT_BIAS);

        // Test setting above maximum
        brakes.set_brake_bias(0.8);
        assert_eq!(brakes.get_brake_bias(), MAX_FRONT_BIAS);

        // Test valid value
        brakes.set_brake_bias(0.6);
        assert_eq!(brakes.get_brake_bias(), 0.6);
    }

    #[test]
    fn test_brake_bias_adjustment() {
        let mut brakes = BrakePhysicsState::new();

        // Test increase
        brakes.set_brake_bias(0.58);
        brakes.increase_brake_bias();
        assert!((brakes.get_brake_bias() - 0.60).abs() < 0.001);

        // Test decrease
        brakes.decrease_brake_bias();
        assert!((brakes.get_brake_bias() - 0.58).abs() < 0.001);

        // Test clamping at max
        brakes.set_brake_bias(0.70);
        brakes.increase_brake_bias();
        assert_eq!(brakes.get_brake_bias(), MAX_FRONT_BIAS);

        // Test clamping at min
        brakes.set_brake_bias(0.50);
        brakes.decrease_brake_bias();
        assert_eq!(brakes.get_brake_bias(), MIN_FRONT_BIAS);
    }

    #[test]
    fn test_engine_braking_cycle() {
        let mut brakes = BrakePhysicsState::new();

        // Start at Medium
        assert_eq!(brakes.get_engine_braking_level(), EngineBrakingLevel::Medium);

        // Cycle to High
        brakes.cycle_engine_braking_level();
        assert_eq!(brakes.get_engine_braking_level(), EngineBrakingLevel::High);

        // Cycle to Low
        brakes.cycle_engine_braking_level();
        assert_eq!(brakes.get_engine_braking_level(), EngineBrakingLevel::Low);

        // Cycle back to Medium
        brakes.cycle_engine_braking_level();
        assert_eq!(brakes.get_engine_braking_level(), EngineBrakingLevel::Medium);
    }

    #[test]
    fn test_force_calculation() {
        let brakes = BrakePhysicsState::new();
        let total_force = 10000.0;

        let (front, rear) = brakes.calculate_forces(total_force);

        // Check bias is applied correctly
        assert!((front - 5800.0).abs() < 0.1); // 58% of 10000
        assert!((rear - 4200.0).abs() < 0.1);  // 42% of 10000
        assert!((front + rear - total_force).abs() < 0.1); // Forces sum to total
    }

    #[test]
    fn test_engine_braking_forces() {
        let mut brakes = BrakePhysicsState::new();

        brakes.set_engine_braking_level(EngineBrakingLevel::Low);
        assert_eq!(brakes.get_engine_braking_force(), ENGINE_BRAKE_LOW);

        brakes.set_engine_braking_level(EngineBrakingLevel::Medium);
        assert_eq!(brakes.get_engine_braking_force(), ENGINE_BRAKE_MEDIUM);

        brakes.set_engine_braking_level(EngineBrakingLevel::High);
        assert_eq!(brakes.get_engine_braking_force(), ENGINE_BRAKE_HIGH);
    }

    #[test]
    fn test_state_with_forces() {
        let brakes = BrakePhysicsState::new();
        let total_force = 20000.0;

        let state = brakes.get_state_with_forces(total_force);

        assert_eq!(state.front_bias, DEFAULT_FRONT_BIAS);
        assert_eq!(state.engine_braking, EngineBrakingLevel::Medium);
        assert!((state.front_brake_force - 11600.0).abs() < 0.1); // 58% of 20000
        assert!((state.rear_brake_force - 8400.0).abs() < 0.1);   // 42% of 20000
    }

    #[test]
    fn test_brake_disc_heats_up_under_braking() {
        let mut discs = BrakeDiscTemperatures::new();
        let initial_temp = discs.celsius()[0];
        for _ in 0..600 {
            discs.update(1.0 / 60.0, 30.0, [5000.0, 5000.0, 3000.0, 3000.0], 25.0);
        }
        let after_temp = discs.celsius()[0];
        assert!(
            after_temp > initial_temp + 50.0,
            "Brake disc should heat up from {} to well above, got {}",
            initial_temp, after_temp
        );
    }

    #[test]
    fn test_high_speed_cools_faster() {
        let mut slow_discs = BrakeDiscTemperatures::new();
        let mut fast_discs = BrakeDiscTemperatures::new();

        for d in [&mut slow_discs, &mut fast_discs] {
            d.temps = [800.0; 4];
        }

        for _ in 0..600 {
            slow_discs.update(1.0 / 60.0, 5.0, [0.0; 4], 25.0);
            fast_discs.update(1.0 / 60.0, 60.0, [0.0; 4], 25.0);
        }

        assert!(
            fast_discs.celsius()[0] < slow_discs.celsius()[0],
            "High speed ({}) should cool faster than low speed ({})",
            fast_discs.celsius()[0], slow_discs.celsius()[0]
        );
    }

    #[test]
    fn test_brake_fade_starts_at_600c() {
        let mu_500 = brake_friction_mu(500.0);
        let mu_700 = brake_friction_mu(700.0);
        assert!(
            mu_500 > mu_700,
            "Friction at 500C ({}) should be > 700C ({})",
            mu_500, mu_700
        );
        assert!((mu_500 - 0.45).abs() < 0.01);
    }

    #[test]
    fn test_brake_cold_low_friction() {
        let mu_cold = brake_friction_mu(50.0);
        let mu_optimal = brake_friction_mu(400.0);
        assert!(
            mu_cold < mu_optimal,
            "Cold brake friction ({}) should be < optimal ({})",
            mu_cold, mu_optimal
        );
    }

    #[test]
    fn test_disc_temp_stays_reasonable() {
        let mut discs = BrakeDiscTemperatures::new();
        for _ in 0..3600 {
            discs.update(1.0 / 60.0, 30.0, [8000.0; 4], 25.0);
        }
        for i in 0..4 {
            assert!(
                discs.celsius()[i] < 1000.0,
                "Disc {} temp {} should stay under 1000C with cooling",
                i, discs.celsius()[i]
            );
        }
    }

    #[test]
    fn test_brake_to_tire_heat_transfer() {
        let mut discs = BrakeDiscTemperatures::new();
        discs.temps = [873.15; 4]; // 600C
        let tire_temps = [80.0; 4]; // 80C tires
        let deltas = discs.heat_to_tires(&tire_temps);
        for delta in &deltas {
            assert!(
                *delta > 0.0,
                "Hot brake should transfer heat to cooler tire, got {}",
                delta
            );
        }
    }

    #[test]
    fn test_brake_bias_affects_total_force() {
        let total = 35000.0;

        let biases = [0.50, 0.55, 0.58, 0.65, 0.70];
        for bias in biases {
            let mut brakes = BrakePhysicsState::new();
            brakes.set_brake_bias(bias);
            let (front, rear) = brakes.calculate_forces(total);

            assert!(
                (front + rear - total).abs() < 0.01,
                "Front + rear ({} + {} = {}) should equal total force ({}) at bias {}",
                front, rear, front + rear, total, bias
            );
            assert!(
                (front / total - bias).abs() < 0.001,
                "Front ratio {} should match bias {} at bias {}",
                front / total, bias, bias
            );
        }
    }
}
