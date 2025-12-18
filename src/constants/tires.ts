// Tire compound types - F1-style naming
export type TireCompound = 'soft' | 'medium' | 'hard' | 'wet' | 'intermediate'

// Tire modifier interface
export interface TireModifiers {
  // Grip multiplier (applied to base grip coefficient)
  gripMultiplier: number
  // Optimal temperature range for this tire [min, max] in Celsius
  optimalTempRange: [number, number]
  // How suitable this tire is for rain (0 = terrible, 1 = designed for rain)
  rainSuitability: number
  // Grip penalty when used in wrong conditions (multiplier, lower = worse)
  wrongConditionsPenalty: number
  // Degradation rate per second of racing (tire wear increase)
  degradationRate: number
  // Display properties
  displayName: string
  color: string // For HUD display
  icon: string // Single character icon
}

// Tire compound configurations
export const TIRE_CONFIG: Record<TireCompound, TireModifiers> = {
  soft: {
    gripMultiplier: 1.15, // Best grip - 15% more than baseline
    optimalTempRange: [25, 45], // Works best in warm/hot conditions
    rainSuitability: 0.0, // Terrible in wet
    wrongConditionsPenalty: 0.25, // Terrible when conditions don't match
    degradationRate: 0.0015, // Degrades fastest (~1.5% per second at max)
    displayName: 'Soft',
    color: '#dc2626', // Red
    icon: 'S',
  },
  medium: {
    gripMultiplier: 1.0, // Baseline grip
    optimalTempRange: [15, 40], // Wide temperature range
    rainSuitability: 0.0, // Bad in wet
    wrongConditionsPenalty: 0.3, // Very bad when conditions don't match
    degradationRate: 0.0008, // Medium degradation
    displayName: 'Medium',
    color: '#eab308', // Yellow
    icon: 'M',
  },
  hard: {
    gripMultiplier: 0.92, // Less grip - 8% less than baseline
    optimalTempRange: [20, 50], // Very wide, tolerates heat
    rainSuitability: 0.0, // Bad in wet
    wrongConditionsPenalty: 0.35, // Bad when conditions don't match
    degradationRate: 0.0004, // Slowest degradation - most durable
    displayName: 'Hard',
    color: '#ffffff', // White
    icon: 'H',
  },
  wet: {
    gripMultiplier: 0.75, // Low grip on dry
    optimalTempRange: [5, 30], // Wide range, needs to handle rain
    rainSuitability: 1.0, // Designed for rain
    wrongConditionsPenalty: 0.5, // Bad on dry
    degradationRate: 0.0008,
    displayName: 'Wet',
    color: '#2563eb', // Blue
    icon: 'W',
  },
  intermediate: {
    gripMultiplier: 0.88, // Balanced for transitional conditions
    optimalTempRange: [0, 25], // Works in cold/mild temps
    rainSuitability: 0.7, // Good in light rain
    wrongConditionsPenalty: 0.7, // Less penalty - versatile
    degradationRate: 0.0006,
    displayName: 'Inter',
    color: '#22c55e', // Green
    icon: 'I',
  },
}

// Default tire compound
export const DEFAULT_TIRE: TireCompound = 'medium'

// Tire wear thresholds
export const TIRE_WEAR_WARNING = 70 // Show warning at 70% wear
export const TIRE_WEAR_CRITICAL = 90 // Critical at 90% wear

// Grip penalty multiplier based on wear (0-100%)
// At 0% wear: 1.0 grip
// At 100% wear: reduced grip
export function getWearGripMultiplier(wearPercent: number): number {
  // Quadratic falloff - grip drops more dramatically as wear increases
  // At 50% wear: ~0.97 grip
  // At 80% wear: ~0.90 grip
  // At 100% wear: ~0.75 grip
  const wearFactor = wearPercent / 100
  return 1 - wearFactor * wearFactor * 0.25
}

// Tire compound order for UI display
export const TIRE_ORDER: TireCompound[] = ['soft', 'medium', 'hard', 'intermediate', 'wet']
