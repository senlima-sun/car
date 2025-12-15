mod car_physics;
mod curb;
mod engine;
mod tires;
mod track_temperature;
mod types;
mod utils;
mod weather;

use engine::PhysicsEngine as PhysicsEngineInternal;
use serde_wasm_bindgen::{from_value, to_value};
use types::{CarInput, CurbSide, TireCompound, TrackBounds, WeatherCondition};
use wasm_bindgen::prelude::*;

// Re-export enums for JavaScript
pub use types::{TireCompound as TireCompoundEnum, WeatherCondition as WeatherConditionEnum};

/// WASM-exposed physics engine wrapper
#[wasm_bindgen]
pub struct PhysicsEngine {
    inner: PhysicsEngineInternal,
}

#[wasm_bindgen]
impl PhysicsEngine {
    /// Create a new physics engine instance
    #[wasm_bindgen(constructor)]
    pub fn new() -> PhysicsEngine {
        // Set panic hook for better error messages in browser
        #[cfg(feature = "console_error_panic_hook")]
        console_error_panic_hook::set_once();

        PhysicsEngine {
            inner: PhysicsEngineInternal::new(),
        }
    }

    // ========================================================================
    // Weather API
    // ========================================================================

    /// Set the current weather condition
    #[wasm_bindgen]
    pub fn set_weather(&mut self, weather: WeatherCondition) {
        self.inner.set_weather(weather);
    }

    /// Get the current weather condition
    #[wasm_bindgen]
    pub fn get_weather(&self) -> WeatherCondition {
        self.inner.get_weather()
    }

    /// Update weather transition (call each frame)
    #[wasm_bindgen]
    pub fn update_weather_transition(&mut self, delta_seconds: f32) {
        self.inner.update_weather_transition(delta_seconds);
    }

    /// Get current weather modifiers as JavaScript object
    #[wasm_bindgen]
    pub fn get_weather_modifiers(&self) -> JsValue {
        to_value(&self.inner.get_weather_modifiers()).unwrap_or(JsValue::NULL)
    }

    /// Check if weather is transitioning
    #[wasm_bindgen]
    pub fn is_weather_transitioning(&self) -> bool {
        self.inner.is_weather_transitioning()
    }

    // ========================================================================
    // Tire API
    // ========================================================================

    /// Set the tire compound
    #[wasm_bindgen]
    pub fn set_tire_compound(&mut self, compound: TireCompound) {
        self.inner.set_tire_compound(compound);
    }

    /// Get the current tire compound
    #[wasm_bindgen]
    pub fn get_tire_compound(&self) -> TireCompound {
        self.inner.get_tire_compound()
    }

    /// Get current tire wear (0.0 to 1.0)
    #[wasm_bindgen]
    pub fn get_tire_wear(&self) -> f32 {
        self.inner.get_tire_wear()
    }

    /// Reset tire wear to 0
    #[wasm_bindgen]
    pub fn reset_tire_wear(&mut self) {
        self.inner.reset_tire_wear();
    }

    /// Get effective grip (compound * weather * wear)
    #[wasm_bindgen]
    pub fn get_effective_grip(&self) -> f32 {
        self.inner.get_effective_grip()
    }

    /// Get per-wheel tire wear as JavaScript object
    #[wasm_bindgen]
    pub fn get_tire_wear_per_wheel(&self) -> JsValue {
        to_value(&self.inner.get_tire_wear_per_wheel()).unwrap_or(JsValue::NULL)
    }

    // ========================================================================
    // Curb API
    // ========================================================================

    /// Set whether the car is on a curb
    #[wasm_bindgen]
    pub fn set_on_curb(&mut self, is_on_curb: bool, side: Option<String>) {
        let curb_side = side.and_then(|s| match s.as_str() {
            "left" | "Left" => Some(CurbSide::Left),
            "right" | "Right" => Some(CurbSide::Right),
            _ => None,
        });
        self.inner.set_on_curb(is_on_curb, curb_side);
    }

    /// Check if car is on curb
    #[wasm_bindgen]
    pub fn is_on_curb(&self) -> bool {
        self.inner.is_on_curb()
    }

    // ========================================================================
    // Track Temperature API
    // ========================================================================

    /// Initialize track temperature grid
    #[wasm_bindgen]
    pub fn init_track_temperature(&mut self, cell_size: f32, bounds: JsValue) {
        let track_bounds: TrackBounds = from_value(bounds).unwrap_or_default();
        self.inner.init_track_temperature(cell_size, track_bounds);
    }

    /// Get track temperature texture data (RGBA bytes)
    #[wasm_bindgen]
    pub fn get_track_texture_data(&mut self) -> Vec<u8> {
        self.inner.get_track_texture_data()
    }

    /// Get number of active track temperature cells
    #[wasm_bindgen]
    pub fn get_track_cell_count(&self) -> usize {
        self.inner.get_track_cell_count()
    }

    // ========================================================================
    // Main Physics Step
    // ========================================================================

    /// Main physics step - call every frame
    ///
    /// # Arguments
    /// * `delta_seconds` - Time since last frame in seconds
    /// * `input` - CarInput object with control state
    /// * `car_position` - [x, y, z] world position
    /// * `car_rotation` - [x, y, z, w] quaternion rotation
    /// * `current_linvel` - [x, y, z] current linear velocity
    /// * `current_angvel` - [x, y, z] current angular velocity
    ///
    /// # Returns
    /// CarPhysicsOutput with new velocities and telemetry
    #[wasm_bindgen]
    pub fn step(
        &mut self,
        delta_seconds: f32,
        input: JsValue,
        car_position: JsValue,
        car_rotation: JsValue,
        current_linvel: JsValue,
        current_angvel: JsValue,
    ) -> JsValue {
        // Parse inputs
        let input: CarInput = from_value(input).unwrap_or_default();
        let position: [f32; 3] = from_value(car_position).unwrap_or([0.0, 0.0, 0.0]);
        let rotation: [f32; 4] = from_value(car_rotation).unwrap_or([0.0, 0.0, 0.0, 1.0]);
        let linvel: [f32; 3] = from_value(current_linvel).unwrap_or([0.0, 0.0, 0.0]);
        let angvel: [f32; 3] = from_value(current_angvel).unwrap_or([0.0, 0.0, 0.0]);

        // Run physics step
        let output = self.inner.step(delta_seconds, input, position, rotation, linvel, angvel);

        // Return as JavaScript object
        to_value(&output).unwrap_or(JsValue::NULL)
    }

    // ========================================================================
    // Debug API
    // ========================================================================

    /// Get debug information as JavaScript object
    #[wasm_bindgen]
    pub fn get_debug_state(&self) -> JsValue {
        let info = self.inner.get_debug_info();
        JsValue::from_str(&format!("{:?}", info))
    }
}

impl Default for PhysicsEngine {
    fn default() -> Self {
        Self::new()
    }
}
