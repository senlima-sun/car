// Curb physics constants and profile geometry

// Rounded slope profile (cross-section): /\
// x = distance from road edge (0 to CURB_WIDTH)
// y = height at that point
export const CURB_PROFILE = [
  { x: 0, y: 0 }, // Road edge (flush with road)
  { x: 0.4, y: 0.08 }, // Start of rise
  { x: 0.8, y: 0.14 }, // Approaching peak
  { x: 1.0, y: 0.15 }, // Peak height
  { x: 1.2, y: 0.14 }, // Start descending
  { x: 1.6, y: 0.08 }, // Descending
  { x: 2.0, y: 0.02 }, // Outer edge (slight lip)
]

// Curb dimensions
export const CURB_WIDTH = 2 // Width perpendicular to road (meters)
export const CURB_PEAK_HEIGHT = 0.15 // Maximum height at center (meters)

// Physics modifiers when car is on curb
export const CURB_PHYSICS = {
  // Speed reduction - light drag effect (8% reduction)
  speedMultiplier: 0.92,

  // Grip increase - curbs are grippy surfaces (15% increase)
  gripMultiplier: 1.15,

  // Lateral stability - reduces sliding on curb (10% more correction)
  lateralStability: 1.1,

  // Minimum speed to apply curb effects (m/s)
  minSpeedForEffect: 5,

  // Drag force multiplier when on curb
  dragMultiplier: 1.5,
}

// In/out turn modifiers
export const CURB_TURN_MODIFIERS = {
  // Entry curb (outside of turn) - helps stabilize entry
  entry: {
    gripMultiplier: 1.2, // Extra grip for turn-in
    lateralStability: 1.15,
  },

  // Exit curb (inside of turn) - provides traction for exit
  exit: {
    gripMultiplier: 1.1,
    lateralStability: 1.05,
  },
}

// Helper to interpolate height from profile
export function getCurbHeightAt(normalizedX: number): number {
  // normalizedX is 0-1 across curb width
  const x = normalizedX * CURB_WIDTH

  // Find the two profile points to interpolate between
  for (let i = 0; i < CURB_PROFILE.length - 1; i++) {
    const p1 = CURB_PROFILE[i]
    const p2 = CURB_PROFILE[i + 1]

    if (x >= p1.x && x <= p2.x) {
      const t = (x - p1.x) / (p2.x - p1.x)
      return p1.y + t * (p2.y - p1.y)
    }
  }

  return 0
}
