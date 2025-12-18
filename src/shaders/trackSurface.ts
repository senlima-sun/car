// Track surface shader for temperature/wetness/rubber/ice visualization

export const trackSurfaceVertexShader = /* glsl */ `
varying vec2 vWorldPos;
varying vec2 vUv;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPosition.xz;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`

export const trackSurfaceFragmentShader = /* glsl */ `
uniform sampler2D temperatureMap;
uniform vec2 worldBoundsMin;
uniform vec2 worldBoundsMax;
uniform int weatherType; // 0=dry, 1=hot, 2=rain, 3=cold
uniform float ambientTemp; // 0-1 normalized temperature
uniform float ambientHumidity; // 0-1 humidity
uniform bool heatmapVisible; // Toggle for heatmap visibility

varying vec2 vWorldPos;
varying vec2 vUv;

// Unified Celsius-to-color function (same breakpoints as TypeScript utility)
// Uses absolute Celsius values for consistent visualization across all systems
vec3 celsiusToColor(float celsius) {
  const float VERY_COLD = 10.0;
  const float COLD = 30.0;
  const float MODERATE = 60.0;
  const float WARM = 90.0;

  vec3 deepCold = vec3(0.102, 0.200, 0.600);   // #1a3399
  vec3 cold = vec3(0.200, 0.502, 0.902);       // #3380e6
  vec3 moderate = vec3(0.200, 0.800, 0.302);   // #33cc4d
  vec3 warm = vec3(1.0, 0.600, 0.102);         // #ff991a
  vec3 hot = vec3(1.0, 0.149, 0.102);          // #ff261a

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

void main() {
  // Hide overlay when heatmap is not visible
  if (!heatmapVisible) {
    discard;
  }

  // Map world position to texture UV
  vec2 worldRange = worldBoundsMax - worldBoundsMin;
  vec2 uv = (vWorldPos - worldBoundsMin) / worldRange;

  // Clamp UV to valid range
  uv = clamp(uv, 0.0, 1.0);

  // Sample temperature data
  // R = temperature (car heat), G = wetness, B = rubber (lower 4 bits) + ice (upper 4 bits)
  vec4 tempData = texture2D(temperatureMap, uv);
  float heat = tempData.r;          // Heat from car (0-1)
  float wetness = tempData.g;       // Rain wetness (0-1)

  // Unpack B channel: rubber in lower 4 bits, ice in upper 4 bits
  float bValue = tempData.b * 255.0;
  float rubberPacked = mod(bValue, 16.0) / 15.0;
  float icePacked = floor(bValue / 16.0) / 15.0;

  // Convert ambient temp to Celsius: normalized 0-1 maps to -20C to 50C
  float ambientCelsius = ambientTemp * 70.0 - 20.0;

  // Car heat adds additional temperature (heat 0-1 maps to 0-50C bonus)
  float carHeatCelsius = heat * 50.0;

  // Total track temperature in Celsius
  float totalCelsius = ambientCelsius + carHeatCelsius;

  // Track whether this pixel has car-specific heating
  float hasCarHeat = step(0.01, heat);

  // Start with transparent color
  vec4 color = vec4(0.0, 0.0, 0.0, 0.0);

  // Layer 1: Rubber buildup (purple for tire marks)
  if (rubberPacked > 0.01) {
    // Purple color gradient: darker purple for fresh rubber, lighter for old
    vec3 freshRubber = vec3(0.4, 0.1, 0.5);  // Deep purple
    vec3 oldRubber = vec3(0.6, 0.3, 0.7);    // Lighter purple
    vec3 rubberColor = mix(freshRubber, oldRubber, 1.0 - rubberPacked);
    float rubberAlpha = rubberPacked * 0.85;
    color = mix(color, vec4(rubberColor, rubberAlpha), rubberPacked);
  }

  // Layer 2: Wetness (blue-gray, semi-transparent)
  if (wetness > 0.01) {
    vec3 wetColor = vec3(0.2, 0.3, 0.5);
    float wetAlpha = wetness * 0.5;
    color = mix(color, vec4(wetColor, wetAlpha), wetness * 0.6);

    // Layer 2.5: Reflective puddles (when wetness > 75%)
    const float PUDDLE_THRESHOLD = 0.75;
    if (wetness > PUDDLE_THRESHOLD) {
      float puddleIntensity = (wetness - PUDDLE_THRESHOLD) / (1.0 - PUDDLE_THRESHOLD);

      // Reflective puddle effect
      vec3 puddleColor = vec3(0.3, 0.5, 0.7); // Blue water

      // Simple reflection approximation (sky color mix)
      float reflectivity = 0.6 + puddleIntensity * 0.3;
      vec3 skyReflect = vec3(0.6, 0.7, 0.9);
      puddleColor = mix(puddleColor, skyReflect, reflectivity * 0.5);

      // Add subtle highlight variation for more realistic water
      float highlightNoise = fract(sin(dot(vWorldPos * 0.5, vec2(12.9898, 78.233))) * 43758.5453);
      puddleColor += vec3(0.1) * highlightNoise * puddleIntensity;

      color = mix(color, vec4(puddleColor, 0.6), puddleIntensity);
    }
  }

  // Layer 3: Ice (white/light blue crystalline, on top of wet)
  if (icePacked > 0.01) {
    vec3 iceColor = vec3(0.8, 0.9, 1.0);
    float iceAlpha = icePacked * 0.6;
    color = mix(color, vec4(iceColor, iceAlpha), icePacked * 0.7);
  }

  // Layer 4: Temperature (5-stage gradient, on top)
  // Use unified Celsius-based color function
  vec3 heatColor = celsiusToColor(totalCelsius);

  // Always show ambient temperature at a visible opacity
  // Areas with car heat get slightly higher intensity
  float baseAlpha = mix(0.45, 0.65, hasCarHeat);
  // Higher mix factor so ambient is always visible
  float mixFactor = mix(0.85, 0.95, hasCarHeat);
  color = mix(color, vec4(heatColor, baseAlpha), mixFactor);

  gl_FragColor = color;
}
`

// Weather type enum for shader uniform
export const WEATHER_TYPE_MAP = {
  dry: 0,
  hot: 1,
  rain: 2,
  cold: 3,
} as const

export type ShaderWeatherType = keyof typeof WEATHER_TYPE_MAP
