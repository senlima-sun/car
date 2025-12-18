import {
  WeatherCondition,
  TireCompound,
  SurfaceType as WasmSurfaceType,
} from '../../../../wasm'
import { type SurfaceType } from '../../../../stores/useSurfaceStore'

/**
 * Map JS weather string to WASM WeatherCondition enum
 */
export function mapWeatherToWasm(weather: string): WeatherCondition {
  switch (weather) {
    case 'hot':
      return WeatherCondition.Hot
    case 'rain':
      return WeatherCondition.Rain
    case 'cold':
      return WeatherCondition.Cold
    default:
      return WeatherCondition.Dry
  }
}

/**
 * Map JS tire compound string to WASM TireCompound enum
 */
export function mapTireToWasm(compound: string): TireCompound {
  switch (compound) {
    case 'soft':
      return TireCompound.Soft
    case 'hard':
      return TireCompound.Hard
    case 'wet':
      return TireCompound.Wet
    case 'intermediate':
      return TireCompound.Intermediate
    default:
      return TireCompound.Medium
  }
}

/**
 * Map JS surface type to WASM SurfaceType enum
 */
export function mapSurfaceToWasm(surface: SurfaceType): WasmSurfaceType {
  switch (surface) {
    case 'road':
      return WasmSurfaceType.Road
    case 'curb':
      return WasmSurfaceType.Curb
    case 'grass':
    default:
      return WasmSurfaceType.Grass
  }
}
