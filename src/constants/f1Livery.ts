export const LIVERY = {
  PRIMARY: '#0a1128',
  PRIMARY_LIGHT: '#1a2744',
  ACCENT_RED: '#dc2626',
  ACCENT_YELLOW: '#eab308',
  CARBON: '#1a1a1a',
  CARBON_LIGHT: '#2a2a2a',
  TITANIUM: '#8a8a8a',
  WHITE: '#f0f0f0',
} as const

export const MATTE_BODY = {
  roughness: 0.35,
  metalness: 0.4,
  envMapIntensity: 1.2,
} as const

export const GLOSSY_ACCENT = {
  roughness: 0.3,
  metalness: 0.6,
  envMapIntensity: 1.2,
} as const

export const CARBON_FIBER = {
  roughness: 0.4,
  metalness: 0.3,
  envMapIntensity: 0.8,
} as const

export const TITANIUM_MATERIAL = {
  roughness: 0.35,
  metalness: 0.85,
  envMapIntensity: 1.0,
} as const

export function getWeatherBodyMaterial(isRaining: boolean) {
  if (isRaining) {
    return {
      roughness: 0.15,
      metalness: 0.7,
      envMapIntensity: 2.5,
    }
  }
  return MATTE_BODY
}

export function getWeatherAccentMaterial(isRaining: boolean) {
  if (isRaining) {
    return {
      roughness: 0.1,
      metalness: 0.8,
      envMapIntensity: 2.8,
    }
  }
  return GLOSSY_ACCENT
}
