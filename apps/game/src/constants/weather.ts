// Weather types (kept for shader compatibility and internal blending)
export type WeatherCondition = 'dry' | 'hot' | 'rain' | 'cold'

// Atmosphere configuration for dynamic sky/lighting
export interface AtmosphereConfig {
  // Sky parameters
  skyTurbidity: number
  skyRayleigh: number
  skyMieCoefficient: number
  skyMieDirectionalG: number
  sunPosition: [number, number, number]

  // Lighting parameters
  ambientIntensity: number
  sunIntensity: number
  sunColor: string
  fillLightIntensity: number
  fillLightColor: string
  hemisphereIntensity: number
  hemisphereSkyColor: string
  hemisphereGroundColor: string

  // Fog parameters
  fogColor: string
  fogNear: number
  fogFar: number
}

// Atmosphere configurations per weather type (used for interpolation)
export const ATMOSPHERE_CONFIG: Record<WeatherCondition, AtmosphereConfig> = {
  dry: {
    // Clear blue sky, normal sun
    skyTurbidity: 10,
    skyRayleigh: 0.5,
    skyMieCoefficient: 0.005,
    skyMieDirectionalG: 0.8,
    sunPosition: [100, 50, 100],

    ambientIntensity: 1.0,
    sunIntensity: 2.5,
    sunColor: '#ffffff',
    fillLightIntensity: 1.0,
    fillLightColor: '#b4c7dc',
    hemisphereIntensity: 0.8,
    hemisphereSkyColor: '#87CEEB',
    hemisphereGroundColor: '#3d5c3d',

    fogColor: '#b5d3e7',
    fogNear: 150,
    fogFar: 600,
  },

  hot: {
    // Hazy bright sky, high sun
    skyTurbidity: 15,
    skyRayleigh: 0.3,
    skyMieCoefficient: 0.01,
    skyMieDirectionalG: 0.9,
    sunPosition: [80, 80, 60],

    ambientIntensity: 1.2,
    sunIntensity: 3.0,
    sunColor: '#fff8e0',
    fillLightIntensity: 0.8,
    fillLightColor: '#e0d0b0',
    hemisphereIntensity: 0.9,
    hemisphereSkyColor: '#e0d8c0',
    hemisphereGroundColor: '#5a6a3a',

    fogColor: '#d4c8b8',
    fogNear: 120,
    fogFar: 500,
  },

  rain: {
    // Dark overcast, sun barely visible at horizon
    skyTurbidity: 30,
    skyRayleigh: 4.0,
    skyMieCoefficient: 0.08,
    skyMieDirectionalG: 0.4,
    sunPosition: [100, 2, 100],

    ambientIntensity: 0.15,
    sunIntensity: 0.1,
    sunColor: '#5a6a7a',
    fillLightIntensity: 0.08,
    fillLightColor: '#2a3a4a',
    hemisphereIntensity: 0.12,
    hemisphereSkyColor: '#1a2a35',
    hemisphereGroundColor: '#0a1510',

    fogColor: '#2a3a45',
    fogNear: 30,
    fogFar: 180,
  },

  cold: {
    // Bluish winter sky, low sun
    skyTurbidity: 12,
    skyRayleigh: 1.5,
    skyMieCoefficient: 0.008,
    skyMieDirectionalG: 0.75,
    sunPosition: [120, 30, 80],

    ambientIntensity: 0.7,
    sunIntensity: 1.2,
    sunColor: '#ccddef',
    fillLightIntensity: 0.5,
    fillLightColor: '#b0c0e0',
    hemisphereIntensity: 0.6,
    hemisphereSkyColor: '#aabbcc',
    hemisphereGroundColor: '#445544',

    fogColor: '#ccddef',
    fogNear: 60,
    fogFar: 300,
  },
}
