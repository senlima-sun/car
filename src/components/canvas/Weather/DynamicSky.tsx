import { ATMOSPHERE_CONFIG, AtmosphereConfig } from '../../../constants/weather'
import HdriSky from './HdriSky'

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpAtmosphere(from: AtmosphereConfig, to: AtmosphereConfig, t: number): AtmosphereConfig {
  return {
    skyTurbidity: lerp(from.skyTurbidity, to.skyTurbidity, t),
    skyRayleigh: lerp(from.skyRayleigh, to.skyRayleigh, t),
    skyMieCoefficient: lerp(from.skyMieCoefficient, to.skyMieCoefficient, t),
    skyMieDirectionalG: lerp(from.skyMieDirectionalG, to.skyMieDirectionalG, t),
    sunPosition: [
      lerp(from.sunPosition[0], to.sunPosition[0], t),
      lerp(from.sunPosition[1], to.sunPosition[1], t),
      lerp(from.sunPosition[2], to.sunPosition[2], t),
    ],
    ambientIntensity: lerp(from.ambientIntensity, to.ambientIntensity, t),
    sunIntensity: lerp(from.sunIntensity, to.sunIntensity, t),
    sunColor: to.sunColor,
    fillLightIntensity: lerp(from.fillLightIntensity, to.fillLightIntensity, t),
    fillLightColor: to.fillLightColor,
    hemisphereIntensity: lerp(from.hemisphereIntensity, to.hemisphereIntensity, t),
    hemisphereSkyColor: to.hemisphereSkyColor,
    hemisphereGroundColor: to.hemisphereGroundColor,
    fogColor: to.fogColor,
    fogNear: lerp(from.fogNear, to.fogNear, t),
    fogFar: lerp(from.fogFar, to.fogFar, t),
  }
}

function computeAtmosphereFromDynamic(
  temperature: number,
  rainIntensity: number,
): AtmosphereConfig {
  let baseConfig = ATMOSPHERE_CONFIG.dry
  let blendTarget: AtmosphereConfig | null = null
  let blendFactor = 0

  if (temperature < 0) {
    baseConfig = ATMOSPHERE_CONFIG.cold
    blendTarget = ATMOSPHERE_CONFIG.dry
    blendFactor = Math.max(0, (temperature + 10) / 10)
  } else if (temperature > 35) {
    baseConfig = ATMOSPHERE_CONFIG.dry
    blendTarget = ATMOSPHERE_CONFIG.hot
    blendFactor = Math.min(1, (temperature - 35) / 15)
  }

  let result = blendTarget ? lerpAtmosphere(baseConfig, blendTarget, blendFactor) : baseConfig

  if (rainIntensity > 0.01) {
    result = lerpAtmosphere(result, ATMOSPHERE_CONFIG.rain, rainIntensity)
  }

  return result
}

export default function DynamicSky() {
  return <HdriSky />
}

export { lerp, lerpAtmosphere, computeAtmosphereFromDynamic }
