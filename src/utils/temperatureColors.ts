/**
 * Unified temperature-to-color mapping utility
 * Uses absolute Celsius values for consistent visualization across all systems
 * (tires, engine, track/ambient)
 */

// Temperature breakpoints in Celsius
export const TEMP_BREAKPOINTS = {
  veryCold: 10, // Below: deep blue
  cold: 30, // 10-30: light blue
  moderate: 60, // 30-60: green
  warm: 90, // 60-90: orange
  // Above 90: red
} as const

// Color palette (hex strings for CSS)
export const TEMP_COLORS = {
  deepCold: '#1a3399', // rgb(26, 51, 153)
  cold: '#3380e6', // rgb(51, 128, 230)
  moderate: '#33cc4d', // rgb(51, 204, 77)
  warm: '#ff991a', // rgb(255, 153, 26)
  hot: '#ff261a', // rgb(255, 38, 26)
} as const

// RGB values normalized to 0-1 for shader uniforms
export const TEMP_COLORS_RGB = {
  deepCold: [0.102, 0.2, 0.6] as const,
  cold: [0.2, 0.502, 0.902] as const,
  moderate: [0.2, 0.8, 0.302] as const,
  warm: [1.0, 0.6, 0.102] as const,
  hot: [1.0, 0.149, 0.102] as const,
} as const

/**
 * Convert absolute Celsius temperature to a color (hex string)
 * Same temperature = same color regardless of source (tire, engine, track)
 */
export function celsiusToColor(celsius: number): string {
  if (celsius < TEMP_BREAKPOINTS.veryCold) return TEMP_COLORS.deepCold
  if (celsius < TEMP_BREAKPOINTS.cold) return TEMP_COLORS.cold
  if (celsius < TEMP_BREAKPOINTS.moderate) return TEMP_COLORS.moderate
  if (celsius < TEMP_BREAKPOINTS.warm) return TEMP_COLORS.warm
  return TEMP_COLORS.hot
}

/**
 * Linear interpolation helper
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t))
}

/**
 * Interpolate between two RGB colors
 */
function lerpRGB(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

/**
 * Convert absolute Celsius temperature to RGB values (0-1 range)
 * Smooth interpolation between color stops for shader use
 */
export function celsiusToColorRGB(celsius: number): [number, number, number] {
  const { veryCold, cold, moderate, warm } = TEMP_BREAKPOINTS
  const colors = TEMP_COLORS_RGB

  if (celsius < veryCold) {
    // Below very cold - solid deep blue
    return [...colors.deepCold]
  }
  if (celsius < cold) {
    // Deep blue to light blue
    const t = (celsius - veryCold) / (cold - veryCold)
    return lerpRGB(colors.deepCold, colors.cold, t)
  }
  if (celsius < moderate) {
    // Light blue to green
    const t = (celsius - cold) / (moderate - cold)
    return lerpRGB(colors.cold, colors.moderate, t)
  }
  if (celsius < warm) {
    // Green to orange
    const t = (celsius - moderate) / (warm - moderate)
    return lerpRGB(colors.moderate, colors.warm, t)
  }
  // Orange to red (cap at 120C for full red)
  const t = Math.min((celsius - warm) / 30, 1)
  return lerpRGB(colors.warm, colors.hot, t)
}

/**
 * GLSL code for celsiusToColor function
 * Include this in shaders that need temperature visualization
 */
export const celsiusToColorGLSL = /* glsl */ `
vec3 celsiusToColor(float celsius) {
  const float VERY_COLD = 10.0;
  const float COLD = 30.0;
  const float MODERATE = 60.0;
  const float WARM = 90.0;

  vec3 deepCold = vec3(0.102, 0.200, 0.600);
  vec3 cold = vec3(0.200, 0.502, 0.902);
  vec3 moderate = vec3(0.200, 0.800, 0.302);
  vec3 warm = vec3(1.0, 0.600, 0.102);
  vec3 hot = vec3(1.0, 0.149, 0.102);

  if (celsius < VERY_COLD) {
    return deepCold;
  } else if (celsius < COLD) {
    float t = (celsius - VERY_COLD) / (COLD - VERY_COLD);
    return mix(deepCold, cold, t);
  } else if (celsius < MODERATE) {
    float t = (celsius - COLD) / (MODERATE - COLD);
    return mix(cold, moderate, t);
  } else if (celsius < WARM) {
    float t = (celsius - MODERATE) / (WARM - MODERATE);
    return mix(moderate, warm, t);
  } else {
    float t = min((celsius - WARM) / 30.0, 1.0);
    return mix(warm, hot, t);
  }
}
`
