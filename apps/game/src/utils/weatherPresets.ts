import type { SessionWeatherPreset } from '@/types/session'

export interface WeatherPresetValues {
  temperature: number
  humidity: number
  precipitationRate: number
  cloudCover: number
}

export function resolveWeatherPreset(preset: SessionWeatherPreset): WeatherPresetValues | null {
  switch (preset) {
    case 'dry':
      return { temperature: 26, humidity: 0.3, precipitationRate: 0, cloudCover: 0.15 }
    case 'wet':
      return { temperature: 14, humidity: 0.92, precipitationRate: 18, cloudCover: 0.85 }
    case 'random': {
      const wet = Math.random() < 0.3
      if (wet) {
        return {
          temperature: 8 + Math.random() * 14,
          humidity: 0.7 + Math.random() * 0.25,
          precipitationRate: 6 + Math.random() * 30,
          cloudCover: 0.6 + Math.random() * 0.4,
        }
      }
      return {
        temperature: 14 + Math.random() * 22,
        humidity: 0.2 + Math.random() * 0.4,
        precipitationRate: 0,
        cloudCover: Math.random() * 0.5,
      }
    }
    case 'current':
    default:
      return null
  }
}
