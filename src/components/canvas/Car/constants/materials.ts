/**
 * Car material configurations
 */

// Wet material properties - applied during rain
export const WET_MATERIAL = {
  metalness: 0.95,
  roughness: 0.05,
  envMapIntensity: 2.5,
}

// Dry material properties - default state
export const DRY_MATERIAL = {
  metalness: 0.8,
  roughness: 0.3,
  envMapIntensity: 1.0,
}

// Wet metal material
export const WET_METAL_MATERIAL = {
  metalness: 0.95,
  roughness: 0.08,
  envMapIntensity: 2.0,
}

// Dry metal material
export const DRY_METAL_MATERIAL = {
  metalness: 0.9,
  roughness: 0.2,
  envMapIntensity: 1.0,
}

// Car colors
export const CAR_COLORS = {
  frame: '#222222',
  metal: '#444444',
  cockpit: '#555555',
} as const

// Wheel positions relative to car body
export const WHEEL_POSITIONS = {
  frontZ: 1.6,
  rearZ: -1.2,
} as const

/**
 * Get material properties based on weather condition
 */
export function getBodyMaterial(isRaining: boolean) {
  return isRaining ? WET_MATERIAL : DRY_MATERIAL
}

/**
 * Get metal material properties based on weather condition
 */
export function getMetalMaterial(isRaining: boolean) {
  return isRaining ? WET_METAL_MATERIAL : DRY_METAL_MATERIAL
}
