use crate::types::{TerrainMaterial, TerrainMaterialProperties};

pub const CHUNK_SIZE: usize = 64;
pub const MAX_CHUNKS: usize = 256;

pub const BASE_BUMP_AMPLITUDE: f32 = 0.008;
pub const BUMP_OCTAVES: u32 = 2;
pub const BUMP_PERSISTENCE: f32 = 0.5;
pub const BUMP_BASE_WAVELENGTH: f32 = 0.6;
pub const MAX_BUMP_SPEED: f32 = 40.0;

pub const PLANK_RIDE_HEIGHT: f32 = 0.035;
pub const PLANK_DRAG_COEFFICIENT: f32 = 0.15;

pub const MATERIAL_HYSTERESIS_COUNT: u32 = 2;
pub const GRIP_SMOOTHING_ALPHA: f32 = 0.3;

pub fn material_properties(material: TerrainMaterial) -> TerrainMaterialProperties {
    match material {
        TerrainMaterial::Asphalt => TerrainMaterialProperties {
            grip_coefficient: 1.00,
            roughness_factor: 0.30,
            thermal_conductivity: 0.80,
            tire_wear_rate: 1.00,
            drag_multiplier: 1.00,
            rolling_resistance: 1.00,
        },
        TerrainMaterial::Concrete => TerrainMaterialProperties {
            grip_coefficient: 0.95,
            roughness_factor: 0.20,
            thermal_conductivity: 0.90,
            tire_wear_rate: 1.05,
            drag_multiplier: 1.00,
            rolling_resistance: 1.00,
        },
        TerrainMaterial::Painted => TerrainMaterialProperties {
            grip_coefficient: 0.85,
            roughness_factor: 0.10,
            thermal_conductivity: 0.70,
            tire_wear_rate: 0.80,
            drag_multiplier: 1.00,
            rolling_resistance: 0.95,
        },
        TerrainMaterial::WornTarmac => TerrainMaterialProperties {
            grip_coefficient: 0.92,
            roughness_factor: 0.50,
            thermal_conductivity: 0.75,
            tire_wear_rate: 1.10,
            drag_multiplier: 1.00,
            rolling_resistance: 1.02,
        },
        TerrainMaterial::FreshTarmac => TerrainMaterialProperties {
            grip_coefficient: 1.05,
            roughness_factor: 0.15,
            thermal_conductivity: 0.85,
            tire_wear_rate: 0.95,
            drag_multiplier: 1.00,
            rolling_resistance: 0.98,
        },
        TerrainMaterial::Grass => TerrainMaterialProperties {
            grip_coefficient: 0.35,
            roughness_factor: 0.70,
            thermal_conductivity: 0.30,
            tire_wear_rate: 0.60,
            drag_multiplier: 1.50,
            rolling_resistance: 2.50,
        },
        TerrainMaterial::Gravel => TerrainMaterialProperties {
            grip_coefficient: 0.55,
            roughness_factor: 0.80,
            thermal_conductivity: 0.40,
            tire_wear_rate: 1.40,
            drag_multiplier: 1.80,
            rolling_resistance: 3.00,
        },
        TerrainMaterial::Sand => TerrainMaterialProperties {
            grip_coefficient: 0.40,
            roughness_factor: 0.60,
            thermal_conductivity: 0.35,
            tire_wear_rate: 1.20,
            drag_multiplier: 2.00,
            rolling_resistance: 3.50,
        },
        TerrainMaterial::Astroturf => TerrainMaterialProperties {
            grip_coefficient: 0.30,
            roughness_factor: 0.15,
            thermal_conductivity: 0.25,
            tire_wear_rate: 0.50,
            drag_multiplier: 1.40,
            rolling_resistance: 2.00,
        },
        TerrainMaterial::WetCurb => TerrainMaterialProperties {
            grip_coefficient: 0.75,
            roughness_factor: 0.40,
            thermal_conductivity: 0.60,
            tire_wear_rate: 1.00,
            drag_multiplier: 1.10,
            rolling_resistance: 1.10,
        },
        TerrainMaterial::PaintedLine => TerrainMaterialProperties {
            grip_coefficient: 0.80,
            roughness_factor: 0.08,
            thermal_conductivity: 0.65,
            tire_wear_rate: 0.75,
            drag_multiplier: 1.00,
            rolling_resistance: 0.95,
        },
    }
}
