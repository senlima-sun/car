import {
  LIVERY,
  MATTE_BODY,
  CARBON_FIBER,
  getWeatherBodyMaterial,
  getWeatherAccentMaterial,
} from '../../../../constants/f1Livery'

export const WET_MATERIAL = {
  metalness: 0.95,
  roughness: 0.05,
  envMapIntensity: 2.5,
}

export const DRY_MATERIAL = MATTE_BODY

export const WET_METAL_MATERIAL = {
  metalness: 0.95,
  roughness: 0.08,
  envMapIntensity: 2.0,
}

export const DRY_METAL_MATERIAL = CARBON_FIBER

export const CAR_COLORS = {
  frame: LIVERY.PRIMARY,
  metal: LIVERY.CARBON,
  cockpit: LIVERY.CARBON,
  accent_red: LIVERY.ACCENT_RED,
  accent_yellow: LIVERY.ACCENT_YELLOW,
  primary_light: LIVERY.PRIMARY_LIGHT,
  titanium: LIVERY.TITANIUM,
  carbon: LIVERY.CARBON,
  carbon_light: LIVERY.CARBON_LIGHT,
  white: LIVERY.WHITE,
} as const

export const WHEEL_POSITIONS = {
  frontZ: 1.7,
  rearZ: -1.7,
} as const

export function getBodyMaterial(isRaining: boolean) {
  return getWeatherBodyMaterial(isRaining)
}

export function getAccentMaterial(isRaining: boolean) {
  return getWeatherAccentMaterial(isRaining)
}

export function getMetalMaterial(isRaining: boolean) {
  return isRaining ? WET_METAL_MATERIAL : DRY_METAL_MATERIAL
}
