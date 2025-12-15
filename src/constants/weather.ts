// Weather types
export type WeatherCondition = 'dry' | 'hot' | 'rain' | 'cold'

// Atmosphere configuration for dynamic sky/lighting
export interface AtmosphereConfig {
  // Sky parameters
  skyTurbidity: number
  skyRayleigh: number
  skyMieCoefficient: number
  skyMieDirectionalG: number
  sunPosition: [number, number, number]

  // Cloud parameters
  cloudOpacity: number
  cloudCount: number
  cloudColor: string

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

// Weather modifier interface
export interface WeatherModifiers {
  // Tire grip modifiers (multiplier to base frictionSlip 1.7)
  frictionSlipMultiplier: number

  // Aerodynamic modifiers
  dragMultiplier: number
  downforceMultiplier: number

  // Engine/power modifiers
  engineEfficiencyMultiplier: number

  // Brake modifiers
  brakeEfficiencyMultiplier: number

  // Steering modifiers
  steerResponseMultiplier: number
  maxSteerAngleMultiplier: number

  // Drift behavior modifiers
  driftEntrySlipAngleMultiplier: number
  driftLateralCorrectionMultiplier: number

  // Speed limits
  maxSpeedMultiplier: number

  // Display properties
  displayName: string
  description: string
  icon: string
}

// Weather configurations
export const WEATHER_CONFIG: Record<WeatherCondition, WeatherModifiers> = {
  dry: {
    // Baseline - all multipliers at 1.0
    frictionSlipMultiplier: 1.0,
    dragMultiplier: 1.0,
    downforceMultiplier: 1.0,
    engineEfficiencyMultiplier: 1.0,
    brakeEfficiencyMultiplier: 1.0,
    steerResponseMultiplier: 1.0,
    maxSteerAngleMultiplier: 1.0,
    driftEntrySlipAngleMultiplier: 1.0,
    driftLateralCorrectionMultiplier: 1.0,
    maxSpeedMultiplier: 1.0,
    displayName: 'Dry',
    description: 'Normal conditions - optimal grip',
    icon: '☀️',
  },

  hot: {
    // Hot weather - good grip from warm tires, slight brake fade
    frictionSlipMultiplier: 1.1,
    dragMultiplier: 0.98,
    downforceMultiplier: 0.98,
    engineEfficiencyMultiplier: 1.0,
    brakeEfficiencyMultiplier: 0.92,
    steerResponseMultiplier: 1.0,
    maxSteerAngleMultiplier: 1.0,
    driftEntrySlipAngleMultiplier: 1.1,
    driftLateralCorrectionMultiplier: 1.05,
    maxSpeedMultiplier: 1.0,
    displayName: 'Hot',
    description: 'Warm conditions - good grip, watch brake temps',
    icon: '🔥',
  },

  rain: {
    // Rain - reduced grip, slippery in turns at high speed
    frictionSlipMultiplier: 0.5, // Even less base grip (was 0.55)
    dragMultiplier: 1.1,
    downforceMultiplier: 0.9,
    engineEfficiencyMultiplier: 1.0,
    brakeEfficiencyMultiplier: 0.55, // Harder to stop (was 0.65)
    steerResponseMultiplier: 0.8, // Sluggish steering (was 0.85)
    maxSteerAngleMultiplier: 1.0,
    driftEntrySlipAngleMultiplier: 0.5, // Easier to break loose (was 0.6)
    driftLateralCorrectionMultiplier: 0.5, // Much more slide in corners (was 0.65)
    maxSpeedMultiplier: 1.0,
    displayName: 'Rain',
    description: 'Wet conditions - slippery in turns!',
    icon: '🌧️',
  },

  cold: {
    // Cold/Freezing - very slippery, easy to lose control
    frictionSlipMultiplier: 0.25,
    dragMultiplier: 1.05,
    downforceMultiplier: 1.05,
    engineEfficiencyMultiplier: 1.0,
    brakeEfficiencyMultiplier: 0.35,
    steerResponseMultiplier: 0.7,
    maxSteerAngleMultiplier: 1.0,
    driftEntrySlipAngleMultiplier: 0.3,
    driftLateralCorrectionMultiplier: 0.35,
    maxSpeedMultiplier: 1.0,
    displayName: 'Freezing',
    description: 'Icy conditions - very easy to slide!',
    icon: '❄️',
  },
}

// Transition duration when weather changes (ms)
export const WEATHER_TRANSITION_DURATION = 3000

// Default weather
export const DEFAULT_WEATHER: WeatherCondition = 'dry'

// Weather order for cycling
export const WEATHER_ORDER: WeatherCondition[] = ['dry', 'hot', 'rain', 'cold']

// Atmosphere configurations per weather type
export const ATMOSPHERE_CONFIG: Record<WeatherCondition, AtmosphereConfig> = {
  dry: {
    // Clear blue sky, normal sun
    skyTurbidity: 10,
    skyRayleigh: 0.5,
    skyMieCoefficient: 0.005,
    skyMieDirectionalG: 0.8,
    sunPosition: [100, 50, 100],

    cloudOpacity: 0.5,
    cloudCount: 6,
    cloudColor: '#ffffff',

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

    cloudOpacity: 0.3,
    cloudCount: 4,
    cloudColor: '#fffaf0',

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
    // Gray overcast, low dim sun
    skyTurbidity: 20,
    skyRayleigh: 2.0,
    skyMieCoefficient: 0.02,
    skyMieDirectionalG: 0.7,
    sunPosition: [100, 20, 100],

    cloudOpacity: 0.9,
    cloudCount: 12,
    cloudColor: '#667788',

    ambientIntensity: 0.6,
    sunIntensity: 0.8,
    sunColor: '#99aabc',
    fillLightIntensity: 0.4,
    fillLightColor: '#8899aa',
    hemisphereIntensity: 0.5,
    hemisphereSkyColor: '#778899',
    hemisphereGroundColor: '#2a3a2a',

    fogColor: '#8899aa',
    fogNear: 80,
    fogFar: 350,
  },

  cold: {
    // Bluish winter sky, low sun
    skyTurbidity: 12,
    skyRayleigh: 1.5,
    skyMieCoefficient: 0.008,
    skyMieDirectionalG: 0.75,
    sunPosition: [120, 30, 80],

    cloudOpacity: 0.7,
    cloudCount: 10,
    cloudColor: '#aabbcc',

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
