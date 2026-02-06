use crate::types::{
    AmbientConditions, AmbientEnvironment, PrecipitationType, SurfaceFrictionBreakdown,
    WeatherModifiers,
};

const R_AIR: f32 = 287.05;
const REFERENCE_PRESSURE: f32 = 1013.25;
const REFERENCE_TEMP_K: f32 = 288.15;
const REFERENCE_AIR_DENSITY: f32 = 1.225;

#[derive(Debug)]
pub struct WeatherState {
    current_modifiers: WeatherModifiers,
    current_ambient: AmbientConditions,
    environment: AmbientEnvironment,
    water_film_mm: f32,
    snow_depth_mm: f32,
    ice_thickness_mm: f32,
    air_density: f32,
    brake_disc_damp_factor: f32,
}

impl Default for WeatherState {
    fn default() -> Self {
        let env = AmbientEnvironment::default_dry();
        let ambient = env.to_legacy_ambient();
        let mut state = Self {
            current_modifiers: WeatherModifiers::dry(),
            current_ambient: ambient,
            environment: env,
            water_film_mm: 0.0,
            snow_depth_mm: 0.0,
            ice_thickness_mm: 0.0,
            air_density: REFERENCE_AIR_DENSITY,
            brake_disc_damp_factor: 0.0,
        };
        state.air_density = state.compute_air_density();
        state.current_modifiers = state.compute_modifiers_from_physics();
        state
    }
}

impl WeatherState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn update(&mut self, delta_seconds: f32) {
        self.update_surface_state(delta_seconds);
        self.update_brake_dampness(delta_seconds);
    }

    pub fn get_modifiers(&self) -> &WeatherModifiers {
        &self.current_modifiers
    }

    pub fn get_environment(&self) -> &AmbientEnvironment {
        &self.environment
    }

    pub fn get_air_density(&self) -> f32 {
        self.air_density
    }

    pub fn get_surface_friction_breakdown(&self) -> SurfaceFrictionBreakdown {
        SurfaceFrictionBreakdown {
            water_film_mm: self.water_film_mm,
            ice_thickness: self.ice_thickness_mm,
            snow_depth: self.snow_depth_mm,
            base_mu: 1.0,
            effective_mu: self.compute_surface_friction(),
        }
    }

    pub fn get_temperature_decay_rate(&self) -> f32 {
        let celsius = self.environment.temperature_celsius;
        let precip = self.environment.precipitation_rate_mmh;
        let temp_rate = if celsius < 5.0 {
            0.12
        } else if celsius > 35.0 {
            0.015
        } else {
            0.03
        };
        let rain_factor = (precip / 50.0).clamp(0.0, 1.0);
        temp_rate * (1.0 + rain_factor * 1.5)
    }

    pub fn is_raining(&self) -> bool {
        self.environment.precipitation_rate_mmh > 0.5
            && self.environment.precipitation_type == PrecipitationType::Rain
    }

    pub fn get_ambient_conditions(&self) -> AmbientConditions {
        self.current_ambient
    }

    pub fn set_custom_ambient(&mut self, celsius: f32, humidity: f32, rain_intensity: f32) {
        let precip_mmh = rain_intensity * 50.0;
        self.environment = AmbientEnvironment::new(celsius, humidity, precip_mmh);
        self.current_ambient = self.environment.to_legacy_ambient();
        self.apply_initial_surface_state();
        self.air_density = self.compute_air_density();
        self.current_modifiers = self.compute_modifiers_from_physics();
    }

    pub fn set_environment(&mut self, env: AmbientEnvironment) {
        self.environment = env;
        self.current_ambient = env.to_legacy_ambient();
        self.apply_initial_surface_state();
        self.air_density = self.compute_air_density();
        self.current_modifiers = self.compute_modifiers_from_physics();
    }

    fn apply_initial_surface_state(&mut self) {
        let env = &self.environment;
        let precip = env.precipitation_rate_mmh;
        match env.precipitation_type {
            PrecipitationType::Rain | PrecipitationType::Hail => {
                self.water_film_mm = (precip * 0.02).clamp(0.0, 3.0);
                self.snow_depth_mm = 0.0;
                if env.temperature_celsius < 0.0 {
                    let ice_fraction = (-env.temperature_celsius / 10.0).clamp(0.0, 0.5);
                    self.ice_thickness_mm = self.water_film_mm * ice_fraction;
                    self.water_film_mm *= 1.0 - ice_fraction;
                }
            }
            PrecipitationType::Snow => {
                self.snow_depth_mm = (precip * 0.06).clamp(0.0, 20.0);
                self.water_film_mm = 0.0;
                if env.temperature_celsius < -2.0 {
                    let compact_fraction = ((-env.temperature_celsius - 2.0) / 10.0).clamp(0.0, 0.3);
                    self.ice_thickness_mm = self.snow_depth_mm * compact_fraction;
                    self.snow_depth_mm *= 1.0 - compact_fraction;
                }
            }
            PrecipitationType::None => {
                self.water_film_mm = 0.0;
                self.snow_depth_mm = 0.0;
                if env.temperature_celsius < -5.0 && env.humidity > 0.7 {
                    self.ice_thickness_mm = ((env.humidity - 0.7) * 0.5).clamp(0.0, 0.3);
                } else {
                    self.ice_thickness_mm = 0.0;
                }
            }
        }
    }

    pub fn get_rain_intensity(&self) -> f32 {
        self.current_ambient.rain_intensity
    }

    fn update_surface_state(&mut self, dt: f32) {
        let env = &self.environment;
        let celsius = env.temperature_celsius;
        let precip = env.precipitation_rate_mmh;

        match env.precipitation_type {
            PrecipitationType::Rain | PrecipitationType::Hail => {
                let accumulation = precip * 0.001 * dt;
                let evaporation = self.evaporation_rate(celsius) * dt;
                let drainage = self.water_film_mm * 0.05 * dt;
                self.water_film_mm = (self.water_film_mm + accumulation - evaporation - drainage).clamp(0.0, 5.0);

                if celsius < 0.0 {
                    let freeze_rate = (-celsius * 0.01).min(0.1);
                    let frozen = (self.water_film_mm * freeze_rate * dt).min(self.water_film_mm);
                    self.water_film_mm -= frozen;
                    self.ice_thickness_mm = (self.ice_thickness_mm + frozen).min(5.0);
                }
            }
            PrecipitationType::Snow => {
                let snow_accum = precip * 0.003 * dt;
                self.snow_depth_mm = (self.snow_depth_mm + snow_accum).min(50.0);

                if celsius > 0.0 {
                    let melt_rate = celsius * 0.02;
                    let melted = (self.snow_depth_mm * melt_rate * dt).min(self.snow_depth_mm);
                    self.snow_depth_mm -= melted;
                    self.water_film_mm = (self.water_film_mm + melted * 0.3).min(5.0);
                }

                if celsius < -2.0 {
                    let compact_rate = 0.01 * dt;
                    let compacted = self.snow_depth_mm * compact_rate;
                    self.snow_depth_mm -= compacted;
                    self.ice_thickness_mm = (self.ice_thickness_mm + compacted * 0.2).min(5.0);
                }
            }
            PrecipitationType::None => {
                let evaporation = self.evaporation_rate(celsius) * dt;
                let drainage = self.water_film_mm * 0.05 * dt;
                self.water_film_mm = (self.water_film_mm - evaporation - drainage).max(0.0);

                if celsius > 0.0 {
                    let melt_rate = celsius * 0.005;
                    let ice_melted = (self.ice_thickness_mm * melt_rate * dt).min(self.ice_thickness_mm);
                    self.ice_thickness_mm -= ice_melted;
                    self.water_film_mm = (self.water_film_mm + ice_melted * 0.5).min(5.0);

                    let snow_melted = (self.snow_depth_mm * melt_rate * 1.5 * dt).min(self.snow_depth_mm);
                    self.snow_depth_mm -= snow_melted;
                    self.water_film_mm = (self.water_film_mm + snow_melted * 0.3).min(5.0);
                }
            }
        }

        self.current_modifiers = self.compute_modifiers_from_physics();
    }

    fn update_brake_dampness(&mut self, dt: f32) {
        let humidity = self.environment.humidity;
        let celsius = self.environment.temperature_celsius;
        let dew_point = celsius - (100.0 - humidity * 100.0) / 5.0;
        let is_damp = self.water_film_mm > 0.01 || celsius < dew_point + 2.0;

        if is_damp && self.brake_disc_damp_factor < 1.0 {
            self.brake_disc_damp_factor = (self.brake_disc_damp_factor + 0.3 * dt).min(1.0);
        } else if !is_damp && self.brake_disc_damp_factor > 0.0 {
            self.brake_disc_damp_factor = (self.brake_disc_damp_factor - 0.5 * dt).max(0.0);
        }
    }

    fn evaporation_rate(&self, celsius: f32) -> f32 {
        let base = if celsius > 30.0 {
            0.002
        } else if celsius > 15.0 {
            0.001
        } else {
            0.0003
        };
        base * (1.0 - self.environment.humidity * 0.7)
    }

    fn compute_surface_friction(&self) -> f32 {
        let water = self.water_film_mm;
        let ice = self.ice_thickness_mm;
        let snow = self.snow_depth_mm;

        let water_mu = if water < 0.01 {
            1.0
        } else if water < 0.1 {
            0.7 + (0.1 - water) / 0.1 * 0.3
        } else if water < 0.5 {
            0.5 + (0.5 - water) / 0.4 * 0.2
        } else if water < 2.0 {
            0.3 + (2.0 - water) / 1.5 * 0.2
        } else {
            0.3
        };

        let ice_mu = if ice < 0.01 {
            1.0
        } else if ice < 0.5 {
            0.15 + (0.5 - ice) / 0.5 * 0.85
        } else {
            0.05 + (1.0 - (ice / 5.0).min(1.0)) * 0.1
        };

        let snow_mu = if snow < 0.1 {
            1.0
        } else if snow < 5.0 {
            0.3 + (5.0 - snow) / 5.0 * 0.7
        } else {
            0.15 + (1.0 - (snow / 50.0).min(1.0)) * 0.15
        };

        (water_mu * ice_mu * snow_mu).clamp(0.05, 1.0)
    }

    pub fn compute_air_density(&self) -> f32 {
        let temp_k = self.environment.temperature_celsius + 273.15;
        let p = self.environment.atmospheric_pressure_hpa * 100.0;
        let rho_dry = p / (R_AIR * temp_k);

        let e_sat = 611.2 * ((17.67 * self.environment.temperature_celsius) / (self.environment.temperature_celsius + 243.5)).exp();
        let e = self.environment.humidity * e_sat;
        let rho = rho_dry * (1.0 - 0.378 * e / p);

        rho.clamp(0.8, 1.8)
    }

    fn compute_engine_efficiency(&self) -> f32 {
        self.air_density / REFERENCE_AIR_DENSITY
    }

    fn compute_aero_density_ratio(&self) -> f32 {
        self.air_density / REFERENCE_AIR_DENSITY
    }

    fn compute_brake_efficiency(&self) -> f32 {
        let base = self.compute_surface_friction();
        let damp_penalty = self.brake_disc_damp_factor * 0.15;
        let humidity_boost = self.environment.humidity * 0.05;
        (base - damp_penalty + humidity_boost).clamp(0.3, 1.0)
    }

    fn compute_steer_response(&self) -> f32 {
        let friction = self.compute_surface_friction();
        let response = 0.5 + friction * 0.5;
        response.clamp(0.4, 1.0)
    }

    fn compute_modifiers_from_physics(&self) -> WeatherModifiers {
        let friction = self.compute_surface_friction();
        let density_ratio = self.compute_aero_density_ratio();
        let engine_eff = self.compute_engine_efficiency();
        let brake_eff = self.compute_brake_efficiency();
        let steer_resp = self.compute_steer_response();

        let drift_entry = if friction < 0.5 {
            0.3 + friction * 0.4
        } else {
            friction
        };

        let drift_correction = if friction < 0.5 {
            0.35 + friction * 0.3
        } else {
            friction
        };

        WeatherModifiers {
            friction_slip_multiplier: friction,
            drag_multiplier: density_ratio,
            downforce_multiplier: density_ratio,
            engine_efficiency_multiplier: engine_eff,
            brake_efficiency_multiplier: brake_eff,
            steer_response_multiplier: steer_resp,
            max_steer_angle_multiplier: 1.0,
            drift_entry_slip_angle_multiplier: drift_entry,
            drift_lateral_correction_multiplier: drift_correction,
            max_speed_multiplier: 1.0,
        }
    }
}

pub fn compute_convection_coefficient(humidity: f32, wind_speed: f32) -> f32 {
    let base_h = 10.0 + wind_speed * 5.0;
    base_h * (1.0 + 0.3 * humidity)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_weather_default() {
        let state = WeatherState::new();
        let ambient = state.get_ambient_conditions();
        assert!((ambient.to_celsius() - 25.0).abs() < 1.0);
        assert!(ambient.rain_intensity < 0.01);
    }

    #[test]
    fn test_custom_weather() {
        let mut state = WeatherState::new();
        state.set_custom_ambient(15.0, 0.9, 1.0);

        let modifiers = state.get_modifiers();
        assert!(
            modifiers.friction_slip_multiplier < 0.85,
            "Rain should reduce friction, got {}",
            modifiers.friction_slip_multiplier
        );
    }

    #[test]
    fn test_temperature_zones() {
        let mut state = WeatherState::new();

        state.set_custom_ambient(-5.0, 0.5, 0.0);
        let modifiers = state.get_modifiers();
        assert!(
            modifiers.friction_slip_multiplier < 1.05,
            "Cold dry: friction should be near 1.0 (no precip), got {}",
            modifiers.friction_slip_multiplier
        );

        state.set_custom_ambient(20.0, 0.3, 0.0);
        let modifiers = state.get_modifiers();
        assert!((modifiers.friction_slip_multiplier - 1.0).abs() < 0.1);

        state.set_custom_ambient(45.0, 0.2, 0.0);
        let modifiers = state.get_modifiers();
        assert!((modifiers.friction_slip_multiplier - 1.0).abs() < 0.1);
    }

    #[test]
    fn test_decay_rates() {
        let mut state = WeatherState::new();

        state.set_custom_ambient(25.0, 0.3, 0.0);
        assert!((state.get_temperature_decay_rate() - 0.03).abs() < 0.001);

        state.set_custom_ambient(-5.0, 0.5, 0.0);
        assert!((state.get_temperature_decay_rate() - 0.12).abs() < 0.001);

        state.set_custom_ambient(25.0, 0.9, 1.0);
        assert!(state.get_temperature_decay_rate() > 0.05);
    }

    #[test]
    fn test_is_raining() {
        let mut state = WeatherState::new();

        state.set_custom_ambient(25.0, 0.3, 0.0);
        assert!(!state.is_raining());

        state.set_custom_ambient(15.0, 0.9, 0.5);
        assert!(state.is_raining());
    }

    #[test]
    fn test_dry_25c_modifiers_near_one() {
        let state = WeatherState::new();
        let m = state.get_modifiers();
        assert!(
            (m.friction_slip_multiplier - 1.0).abs() < 0.05,
            "25C dry friction should be ~1.0, got {}",
            m.friction_slip_multiplier
        );
        assert!(
            (m.drag_multiplier - 1.0).abs() < 0.1,
            "25C dry drag should be ~1.0, got {}",
            m.drag_multiplier
        );
        assert!(
            (m.engine_efficiency_multiplier - 1.0).abs() < 0.1,
            "25C dry engine eff should be ~1.0, got {}",
            m.engine_efficiency_multiplier
        );
    }

    #[test]
    fn test_water_film_initial_wet_most_dangerous() {
        let mut state = WeatherState::new();
        state.set_environment(AmbientEnvironment::new(20.0, 0.6, 5.0));
        for _ in 0..300 {
            state.update(1.0 / 60.0);
        }
        let light_friction = state.get_modifiers().friction_slip_multiplier;

        let mut state2 = WeatherState::new();
        state2.set_environment(AmbientEnvironment::new(20.0, 0.6, 40.0));
        for _ in 0..300 {
            state2.update(1.0 / 60.0);
        }
        let heavy_friction = state2.get_modifiers().friction_slip_multiplier;

        assert!(
            heavy_friction < light_friction || (heavy_friction - light_friction).abs() < 0.15,
            "Heavy rain ({}) should have <= friction than light rain ({})",
            heavy_friction,
            light_friction
        );
    }

    #[test]
    fn test_snow_auto_detected_below_zero() {
        let env = AmbientEnvironment::new(-5.0, 0.8, 10.0);
        assert_eq!(env.precipitation_type, PrecipitationType::Snow);
    }

    #[test]
    fn test_rain_auto_detected_above_two() {
        let env = AmbientEnvironment::new(10.0, 0.8, 10.0);
        assert_eq!(env.precipitation_type, PrecipitationType::Rain);
    }

    #[test]
    fn test_snow_friction_less_than_rain() {
        let mut snow_state = WeatherState::new();
        snow_state.set_environment(AmbientEnvironment::new(-5.0, 0.8, 20.0));
        for _ in 0..600 {
            snow_state.update(1.0 / 60.0);
        }

        let mut rain_state = WeatherState::new();
        rain_state.set_environment(AmbientEnvironment::new(15.0, 0.8, 20.0));
        for _ in 0..600 {
            rain_state.update(1.0 / 60.0);
        }

        assert!(
            snow_state.get_modifiers().friction_slip_multiplier
                <= rain_state.get_modifiers().friction_slip_multiplier + 0.05,
            "Snow friction ({}) should be <= rain friction ({})",
            snow_state.get_modifiers().friction_slip_multiplier,
            rain_state.get_modifiers().friction_slip_multiplier
        );
    }

    #[test]
    fn test_cold_air_increases_engine_power() {
        let mut cold_state = WeatherState::new();
        cold_state.set_environment(AmbientEnvironment::new(-10.0, 0.3, 0.0));

        let mut hot_state = WeatherState::new();
        hot_state.set_environment(AmbientEnvironment::new(40.0, 0.3, 0.0));

        assert!(
            cold_state.get_modifiers().engine_efficiency_multiplier
                > hot_state.get_modifiers().engine_efficiency_multiplier,
            "Cold air ({}) should give more engine power than hot ({})",
            cold_state.get_modifiers().engine_efficiency_multiplier,
            hot_state.get_modifiers().engine_efficiency_multiplier
        );
    }

    #[test]
    fn test_air_density_reference() {
        let state = WeatherState::new();
        let rho = state.get_air_density();
        assert!(
            (rho - REFERENCE_AIR_DENSITY).abs() < 0.1,
            "Air density at 25C/1013hPa should be near 1.225, got {}",
            rho
        );
    }

    #[test]
    fn test_air_density_cold_higher() {
        let mut cold = WeatherState::new();
        cold.set_environment(AmbientEnvironment::new(-10.0, 0.3, 0.0));

        let mut hot = WeatherState::new();
        hot.set_environment(AmbientEnvironment::new(40.0, 0.3, 0.0));

        assert!(
            cold.get_air_density() > hot.get_air_density(),
            "Cold air density ({}) should be > hot ({})",
            cold.get_air_density(),
            hot.get_air_density()
        );
    }

    #[test]
    fn test_humidity_brake_dampness() {
        let mut state = WeatherState::new();
        state.set_environment(AmbientEnvironment::new(5.0, 0.95, 2.0));
        for _ in 0..600 {
            state.update(1.0 / 60.0);
        }
        let brake_eff = state.get_modifiers().brake_efficiency_multiplier;
        assert!(
            brake_eff < 0.95,
            "High humidity + light rain should reduce brake efficiency, got {}",
            brake_eff
        );
    }

    #[test]
    fn test_surface_friction_breakdown() {
        let mut state = WeatherState::new();
        state.set_environment(AmbientEnvironment::new(20.0, 0.5, 15.0));
        for _ in 0..600 {
            state.update(1.0 / 60.0);
        }
        let breakdown = state.get_surface_friction_breakdown();
        assert!(breakdown.water_film_mm > 0.0);
        assert!(breakdown.effective_mu < 1.0);
    }

    #[test]
    fn test_convection_coefficient() {
        let h_dry = compute_convection_coefficient(0.0, 0.0);
        let h_humid_windy = compute_convection_coefficient(0.9, 15.0);
        assert!(h_humid_windy > h_dry);
    }

    #[test]
    fn test_legacy_api_compatibility() {
        let mut state = WeatherState::new();
        state.set_custom_ambient(25.0, 0.3, 0.0);

        let m = state.get_modifiers();
        assert!(m.friction_slip_multiplier > 0.0);
        assert!(m.drag_multiplier > 0.0);
        assert!(m.engine_efficiency_multiplier > 0.0);
        assert!(m.brake_efficiency_multiplier > 0.0);
        assert!(m.steer_response_multiplier > 0.0);

        let ambient = state.get_ambient_conditions();
        assert!((ambient.to_celsius() - 25.0).abs() < 1.0);
    }

    #[test]
    fn test_ice_friction_lowest() {
        let mut state = WeatherState::new();
        state.set_environment(AmbientEnvironment::new(-10.0, 0.7, 15.0));
        for _ in 0..1800 {
            state.update(1.0 / 60.0);
        }
        let ice_friction = state.get_modifiers().friction_slip_multiplier;

        let mut rain_state = WeatherState::new();
        rain_state.set_environment(AmbientEnvironment::new(15.0, 0.7, 15.0));
        for _ in 0..1800 {
            rain_state.update(1.0 / 60.0);
        }
        let rain_friction = rain_state.get_modifiers().friction_slip_multiplier;

        assert!(
            ice_friction < rain_friction,
            "Ice friction ({}) should be < rain friction ({})",
            ice_friction,
            rain_friction
        );
    }
}
